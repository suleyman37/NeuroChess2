from __future__ import annotations

import unittest
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[2]
FRONTEND_SRC = PROJECT_ROOT / "frontend" / "src"


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8").replace("\r\n", "\n")


class FrontendProfilePrivacyStaticTests(unittest.TestCase):
    def setUp(self) -> None:
        self.app = read(FRONTEND_SRC / "App.tsx")
        self.client = read(FRONTEND_SRC / "api" / "client.ts")
        self.styles = read(FRONTEND_SRC / "styles.css")

    def test_profile_privacy_lives_outside_plan2_main_nav(self) -> None:
        self.assertIn('className="app-shell-nav"', self.app)
        nav_block = self.app.split('className="app-shell-nav"', 1)[1].split(
            "</nav>",
            1,
        )[0]

        self.assertIn("Aujourd'hui", nav_block)
        self.assertIn("Mes parties", nav_block)
        self.assertIn("Entra", nav_block)
        self.assertNotIn("Profil", nav_block)
        self.assertNotIn("Param", nav_block)

        self.assertIn("profile-settings-button", self.app)
        self.assertIn("Profil / Param", self.app)
        self.assertIn("profile-privacy-panel", self.app)

    def test_export_delete_controls_are_visible_and_confirmed(self) -> None:
        for token in (
            "Exporter mes donn",
            "Supprimer mes donn",
            "Confirmation obligatoire",
            "Tape SUPPRIMER",
            "Confirmer la suppression",
            "Cette action supprimera les parties",
            "exportUserData",
            "deleteUserData",
        ):
            self.assertIn(token, self.app + self.client)

        self.assertIn("/api/export", self.client)
        self.assertIn("/api/user-data", self.client)
        self.assertIn('profileDeleteInput !== "SUPPRIMER"', self.app)
        self.assertIn('params = new URLSearchParams({ confirm })', self.client)

    def test_profile_privacy_styles_are_local_and_destructive(self) -> None:
        for token in (
            ".profile-privacy-panel",
            ".profile-privacy-section",
            ".profile-delete-confirmation",
            "button.danger",
        ):
            self.assertIn(token, self.styles)

    def test_no_forbidden_v1_labels_were_added(self) -> None:
        for forbidden_label in (
            "Candidate Trainer",
            "Intent Layer",
            "Transfer Gap",
            "LLM coach",
            "NeuroMonitor",
            "brain",
            "cortex",
            "atlas",
            "SkillTrace score",
            "ETV",
            "FSRS",
        ):
            self.assertNotIn(forbidden_label, self.app)


if __name__ == "__main__":
    unittest.main()
