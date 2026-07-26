import { useEffect, useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { api, type Pairing, type SyncInfo } from "../../api";
import { PhoneIcon, RefreshIcon } from "../icons";

// Tela de pareamento do celular. O QR carrega o endereço do PC + o token;
// o app lê uma vez, guarda no cofre do aparelho e depois reconecta sozinho.
const PROTOCOL = 1;

function quando(iso: string | null): string {
  if (!iso) return "nunca";
  const d = new Date(iso);
  const min = Math.round((Date.now() - d.getTime()) / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  if (min < 60 * 24) return `há ${Math.round(min / 60)} h`;
  return d.toLocaleDateString("pt-BR");
}

// 172.x sem HOST_LAN_IP = o servidor está vendo só a rede do Docker.
const soDocker = (info: SyncInfo) =>
  !info.hostLanIpFromEnv && info.lanIps.length > 0 && info.lanIps.every((ip) => ip.startsWith("172."));

export function PairPanel() {
  const [info, setInfo] = useState<SyncInfo | null>(null);
  const [host, setHost] = useState("");
  const [pairing, setPairing] = useState<Pairing | null>(null);
  const [busy, setBusy] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = async () => {
    try {
      const i = await api.getSyncInfo();
      setInfo(i);
      setHost((atual) => atual || i.hostLanIpFromEnv || i.lanIps.find((ip) => !ip.startsWith("172.")) || i.lanIps[0] || "");
    } catch {
      setErro("não consegui falar com o servidor");
    }
  };

  useEffect(() => {
    void carregar();
  }, []);

  const gerar = async () => {
    setBusy(true);
    setErro(null);
    try {
      setPairing(await api.newPairing());
      await carregar();
    } catch {
      setErro("falha ao gerar o pareamento");
    } finally {
      setBusy(false);
    }
  };

  const payload = useMemo(() => {
    if (!pairing || !host) return null;
    return JSON.stringify({ v: PROTOCOL, host, port: pairing.port, token: pairing.token });
  }, [pairing, host]);

  const copiar = async () => {
    if (!payload) return;
    await navigator.clipboard.writeText(payload).catch(() => {});
    setCopiado(true);
    window.setTimeout(() => setCopiado(false), 2000);
  };

  if (!info) {
    return (
      <div className="panel" style={{ width: 344 }}>
        <div className="panel-head"><i /><b>CELULAR</b></div>
        <div style={{ padding: "16px", fontSize: 12.5, color: "var(--mut2)" }}>
          {erro ?? "carregando…"}
        </div>
      </div>
    );
  }

  return (
    <div className="panel" style={{ width: 344 }}>
      <div className="panel-head">
        <i /><b>CELULAR</b>
        <small>{info.devices.length === 0 ? "nenhum pareado" : `${info.devices.length} pareado(s)`}</small>
      </div>

      <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ fontSize: 12, color: "var(--mut2)", lineHeight: 1.5, display: "flex", gap: 9 }}>
          <span style={{ color: "var(--amber-dk)", flex: "none", marginTop: 1 }}><PhoneIcon size={16} /></span>
          O app funciona offline e sincroniza quando estiver na mesma rede que este PC.
          Missões, provas, ataques e renda vão nos dois sentidos — o arco da semana continua
          sendo fechado aqui, com o cowork.
        </div>

        {soDocker(info) && (
          <div style={{ fontSize: 11.5, lineHeight: 1.5, background: "#fdf3e0", border: "1px solid rgba(242,164,28,.4)", borderRadius: 4, padding: "9px 11px" }}>
            O servidor só está vendo a rede interna do Docker (<b>{info.lanIps.join(", ")}</b>).
            Suba pelo atalho <b>Subir a Torre</b> (ou <code>scripts\start.ps1</code>) para ele
            aprender o IP da sua rede — ou digite o endereço à mão abaixo.
          </div>
        )}

        <div>
          <div style={{ fontSize: 11, letterSpacing: 1.5, color: "var(--mut2)", fontWeight: 600, marginBottom: 6 }}>
            ENDEREÇO DESTE PC NA REDE
          </div>
          <div style={{ display: "flex", gap: 7 }}>
            <input
              className="field"
              style={{ flex: 1 }}
              value={host}
              onChange={(e) => setHost(e.target.value.trim())}
              placeholder="192.168.0.10"
            />
            <span style={{ alignSelf: "center", fontSize: 12.5, color: "var(--faint)" }}>:{info.port}</span>
          </div>
          {info.lanIps.length > 1 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 6 }}>
              {info.lanIps.map((ip) => (
                <button
                  key={ip}
                  onClick={() => setHost(ip)}
                  style={{
                    border: `1px solid ${ip === host ? "var(--amber)" : "#e2ddd5"}`,
                    background: ip === host ? "#fdf3e0" : "transparent",
                    color: ip === host ? "var(--amber-dk)" : "var(--mut2)",
                    borderRadius: 3, padding: "3px 8px", fontSize: 11, cursor: "pointer",
                  }}
                >
                  {ip}
                </button>
              ))}
            </div>
          )}
        </div>

        {!payload && (
          <button className="btn-dark" disabled={busy || !host} onClick={gerar}>
            {info.tokenSet ? "GERAR NOVO PAREAMENTO" : "PAREAR CELULAR"}
          </button>
        )}

        {info.tokenSet && !payload && (
          <div style={{ fontSize: 11, color: "var(--faint)", lineHeight: 1.45, marginTop: -4 }}>
            Já existe um pareamento ativo. Gerar outro <b>desconecta</b> os aparelhos atuais —
            use se perdeu o celular ou trocou de aparelho.
          </div>
        )}

        {payload && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, background: "var(--soft)", borderRadius: 5, padding: "14px 12px" }}>
            <div style={{ background: "#fff", padding: 10, borderRadius: 4, lineHeight: 0 }}>
              <QRCodeSVG value={payload} size={188} level="M" marginSize={0} />
            </div>
            <div style={{ fontSize: 11.5, color: "var(--mut2)", textAlign: "center", lineHeight: 1.45 }}>
              No app, toque em <b>Parear com o PC</b> e aponte a câmera.
            </div>
            <div style={{ fontSize: 10.5, color: "var(--faint)", textAlign: "center", lineHeight: 1.4 }}>
              Este código é a chave do seu banco — não deixe aparecer em print ou live.
            </div>
            <div style={{ display: "flex", gap: 7 }}>
              <button className="btn-outline-amber" style={{ fontSize: 12, padding: "6px 12px", letterSpacing: 1 }} onClick={copiar}>
                {copiado ? "COPIADO" : "COPIAR DADOS"}
              </button>
              <button className="btn-outline-amber" style={{ fontSize: 12, padding: "6px 12px", letterSpacing: 1 }} onClick={() => setPairing(null)}>
                ESCONDER
              </button>
            </div>
          </div>
        )}

        {erro && <div style={{ fontSize: 11.5, color: "#c0392b" }}>{erro}</div>}

        <div style={{ borderTop: "1px solid #eee9e1", paddingTop: 11 }}>
          <div style={{ fontSize: 11, letterSpacing: 1.5, color: "var(--mut2)", fontWeight: 600, marginBottom: 7, display: "flex", alignItems: "center", gap: 6 }}>
            APARELHOS
            <button
              onClick={() => void carregar()}
              title="atualizar"
              style={{ marginLeft: "auto", border: "none", background: "transparent", color: "var(--mut2)", cursor: "pointer", display: "flex" }}
            >
              <RefreshIcon />
            </button>
          </div>
          {info.devices.length === 0 ? (
            <div style={{ fontSize: 11.5, color: "var(--faint)", lineHeight: 1.45 }}>
              Nenhum celular pareado ainda.
            </div>
          ) : (
            info.devices.map((d) => (
              <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 9, background: "var(--soft)", borderRadius: 4, padding: "8px 11px", marginBottom: 6 }}>
                <span style={{ color: "var(--amber-dk)", flex: "none", display: "flex" }}><PhoneIcon size={15} /></span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600 }}>{d.name}</div>
                  <div style={{ fontSize: 10.5, color: "var(--faint)" }}>
                    visto {quando(d.lastSeen)} · sincronizou {quando(d.lastPulledAt)}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
