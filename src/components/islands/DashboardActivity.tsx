/** @jsxImportSource preact */
import { useState } from "preact/hooks";

interface ChoreLog {
  choreName: string;
  userName: string;
  userAvatar?: string;
  points: number;
  date: string;
}

interface ExpenseLog {
  description: string;
  userName: string;
  userAvatar?: string;
  amount: number;
  date: string;
  items?: Array<{ name: string; quantity: number; unit_price: number }>;
}

interface Props {
  choreLogs: ChoreLog[];
  expenseLogs: ExpenseLog[];
}

type ActiveTab = "finanzas" | "limpieza";

function formatCLP(n: number) {
  return `$${Math.round(n).toLocaleString("es-CL")}`;
}

function MiniAvatar({ url, name, size = 16 }: { url?: string; name?: string; size?: number }) {
  if (url) {
    return <img src={url} alt="" width={size} height={size} style={{ borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />;
  }
  const letter = (name || '?')[0].toUpperCase();
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: size, height: size, borderRadius: '50%', background: 'var(--surface)', color: 'var(--text-secondary)', fontSize: size * 0.6, fontFamily: 'var(--font-mono)', flexShrink: 0 }}>
      {letter}
    </span>
  );
}

export default function DashboardActivity({ choreLogs, expenseLogs }: Props) {
  const [tab, setTab] = useState<ActiveTab>("finanzas");

  return (
    <div class="da-root">
      <div class="da-tabs">
        <button
          class={`da-tab ${tab === "finanzas" ? "da-tab-active" : ""}`}
          onClick={() => setTab("finanzas")}
        >
          FINANZAS
        </button>
        <button
          class={`da-tab ${tab === "limpieza" ? "da-tab-active" : ""}`}
          onClick={() => setTab("limpieza")}
        >
          LIMPIEZA
        </button>
      </div>

      <div class="da-content">
        {tab === "finanzas" ? (
          <div class="da-list">
            {expenseLogs.length === 0 && (
              <p class="da-empty">[SIN GASTOS RECIENTES]</p>
            )}
            {expenseLogs.map((exp, i) => (
              <div class="da-row" key={i}>
                <div class="da-row-info">
                  <span class="da-row-name">
                    {exp.items && exp.items.length > 0
                      ? exp.items.map((it) => it.name).join(", ")
                      : exp.description}
                  </span>
                  <span class="da-row-meta" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <MiniAvatar url={exp.userAvatar} name={exp.userName} size={14} />
                    {exp.userName} · {exp.date}
                  </span>
                </div>
                <span class="da-row-expense">-{formatCLP(exp.amount)}</span>
              </div>
            ))}
          </div>
        ) : (
          <div class="da-list">
            {choreLogs.length === 0 && (
              <p class="da-empty">[SIN TAREAS RECIENTES]</p>
            )}
            {choreLogs.map((log, i) => (
              <div class="da-row" key={i}>
                <div class="da-row-info">
                  <span class="da-row-name">{log.choreName}</span>
                  <span class="da-row-meta" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <MiniAvatar url={log.userAvatar} name={log.userName} size={14} />
                    {log.userName} · {log.date}
                  </span>
                </div>
                <span class="da-row-pts">+{log.points}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
