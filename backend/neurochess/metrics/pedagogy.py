from __future__ import annotations

from typing import Any


PEDAGOGICAL_EXPLANATION_VERSION = "neuro_pedagogy_templates_v1"
CONTRAST_COACH_EXPLANATION_VERSION = "contrast_coach_explanation_v1"

ERROR_TYPE_LABELS = {
    "tactical": "Tactique manquée",
    "positional": "Plan positionnel",
    "conversion": "Conversion",
    "defensive": "Défense",
    "cluster": "Enchaînement d'erreurs",
    "opening_transition": "Sortie du livre",
    "strong_find": "Coup fort",
    "unknown": "À revoir",
}


def build_pedagogical_explanation(
    move_annotation: dict[str, Any],
    context: dict[str, Any] | None = None,
) -> dict[str, Any]:
    tags = set(move_annotation.get("tags") or [])
    primary = str(move_annotation.get("primary_category") or "unknown")
    win_loss = _optional_float(move_annotation.get("win_loss"))
    missed_gain = _optional_float(move_annotation.get("missed_gain"))
    player_before = _optional_float(move_annotation.get("player_win_percent_before"))
    persistence_weight = _optional_float(move_annotation.get("persistence_weight")) or 1.0
    cluster_weight = _optional_float(move_annotation.get("cluster_weight")) or 1.0
    best_move = str(
        move_annotation.get("best_move_san")
        or move_annotation.get("best_move_uci")
        or ""
    )
    opening_transition = bool((context or {}).get("opening_transition")) or (
        "opening_transition" in tags
    )

    if primary in {"best", "excellent"} and "strong_find" in tags:
        payload = _strong_find_payload()
    elif (
        "conversion_issue" in tags
        or (player_before is not None and player_before >= 75.0 and (win_loss or 0.0) >= 10.0)
    ):
        payload = _conversion_payload()
    elif (
        "defensive_resource_missed" in tags
        or (
            player_before is not None
            and player_before <= 35.0
            and missed_gain is not None
            and missed_gain >= 10.0
        )
    ):
        payload = _defensive_payload()
    elif "cluster" in tags or cluster_weight > 1.10:
        payload = _cluster_payload()
    elif (
        "missed_opportunity" in tags
        or _is_forcing_san(best_move)
        or ((win_loss or 0.0) >= 15.0 and best_move)
    ):
        payload = _tactical_payload(best_move)
    elif (
        "persistent_loss" in tags
        or persistence_weight > 1.10
        or (win_loss is not None and 5.0 <= win_loss <= 20.0)
    ):
        payload = _positional_payload()
    elif opening_transition:
        payload = _opening_transition_payload()
    else:
        payload = _unknown_payload()

    if opening_transition and payload["error_type"] not in {
        "tactical",
        "conversion",
        "defensive",
        "cluster",
        "strong_find",
    }:
        payload["error_type"] = "opening_transition"
        payload["main_message"] = (
            "Ce moment arrive juste après la sortie du livre : le plan compte plus "
            "que la mémoire."
        )

    _apply_pv_contrast_to_payload(payload, move_annotation)
    payload["pedagogical_explanation_version"] = PEDAGOGICAL_EXPLANATION_VERSION
    return payload


def build_contrast_coach_explanation(
    move_annotation: dict[str, Any],
) -> dict[str, Any]:
    base = move_annotation.get("pedagogical_explanation")
    base = base if isinstance(base, dict) else {}
    evidence = move_annotation.get("pv_contrast_evidence")
    evidence = evidence if isinstance(evidence, dict) else {}
    contrast = evidence.get("contrast")
    contrast = contrast if isinstance(contrast, dict) else {}
    played_branch = evidence.get("played_branch")
    played_branch = played_branch if isinstance(played_branch, dict) else {}
    best_branch = evidence.get("best_branch")
    best_branch = best_branch if isinstance(best_branch, dict) else {}

    confidence = str(evidence.get("confidence") or base.get("confidence") or "low")
    if confidence not in {"low", "medium", "high"}:
        confidence = "low"
    main_type = str(contrast.get("main_difference_type") or "unknown")
    reply = played_branch.get("opponent_best_reply_san") or played_branch.get(
        "opponent_best_reply_uci"
    )
    played_risk = contrast.get("played_branch_risk")
    best_benefit = contrast.get("best_branch_benefit")
    played_preview = _line_preview(played_branch.get("pv"))
    best_preview = _line_preview(best_branch.get("pv"))
    bullets = contrast.get("safe_explanation_bullets")
    safe_bullet = str(bullets[0]) if isinstance(bullets, list) and bullets else None

    available = bool(evidence.get("available")) and bool(contrast)
    what_happened = _what_happened_after_played(reply, played_risk, available)
    why_better = _why_solution_is_better(main_type, best_benefit, confidence)
    main_difference = _main_difference_sentence(main_type, confidence)
    line_explanation = _line_explanation(best_preview, played_preview, confidence)
    safe_takeaway = (
        str(base.get("training_takeaway") or "")
        or safe_bullet
        or "Compare le coup joue avec la solution et garde une explication prudente."
    )

    return {
        "schema_version": CONTRAST_COACH_EXPLANATION_VERSION,
        "contrast_coach_explanation_version": CONTRAST_COACH_EXPLANATION_VERSION,
        "available": available,
        "what_happened_after_played": what_happened,
        "why_solution_is_better": why_better,
        "main_difference": main_difference,
        "main_difference_type": main_type,
        "main_difference_label": _main_difference_label(main_type),
        "line_explanation": line_explanation,
        "safe_takeaway": safe_takeaway,
        "confidence": confidence,
        "played_line_preview": played_preview,
        "best_line_preview": best_preview,
        "missing_data": evidence.get("missing_data") or [],
    }


def coach_card_title(move_annotation: dict[str, Any]) -> str:
    ply = _optional_int(move_annotation.get("ply")) or 0
    move_number = _optional_int(move_annotation.get("move_number")) or ((ply + 1) // 2)
    color = _color_label(str(move_annotation.get("color") or move_annotation.get("side") or ""))
    move = move_annotation.get("san") or move_annotation.get("uci") or "?"
    return f"Coup {move_number} — {color} jouent {move}"


def compact_label(move_annotation: dict[str, Any], explanation: dict[str, Any]) -> str:
    ply = _optional_int(move_annotation.get("ply")) or 0
    move_number = _optional_int(move_annotation.get("move_number")) or ((ply + 1) // 2)
    error_label = ERROR_TYPE_LABELS.get(str(explanation.get("error_type")), "À revoir")
    impact = impact_label(move_annotation.get("win_loss"))
    return f"Coup {move_number} — {error_label} — {impact}"


def move_quality_label(move_accuracy: Any) -> str:
    value = _optional_float(move_accuracy)
    if value is None:
        return "Non classée"
    if value >= 95.0:
        return "Excellente"
    if value >= 85.0:
        return "Très bonne"
    if value >= 70.0:
        return "Correcte"
    if value >= 50.0:
        return "Moyenne"
    if value >= 30.0:
        return "Faible"
    return "Très faible"


def impact_label(win_loss: Any) -> str:
    value = _optional_float(win_loss)
    if value is None:
        return "non mesuré"
    if value < 2.0:
        return "négligeable"
    if value < 7.0:
        return "léger"
    if value < 15.0:
        return "important"
    if value < 30.0:
        return "très important"
    return "critique"


def _tactical_payload(best_move: str) -> dict[str, Any]:
    missed = (
        f"Le meilleur coup {best_move} était forcing et changeait immédiatement la position."
        if best_move
        else "Le meilleur coup était forcing et changeait immédiatement la position."
    )
    return {
        "error_type": "tactical",
        "time_horizon": "immediate",
        "main_message": "Tu as probablement raté une ressource tactique.",
        "missed_idea": missed,
        "why_played_move_bad": "Ton coup ne profite pas de la ressource la plus directe.",
        "why_best_move_good": (
            "Le meilleur coup crée une menace immédiate ou force l'adversaire à réagir."
        ),
        "training_takeaway": (
            "Dans une position tactique, vérifie d'abord les échecs, captures et menaces."
        ),
        "confidence": "medium",
    }


def _conversion_payload() -> dict[str, Any]:
    return {
        "error_type": "conversion",
        "time_horizon": "short_term",
        "main_message": "Tu avais une position favorable, mais ce coup rend la conversion plus difficile.",
        "missed_idea": "Il fallait chercher un coup qui garde le contrôle et limite le contre-jeu.",
        "why_played_move_bad": (
            "Ton coup laisse l'adversaire revenir dans la partie ou complique inutilement la position."
        ),
        "why_best_move_good": (
            "Le meilleur coup conserve mieux l'avantage et réduit les ressources adverses."
        ),
        "training_takeaway": (
            "Quand tu es mieux, privilégie les coups qui stabilisent l'avantage avant de chercher le gain immédiat."
        ),
        "confidence": "high",
    }


def _defensive_payload() -> dict[str, Any]:
    return {
        "error_type": "defensive",
        "time_horizon": "short_term",
        "main_message": "Dans une position difficile, tu as manqué une ressource défensive.",
        "missed_idea": "Le meilleur coup améliorait tes chances de résistance.",
        "why_played_move_bad": "Ton coup laisse l'adversaire conserver ou augmenter la pression.",
        "why_best_move_good": "Le meilleur coup réduit les menaces adverses ou gagne du temps pour défendre.",
        "training_takeaway": "Quand tu es moins bien, cherche d'abord comment limiter les dégâts.",
        "confidence": "high",
    }


def _cluster_payload() -> dict[str, Any]:
    return {
        "error_type": "cluster",
        "time_horizon": "short_term",
        "main_message": "Ce coup fait partie d'un enchaînement d'erreurs.",
        "missed_idea": "Après une première perte, il fallait stabiliser la position.",
        "why_played_move_bad": "Ton coup continue la spirale négative au lieu de réduire les risques.",
        "why_best_move_good": "Le meilleur coup limite les dégâts et empêche l'adversaire d'augmenter son avantage.",
        "training_takeaway": "Après une erreur, ton objectif numéro un est de jouer un coup solide.",
        "confidence": "medium",
    }


def _positional_payload() -> dict[str, Any]:
    return {
        "error_type": "positional",
        "time_horizon": "long_term",
        "main_message": "Le problème n'est pas forcément tactique : ton coup a rendu la position plus difficile.",
        "missed_idea": "Il fallait chercher un plan qui limite l'activité adverse ou améliore tes pièces.",
        "why_played_move_bad": "Ton coup laisse l'adversaire améliorer sa position dans les coups suivants.",
        "why_best_move_good": "Le meilleur coup répond mieux au plan de la position.",
        "training_takeaway": (
            "Quand il n'y a pas de tactique immédiate, demande-toi quel camp va améliorer ses pièces le plus facilement."
        ),
        "confidence": "medium",
    }


def _opening_transition_payload() -> dict[str, Any]:
    return {
        "error_type": "opening_transition",
        "time_horizon": "short_term",
        "main_message": "Ce moment arrive juste après la sortie du livre : le plan compte plus que la mémoire.",
        "missed_idea": "Il fallait identifier le plan naturel plutôt que réciter une suite connue.",
        "why_played_move_bad": "Ton coup ne répond pas encore clairement aux besoins de la position.",
        "why_best_move_good": "Le meilleur coup organise mieux les pièces pour la suite.",
        "training_takeaway": "À la sortie du livre, cherche le plan avant de choisir le coup.",
        "confidence": "low",
    }


def _strong_find_payload() -> dict[str, Any]:
    return {
        "error_type": "strong_find",
        "time_horizon": "short_term",
        "main_message": "Tu as trouvé un bon coup dans un moment important.",
        "missed_idea": "Tu as identifié l'idée clé de la position.",
        "why_played_move_bad": "Ton coup conserve très bien les chances dans cette position.",
        "why_best_move_good": "Ce choix garde la position sous contrôle et évite les concessions inutiles.",
        "training_takeaway": "Ce type de décision est à consolider : elle montre une bonne lecture de la position.",
        "confidence": "medium",
    }


def _unknown_payload() -> dict[str, Any]:
    return {
        "error_type": "unknown",
        "time_horizon": "unknown",
        "main_message": "Ce coup a réduit tes chances, mais la cause exacte nécessite une analyse plus détaillée.",
        "missed_idea": "Compare ton coup avec le meilleur choix indiqué.",
        "why_played_move_bad": "Le coup joué donne un moins bon résultat que l'alternative proposée.",
        "why_best_move_good": "Le meilleur coup conserve davantage tes chances.",
        "training_takeaway": "Rejoue la position et cherche pourquoi le meilleur coup améliore la situation.",
        "confidence": "low",
    }


def _apply_pv_contrast_to_payload(
    payload: dict[str, Any],
    move_annotation: dict[str, Any],
) -> None:
    evidence = move_annotation.get("pv_contrast_evidence")
    if not isinstance(evidence, dict) or not evidence.get("available"):
        return
    contrast = evidence.get("contrast")
    if not isinstance(contrast, dict):
        return

    main_type = str(contrast.get("main_difference_type") or "unknown")
    confidence = str(evidence.get("confidence") or "low")
    played_branch = evidence.get("played_branch")
    best_branch = evidence.get("best_branch")
    played_branch = played_branch if isinstance(played_branch, dict) else {}
    best_branch = best_branch if isinstance(best_branch, dict) else {}
    reply = played_branch.get("opponent_best_reply_san") or played_branch.get(
        "opponent_best_reply_uci"
    )
    best_preview = _line_preview(best_branch.get("pv"))

    if main_type == "forcing":
        payload["main_message"] = (
            "Le meilleur coup est plus forcing : il oblige l'adversaire a repondre tout de suite."
        )
        payload["missed_idea"] = (
            "La difference principale vient du caractere forcing de la solution."
        )
    elif main_type == "conversion":
        payload["main_message"] = (
            "Tu avais une position favorable, mais la branche jouee rend la conversion plus difficile."
        )
    elif main_type == "defense":
        payload["main_message"] = (
            "Le contraste indique surtout une ressource defensive manquee."
        )
    elif main_type == "king_safety":
        payload["main_message"] = (
            "La ligne du meilleur coup agit plus directement sur la securite du roi."
        )
    elif main_type == "initiative":
        payload["main_message"] = (
            "Apres le coup joue, l'adversaire obtient une reponse active dans les donnees cachees."
        )

    if reply:
        payload["why_played_move_bad"] = (
            f"Apres le coup joue, l'adversaire peut repondre activement par {reply}."
        )
    if best_preview:
        payload["why_best_move_good"] = (
            f"La ligne proposee commence par : {best_preview}. Elle soutient mieux l'idee du meilleur coup."
        )
    elif confidence == "low":
        payload["why_best_move_good"] = (
            "La ligne complete n'est pas disponible ; compare surtout le coup joue avec la solution."
        )

    if confidence == "low":
        payload["confidence"] = "low"
    elif confidence == "high" and payload.get("confidence") == "medium":
        payload["confidence"] = "high"


def _what_happened_after_played(
    reply: Any,
    played_risk: Any,
    available: bool,
) -> str:
    if reply:
        return f"Apres le coup joue, l'adversaire peut repondre activement par {reply}."
    if played_risk:
        return str(played_risk)
    if available:
        return "Apres le coup joue, les donnees cachees indiquent une branche moins favorable."
    return "Les preuves PV ne donnent pas assez d'elements sur la reponse adverse."


def _why_solution_is_better(
    main_type: str,
    best_benefit: Any,
    confidence: str,
) -> str:
    if best_benefit:
        return str(best_benefit)
    if main_type == "forcing":
        return "La solution est plus forcing : elle oblige l'adversaire a repondre immediatement."
    if main_type == "conversion":
        return "La solution conserve mieux l'avantage et rend la conversion plus simple."
    if main_type == "defense":
        return "La solution ameliore les chances de resistance."
    if main_type == "king_safety":
        return "La solution met davantage le roi adverse sous pression."
    if main_type == "initiative":
        return "La solution conserve mieux l'initiative."
    if main_type == "material":
        return "La solution evite une concession materielle ou gagne plus clairement du materiel."
    if main_type == "positional":
        return "La solution repond mieux aux besoins positionnels de la position."
    if confidence == "low":
        return "Les donnees disponibles sont partielles ; compare surtout le coup joue avec la solution."
    return "La solution conserve davantage les chances du joueur dans les donnees cachees."


def _main_difference_sentence(main_type: str, confidence: str) -> str:
    if main_type == "forcing":
        return "Difference principale : coup forcing."
    if main_type == "conversion":
        return "Difference principale : conversion de l'avantage."
    if main_type == "defense":
        return "Difference principale : ressource defensive."
    if main_type == "king_safety":
        return "Difference principale : securite du roi."
    if main_type == "initiative":
        return "Difference principale : initiative."
    if main_type == "material":
        return "Difference principale : materiel."
    if main_type == "positional":
        return "Difference principale : plan positionnel."
    if confidence == "low":
        return "Difference principale difficile a classifier avec les donnees disponibles."
    return "Difference principale difficile a classifier."


def _main_difference_label(main_type: str) -> str:
    labels = {
        "forcing": "Coup forcing",
        "material": "Materiel",
        "king_safety": "Securite du roi",
        "initiative": "Initiative",
        "defense": "Defense",
        "conversion": "Conversion",
        "positional": "Plan positionnel",
        "unknown": "Difference difficile a classifier",
    }
    return labels.get(main_type, labels["unknown"])


def _line_explanation(
    best_preview: str | None,
    played_preview: str | None,
    confidence: str,
) -> str:
    if best_preview:
        return f"La ligne de la solution commence par : {best_preview}."
    if played_preview:
        return f"La ligne apres le coup joue commence par : {played_preview}."
    if confidence == "low":
        return "Les donnees disponibles sont partielles ; aucune ligne fiable n'est complete."
    return "Aucune ligne complete n'est disponible dans le cache."


def _line_preview(line: Any, limit: int = 4) -> str | None:
    if not isinstance(line, list):
        return None
    values: list[str] = []
    for entry in line[:limit]:
        if not isinstance(entry, dict):
            continue
        move = entry.get("san") or entry.get("uci")
        if move:
            values.append(str(move))
    return " ".join(values) if values else None


def _is_forcing_san(value: str) -> bool:
    return bool(value and any(marker in value for marker in ("+", "#", "x")))


def _color_label(color: str) -> str:
    if color == "white":
        return "Blancs"
    if color == "black":
        return "Noirs"
    return "Joueur"


def _optional_float(value: Any) -> float | None:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _optional_int(value: Any) -> int | None:
    if value is None:
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None
