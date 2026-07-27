// No aparelho, o fetch do React Native aceita `{ uri, name, type }` e lê o arquivo sozinho.
// Em Node isso não existe, então aqui a parte do multipart é um File/Blob de verdade —
// o que faz o teste subir a prova para o servidor real, pelo mesmo endpoint.
import fs from "node:fs";

export function parteDeArquivo(uri: string, nome: string, mime: string): unknown {
  const bytes = fs.readFileSync(uri);
  return new File([bytes], nome, { type: mime });
}
