// Cofre em memória para os testes fora do aparelho.
const cofre = new Map<string, string>();

export async function setItemAsync(chave: string, valor: string): Promise<void> {
  cofre.set(chave, valor);
}

export async function getItemAsync(chave: string): Promise<string | null> {
  return cofre.get(chave) ?? null;
}

export async function deleteItemAsync(chave: string): Promise<void> {
  cofre.delete(chave);
}
