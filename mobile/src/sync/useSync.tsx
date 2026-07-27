// Estado da sincronização para a interface: em que pé está, quantas coisas esperam,
// e as ações (sincronizar agora, parear, procurar o PC).
//
// Gatilhos automáticos (decisão D13): ao abrir/voltar ao app e a cada 5 minutos.
// Conflito NUNCA é resolvido sozinho — só entra na lista e espera o usuário.
import {
  createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode,
} from "react";
import { AppState, Linking } from "react-native";
import { useSQLiteContext } from "expo-sqlite";
import * as Application from "expo-application";
import { sincronizar, type Estado } from "./engine";
import { esquecerPareamento, lerPareamento, salvarPareamento, trocarHost, type Pairing } from "./pairing";
import { procurarNaRede } from "./client";
import { deviceId } from "./pairing";
import { countConflicts, countPending, getSyncState } from "@/db/repo";
import { useGame } from "@/game/useGame";

const INTERVALO_MS = 5 * 60 * 1000;

type SyncContext = {
  estado: Estado;
  mensagem: string | null;
  pendentes: number;
  conflitos: number;
  ultimaSync: string | null;
  pareamento: Pairing | null;
  sincronizarAgora: () => Promise<void>;
  parear: (p: Pairing) => Promise<void>;
  despareamento: () => Promise<void>;
  mudarHost: (host: string, port?: number) => Promise<void>;
  procurarPc: () => Promise<string | null>;
  procurando: { testados: number; total: number } | null;
  /** o PC publicou uma versão mais nova que a instalada */
  atualizacao: { versao: string; host: string } | null;
  baixarAtualizacao: () => void;
};

const Ctx = createContext<SyncContext | null>(null);

export function SyncProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const { recarregar } = useGame();

  const [estado, setEstado] = useState<Estado>("offline");
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [pendentes, setPendentes] = useState(0);
  const [conflitos, setConflitos] = useState(0);
  const [ultimaSync, setUltimaSync] = useState<string | null>(null);
  const [pareamento, setPareamento] = useState<Pairing | null>(null);
  const [procurando, setProcurando] = useState<{ testados: number; total: number } | null>(null);
  const [atualizacao, setAtualizacao] = useState<{ versao: string; host: string } | null>(null);

  // trava simples: duas rodadas ao mesmo tempo enviariam a mesma operação duas vezes
  const rodando = useRef(false);

  const atualizarContadores = useCallback(async () => {
    const [p, c, ultima, par, versaoPublicada, codigoPublicado] = await Promise.all([
      countPending(db),
      countConflicts(db),
      getSyncState(db, "lastSyncAt"),
      lerPareamento(db),
      getSyncState(db, "latestAppVersion"),
      getSyncState(db, "latestAppVersionCode"),
    ]);
    setPendentes(p);
    setConflitos(c);
    setUltimaSync(ultima);
    setPareamento(par);

    // sem loja, o próprio PC avisa que existe versão nova
    const instalado = Number(Application.nativeBuildVersion ?? 0);
    const publicado = Number(codigoPublicado ?? 0);
    setAtualizacao(publicado > instalado && versaoPublicada ? { versao: versaoPublicada, host: par?.host ?? "" } : null);

    return par;
  }, [db]);

  const sincronizarAgora = useCallback(async () => {
    if (rodando.current) return;
    rodando.current = true;
    const par = await atualizarContadores();
    if (!par) {
      setEstado("nao_pareado");
      rodando.current = false;
      return;
    }

    setEstado("sincronizando");
    setMensagem(null);
    try {
      const r = await sincronizar(db);
      setEstado(r.estado);
      setMensagem(r.mensagem ?? null);
      if (r.baixou || r.enviadas > 0) await recarregar();
    } finally {
      await atualizarContadores();
      rodando.current = false;
    }
  }, [db, atualizarContadores, recarregar]);

  // primeira carga + volta do app para a frente + batida de 5 min
  useEffect(() => {
    void sincronizarAgora();

    const assinatura = AppState.addEventListener("change", (s) => {
      if (s === "active") void sincronizarAgora();
    });
    const timer = setInterval(() => void sincronizarAgora(), INTERVALO_MS);

    return () => {
      assinatura.remove();
      clearInterval(timer);
    };
  }, [sincronizarAgora]);

  const parear = useCallback(
    async (p: Pairing) => {
      await salvarPareamento(db, p);
      await atualizarContadores();
      await sincronizarAgora();
    },
    [db, atualizarContadores, sincronizarAgora]
  );

  const despareamento = useCallback(async () => {
    await esquecerPareamento(db);
    setEstado("nao_pareado");
    await atualizarContadores();
  }, [db, atualizarContadores]);

  const mudarHost = useCallback(
    async (host: string, port = 4000) => {
      await trocarHost(db, host, port);
      await atualizarContadores();
      await sincronizarAgora();
    },
    [db, atualizarContadores, sincronizarAgora]
  );

  const procurarPc = useCallback(async () => {
    const par = await lerPareamento(db);
    if (!par) return null;
    const dev = await deviceId(db);

    setProcurando({ testados: 0, total: 254 });
    try {
      const achado = await procurarNaRede(par, dev, (testados, total) => setProcurando({ testados, total }));
      if (achado) {
        await trocarHost(db, achado, par.port);
        await atualizarContadores();
        await sincronizarAgora();
      }
      return achado;
    } finally {
      setProcurando(null);
    }
  }, [db, atualizarContadores, sincronizarAgora]);

  const valor: SyncContext = {
    estado,
    mensagem,
    pendentes,
    conflitos,
    ultimaSync,
    pareamento,
    sincronizarAgora,
    parear,
    despareamento,
    mudarHost,
    procurarPc,
    procurando,
    atualizacao,
    // o app nunca instala sozinho: abre o download e o Android conduz
    baixarAtualizacao: () => {
      if (pareamento) void Linking.openURL(`http://${pareamento.host}:${pareamento.port}/api/app/download`);
    },
  };

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export function useSync(): SyncContext {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSync precisa estar dentro de <SyncProvider>");
  return ctx;
}
