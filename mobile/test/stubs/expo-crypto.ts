// Substituto de expo-crypto para rodar as funções de banco fora do aparelho.
// Mapeado por `paths` no tsconfig.test.json — o código de produção não muda.
import { randomUUID as nodeRandomUUID } from "node:crypto";

export const randomUUID = () => nodeRandomUUID();
