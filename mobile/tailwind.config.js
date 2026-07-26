/** @type {import('tailwindcss').Config} */
// Paleta vinda do protótipo "Upgrade Pessoal Mobile.dc.html" (âmbar #f2a41c sobre papel
// quente). Os valores concretos ficam em src/global.css como variáveis CSS, com o tema
// escuro sobrescrevendo em `.dark:root` — assim cada componente usa UMA classe
// (`text-ink`, `bg-card`) e o tema troca sozinho, sem `dark:` espalhado pelo código.
const tema = (nome) => `rgb(var(--${nome}) / <alpha-value>)`;

module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        accent: "#f2a41c", // âmbar: o mesmo nos dois temas, é a identidade
        accentSoft: "#f7c14f",
        danger: tema("danger"),
        bg1: tema("bg1"),
        bg2: tema("bg2"),
        bg3: tema("bg3"),
        ink: tema("ink"),
        ink2: tema("ink2"),
        ink3: tema("ink3"),
        faint: tema("faint"),
        faint2: tema("faint2"),
        accentInk: tema("accentInk"),
        card: tema("card"),
        cardLine: tema("cardLine"),
        surf: tema("surf"),
        surf2: tema("surf2"),
        line: tema("line"),
        soft: tema("soft"),
        track: tema("track"),
        field: tema("field"),
        panel: tema("panel"),
        panelLine: tema("panelLine"),
        panelInk: tema("panelInk"),
        panelMute: tema("panelMute"),
        panelFaint: tema("panelFaint"),
        amberSoft: tema("amberSoft"),
        navBg: tema("navBg"),
        toast: tema("toast"),
        hexFill: tema("hexFill"),
        hexGrid: tema("hexGrid"),
        dot: tema("dot"),
      },
      fontFamily: {
        // Rajdhani = títulos e números (o "display" do jogo); IBM Plex = texto corrido
        display: ["Rajdhani_700Bold"],
        displaySemi: ["Rajdhani_600SemiBold"],
        sans: ["IBMPlexSans_400Regular"],
        medium: ["IBMPlexSans_500Medium"],
        semibold: ["IBMPlexSans_600SemiBold"],
      },
    },
  },
  plugins: [],
};
