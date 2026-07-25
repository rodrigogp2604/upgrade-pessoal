import { StarIcon } from "./icons";

export type CelebrationData =
  | { type: "level"; level: number; title: string | null }
  | { type: "boss"; name: string; isItem?: boolean };

interface Props {
  data: CelebrationData;
  onClose: () => void;
}

export function Celebration({ data, onClose }: Props) {
  return (
    <div className="cel">
      <div className="cel-rays" />
      <div className="cel-flash" />
      {data.type === "level" ? (
        <div className="cel-body">
          <div className="cel-kicker">LEVEL UP</div>
          <div className="cel-level">{data.level}</div>
          {data.title && <div className="cel-title"><StarIcon size={15} />{data.title}</div>}
          <div className="cel-sub">Um novo andar da Torre se abre acima de você.</div>
        </div>
      ) : data.isItem ? (
        <div className="cel-body">
          <div className="cel-boss-skull">🎒</div>
          <div className="cel-boss-head">ITEM CONQUISTADO</div>
          <div className="cel-boss-name">{data.name}</div>
          <div className="cel-sub">Compra quitada — agora é seu de verdade. Foi para a bolsa de itens.</div>
        </div>
      ) : (
        <div className="cel-body">
          <div className="cel-boss-skull">☠</div>
          <div className="cel-boss-head">CHEFÃO DERROTADO</div>
          <div className="cel-boss-name">{data.name}</div>
          <div className="cel-sub">Dívida eliminada. Sua Saúde Financeira agradece.</div>
        </div>
      )}
      <button className="cel-btn" onClick={onClose}>CONTINUAR A ESCALADA</button>
    </div>
  );
}
