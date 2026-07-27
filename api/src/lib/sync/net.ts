import os from "node:os";

// Dentro do Docker, os.networkInterfaces() só enxerga a rede do container (172.x) —
// esse IP é inútil para o celular. Por isso o script que sobe o servidor descobre o
// IPv4 da máquina e injeta em HOST_LAN_IP; ele entra na frente da lista.
export function lanIps(): string[] {
  const fromEnv = (process.env.HOST_LAN_IP ?? "").trim();
  const detected: string[] = [];

  for (const addrs of Object.values(os.networkInterfaces())) {
    for (const a of addrs ?? []) {
      if (a.family === "IPv4" && !a.internal) detected.push(a.address);
    }
  }

  const list = fromEnv ? [fromEnv, ...detected.filter((ip) => ip !== fromEnv)] : detected;
  return list;
}

export function isDockerish(): boolean {
  return lanIps().every((ip) => ip.startsWith("172.")) && !process.env.HOST_LAN_IP;
}
