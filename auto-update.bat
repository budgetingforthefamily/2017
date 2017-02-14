@ECHO OFF
SET FILENAME=resources\budget.auto.json
SET NODEFILE=resources\index.js
SET OPENMSG=Updating \033[96m%FILENAME%\033[0m with \033[96m%NODEFILE%\033[0m
SET STAGEMSG=\033[33mStaging \033[0m\033[96m%FILENAME%\033[0m\033[33m on git...\033[0m
SET DONEMSG=\033[92mUpdate complete! The website is live and ready to go\033[0m


cd %~dp0
ECHO *** %OPENMSG% *** | resources\cmdcolor.exe

node %NODEFILE%

ECHO.
ECHO %STAGEMSG% | resources\cmdcolor.exe

git add %FILENAME%

ECHO.

git commit -m "Budget update"

ECHO.

git push

ECHO.
ECHO *** %DONEMSG% *** | resources\cmdcolor.exe

ECHO Press any key to exit . . .
PAUSE > nul
EXIT
