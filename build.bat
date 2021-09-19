@echo off

set DIR=%~dp0
set BUILD="%DIR%\build"
set RESOURCE="%DIR%\doc_template"
set TSC_OUTPUT="%DIR%\build\app.js"
set PS_JSX_OUTPUT="%DIR%\build\LabelPlus_Ps_Script.jsx"
set PS_JSX_RESOURCE="%DIR%\build\ps_script_res"

rd /S /Q %BUILD%
mkdir %BUILD%

mkdir %PS_JSX_RESOURCE%
copy %RESOURCE% %PS_JSX_RESOURCE%

tsc -p . --out %TSC_OUTPUT% && py ./flatten_jsx.py build/app.js %PS_JSX_OUTPUT% -I build/ src/ 