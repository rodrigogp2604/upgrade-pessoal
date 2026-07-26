const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// `mobile/` fica de fora dos workspaces do npm (decisão D7), então na raiz do repositório
// existe OUTRO node_modules — com React 18 vindo do painel web. Por padrão o Metro sobe
// na árvore procurando módulos e acabaria misturando os dois Reacts, o que aparece só em
// runtime como "Invalid hook call". Aqui a busca fica presa ao node_modules do app.
config.resolver.nodeModulesPaths = [path.resolve(__dirname, "node_modules")];
config.resolver.disableHierarchicalLookup = true;

module.exports = withNativeWind(config, { input: "./src/global.css" });
