// Operações de disco das provas, separadas da captura de propósito: o motor de
// sincronização precisa apagar arquivo, mas não precisa (e não deve) carregar câmera,
// galeria e manipulador de imagem junto.
import { Directory, File, Paths } from "expo-file-system";

export function pastaDeProvas(nome: "provas" | "miniaturas"): Directory {
  const dir = new Directory(Paths.document, nome);
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

/** Copia um arquivo temporário (câmera/galeria) para a pasta definitiva do app. */
export function guardar(deUri: string, para: Directory, nomeArquivo: string): File {
  const origem = new File(deUri);
  const destino = new File(para, nomeArquivo);
  if (destino.exists) destino.delete();
  origem.copy(destino);
  return destino;
}

/** Chamado quando o servidor confirma o recebimento: o original sai, a miniatura fica. */
export function apagarOriginal(uri: string): void {
  try {
    const f = new File(uri);
    if (f.exists) f.delete();
  } catch {
    // arquivo já pode ter ido embora com a limpeza do sistema
  }
}
