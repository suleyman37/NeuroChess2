@echo off
setlocal

set "PROJECT_DIR=%~dp0"
set "LOCAL_PYTHON=%PROJECT_DIR%.venv\Scripts\python.exe"
set "CODEX_PYTHON=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"
set "OLD_LOCAL_PYTHON=%LOCALAPPDATA%\Python\bin\python.exe"
set "PYTHON_EXE="

set "TOOLS_NODE_DIR=%LOCALAPPDATA%\NeuroChess2Tools\node-v22.11.0-win-x64"
set "TOOLS_NODE_EXE=%TOOLS_NODE_DIR%\node.exe"
set "TOOLS_NPM_CMD=%TOOLS_NODE_DIR%\npm.cmd"
set "CODEX_NODE_EXE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
set "NODE_EXE="
set "NPM_CMD="

set "LOG_DIR=%TEMP%\NeuroChess2Logs"
set "BUNDLED_STOCKFISH=%PROJECT_DIR%backend\neurochess\stockfish.exe"
set "FRONTEND_VITE=%PROJECT_DIR%frontend\node_modules\vite\bin\vite.js"

echo NeuroChess 2 - lancement local
echo.

if exist "%LOCAL_PYTHON%" set "PYTHON_EXE=%LOCAL_PYTHON%"
if not defined PYTHON_EXE if exist "%OLD_LOCAL_PYTHON%" set "PYTHON_EXE=%OLD_LOCAL_PYTHON%"
if not defined PYTHON_EXE if exist "%LOCALAPPDATA%\Programs\Python\Python314\python.exe" set "PYTHON_EXE=%LOCALAPPDATA%\Programs\Python\Python314\python.exe"
if not defined PYTHON_EXE if exist "%LOCALAPPDATA%\Programs\Python\Python313\python.exe" set "PYTHON_EXE=%LOCALAPPDATA%\Programs\Python\Python313\python.exe"
if not defined PYTHON_EXE if exist "%LOCALAPPDATA%\Programs\Python\Python312\python.exe" set "PYTHON_EXE=%LOCALAPPDATA%\Programs\Python\Python312\python.exe"
if not defined PYTHON_EXE if exist "%LOCALAPPDATA%\Programs\Python\Python311\python.exe" set "PYTHON_EXE=%LOCALAPPDATA%\Programs\Python\Python311\python.exe"
if not defined PYTHON_EXE if exist "%CODEX_PYTHON%" set "PYTHON_EXE=%CODEX_PYTHON%"
if not defined PYTHON_EXE for /f "delims=" %%P in ('where python.exe 2^>nul') do if not defined PYTHON_EXE set "PYTHON_EXE=%%P"

if not defined PYTHON_EXE (
    echo ERREUR: Python introuvable.
    echo Installe Python 3.12+ ou relance Codex pour recreer ses outils locaux.
    echo.
    pause
    exit /b 1
)

if not exist "%LOCAL_PYTHON%" (
    echo Creation de l'environnement Python local...
    "%PYTHON_EXE%" -m venv "%PROJECT_DIR%.venv"
    if errorlevel 1 (
        echo.
        echo ERREUR: creation de .venv impossible.
        pause
        exit /b 1
    )
    set "PYTHON_EXE=%LOCAL_PYTHON%"
) else (
    set "PYTHON_EXE=%LOCAL_PYTHON%"
)

if exist "%TOOLS_NODE_EXE%" (
    set "NODE_EXE=%TOOLS_NODE_EXE%"
    if exist "%TOOLS_NPM_CMD%" set "NPM_CMD=%TOOLS_NPM_CMD%"
)
if not defined NODE_EXE if exist "%CODEX_NODE_EXE%" set "NODE_EXE=%CODEX_NODE_EXE%"
if not defined NODE_EXE for /f "delims=" %%N in ('where node.exe 2^>nul') do if not defined NODE_EXE set "NODE_EXE=%%N"
if not defined NPM_CMD for /f "delims=" %%N in ('where npm.cmd 2^>nul') do if not defined NPM_CMD set "NPM_CMD=%%N"

if not defined NODE_EXE (
    echo ERREUR: Node.js introuvable.
    echo Installe Node.js 22+ ou demande a Codex de le reinstaller pour NeuroChess 2.
    echo.
    pause
    exit /b 1
)

for %%I in ("%NODE_EXE%") do set "PATH=%%~dpI;%PATH%"

if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"

if exist "%BUNDLED_STOCKFISH%" (
    set "NEUROCHESS_STOCKFISH_PATH=%BUNDLED_STOCKFISH%"
    echo Stockfish bundled detecte.
)

cd /d "%PROJECT_DIR%"

echo Python: %PYTHON_EXE%
echo Node: %NODE_EXE%
echo.

echo Verification des dependances Python...
"%PYTHON_EXE%" -c "import fastapi, uvicorn, chess, httpx" >nul 2>&1
if errorlevel 1 (
    echo Installation des dependances Python...
    "%PYTHON_EXE%" -m pip install -r requirements.txt
    if errorlevel 1 (
        echo.
        echo ERREUR: installation des dependances Python impossible.
        pause
        exit /b 1
    )
)

echo Verification des dependances frontend...
if not exist "%FRONTEND_VITE%" (
    if defined NPM_CMD (
        echo Installation des dependances frontend...
        cd /d "%PROJECT_DIR%frontend"
        "%NPM_CMD%" install
        if errorlevel 1 (
            echo.
            echo ERREUR: installation des dependances frontend impossible.
            pause
            exit /b 1
        )
        cd /d "%PROJECT_DIR%"
    ) else (
        echo ERREUR: frontend\node_modules est incomplet et npm est introuvable.
        echo Installe Node.js avec npm, puis relance ce fichier.
        pause
        exit /b 1
    )
)

call :check_url "http://127.0.0.1:8000/health"
if errorlevel 1 (
    echo Lancement du backend...
    start "NeuroChess 2 Backend" /D "%PROJECT_DIR%" /min cmd /c ""%PYTHON_EXE%" -m uvicorn backend.app:app --host 127.0.0.1 --port 8000 > "%LOG_DIR%\backend.log" 2> "%LOG_DIR%\backend.err.log""
) else (
    echo Backend deja lance.
)

call :check_url "http://127.0.0.1:5173"
if errorlevel 1 (
    echo Lancement du frontend...
    start "NeuroChess 2 Frontend" /D "%PROJECT_DIR%frontend" /min cmd /c ""%NODE_EXE%" "%FRONTEND_VITE%" --host 127.0.0.1 > "%LOG_DIR%\frontend.log" 2> "%LOG_DIR%\frontend.err.log""
) else (
    echo Frontend deja lance.
)

echo Attente du backend...
call :wait_url "http://127.0.0.1:8000/health" 30
if errorlevel 1 (
    echo.
    echo ERREUR: le backend ne repond pas.
    echo Logs: %LOG_DIR%\backend.err.log
    pause
    exit /b 1
)

echo Attente du frontend...
call :wait_url "http://127.0.0.1:5173" 30
if errorlevel 1 (
    echo.
    echo ERREUR: le frontend ne repond pas.
    echo Logs: %LOG_DIR%\frontend.err.log
    pause
    exit /b 1
)

echo.
echo NeuroChess 2 est pret.
echo Ouverture du navigateur...
start "" "http://localhost:5173"
echo.
echo Tu peux fermer cette fenetre. Les serveurs continuent en arriere-plan.
powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Sleep -Seconds 3" >nul
exit /b 0

:check_url
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $response = Invoke-WebRequest -UseBasicParsing -Uri '%~1' -TimeoutSec 2; if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) { exit 0 } exit 1 } catch { exit 1 }"
exit /b %errorlevel%

:wait_url
set "WAIT_URL=%~1"
set "WAIT_SECONDS=%~2"
set /a WAIT_COUNT=0
:wait_loop
call :check_url "%WAIT_URL%"
if not errorlevel 1 exit /b 0
set /a WAIT_COUNT+=1
if %WAIT_COUNT% GEQ %WAIT_SECONDS% exit /b 1
powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Sleep -Seconds 1" >nul
goto wait_loop
