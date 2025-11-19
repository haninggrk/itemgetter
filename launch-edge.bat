@echo off
SET EDGE_PATH="C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
SET PORT=9222

IF EXIST %EDGE_PATH% (
    echo Launching Microsoft Edge with CDP enabled on port %PORT%...
    start "" %EDGE_PATH% --remote-debugging-port=%PORT%
) ELSE (
    echo Error: Microsoft Edge executable not found at %EDGE_PATH%
    echo Please check the path and update the EDGE_PATH variable.
)

pause