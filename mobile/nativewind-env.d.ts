/// <reference types="nativewind/types" />

// O global.css é processado pelo Metro (via nativewind/metro); para o TypeScript ele é
// só um import de efeito colateral.
declare module "*.css";
