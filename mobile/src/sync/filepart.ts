// Única parte do upload que é específica de plataforma: como um arquivo do disco entra
// num FormData.
//
// No React Native, `fetch` aceita `{ uri, name, type }` e o próprio runtime lê o arquivo —
// não existe Blob de arquivo local. Fora do aparelho (testes em Node) o mesmo papel é
// cumprido por um Blob de verdade, trocado via `paths` do tsconfig.test.json.
export function parteDeArquivo(uri: string, nome: string, mime: string): unknown {
  return { uri, name: nome, type: mime };
}
