// Banco local do app. Duas metades:
//
//  1. ESPELHO do servidor (mesmos ids, mesmos nomes de coluna). É o que as telas leem.
//  2. MÁQUINA DE SINCRONIZAÇÃO: outbox (o que fiz e ainda não subiu), conflicts
//     (o que o PC discordou) e pending_files (provas esperando upload).
//
// As FKs repetem o ON DELETE CASCADE do servidor de propósito: apagar uma missão no PC
// não gera lápide para as provas dela, porque a cascata acontece dentro do SQLite dos
// dois lados. Para isso funcionar aqui, `PRAGMA foreign_keys = ON` é obrigatório.
import type { SQLiteDatabase } from "expo-sqlite";

export const SCHEMA_VERSION = 1;

const DDL = `
CREATE TABLE IF NOT EXISTS character (
  id         INTEGER PRIMARY KEY NOT NULL,
  name       TEXT    NOT NULL DEFAULT 'Jogador',
  xp         INTEGER NOT NULL DEFAULT 0,
  stats      TEXT    NOT NULL DEFAULT '{}',
  updatedAt  TEXT
);

CREATE TABLE IF NOT EXISTS titles (
  id        INTEGER PRIMARY KEY NOT NULL,
  level     INTEGER NOT NULL,
  name      TEXT    NOT NULL,
  updatedAt TEXT
);

CREATE TABLE IF NOT EXISTS weeks (
  id        INTEGER PRIMARY KEY NOT NULL,
  floor     INTEGER NOT NULL,
  theme     TEXT    NOT NULL,
  startDate TEXT    NOT NULL,
  status    TEXT    NOT NULL DEFAULT 'active',
  rating    INTEGER,
  review    TEXT,
  closedAt  TEXT,
  updatedAt TEXT
);

CREATE TABLE IF NOT EXISTS missions (
  id          INTEGER PRIMARY KEY NOT NULL,
  weekId      INTEGER NOT NULL REFERENCES weeks(id) ON DELETE CASCADE,
  "order"     INTEGER NOT NULL DEFAULT 0,
  kind        TEXT    NOT NULL DEFAULT 'main',  -- main = linear · side = XP bônus opcional
  title       TEXT    NOT NULL,
  description TEXT,
  bonus       TEXT,
  xp          INTEGER NOT NULL DEFAULT 0,
  statGains   TEXT    NOT NULL DEFAULT '{}',
  status      TEXT    NOT NULL DEFAULT 'pending',
  rating      INTEGER,
  completedAt TEXT,
  updatedAt   TEXT
);
CREATE INDEX IF NOT EXISTS idx_missions_week ON missions(weekId);

CREATE TABLE IF NOT EXISTS attachments (
  id           INTEGER PRIMARY KEY NOT NULL,
  missionId    INTEGER NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  originalName TEXT    NOT NULL,
  mimeType     TEXT,
  size         INTEGER,
  url          TEXT,
  localUri     TEXT,   -- miniatura/arquivo que ainda vive no aparelho
  clientUuid   TEXT,
  createdAt    TEXT,
  updatedAt    TEXT
);
CREATE INDEX IF NOT EXISTS idx_attachments_mission ON attachments(missionId);

CREATE TABLE IF NOT EXISTS debts (
  id        INTEGER PRIMARY KEY NOT NULL,
  name      TEXT    NOT NULL,
  note      TEXT,
  kind      TEXT    NOT NULL DEFAULT 'debt',
  total     REAL    NOT NULL,
  status    TEXT    NOT NULL DEFAULT 'active',
  "order"   INTEGER NOT NULL DEFAULT 0,
  updatedAt TEXT
);

CREATE TABLE IF NOT EXISTS payments (
  id         INTEGER PRIMARY KEY NOT NULL,
  debtId     INTEGER NOT NULL REFERENCES debts(id) ON DELETE CASCADE,
  amount     REAL    NOT NULL,
  note       TEXT,
  date       TEXT,
  clientUuid TEXT UNIQUE,
  updatedAt  TEXT
);
CREATE INDEX IF NOT EXISTS idx_payments_debt ON payments(debtId);

CREATE TABLE IF NOT EXISTS settings (
  key       TEXT PRIMARY KEY NOT NULL,
  value     TEXT NOT NULL,
  updatedAt TEXT
);

CREATE TABLE IF NOT EXISTS visits (
  date TEXT PRIMARY KEY NOT NULL
);

CREATE TABLE IF NOT EXISTS briefing (
  id        INTEGER PRIMARY KEY NOT NULL,
  content   TEXT NOT NULL,
  createdAt TEXT
);

-- ─────────── máquina de sincronização ───────────

-- cursor do pull, id do aparelho, endereço do PC, preferências locais (tema)
CREATE TABLE IF NOT EXISTS sync_state (
  key   TEXT PRIMARY KEY NOT NULL,
  value TEXT
);

-- Fila de operações. A coluna "base" guarda o que o app viu no momento da ação: é isso
-- que permite o servidor perceber que o PC mexeu depois e levantar conflito.
CREATE TABLE IF NOT EXISTS outbox (
  opId      TEXT PRIMARY KEY NOT NULL,
  type      TEXT    NOT NULL,
  payload   TEXT    NOT NULL,
  base      TEXT,
  status    TEXT    NOT NULL DEFAULT 'pending',  -- pending|conflict|discarded
  tries     INTEGER NOT NULL DEFAULT 0,
  lastError TEXT,
  createdAt TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_outbox_status ON outbox(status, createdAt);

CREATE TABLE IF NOT EXISTS conflicts (
  opId        TEXT PRIMARY KEY NOT NULL,
  entity      TEXT NOT NULL,
  entityId    TEXT NOT NULL,
  reason      TEXT NOT NULL,
  mineLabel   TEXT NOT NULL,
  theirsLabel TEXT NOT NULL,
  createdAt   TEXT NOT NULL
);

-- Ponte entre o id provisório (negativo) que o app inventou offline e o id real que o
-- servidor devolveu. Sem isso, "criei o chefão e paguei ele antes de sincronizar" chegaria
-- ao PC apontando para um id que não existe lá.
CREATE TABLE IF NOT EXISTS id_map (
  entity    TEXT    NOT NULL,
  localId   INTEGER NOT NULL,
  serverId  INTEGER NOT NULL,
  createdAt TEXT    NOT NULL,
  PRIMARY KEY (entity, localId)
);

CREATE TABLE IF NOT EXISTS pending_files (
  opId       TEXT PRIMARY KEY NOT NULL,
  missionId  INTEGER NOT NULL,
  localUri   TEXT    NOT NULL,
  clientUuid TEXT    NOT NULL,
  bytes      INTEGER,
  createdAt  TEXT    NOT NULL
);
`;

export async function migrate(db: SQLiteDatabase): Promise<void> {
  // WAL: escrita não bloqueia leitura — importante porque a sincronização grava
  // enquanto as telas leem. foreign_keys: sem isso a cascata não acontece.
  await db.execAsync("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");

  const row = await db.getFirstAsync<{ user_version: number }>("PRAGMA user_version");
  const atual = row?.user_version ?? 0;

  if (atual < 1) {
    await db.execAsync(DDL);
  }

  // Migrações futuras entram como `if (atual < 2) { ... }` — nunca editando o DDL acima,
  // senão quem já instalou o APK fica sem a mudança.

  if (atual !== SCHEMA_VERSION) {
    await db.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION}`);
  }
}
