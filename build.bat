set TSC_OUTPUT=build/app.js
set PS_JSX_OUTPUT=build/LabelPlus_Ps_Script.jsx
mkdir build
echo y | del build
tsc -p . --out %TSC_OUTPUT% && py ./flatten_jsx.py build/app.js %PS_JSX_OUTPUT% -I build/ src/ 