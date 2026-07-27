// Distribuição do APK pelo próprio servidor local.
//
// Sem loja: o celular já fala com este PC na porta 4000, então é ele que entrega o app.
// O binário mora em data/apk/ — junto do banco e das provas, fora do git, dentro do
// volume do Docker (publicar versão nova não exige rebuild da imagem).
//
// Estas rotas ficam SEM token de propósito: a primeira instalação acontece antes de
// existir pareamento, e quem já está na rede local já alcança o painel. O token protege
// o dado; o binário é o mesmo que qualquer um instalaria.
import path from "node:path";
import fs from "node:fs";
import { Router } from "express";
import { route } from "../lib/http";
import { UPLOAD_DIR } from "../lib/uploads";

export const appRouter = Router();

// data/apk/ fica ao lado de data/uploads/
export const APK_DIR = process.env.APK_DIR || path.resolve(UPLOAD_DIR, "..", "apk");

export type ApkManifest = {
  version: string;
  versionCode: number;
  builtAt: string;
  file: string;
  sizeBytes: number;
  sha256: string;
};

export function lerManifesto(): ApkManifest | null {
  try {
    const bruto = fs.readFileSync(path.join(APK_DIR, "manifest.json"), "utf8");
    const m = JSON.parse(bruto) as ApkManifest;
    if (!m?.file || !fs.existsSync(path.join(APK_DIR, m.file))) return null;
    return m;
  } catch {
    return null;
  }
}

appRouter.get(
  "/latest",
  route(async (_req, res) => {
    const manifesto = lerManifesto();
    if (!manifesto) {
      return res.json({ publicado: false, comoPublicar: "rode scripts\\build-apk.ps1 no PC" });
    }
    res.json({ publicado: true, ...manifesto, url: "/api/app/download" });
  })
);

appRouter.get(
  "/download",
  route(async (_req, res) => {
    const manifesto = lerManifesto();
    if (!manifesto) return res.status(404).json({ error: "nenhum APK publicado ainda", code: "not_found" });

    const caminho = path.join(APK_DIR, manifesto.file);
    // sem este Content-Type o Chrome trata como arquivo genérico e o Android
    // nem oferece a instalação
    res.setHeader("Content-Type", "application/vnd.android.package-archive");
    res.setHeader("Content-Disposition", `attachment; filename="${manifesto.file}"`);
    res.setHeader("Content-Length", String(manifesto.sizeBytes));
    fs.createReadStream(caminho).pipe(res);
  })
);
