// Primeira abertura: o banco está vazio e quem preenche é a entrevista
// do /briefing com o Claude (Code ou Cowork). Aqui só damos o caminho.
export function Onboarding() {
  const steps = [
    { n: "1", title: "O painel já está no ar", desc: "Este app rodando é o tabuleiro do jogo. Pode deixar aberto." },
    { n: "2", title: "Abra o Claude nesta pasta", desc: "Claude Code (terminal) ou Claude Cowork, tanto faz — os dois leem as skills do projeto." },
    { n: "3", title: "Rode /briefing", desc: "Uma entrevista sincera: sua realidade, seu nível real (talvez você já comece no andar 50), suas metas. Ela define o personagem, os títulos e o primeiro arco de missões." },
  ];
  return (
    <div className="app">
      <div className="topline" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 26, padding: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, animation: "riseIn .5s cubic-bezier(.2,1.3,.4,1)" }}>
          <div className="brand-mark" style={{ width: 34, height: 34 }}><span style={{ width: 13, height: 13 }} /></div>
          <div style={{ fontFamily: "var(--disp)", fontWeight: 700, fontSize: 26, letterSpacing: 5 }}>UPGRADE PESSOAL</div>
        </div>
        <div style={{ fontSize: 14, color: "var(--mut)", textAlign: "center", maxWidth: 460, lineHeight: 1.6, animation: "riseIn .5s .08s both" }}>
          Um RPG da sua vida real: missões que valem XP, uma Torre para escalar,
          dívidas como chefões. Antes de subir o primeiro andar, o jogo precisa
          te conhecer de verdade.
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, width: 480, maxWidth: "94vw" }}>
          {steps.map((s, i) => (
            <div key={s.n} style={{
              display: "flex", gap: 14, alignItems: "flex-start", background: "#fff", borderRadius: 5,
              padding: "14px 18px", boxShadow: "0 8px 24px rgba(43,37,35,.12)",
              animation: `riseIn .5s ${0.16 + i * 0.1}s both`,
            }}>
              <div style={{
                width: 30, height: 30, borderRadius: "50%", background: i === 2 ? "var(--amber)" : "var(--ink)",
                color: "#fff", fontFamily: "var(--disp)", fontWeight: 700, fontSize: 15,
                display: "flex", alignItems: "center", justifyContent: "center", flex: "none", marginTop: 2,
              }}>{s.n}</div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14.5 }}>{s.title}</div>
                <div style={{ fontSize: 12.5, color: "var(--mut)", marginTop: 3, lineHeight: 1.5 }}>{s.desc}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{
          fontFamily: "var(--disp)", fontWeight: 600, fontSize: 13, letterSpacing: 2, color: "var(--amber-dk)",
          background: "#fdf3e0", border: "1px solid rgba(242,164,28,.4)", borderRadius: 20, padding: "8px 20px",
          animation: "riseIn .5s .5s both",
        }}>
          ESTA TELA SE TRANSFORMA SOZINHA QUANDO O BRIEFING EXISTIR
        </div>
      </div>
    </div>
  );
}
