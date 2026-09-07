@echo off
REM Start local web server for Baarden game
REM This allows Firebase to load properly (no CORS issues with file:// URLs)

cd /d "C:\Users\keanu\OneDrive\Documenten\Eigen creatie Games\Baarden"

echo.
echo Starting local web server...
echo.
echo The game will be available at: http://localhost:8000
echo Press Ctrl+C to stop the server
echo.

python -m http.server 8000

REM If Python is not found, try python3
if %errorlevel% neq 0 (
    python3 -m http.server 8000
)
