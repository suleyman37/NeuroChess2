from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class EngineProfile:
    name: str
    analysis_profile: str
    threads: int
    hash_mb: int
    multipv: int
    limit_mode: str
    uci_analyse_mode: bool = True
    uci_limit_strength: bool = False


ENGINE_PROFILES: dict[str, EngineProfile] = {
    "live_continuous": EngineProfile(
        name="live_continuous",
        analysis_profile="live_continuous",
        threads=4,
        hash_mb=512,
        multipv=1,
        limit_mode="continuous",
    ),
    "shallow": EngineProfile(
        name="shallow",
        analysis_profile="quick",
        threads=2,
        hash_mb=256,
        multipv=1,
        limit_mode="mixed",
    ),
    "quick": EngineProfile(
        name="review_quick",
        analysis_profile="quick",
        threads=2,
        hash_mb=256,
        multipv=2,
        limit_mode="time",
    ),
    "standard": EngineProfile(
        name="review_standard",
        analysis_profile="standard",
        threads=6,
        hash_mb=1024,
        multipv=3,
        limit_mode="time",
    ),
    "deep": EngineProfile(
        name="review_deep",
        analysis_profile="deep",
        threads=8,
        hash_mb=2048,
        multipv=3,
        limit_mode="time",
    ),
}


def engine_profile_for_name(name: str | None) -> EngineProfile:
    return ENGINE_PROFILES.get(name or "", ENGINE_PROFILES["shallow"])


def review_multipv_for_profile(profile: str | None) -> int:
    return engine_profile_for_name(profile).multipv


def review_threads_for_profile(profile: str | None) -> int:
    return engine_profile_for_name(profile).threads


def review_hash_for_profile(profile: str | None) -> int:
    return engine_profile_for_name(profile).hash_mb


def optional_syzygy_path(env: dict[str, str] | None = None) -> str | None:
    environment = env if env is not None else os.environ
    value = environment.get("NEUROCHESS_SYZYGY_PATH")
    return value.strip() if value and value.strip() else None


def apply_engine_profile_options(
    engine: Any,
    profile_name: str | None,
    requested_multipv: int,
    limit_mode: str,
    syzygy_path: str | None = None,
) -> dict[str, Any]:
    profile = engine_profile_for_name(profile_name)
    report: dict[str, Any] = {
        "engine_profile": profile.name,
        "analysis_profile": profile.analysis_profile,
        "threads": None,
        "hash_mb": None,
        "multipv": requested_multipv,
        "analysis_limit_mode": limit_mode,
        "limit_mode": limit_mode,
        "uci_analyse_mode": None,
        "uci_limit_strength": None,
        "skill_level": None,
        "syzygy_path_active": False,
        "options": {},
    }

    _try_configure_option(
        engine=engine,
        option_name="Threads",
        requested_value=profile.threads,
        report=report,
        report_key="threads",
    )
    _try_configure_option(
        engine=engine,
        option_name="Hash",
        requested_value=profile.hash_mb,
        report=report,
        report_key="hash_mb",
    )
    _try_configure_option(
        engine=engine,
        option_name="UCI_AnalyseMode",
        requested_value=profile.uci_analyse_mode,
        report=report,
        report_key="uci_analyse_mode",
    )
    _try_configure_option(
        engine=engine,
        option_name="UCI_LimitStrength",
        requested_value=profile.uci_limit_strength,
        report=report,
        report_key="uci_limit_strength",
    )
    _try_configure_skill_level(engine, report)
    if syzygy_path:
        _try_configure_syzygy(engine, syzygy_path, report)
    else:
        report["options"]["SyzygyPath"] = {
            "exposed": bool(getattr(engine, "options", {}).get("SyzygyPath")),
            "configured_value": None,
            "status": "not_configured",
        }

    return report


def _try_configure_option(
    engine: Any,
    option_name: str,
    requested_value: Any,
    report: dict[str, Any],
    report_key: str,
) -> None:
    options = getattr(engine, "options", {}) or {}
    option = options.get(option_name)
    if option is None:
        report["options"][option_name] = {
            "exposed": False,
            "configured_value": None,
            "status": "not_exposed",
        }
        return

    value = _clamp_option_value(option, requested_value)
    try:
        engine.configure({option_name: value})
        report[report_key] = value
        report["options"][option_name] = {
            "exposed": True,
            "default": getattr(option, "default", None),
            "configured_value": value,
            "status": "applied",
        }
    except Exception as exc:
        report["options"][option_name] = {
            "exposed": True,
            "default": getattr(option, "default", None),
            "configured_value": value,
            "status": "failed",
            "error": repr(exc),
        }


def _try_configure_skill_level(engine: Any, report: dict[str, Any]) -> None:
    options = getattr(engine, "options", {}) or {}
    option = options.get("Skill Level")
    if option is None:
        report["options"]["Skill Level"] = {
            "exposed": False,
            "configured_value": None,
            "status": "not_exposed",
        }
        return

    requested = getattr(option, "max", None)
    if requested is None:
        requested = getattr(option, "default", None)
    try:
        engine.configure({"Skill Level": requested})
        report["skill_level"] = requested
        report["options"]["Skill Level"] = {
            "exposed": True,
            "default": getattr(option, "default", None),
            "configured_value": requested,
            "status": "applied",
        }
    except Exception as exc:
        report["options"]["Skill Level"] = {
            "exposed": True,
            "default": getattr(option, "default", None),
            "configured_value": requested,
            "status": "failed",
            "error": repr(exc),
        }


def _try_configure_syzygy(
    engine: Any,
    syzygy_path: str,
    report: dict[str, Any],
) -> None:
    options = getattr(engine, "options", {}) or {}
    option = options.get("SyzygyPath")
    if option is None:
        report["options"]["SyzygyPath"] = {
            "exposed": False,
            "configured_value": syzygy_path,
            "status": "not_exposed",
        }
        return

    try:
        engine.configure({"SyzygyPath": syzygy_path})
        report["syzygy_path_active"] = True
        report["options"]["SyzygyPath"] = {
            "exposed": True,
            "configured_value": syzygy_path,
            "status": "applied",
        }
    except Exception as exc:
        report["options"]["SyzygyPath"] = {
            "exposed": True,
            "configured_value": syzygy_path,
            "status": "failed",
            "error": repr(exc),
        }


def _clamp_option_value(option: Any, value: Any) -> Any:
    minimum = getattr(option, "min", None)
    maximum = getattr(option, "max", None)
    if isinstance(value, int):
        if minimum is not None:
            value = max(int(minimum), value)
        if maximum is not None:
            value = min(int(maximum), value)
    return value
