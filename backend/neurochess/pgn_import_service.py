from __future__ import annotations

import hashlib
import io
import json
import re
from contextlib import closing
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import chess
import chess.pgn

from neurochess.data.database import get_connection
from neurochess.opening_service import OpeningService


VALID_PLATFORMS = {"chesscom", "lichess", "unknown", None}
HISTORY_SCOPES = {"mine", "imported", "local", "ai", "observed", "all"}
HISTORY_MIN_REVIEW_HALF_MOVES = 10
STANDARD_VARIANT = "Standard"
FROM_POSITION_VARIANT = "From Position"
SUPPORTED_VARIANTS = {STANDARD_VARIANT.casefold(), FROM_POSITION_VARIANT.casefold()}
STANDARD_INITIAL_FEN = chess.STARTING_FEN
IMPORT_SCHEMA_VERSION = "pgn_import_from_position_v2"
CHESSCOM_GAME_ID_RE = re.compile(
    r"chess\.com/(?:analysis/)?game/(?:live|daily|computer)/(\d+)",
    re.IGNORECASE,
)
LICHESS_GAME_ID_RE = re.compile(
    r"lichess\.org/(?:analysis/)?([A-Za-z0-9]{8,12})(?:[/?#]|$)",
    re.IGNORECASE,
)


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


@dataclass(frozen=True)
class ParsedPgnMove:
    ply: int
    fen_before: str
    fen_after: str
    uci: str
    san: str
    white_clock_ms: int | None
    black_clock_ms: int | None
    time_spent_ms: int | None
    clock_source: str | None


@dataclass(frozen=True)
class ParsedPgnGame:
    headers: dict[str, str]
    white_name: str | None
    black_name: str | None
    result: str | None
    date_played: str | None
    time_control: str | None
    white_elo: int | None
    black_elo: int | None
    eco_code_pgn: str | None
    opening_name_pgn: str | None
    termination: str | None
    source_url: str | None
    source_game_id: str | None
    source_platform: str
    initial_fen: str
    current_position_fen: str | None
    variant: str
    import_warnings: tuple[str, ...]
    moves: list[ParsedPgnMove]
    moves_uci_hash: str
    pgn_text: str


class PgnImportService:
    def __init__(self, db_path: str | Path | None = None) -> None:
        self.db_path = db_path

    def preview_import(self, pgn_text: str) -> dict[str, Any]:
        parsed_games, errors = parse_pgn_games(pgn_text)
        duplicate_count = 0
        sample_games: list[dict[str, Any]] = []
        detected_players: set[str] = set()

        with closing(get_connection(self.db_path)) as connection:
            known_aliases = _known_aliases(connection)
            for parsed in parsed_games:
                if _is_duplicate(connection, parsed, parsed.source_platform):
                    duplicate_count += 1
                if parsed.white_name:
                    detected_players.add(parsed.white_name)
                if parsed.black_name:
                    detected_players.add(parsed.black_name)
                if len(sample_games) < 5:
                    sample_games.append(_sample_payload(parsed))

        normalized_players = {
            normalize_username(player)
            for player in detected_players
            if normalize_username(player)
        }
        needs_user_alias = bool(normalized_players and not normalized_players.intersection(known_aliases))

        return {
            "game_count": len(parsed_games) + len(errors),
            "valid_count": len(parsed_games),
            "invalid_count": len(errors),
            "duplicate_count": duplicate_count,
            "detected_players": sorted(detected_players, key=str.lower),
            "needs_user_alias": needs_user_alias,
            "sample_games": sample_games,
            "errors": errors,
        }

    def import_pgn(
        self,
        pgn_text: str,
        user_alias: str | None = None,
        platform: str | None = "unknown",
    ) -> dict[str, Any]:
        if platform not in VALID_PLATFORMS:
            platform = "unknown"

        parsed_games, errors = parse_pgn_games(pgn_text)
        imported_game_ids: list[int] = []
        repaired_game_ids: list[int] = []
        duplicate_count = 0
        classified_count = 0
        warnings: list[str] = []

        with closing(get_connection(self.db_path)) as connection:
            connection.execute("BEGIN")
            try:
                if user_alias:
                    _upsert_user_alias(connection, user_alias, platform)

                aliases = _aliases_for_import(connection, user_alias, platform)
                for parsed in parsed_games:
                    effective_platform = _effective_platform(platform, parsed)
                    existing = _find_duplicate_game(connection, parsed, effective_platform)
                    if existing is not None:
                        if _needs_legacy_repair(connection, existing, parsed, effective_platform):
                            user_color = _user_color_for_game(parsed, aliases)
                            opponent_name = _opponent_name(parsed, user_color)
                            result_from_user_pov = _result_from_user_pov(
                                parsed.result,
                                user_color,
                            )
                            repaired_game_ids.append(
                                _repair_imported_game(
                                    connection=connection,
                                    game_id=int(existing["id"]),
                                    parsed=parsed,
                                    platform=effective_platform,
                                    user_color=user_color,
                                    opponent_name=opponent_name,
                                    result_from_user_pov=result_from_user_pov,
                                )
                            )
                        else:
                            duplicate_count += 1
                        continue

                    if _is_duplicate(connection, parsed, effective_platform):
                        duplicate_count += 1
                        continue

                    user_color = _user_color_for_game(parsed, aliases)
                    opponent_name = _opponent_name(parsed, user_color)
                    result_from_user_pov = _result_from_user_pov(parsed.result, user_color)
                    game_id = _insert_imported_game(
                        connection=connection,
                        parsed=parsed,
                        platform=effective_platform,
                        user_color=user_color,
                        opponent_name=opponent_name,
                        result_from_user_pov=result_from_user_pov,
                    )
                    _insert_imported_moves(connection, game_id, parsed.moves)
                    imported_game_ids.append(game_id)
                connection.commit()
            except Exception:
                connection.rollback()
                raise

        opening_service = OpeningService(self.db_path)
        for game_id in [*imported_game_ids, *repaired_game_ids]:
            try:
                opening_service.classify_game_opening(game_id)
                classified_count += 1
            except Exception as exc:
                warnings.append(f"opening_classification_failed:{game_id}:{exc}")

        return {
            "status": "ok",
            "imported_count": len(imported_game_ids),
            "duplicate_count": duplicate_count,
            "invalid_count": len(errors),
            "classified_count": classified_count,
            "warnings": warnings,
            "imported_game_ids": imported_game_ids,
            "repaired_count": len(repaired_game_ids),
            "repaired_game_ids": repaired_game_ids,
            "import_schema_version": IMPORT_SCHEMA_VERSION,
        }

    def game_diagnostics(self, game_id: int) -> dict[str, Any]:
        with closing(get_connection(self.db_path)) as connection:
            return _game_diagnostics_payload(connection, game_id)

    def history(
        self,
        limit: int = 50,
        offset: int = 0,
        scope: str = "mine",
    ) -> list[dict[str, Any]]:
        safe_limit = max(1, min(int(limit), 200))
        safe_offset = max(0, int(offset))
        safe_scope = scope if scope in HISTORY_SCOPES else "mine"
        with closing(get_connection(self.db_path)) as connection:
            rows = connection.execute(
                """
            SELECT
                    g.id AS game_id,
                    COALESCE(g.game_category, '') AS game_category,
                    g.opponent_type,
                    COALESCE(g.source, 'local') AS source,
                    g.source_platform,
                    g.source_url,
                    g.source_game_id,
                    g.initial_fen,
                    g.current_position_fen,
                    g.variant,
                    g.import_status,
                    g.import_warnings_json,
                    g.import_error,
                    g.import_schema_version,
                    g.date_played,
                    g.created_at,
                    g.completed_at,
                    g.mode,
                    g.white_name,
                    g.black_name,
                    g.user_color,
                    g.opponent_name,
                    g.result,
                    g.result_from_user_pov,
                    g.white_elo,
                    g.black_elo,
                    g.time_control,
                    COALESCE(c.opening_name, g.opening_name_pgn) AS opening_name,
                    COALESCE(c.eco_code, g.eco_code_pgn) AS eco_code,
                    COALESCE(c.classification_status, 'unknown') AS classification_status,
                    (
                        SELECT COUNT(*)
                        FROM moves m
                        WHERE m.game_id = g.id
                    ) AS move_count,
                    (
                        SELECT gr.status
                        FROM game_reviews gr
                        WHERE gr.game_id = g.id
                        ORDER BY gr.id DESC
                        LIMIT 1
                    ) AS review_status,
                    (
                        SELECT COUNT(*)
                        FROM review_moments rm
                        WHERE rm.review_id = (
                            SELECT gr2.id
                            FROM game_reviews gr2
                            WHERE gr2.game_id = g.id
                            ORDER BY gr2.id DESC
                            LIMIT 1
                        )
                    ) AS review_moment_count
                FROM games g
                LEFT JOIN game_opening_classifications c
                    ON c.game_id = g.id
                WHERE g.completed = 1
                ORDER BY
                    COALESCE(g.date_played, g.completed_at, g.created_at) DESC,
                    g.id DESC
                """,
            ).fetchall()

        scoped_items = [
            item
            for item in (_history_payload(row) for row in rows)
            if _history_scope_allows(safe_scope, item)
        ]
        return scoped_items[safe_offset : safe_offset + safe_limit]


def parse_pgn_games(pgn_text: str) -> tuple[list[ParsedPgnGame], list[str]]:
    stream = io.StringIO(pgn_text or "")
    parsed_games: list[ParsedPgnGame] = []
    errors: list[str] = []
    game_index = 0

    while True:
        try:
            game = chess.pgn.read_game(stream)
        except Exception as exc:
            errors.append(f"game_{game_index + 1}: parse_error: {exc}")
            break

        if game is None:
            break

        game_index += 1
        if getattr(game, "errors", None):
            errors.append(f"game_{game_index}: {game.errors[0]}")
            continue

        try:
            parsed_games.append(_parse_game(game))
        except Exception as exc:
            errors.append(f"game_{game_index}: {exc}")

    return parsed_games, errors


def normalize_username(username: str | None) -> str:
    return " ".join((username or "").strip().casefold().split())


def time_control_category(time_control: str | None) -> str:
    if not time_control:
        return "unknown"
    try:
        base_seconds = int(str(time_control).split("+", 1)[0])
    except (TypeError, ValueError):
        return "unknown"
    if base_seconds <= 0:
        return "unknown"
    if base_seconds < 180:
        return "bullet"
    if base_seconds < 600:
        return "blitz"
    if base_seconds < 1800:
        return "rapid"
    return "classical"


def _history_payload(row: Any) -> dict[str, Any]:
    data = dict(row)
    move_count = int(data.get("move_count") or 0)
    category = _history_game_category(data)
    import_status = data.get("import_status") or "ok"
    reviewable = move_count > HISTORY_MIN_REVIEW_HALF_MOVES and import_status == "ok"
    review_status = data.get("review_status")
    review_moment_count = int(data.get("review_moment_count") or 0)
    time_category = time_control_category(data.get("time_control"))

    return {
        "game_id": data["game_id"],
        "game_category": category,
        "opponent_type": data.get("opponent_type") or "unknown",
        "source": data.get("source") or "local",
        "source_platform": data.get("source_platform"),
        "source_url": data.get("source_url"),
        "source_game_id": data.get("source_game_id"),
        "initial_fen": data.get("initial_fen") or STANDARD_INITIAL_FEN,
        "current_position_fen": data.get("current_position_fen"),
        "variant": data.get("variant") or STANDARD_VARIANT,
        "import_status": import_status,
        "import_warnings": _parse_warning_list(data.get("import_warnings_json")),
        "import_error": data.get("import_error"),
        "import_schema_version": data.get("import_schema_version"),
        "is_special_position": (data.get("initial_fen") or STANDARD_INITIAL_FEN) != STANDARD_INITIAL_FEN,
        "date_played": data.get("date_played"),
        "white_name": _clean_display_value(data.get("white_name")),
        "black_name": _clean_display_value(data.get("black_name")),
        "display_title": _history_display_title(data, category),
        "display_subtitle": _history_display_subtitle(data, category, time_category),
        "user_color": data.get("user_color"),
        "opponent_name": _clean_display_value(data.get("opponent_name")),
        "result": data.get("result"),
        "result_from_user_pov": data.get("result_from_user_pov"),
        "white_elo": data.get("white_elo"),
        "black_elo": data.get("black_elo"),
        "time_control": data.get("time_control"),
        "time_control_category": time_category,
        "move_count": move_count,
        "opening_name": _clean_display_value(data.get("opening_name")),
        "eco_code": _clean_display_value(data.get("eco_code")),
        "classification_status": data.get("classification_status") or "unknown",
        "review_status": review_status,
        "review_summary_status": _history_review_summary_status(
            review_status=review_status,
            review_moment_count=review_moment_count,
            is_reviewable=reviewable,
        ),
        "is_reviewable": reviewable,
        "metadata_quality": _history_metadata_quality(data, category, move_count),
    }


def _game_diagnostics_payload(connection: Any, game_id: int) -> dict[str, Any]:
    game = connection.execute(
        """
        SELECT
            g.*,
            c.classification_status AS opening_status,
            c.opening_name AS classified_opening_name,
            c.eco_code AS classified_eco_code
        FROM games g
        LEFT JOIN game_opening_classifications c ON c.game_id = g.id
        WHERE g.id = ?
        """,
        (game_id,),
    ).fetchone()
    if game is None:
        raise ValueError("game not found")

    moves = connection.execute(
        """
        SELECT *
        FROM moves
        WHERE game_id = ?
        ORDER BY ply, id
        """,
        (game_id,),
    ).fetchall()
    first_move = moves[0] if moves else None
    last_move = moves[-1] if moves else None
    initial_fen = (
        _row_value(game, "initial_fen")
        or (first_move["fen_before"] if first_move is not None else None)
        or STANDARD_INITIAL_FEN
    )
    replay = _replay_from_initial_fen(initial_fen, moves)
    import_status = _row_value(game, "import_status", "ok") or "ok"
    can_open = import_status == "ok" and replay["ok"]
    can_analyze = can_open and len(moves) > HISTORY_MIN_REVIEW_HALF_MOVES
    history_payload_ok = bool(game["id"]) and bool(
        _clean_display_value(_row_value(game, "white_name"))
    ) and bool(_clean_display_value(_row_value(game, "black_name")))

    return {
        "local_game_id": int(game["id"]),
        "external_source": _row_value(game, "source_platform"),
        "external_game_id": _row_value(game, "source_game_id"),
        "source_url": _row_value(game, "source_url"),
        "variant": _row_value(game, "variant") or STANDARD_VARIANT,
        "initial_fen": initial_fen,
        "is_initial_fen_standard": initial_fen == STANDARD_INITIAL_FEN,
        "current_position_fen": _row_value(game, "current_position_fen"),
        "import_status": import_status,
        "import_warnings": _parse_warning_list(_row_value(game, "import_warnings_json")),
        "import_error": _row_value(game, "import_error"),
        "import_schema_version": _row_value(game, "import_schema_version"),
        "move_count": len(moves),
        "first_move_san": first_move["san"] if first_move is not None else None,
        "last_move_san": last_move["san"] if last_move is not None else None,
        "first_fen_before": first_move["fen_before"] if first_move is not None else None,
        "last_fen_after": replay["last_fen_after"],
        "opening_status": _row_value(game, "opening_status", "unknown") or "unknown",
        "can_open": can_open,
        "can_analyze": can_analyze,
        "replay_from_initial_fen_ok": replay["ok"],
        "replay_error_ply": replay["error_ply"],
        "replay_error_san": replay["error_san"],
        "replay_error_fen_before": replay["error_fen_before"],
        "replay_error_message": replay["error_message"],
        "history_payload_ok": history_payload_ok,
        "review_start_ok_if_fake_engine": can_analyze,
    }


def _replay_from_initial_fen(initial_fen: str, moves: list[Any]) -> dict[str, Any]:
    try:
        board = chess.Board(initial_fen)
    except ValueError as exc:
        return {
            "ok": False,
            "last_fen_after": None,
            "error_ply": 0,
            "error_san": None,
            "error_fen_before": initial_fen,
            "error_message": f"invalid_initial_fen:{exc}",
        }
    if not board.is_valid():
        return {
            "ok": False,
            "last_fen_after": None,
            "error_ply": 0,
            "error_san": None,
            "error_fen_before": initial_fen,
            "error_message": "invalid_initial_fen:board_is_not_valid",
        }

    for move_row in moves:
        expected_fen = str(move_row["fen_before"])
        if board.fen() != expected_fen:
            return {
                "ok": False,
                "last_fen_after": board.fen(),
                "error_ply": int(move_row["ply"]),
                "error_san": move_row["san"],
                "error_fen_before": expected_fen,
                "error_message": "fen_before_mismatch",
            }
        try:
            move = chess.Move.from_uci(str(move_row["uci"]))
        except ValueError as exc:
            return {
                "ok": False,
                "last_fen_after": board.fen(),
                "error_ply": int(move_row["ply"]),
                "error_san": move_row["san"],
                "error_fen_before": expected_fen,
                "error_message": f"invalid_uci:{exc}",
            }
        if move not in board.legal_moves:
            return {
                "ok": False,
                "last_fen_after": board.fen(),
                "error_ply": int(move_row["ply"]),
                "error_san": move_row["san"],
                "error_fen_before": expected_fen,
                "error_message": "illegal_move",
            }
        board.push(move)

    return {
        "ok": True,
        "last_fen_after": board.fen(),
        "error_ply": None,
        "error_san": None,
        "error_fen_before": None,
        "error_message": None,
    }


def _history_game_category(data: dict[str, Any]) -> str:
    explicit = str(data.get("game_category") or "").strip()
    if explicit:
        return explicit
    source = data.get("source") or "local"
    opponent_type = str(data.get("opponent_type") or "").strip()
    if source == "pgn_import":
        return "imported_user" if data.get("user_color") else "imported_observed"
    if opponent_type in {"engine", "bot"}:
        return "local_ai"
    if source in {"local", None}:
        return "local_manual"
    return "unknown"


def _history_scope_allows(scope: str, item: dict[str, Any]) -> bool:
    category = item["game_category"]
    if scope == "all":
        return True
    if scope == "mine":
        return category in {"imported_user", "local_manual", "local_ai"}
    if scope == "imported":
        return category in {"imported_user", "imported_observed"}
    if scope == "local":
        return category == "local_manual"
    if scope == "ai":
        return category == "local_ai"
    if scope == "observed":
        return category == "imported_observed"
    return False


def _history_display_title(data: dict[str, Any], category: str) -> str:
    white = _clean_display_value(data.get("white_name"))
    black = _clean_display_value(data.get("black_name"))
    if category in {"imported_user", "imported_observed"} and white and black:
        return f"{white} vs {black}"
    if category == "imported_user":
        if white and black:
            return f"{white} vs {black}"
        return "Partie importée"
    if category == "imported_observed":
        return "Partie observée"
    if category == "local_manual":
        return "Partie locale"
    if category == "local_ai":
        return "Partie contre IA"
    return "Position locale non identifiée"


def _history_display_subtitle(
    data: dict[str, Any],
    category: str,
    time_category: str,
) -> str:
    if category == "local_manual":
        return "NeuroChess · Partie jouée localement"
    if category == "local_ai":
        return "NeuroChess · Partie contre IA"
    if category == "imported_observed":
        return f"{_source_label(data)} · joueurs non associés à votre profil"
    if category in {"analysis_sandbox", "unknown"}:
        return "Données incomplètes"

    parts = [_source_label(data)]
    time_control = data.get("time_control")
    if time_control:
        parts.append(f"{_time_category_label(time_category)} {time_control}")
    date_played = data.get("date_played")
    if date_played:
        parts.append(str(date_played))
    return " · ".join(parts)


def _history_review_summary_status(
    review_status: str | None,
    review_moment_count: int,
    is_reviewable: bool,
) -> str:
    if not is_reviewable:
        return "too_short"
    if review_status in {"done", "partial"}:
        return "review_available" if review_moment_count > 0 else "no_significant_moments"
    if review_status == "pending":
        return "analysis_in_progress"
    if review_status in {"failed", "stalled"}:
        return "analysis_failed"
    return "not_analyzed"


def _history_metadata_quality(
    data: dict[str, Any],
    category: str,
    move_count: int,
) -> str:
    if category in {"analysis_sandbox", "unknown"}:
        return "poor"
    if move_count <= 0:
        return "poor"
    if category.startswith("imported"):
        has_names = bool(_clean_display_value(data.get("white_name"))) and bool(
            _clean_display_value(data.get("black_name"))
        )
        return "complete" if has_names and data.get("date_played") else "partial"
    return "complete"


def _clean_display_value(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    if not text or text == "?":
        return None
    return text


def _parse_warning_list(value: Any) -> list[str]:
    if not value:
        return []
    try:
        parsed = json.loads(str(value))
    except json.JSONDecodeError:
        return [str(value)]
    if not isinstance(parsed, list):
        return []
    return [str(item) for item in parsed if str(item).strip()]


def _row_value(row: Any, key: str, default: Any = None) -> Any:
    try:
        keys = row.keys()
    except AttributeError:
        return default
    return row[key] if key in keys else default


def _source_label(data: dict[str, Any]) -> str:
    platform = str(data.get("source_platform") or "").strip().casefold()
    source = str(data.get("source") or "local").strip().casefold()
    if platform == "chesscom":
        return "Chess.com"
    if platform == "lichess":
        return "Lichess"
    if source == "pgn_import":
        return "PGN"
    if source == "local":
        return "NeuroChess"
    return "Source inconnue"


def _time_category_label(category: str) -> str:
    return {
        "bullet": "Bullet",
        "blitz": "Blitz",
        "rapid": "Rapid",
        "classical": "Classical",
    }.get(category, "Cadence inconnue")


def _parse_game(game: chess.pgn.Game) -> ParsedPgnGame:
    headers = {str(key): str(value) for key, value in game.headers.items()}
    variant = _variant_from_headers(headers)
    if variant.casefold() not in SUPPORTED_VARIANTS:
        raise ValueError(f"unsupported variant: {variant}")

    initial_fen = _initial_fen_from_headers(headers, variant)
    board = chess.Board(initial_fen)
    current_position_fen, import_warnings = _current_position_fen_from_headers(headers)
    moves: list[ParsedPgnMove] = []
    uci_moves: list[str] = []
    previous_clock_ms: dict[chess.Color, int] = {}

    for ply, node in enumerate(game.mainline(), start=1):
        move = node.move
        if move not in board.legal_moves:
            raise ValueError(f"illegal move at ply {ply}: {move.uci()}")

        fen_before = board.fen()
        san = board.san(move)
        played_by = board.turn
        clock_ms = _clock_ms(node)
        time_spent_ms: int | None = None
        if clock_ms is not None and played_by in previous_clock_ms:
            elapsed = previous_clock_ms[played_by] - clock_ms
            time_spent_ms = elapsed if elapsed >= 0 else None
        if clock_ms is not None:
            previous_clock_ms[played_by] = clock_ms

        board.push(move)
        uci = move.uci()
        uci_moves.append(uci)
        moves.append(
            ParsedPgnMove(
                ply=ply,
                fen_before=fen_before,
                fen_after=board.fen(),
                uci=uci,
                san=san,
                white_clock_ms=clock_ms if played_by == chess.WHITE else None,
                black_clock_ms=clock_ms if played_by == chess.BLACK else None,
                time_spent_ms=time_spent_ms,
                clock_source="pgn_clk" if clock_ms is not None else None,
            )
        )

    if not moves:
        raise ValueError("no mainline moves")

    moves_uci_hash = _moves_hash(uci_moves)
    source_url = _source_url(headers)
    source_platform = _detect_source_platform(headers, source_url)
    pgn_text = str(game)
    return ParsedPgnGame(
        headers=headers,
        white_name=_optional_header(headers, "White"),
        black_name=_optional_header(headers, "Black"),
        result=_optional_header(headers, "Result"),
        date_played=_date_header(headers),
        time_control=_optional_header(headers, "TimeControl"),
        white_elo=_optional_int(_optional_header(headers, "WhiteElo")),
        black_elo=_optional_int(_optional_header(headers, "BlackElo")),
        eco_code_pgn=_optional_header(headers, "ECO"),
        opening_name_pgn=_optional_header(headers, "Opening"),
        termination=_optional_header(headers, "Termination"),
        source_url=source_url,
        source_game_id=_source_game_id(
            headers=headers,
            source_platform=source_platform,
            source_url=source_url,
            moves_uci_hash=moves_uci_hash,
            initial_fen=initial_fen,
        ),
        source_platform=source_platform,
        initial_fen=initial_fen,
        current_position_fen=current_position_fen,
        variant=variant,
        import_warnings=tuple(import_warnings),
        moves=moves,
        moves_uci_hash=moves_uci_hash,
        pgn_text=pgn_text,
    )


def _clock_ms(node: chess.pgn.GameNode) -> int | None:
    try:
        clock_seconds = node.clock()
    except Exception:
        return None
    if clock_seconds is None:
        return None
    return int(round(float(clock_seconds) * 1000))


def _moves_hash(uci_moves: list[str]) -> str:
    return hashlib.sha256(" ".join(uci_moves).encode("utf-8")).hexdigest()


def _optional_header(headers: dict[str, str], key: str) -> str | None:
    value = headers.get(key)
    if value is None:
        return None
    stripped = value.strip()
    if not stripped or stripped == "?":
        return None
    return stripped


def _variant_from_headers(headers: dict[str, str]) -> str:
    variant = _optional_header(headers, "Variant")
    if variant is None:
        return STANDARD_VARIANT
    if variant.casefold() == FROM_POSITION_VARIANT.casefold():
        return FROM_POSITION_VARIANT
    if variant.casefold() in {"standard", "chess"}:
        return STANDARD_VARIANT
    return variant


def _initial_fen_from_headers(headers: dict[str, str], variant: str) -> str:
    setup = _optional_header(headers, "SetUp")
    fen_header = _optional_header(headers, "FEN")
    if setup == "1":
        if fen_header is None:
            raise ValueError("SetUp=1 requires FEN header")
        return _validated_fen(fen_header, "initial_fen")
    if variant.casefold() == FROM_POSITION_VARIANT.casefold():
        raise ValueError("Variant=From Position requires SetUp=1 and FEN")
    return STANDARD_INITIAL_FEN


def _current_position_fen_from_headers(
    headers: dict[str, str],
) -> tuple[str | None, list[str]]:
    value = _optional_header(headers, "CurrentPosition")
    if value is None:
        return None, []
    try:
        return _validated_fen(value, "current_position_fen"), []
    except ValueError as exc:
        return None, [f"ignored_invalid_current_position:{exc}"]


def _validated_fen(fen: str, field_name: str) -> str:
    try:
        board = chess.Board(fen)
    except ValueError as exc:
        raise ValueError(f"invalid {field_name}: {exc}") from exc
    if not board.is_valid():
        raise ValueError(f"invalid {field_name}: board is not valid")
    return board.fen()


def _date_header(headers: dict[str, str]) -> str | None:
    value = _optional_header(headers, "Date") or _optional_header(headers, "UTCDate")
    if value is None:
        return None
    return value.replace("????", "unknown")


def _optional_int(value: str | None) -> int | None:
    if value is None:
        return None
    try:
        return int(value)
    except ValueError:
        return None


def _source_url(headers: dict[str, str]) -> str | None:
    for key in ("Link", "URL", "Site"):
        value = _optional_header(headers, key)
        if value and value.lower().startswith(("http://", "https://")):
            return value
    return None


def _detect_source_platform(headers: dict[str, str], source_url: str | None) -> str:
    haystack = " ".join(
        str(value)
        for value in (
            source_url,
            _optional_header(headers, "Link"),
            _optional_header(headers, "URL"),
            _optional_header(headers, "Site"),
        )
        if value
    ).casefold()
    if "chess.com" in haystack:
        return "chesscom"
    if "lichess.org" in haystack:
        return "lichess"
    return "unknown"


def _source_game_id(
    headers: dict[str, str],
    source_platform: str,
    source_url: str | None,
    moves_uci_hash: str,
    initial_fen: str,
) -> str:
    explicit = _optional_header(headers, "GameId") or _optional_header(headers, "GameID")
    if explicit:
        return explicit

    candidate_urls = [
        value
        for value in (
            source_url,
            _optional_header(headers, "Link"),
            _optional_header(headers, "URL"),
            _optional_header(headers, "Site"),
        )
        if value
    ]
    if source_platform == "chesscom":
        for value in candidate_urls:
            matched = CHESSCOM_GAME_ID_RE.search(value)
            if matched:
                return matched.group(1)
    if source_platform == "lichess":
        for value in candidate_urls:
            matched = LICHESS_GAME_ID_RE.search(value)
            if matched:
                return matched.group(1)

    stable_seed = "|".join(
        [
            source_platform,
            _optional_header(headers, "White") or "",
            _optional_header(headers, "Black") or "",
            _date_header(headers) or "",
            _optional_header(headers, "Result") or "",
            initial_fen,
            moves_uci_hash,
        ]
    )
    return f"hash:{hashlib.sha256(stable_seed.encode('utf-8')).hexdigest()[:20]}"


def _sample_payload(parsed: ParsedPgnGame) -> dict[str, Any]:
    return {
        "white": parsed.white_name,
        "black": parsed.black_name,
        "date": parsed.date_played,
        "result": parsed.result,
        "time_control": parsed.time_control,
        "eco": parsed.eco_code_pgn,
        "opening": parsed.opening_name_pgn,
        "source_platform": parsed.source_platform,
        "variant": parsed.variant,
        "is_special_position": parsed.initial_fen != STANDARD_INITIAL_FEN,
    }


def _known_aliases(connection: Any) -> set[str]:
    rows = connection.execute("SELECT username_normalized FROM user_aliases").fetchall()
    return {str(row["username_normalized"]) for row in rows}


def _aliases_for_import(
    connection: Any,
    user_alias: str | None,
    platform: str | None,
) -> set[str]:
    aliases = _known_aliases(connection)
    if user_alias:
        aliases.add(normalize_username(user_alias))
    if platform:
        rows = connection.execute(
            """
            SELECT username_normalized
            FROM user_aliases
            WHERE platform = ?
               OR platform IS NULL
            """,
            (platform,),
        ).fetchall()
        aliases.update(str(row["username_normalized"]) for row in rows)
    return {alias for alias in aliases if alias}


def _upsert_user_alias(connection: Any, username: str, platform: str | None) -> None:
    normalized = normalize_username(username)
    if not normalized:
        return
    now = _utc_now()
    connection.execute(
        """
        INSERT INTO user_aliases (
            username,
            username_normalized,
            platform,
            created_at,
            updated_at
        )
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(username_normalized, platform) DO UPDATE SET
            username = excluded.username,
            updated_at = excluded.updated_at
        """,
        (username.strip(), normalized, platform, now, now),
    )


def _effective_platform(platform: str | None, parsed: ParsedPgnGame) -> str:
    if platform in {"chesscom", "lichess"}:
        return platform
    return parsed.source_platform or "unknown"


def _is_duplicate(
    connection: Any,
    parsed: ParsedPgnGame,
    platform: str | None,
) -> bool:
    return _find_duplicate_game(connection, parsed, platform) is not None


def _find_duplicate_game(
    connection: Any,
    parsed: ParsedPgnGame,
    platform: str | None,
) -> Any | None:
    effective_platform = platform or parsed.source_platform or "unknown"
    if parsed.source_game_id:
        existing = connection.execute(
            """
            SELECT *
            FROM games
            WHERE COALESCE(source_platform, 'unknown') = ?
              AND source_game_id = ?
            LIMIT 1
            """,
            (effective_platform, parsed.source_game_id),
        ).fetchone()
        if existing is not None:
            return existing

    if parsed.source_url:
        existing = connection.execute(
            """
            SELECT *
            FROM games
            WHERE source_url = ?
            LIMIT 1
            """,
            (parsed.source_url,),
        ).fetchone()
        if existing is not None:
            return existing

    existing = connection.execute(
        """
        SELECT *
        FROM games
        WHERE lower(trim(COALESCE(white_name, ''))) = ?
          AND lower(trim(COALESCE(black_name, ''))) = ?
          AND COALESCE(date_played, '') = COALESCE(?, '')
          AND COALESCE(result, '') = COALESCE(?, '')
          AND moves_uci_hash = ?
        LIMIT 1
        """,
        (
            normalize_username(parsed.white_name),
            normalize_username(parsed.black_name),
            parsed.date_played,
            parsed.result,
            parsed.moves_uci_hash,
        ),
    ).fetchone()
    return existing


def _needs_legacy_repair(
    connection: Any,
    existing: Any,
    parsed: ParsedPgnGame,
    platform: str,
) -> bool:
    schema_version = _row_value(existing, "import_schema_version")
    if schema_version != IMPORT_SCHEMA_VERSION:
        return True
    if (_row_value(existing, "initial_fen") or STANDARD_INITIAL_FEN) != parsed.initial_fen:
        return True
    if (_row_value(existing, "variant") or STANDARD_VARIANT) != parsed.variant:
        return True
    if (_row_value(existing, "import_status") or "ok") != "ok":
        return True
    if (_row_value(existing, "source_platform") or "unknown") != platform:
        return True

    move_summary = connection.execute(
        """
        SELECT COUNT(*) AS move_count,
               MIN(CASE WHEN ply = 1 THEN fen_before ELSE NULL END) AS first_fen_before
        FROM moves
        WHERE game_id = ?
        """,
        (int(existing["id"]),),
    ).fetchone()
    if parsed.moves and move_summary["first_fen_before"] != parsed.moves[0].fen_before:
        return True
    return False


def _user_color_for_game(parsed: ParsedPgnGame, aliases: set[str]) -> str | None:
    if parsed.white_name and normalize_username(parsed.white_name) in aliases:
        return "white"
    if parsed.black_name and normalize_username(parsed.black_name) in aliases:
        return "black"
    return None


def _opponent_name(parsed: ParsedPgnGame, user_color: str | None) -> str | None:
    if user_color == "white":
        return parsed.black_name
    if user_color == "black":
        return parsed.white_name
    return None


def _result_from_user_pov(result: str | None, user_color: str | None) -> str | None:
    if user_color is None:
        return None
    if result == "1/2-1/2":
        return "draw"
    if result == "1-0":
        return "win" if user_color == "white" else "loss"
    if result == "0-1":
        return "win" if user_color == "black" else "loss"
    return "unknown"


def _insert_imported_game(
    connection: Any,
    parsed: ParsedPgnGame,
    platform: str,
    user_color: str | None,
    opponent_name: str | None,
    result_from_user_pov: str | None,
) -> int:
    now = _utc_now()
    cursor = connection.execute(
        """
        INSERT INTO games (
            created_at,
            completed_at,
            mode,
            result,
            pgn,
            completed,
            source,
            source_platform,
            source_url,
            source_game_id,
            initial_fen,
            current_position_fen,
            variant,
            import_status,
            import_warnings_json,
            import_error,
            import_schema_version,
            imported_at,
            moves_uci_hash,
            white_name,
            black_name,
            white_elo,
            black_elo,
            time_control,
            date_played,
            eco_code_pgn,
            opening_name_pgn,
            termination,
            user_color,
            opponent_name,
            result_from_user_pov,
            game_category
        )
        VALUES (?, ?, 'imported_pgn', ?, ?, 1, 'pgn_import', ?, ?, ?, ?, ?, ?, 'ok', ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            now,
            now,
            parsed.result,
            parsed.pgn_text,
            platform,
            parsed.source_url,
            parsed.source_game_id,
            parsed.initial_fen,
            parsed.current_position_fen,
            parsed.variant,
            json.dumps(list(parsed.import_warnings), ensure_ascii=False),
            IMPORT_SCHEMA_VERSION,
            now,
            parsed.moves_uci_hash,
            parsed.white_name,
            parsed.black_name,
            parsed.white_elo,
            parsed.black_elo,
            parsed.time_control,
            parsed.date_played,
            parsed.eco_code_pgn,
            parsed.opening_name_pgn,
            parsed.termination,
            user_color,
            opponent_name,
            result_from_user_pov,
            "imported_user" if user_color else "imported_observed",
        ),
    )
    return int(cursor.lastrowid)


def _repair_imported_game(
    connection: Any,
    game_id: int,
    parsed: ParsedPgnGame,
    platform: str,
    user_color: str | None,
    opponent_name: str | None,
    result_from_user_pov: str | None,
) -> int:
    now = _utc_now()
    connection.execute(
        """
        UPDATE games
        SET completed_at = ?,
            mode = 'imported_pgn',
            result = ?,
            pgn = ?,
            completed = 1,
            source = 'pgn_import',
            source_platform = ?,
            source_url = ?,
            source_game_id = ?,
            initial_fen = ?,
            current_position_fen = ?,
            variant = ?,
            import_status = 'ok',
            import_warnings_json = ?,
            import_error = NULL,
            import_schema_version = ?,
            imported_at = ?,
            moves_uci_hash = ?,
            white_name = ?,
            black_name = ?,
            white_elo = ?,
            black_elo = ?,
            time_control = ?,
            date_played = ?,
            eco_code_pgn = ?,
            opening_name_pgn = ?,
            termination = ?,
            user_color = ?,
            opponent_name = ?,
            result_from_user_pov = ?,
            game_category = ?
        WHERE id = ?
        """,
        (
            now,
            parsed.result,
            parsed.pgn_text,
            platform,
            parsed.source_url,
            parsed.source_game_id,
            parsed.initial_fen,
            parsed.current_position_fen,
            parsed.variant,
            json.dumps(list(parsed.import_warnings), ensure_ascii=False),
            IMPORT_SCHEMA_VERSION,
            now,
            parsed.moves_uci_hash,
            parsed.white_name,
            parsed.black_name,
            parsed.white_elo,
            parsed.black_elo,
            parsed.time_control,
            parsed.date_played,
            parsed.eco_code_pgn,
            parsed.opening_name_pgn,
            parsed.termination,
            user_color,
            opponent_name,
            result_from_user_pov,
            "imported_user" if user_color else "imported_observed",
            game_id,
        ),
    )
    connection.execute("DELETE FROM moves WHERE game_id = ?", (game_id,))
    connection.execute(
        "DELETE FROM game_opening_classifications WHERE game_id = ?",
        (game_id,),
    )
    connection.execute("DELETE FROM review_moments WHERE game_id = ?", (game_id,))
    connection.execute("DELETE FROM game_reviews WHERE game_id = ?", (game_id,))
    connection.execute("DELETE FROM review_jobs WHERE game_id = ?", (game_id,))
    _insert_imported_moves(connection, game_id, parsed.moves)
    return game_id


def _insert_imported_moves(
    connection: Any,
    game_id: int,
    moves: list[ParsedPgnMove],
) -> None:
    now = _utc_now()
    for move in moves:
        connection.execute(
            """
            INSERT INTO moves (
                game_id,
                ply,
                fen_before,
                uci,
                san,
                is_player,
                time_spent,
                eval_before_cp,
                eval_after_cp,
                best_move_uci,
                cp_loss,
                classification,
                created_at,
                time_spent_ms,
                white_clock_ms,
                black_clock_ms,
                clock_source
            )
            VALUES (?, ?, ?, ?, ?, 1, NULL, NULL, NULL, NULL, NULL, NULL, ?, ?, ?, ?, ?)
            """,
            (
                game_id,
                move.ply,
                move.fen_before,
                move.uci,
                move.san,
                now,
                move.time_spent_ms,
                move.white_clock_ms,
                move.black_clock_ms,
                move.clock_source,
            ),
        )
