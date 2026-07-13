@echo off
rem Bundled gsd-sdk shim for Windows. Forwards to node sdk\dist\cli.js
rem so users no longer need `npm install -g get-shit-done-cc` (#4).
rem
rem [PLUGIN PATCH #PLUGIN-WRAPPER-ENV-EXPORT] Exports CLAUDE_PLUGIN_ROOT and
rem GSD_AGENTS_DIR before invoking node so the bundled SDK + dynamically-
rem loaded bin/lib/core.cjs can resolve agents/, model catalog, etc. without
rem depending on Claude Code setting CLAUDE_PLUGIN_ROOT in shell envs.

setlocal

if defined CLAUDE_PLUGIN_ROOT (
  if exist "%CLAUDE_PLUGIN_ROOT%\sdk\dist\cli.js" (
    set "PLUGIN_ROOT=%CLAUDE_PLUGIN_ROOT%"
    set "PLUGIN_SDK=%CLAUDE_PLUGIN_ROOT%\sdk\dist\cli.js"
    goto :run
  )
)

set "SELF_DIR=%~dp0"
for %%I in ("%SELF_DIR%..") do set "PLUGIN_ROOT=%%~fI"
set "PLUGIN_SDK=%PLUGIN_ROOT%\sdk\dist\cli.js"

:run
if exist "%PLUGIN_SDK%" (
  set "CLAUDE_PLUGIN_ROOT=%PLUGIN_ROOT%"
  if not defined GSD_AGENTS_DIR (
    if exist "%PLUGIN_ROOT%\agents" (
      set "GSD_AGENTS_DIR=%PLUGIN_ROOT%\agents"
    )
  )
  node "%PLUGIN_SDK%" %*
  exit /b %ERRORLEVEL%
)

echo ERROR: bundled SDK not found. This is a plugin install bug -- 1>&2
echo        please report it at https://github.com/buildomator/buildomator/issues 1>&2
exit /b 1
