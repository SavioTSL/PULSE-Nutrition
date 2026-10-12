#!/usr/bin/env sh
# Atualiza o arquivo de navegador após alterações nos módulos de js/.
set -eu
cd "$(dirname "$0")/.."
node scripts/prerender.mjs
npm --cache /tmp/pulse-npm exec --yes --package=esbuild@0.25.12 -- esbuild js/script.js --bundle --format=iife --target=es2020 --minify --outfile=js/app.js

cat css/fonts.css css/style.css > /tmp/pulse-styles.css
npm --cache /tmp/pulse-npm exec --yes --package=esbuild@0.25.12 -- esbuild /tmp/pulse-styles.css --minify --outfile=css/app.css
