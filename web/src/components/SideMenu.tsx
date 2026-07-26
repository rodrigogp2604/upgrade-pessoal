import { BackpackIcon, BossIcon, CoinsIcon, PhoneIcon, ScrollIcon, TowerIcon, UserIcon } from "./icons";
import type { MenuId } from "../App";

interface Props {
  active: MenuId;
  onToggle: (menu: Exclude<MenuId, null>) => void;
}

const ITEMS: { id: Exclude<MenuId, null>; icon: JSX.Element; label: string }[] = [
  { id: "status", icon: <UserIcon />, label: "Status do jogador" },
  { id: "torre", icon: <TowerIcon />, label: "A Torre" },
  { id: "boss", icon: <BossIcon />, label: "Chefões (dívidas e compras)" },
  { id: "renda", icon: <CoinsIcon />, label: "Renda e bolsa de ouro" },
  { id: "bolsa", icon: <BackpackIcon />, label: "Bolsa de itens" },
  { id: "briefing", icon: <ScrollIcon />, label: "Briefing" },
  { id: "celular", icon: <PhoneIcon />, label: "Parear celular" },
];

export function SideMenu({ active, onToggle }: Props) {
  return (
    <div className="menu">
      {ITEMS.map((it) => (
        <button
          key={it.id}
          className={`ico${active === it.id ? " on" : ""}`}
          title={it.label}
          onClick={() => onToggle(it.id)}
        >
          {it.icon}
        </button>
      ))}
    </div>
  );
}
