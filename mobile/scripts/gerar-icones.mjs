// Gera os ícones do app a partir de assets/torre.svg (a mesma arte do atalho do PC).
//   node scripts/gerar-icones.mjs
//
// Roda uma vez; o resultado é versionado. Sharp é devDependency — não vai no APK.
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const aqui = path.dirname(fileURLToPath(import.meta.url));
const raiz = path.resolve(aqui, "..", "..");
const svg = fs.readFileSync(path.join(raiz, "assets", "torre.svg"));
const destino = path.join(raiz, "mobile", "assets", "images");

// O ícone adaptativo do Android corta as bordas: a arte precisa caber no círculo de
// segurança (66% do quadro), senão a torre nasce sem base.
const svgSemFundo = Buffer.from(
  svg
    .toString()
    .replace(/<rect width="256" height="256" rx="58" fill="url\(#bg\)"\/>/, "")
);

async function gerar() {
  await sharp(svg, { density: 600 }).resize(1024, 1024).png().toFile(path.join(destino, "icon.png"));

  // primeiro plano: a torre sozinha, com folga para o recorte do Android
  const arte = await sharp(svgSemFundo, { density: 600 }).resize(700, 700).png().toBuffer();
  await sharp({
    create: { width: 1024, height: 1024, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: arte, gravity: "center" }])
    .png()
    .toFile(path.join(destino, "android-icon-foreground.png"));

  await sharp({
    create: { width: 1024, height: 1024, channels: 4, background: "#f2a41c" },
  })
    .png()
    .toFile(path.join(destino, "android-icon-background.png"));

  // monocromático (tema dinâmico do Android 13+): silhueta branca sobre transparente
  await sharp(svgSemFundo, { density: 600 })
    .resize(700, 700)
    .grayscale()
    .toColorspace("b-w")
    .negate({ alpha: false })
    .extend({ top: 162, bottom: 162, left: 162, right: 162, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(path.join(destino, "android-icon-monochrome.png"));

  await sharp(svg, { density: 600 }).resize(256, 256).png().toFile(path.join(destino, "splash-icon.png"));
  await sharp(svg, { density: 600 }).resize(48, 48).png().toFile(path.join(destino, "favicon.png"));

  for (const arquivo of fs.readdirSync(destino)) {
    const { size } = fs.statSync(path.join(destino, arquivo));
    console.log(`  ${arquivo} — ${Math.round(size / 1024)} KB`);
  }
}

gerar().catch((e) => {
  console.error("falhou:", e);
  process.exit(1);
});
