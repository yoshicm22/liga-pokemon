// Compila Tailwind una sola vez y lo incrusta en los HTML (antes se compilaba en el navegador desde el CDN).
// Uso: npm run css   (repetir tras cambiar clases en public/index.html o demo-v9.html)
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const files = ["public/index.html", "demo-v9.html"];
const css = execFileSync("npx", ["tailwindcss", "--content", files.join(","), "--minify"], {
  input: "@tailwind base;@tailwind components;@tailwind utilities;",
  encoding: "utf8",
});
const tag = `<style id="tw">${css.trim()}</style>`;
for (const f of files) {
  const html = readFileSync(f, "utf8");
  const out = html
    .replace(/<script src="https:\/\/cdn\.tailwindcss\.com[^"]*"><\/script>/, tag)
    .replace(/<style id="tw">[\s\S]*?<\/style>/, tag);
  if (!out.includes('<style id="tw">')) throw new Error(`${f}: no encuentro dónde poner el CSS`);
  writeFileSync(f, out);
  console.log(`${f}: ${(css.length / 1024).toFixed(1)} KB de CSS incrustado`);
}
