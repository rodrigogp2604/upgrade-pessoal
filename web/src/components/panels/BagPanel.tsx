import { useRef } from "react";
import type { DebtsResponse } from "../../api";
import { BackpackIcon, CheckIcon } from "../icons";

interface Props {
  data: DebtsResponse;
  busy: boolean;
  onAddPurchase: (name: string, total: number, alreadyPaid: number) => void;
}

function money(v: number): string {
  return "R$ " + Math.round(v).toLocaleString("pt-BR");
}

// Bolsa de itens: aquisições quitadas viram conquistas.
// Comprar algo parcelado = registrar aqui → enquanto dever, é um chefão.
export function BagPanel({ data, busy, onAddPurchase }: Props) {
  const nameRef = useRef<HTMLInputElement>(null);
  const totalRef = useRef<HTMLInputElement>(null);
  const paidRef = useRef<HTMLInputElement>(null);

  const items = data.debts.filter((d) => d.kind === "item" && d.status === "dead");
  const paying = data.debts.filter((d) => d.kind === "item" && d.status === "active");

  const add = () => {
    const n = nameRef.current?.value.trim() ?? "";
    const total = parseFloat(totalRef.current?.value ?? "");
    const paid = parseFloat(paidRef.current?.value ?? "") || 0;
    if (!n || !total || total <= 0 || paid < 0 || paid > total) return;
    if (nameRef.current) nameRef.current.value = "";
    if (totalRef.current) totalRef.current.value = "";
    if (paidRef.current) paidRef.current.value = "";
    onAddPurchase(n, total, paid);
  };

  return (
    <div className="panel" style={{ width: 344 }}>
      <div className="panel-head"><i /><b>BOLSA DE ITENS</b>
        {items.length > 0 && <small>{items.length} {items.length === 1 ? "item" : "itens"}</small>}
      </div>
      <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
        {items.length === 0 && paying.length === 0 && (
          <div style={{ textAlign: "center", fontSize: 12.5, color: "var(--mut2)", padding: "10px 6px", lineHeight: 1.5 }}>
            A bolsa está vazia. Registre uma compra abaixo — se ainda estiver
            pagando, ela vira um chefão; quitou, o item aparece aqui como conquista.
          </div>
        )}

        {items.map((d) => (
          <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 11, background: "var(--soft)", borderRadius: 4, padding: "10px 12px" }}>
            <div style={{ width: 30, height: 30, borderRadius: 6, background: "var(--amber)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
              <BackpackIcon size={16} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{d.name}</div>
              {d.note && <div style={{ fontSize: 11, color: "var(--mut2)" }}>{d.note}</div>}
            </div>
            <div style={{ textAlign: "right", flex: "none" }}>
              <div style={{ fontFamily: "var(--disp)", fontWeight: 700, fontSize: 14, color: "var(--amber-dk)" }}>{money(d.total)}</div>
              <div style={{ fontSize: 10, color: "var(--faint)", display: "flex", alignItems: "center", gap: 3, justifyContent: "flex-end" }}>
                <span style={{ display: "inline-flex", width: 12, height: 12, borderRadius: "50%", background: "var(--amber)", alignItems: "center", justifyContent: "center" }}><CheckIcon size={8} /></span>
                CONQUISTADO
              </div>
            </div>
          </div>
        ))}

        {paying.length > 0 && (
          <div style={{ fontSize: 11, color: "var(--mut2)", lineHeight: 1.5, background: "#fdf3e0", border: "1px solid rgba(242,164,28,.35)", borderRadius: 4, padding: "8px 11px" }}>
            Em batalha: {paying.map((d) => `${d.name} (falta ${money(d.remaining)})`).join(" · ")} — veja nos Chefões.
          </div>
        )}

        <div style={{ borderTop: "1px solid #eee9e1", paddingTop: 11 }}>
          <div style={{ fontSize: 11, letterSpacing: 1.5, color: "var(--mut2)", fontWeight: 600, marginBottom: 7 }}>REGISTRAR COMPRA</div>
          <input ref={nameRef} placeholder="O que comprou? (ex.: cadeira nova)" className="field" style={{ width: "100%" }} />
          <div style={{ display: "flex", gap: 7, marginTop: 7 }}>
            <input ref={totalRef} type="number" placeholder="Custo total (R$)" className="field" style={{ flex: 1 }} />
            <input ref={paidRef} type="number" placeholder="Já pago (R$)" className="field" style={{ flex: 1 }}
              onKeyDown={(e) => { if (e.key === "Enter") add(); }} />
            <button className="btn-outline-amber" disabled={busy} style={{ fontSize: 13, padding: "6px 13px", letterSpacing: 1 }} onClick={add}>OK</button>
          </div>
          <div style={{ fontSize: 10.5, color: "var(--faint)", marginTop: 5 }}>
            Pagou tudo? Vira item na hora. Falta pagar? Nasce um chefão com o restante de HP.
          </div>
        </div>
      </div>
    </div>
  );
}
