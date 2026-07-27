// expo-file-system sobre o sistema de arquivos do Node, com a mesma forma da API nova
// (classes File/Directory + Paths). Só o que o app usa.
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const RAIZ = path.join(os.tmpdir(), "upgrade-provas-teste");

export class Directory {
  uri: string;

  constructor(...partes: (string | Directory)[]) {
    this.uri = path.join(...partes.map((p) => (typeof p === "string" ? p : p.uri)));
  }

  get exists() {
    return fs.existsSync(this.uri);
  }

  // a API real aceita { intermediates: true }; aqui recursive já cobre isso
  create(_opcoes?: { intermediates?: boolean }) {
    fs.mkdirSync(this.uri, { recursive: true });
  }

  delete() {
    fs.rmSync(this.uri, { recursive: true, force: true });
  }
}

export class File {
  uri: string;

  constructor(...partes: (string | Directory)[]) {
    this.uri = path.join(...partes.map((p) => (typeof p === "string" ? p : p.uri)));
  }

  get exists() {
    return fs.existsSync(this.uri);
  }

  get size() {
    return this.exists ? fs.statSync(this.uri).size : 0;
  }

  create() {
    fs.mkdirSync(path.dirname(this.uri), { recursive: true });
    if (!this.exists) fs.writeFileSync(this.uri, "");
  }

  write(conteudo: string | Uint8Array) {
    fs.mkdirSync(path.dirname(this.uri), { recursive: true });
    fs.writeFileSync(this.uri, conteudo);
  }

  copy(destino: File) {
    fs.mkdirSync(path.dirname(destino.uri), { recursive: true });
    fs.copyFileSync(this.uri, destino.uri);
  }

  delete() {
    if (this.exists) fs.unlinkSync(this.uri);
  }
}

export const Paths = {
  document: new Directory(path.join(RAIZ, "document")),
  cache: new Directory(path.join(RAIZ, "cache")),
};
