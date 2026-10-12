#!/usr/bin/env sh
# Atualiza o arquivo de navegador após alterações nos módulos de js/.
set -eu
cd "$(dirname "$0")/.."
node scripts/prerender.mjs
npm --cache /tmp/pulse-npm exec --yes --package=esbuild@0.25.12 -- esbuild js/script.js --bundle --format=iife --target=es2020 --minify --outfile=js/app.js

cat css/fonts.css css/style.css > /tmp/pulse-styles.css
npm --cache /tmp/pulse-npm exec --yes --package=esbuild@0.25.12 -- esbuild /tmp/pulse-styles.css --minify --outfile=css/app.css

for entry in checkout admin order; do
  npm --cache /tmp/pulse-npm exec --yes --package=esbuild@0.25.12 -- esbuild "js/$entry.js" --bundle --format=iife --target=es2020 --minify --outfile="js/$entry-app.js"
done

# Publicação: somente telas e assets públicos, sem código do servidor.
mkdir -p public/assets public/css public/js
cp -R assets/. public/assets/
cp index.html admin.html checkout.html pedido.html pedidos.html privacidade.html public/
cp css/app.css css/commerce.css public/css/
cp js/app.js js/admin-app.js js/checkout-app.js js/order-app.js js/config.js public/js/
