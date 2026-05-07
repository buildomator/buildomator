@echo off
rem Bundled gsd-sdk shim for Windows. Forwards to node sdk\dist\cli.js
rem so users no longer need `npm install -g get-shit-done-cc` (#4).

setlocal

if defined CLAUDE_PLUGIN_ROOT (
  if exist "%CLAUDE_PLUGIN_ROOT%\sdk\dist\cli.js" (
    node "%CLAUDE_PLUGIN_ROOT%\sdk\dist\cli.js" %*
    exit /b %ERRORLEVEL%
  )
)

set "SELF_DIR=%~dp0"
set "PLUGIN_SDK=%SELF_DIR%..\sdk\dist\cli.js"
if exist "%PLUGIN_SDK%" (
  node "%PLUGIN_SDK%" %*
  exit /b %ERRORLEVEL%
)

echo ERROR: bundled SDK not found. This is a plugin install bug -- 1>&2
echo        please report it at https://github.com/jnuyens/gsd-plugin/issues 1>&2
exit /b 1
