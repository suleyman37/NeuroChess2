# Suggested Commands

- Check repo state: `git status --short --branch`.
- Search files/text on Windows if `rg` is unavailable: `Get-ChildItem -Recurse` and `Select-String`.
- Backend tests: `.venv\Scripts\python.exe -m unittest discover backend/tests`.
- Target a test: `.venv\Scripts\python.exe -m unittest backend.tests.<test_module>`.
- Review smoke: `.venv\Scripts\python.exe scripts\review_regression_smoke.py`.
- Backend dev server: `.venv\Scripts\python.exe -m uvicorn backend.app:app --reload`.
- Frontend install/build/dev from `frontend/`: `cmd /c npm.cmd install`, `cmd /c npm.cmd run build`, `cmd /c npm.cmd run dev`.
- Use `cmd /c npm.cmd` or `cmd /c npx.cmd` on this Windows setup when PowerShell blocks `.ps1` npm shims.