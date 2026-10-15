@echo off
rem Windows twin of bin/gsd-node. node is on the machine PATH on Windows
rem (installer, nvm-windows, scoop), so forward straight to it.
node %*
exit /b %ERRORLEVEL%
