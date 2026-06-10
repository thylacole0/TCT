/** @jsxImportSource preact */
import { useState, useCallback, useEffect, useRef } from "preact/hooks";
import TctIcon from "../icons/TctIcon";

// ─── Types ───
interface ShoppingItem {
  id: string;
  name: string;
  list_type: "comida" | "aseo";
  quantity: number;
  is_bought: boolean;
  bought_price: number | null;
  bought_at: string | null;
  bought_by: string | null;
  converted_expense_id?: string | null;
  created_by: string;
  created_at: string;
  profiles?: { display_name: string; avatar_url: string | null };
}

type ListType = "comida" | "aseo";

interface Props {
  comidaBudgetWeekId?: string;
  aseoBudgetWeekId?: string;
  isReadOnly?: boolean;
}

// ─── Helpers ───
function formatCLP(n: number) {
  return `$${Math.round(n).toLocaleString("es-CL")}`;
}

function MiniAvatar({ url, name, size = 16 }: { url?: string | null; name?: string; size?: number }) {
  if (url) {
    return <img src={url} alt="" width={size} height={size} style={{ borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />;
  }
  const letter = (name || "?")[0].toUpperCase();
  return (
    <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: size, height: size, borderRadius: "50%", background: "var(--surface)", color: "var(--text-secondary)", fontSize: size * 0.6, fontFamily: "var(--font-mono)", flexShrink: 0 }}>
      {letter}
    </span>
  );
}

// ─── Main Component ───
export default function ShoppingListIsland({ comidaBudgetWeekId, aseoBudgetWeekId, isReadOnly }: Props) {
  const [view, setView] = useState<ListType>("comida");

  return (
    <div class="fh-root">
      <div class="fh-tabs">
        <button
          class={`fh-tab ${view === "comida" ? "fh-tab-active" : ""}`}
          onClick={() => setView("comida")}
        >
          LISTADO COMIDA
        </button>
        <button
          class={`fh-tab ${view === "aseo" ? "fh-tab-active" : ""}`}
          onClick={() => setView("aseo")}
        >
          LISTADO ASEO
        </button>
      </div>

      <div class="fh-panel-wrapper">
        <div class="fh-panel" style={{ display: view === "comida" ? "block" : "none" }}>
          <ShoppingList
            listType="comida"
            budgetWeekId={comidaBudgetWeekId}
            isReadOnly={isReadOnly}
          />
        </div>
        <div class="fh-panel" style={{ display: view === "aseo" ? "block" : "none" }}>
          <ShoppingList
            listType="aseo"
            budgetWeekId={aseoBudgetWeekId}
            isReadOnly={isReadOnly}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Shopping List Panel ───
function ShoppingList({ listType, budgetWeekId, isReadOnly }: { listType: ListType; budgetWeekId?: string; isReadOnly?: boolean }) {
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [newQty, setNewQty] = useState(1);
  const [adding, setAdding] = useState(false);
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [buyPrice, setBuyPrice] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState(false);
  const [lastDeleted, setLastDeleted] = useState<{ name: string; quantity: number } | null>(null);
  const [clearing, setClearing] = useState(false);
  const priceInputRef = useRef<HTMLInputElement>(null);
  const addInputRef = useRef<HTMLInputElement>(null);

  const pending = items.filter((i) => !i.is_bought);
  const bought = items.filter((i) => i.is_bought);
  const label = listType === "aseo" ? "ASEO" : "COMIDA";

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/shopping/list?list_type=${listType}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setItems(await res.json());
      setLoadError(false);
    } catch (e) {
      console.error("Failed to fetch shopping list", e);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [listType]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // Focus price input when buying mode opens
  useEffect(() => {
    if (buyingId && priceInputRef.current) {
      priceInputRef.current.focus();
    }
  }, [buyingId]);

  const handleAdd = async (e: Event) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setAdding(true);
    setStatus("");
    setError("");
    try {
      const res = await fetch("/api/shopping/list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, list_type: listType, quantity: newQty }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const item = await res.json();
      setItems((prev) => [item, ...prev]);
      setNewName("");
      setNewQty(1);
      setStatus("[AGREGADO]");
      setLastDeleted(null);
      // Keep focus for chained quick entry
      addInputRef.current?.focus();
    } catch (e) {
      console.error("Failed to add item", e);
      setError("[ERROR: NO SE PUDO AGREGAR]");
    } finally {
      setAdding(false);
    }
  };

  const handleBuy = async (item: ShoppingItem) => {
    const price = parseFloat(buyPrice);
    if (!price || price <= 0) {
      // Just mark as bought without price
      setBuyingId(null);
    }

    // Optimistic update
    setItems((prev) =>
      prev.map((i) =>
        i.id === item.id ? { ...i, is_bought: true, bought_price: price || null } : i
      )
    );
    setBuyingId(null);
    setBuyPrice("");
    setStatus("");
    setError("");

    try {
      const res = await fetch("/api/shopping/list", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: item.id,
          is_bought: true,
          bought_price: price || null,
          budget_week_id: budgetWeekId || null,
          budget_type: listType,
        }),
      });

      if (!res.ok) throw new Error(await res.text());
      const updated = await res.json();
      setItems((prev) => prev.map((i) => (i.id === item.id ? updated : i)));
      setStatus(price > 0 ? "[COMPRADO · GASTO REGISTRADO]" : "[COMPRADO]");
    } catch (err: any) {
      // Revert on failure
      setItems((prev) =>
        prev.map((i) =>
          i.id === item.id ? { ...i, is_bought: false, bought_price: null } : i
        )
      );
      setError(`[ERROR: ${err.message || "NO SE PUDO MARCAR"}]`);
    }
  };

  const handleUnbuy = async (item: ShoppingItem) => {
    if (item.converted_expense_id && !confirm("Desmarcar esta compra eliminará el gasto automático asociado. ¿Continuar?")) {
      return;
    }

    setItems((prev) =>
      prev.map((i) =>
        i.id === item.id ? { ...i, is_bought: false, bought_price: null } : i
      )
    );
    try {
      const res = await fetch("/api/shopping/list", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, is_bought: false }),
      });
      if (!res.ok) throw new Error(await res.text());
      const updated = await res.json();
      setItems((prev) => prev.map((i) => (i.id === item.id ? updated : i)));
      setStatus("[PENDIENTE · GASTO AUTOMATICO REVERSADO]");
      setError("");
    } catch (err: any) {
      setItems((prev) =>
        prev.map((i) =>
          i.id === item.id ? { ...i, is_bought: true, bought_price: item.bought_price } : i
        )
      );
      setError(`[ERROR: ${err.message || "NO SE PUDO DESMARCAR"}]`);
    }
  };

  const handleDelete = async (item: ShoppingItem) => {
    if (
      item.is_bought &&
      !confirm("¿Eliminar este producto comprado? El gasto registrado se mantiene.")
    ) {
      return;
    }
    const prev = items;
    setItems((p) => p.filter((i) => i.id !== item.id));
    try {
      const res = await fetch("/api/shopping/list", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id }),
      });
      if (!res.ok) throw new Error(await res.text());
      if (!item.is_bought) {
        setLastDeleted({ name: item.name, quantity: item.quantity });
        setStatus(`[ELIMINADO: ${item.name.toUpperCase()}]`);
      } else {
        setLastDeleted(null);
        setStatus("[ELIMINADO]");
      }
      setError("");
    } catch (err: any) {
      setItems(prev);
      setError(`[ERROR: ${err.message || "NO SE PUDO ELIMINAR"}]`);
    }
  };

  const handleUndoDelete = async () => {
    if (!lastDeleted) return;
    const { name, quantity } = lastDeleted;
    setLastDeleted(null);
    setStatus("");
    try {
      const res = await fetch("/api/shopping/list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, list_type: listType, quantity }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const item = await res.json();
      setItems((prev) => [item, ...prev]);
      setStatus("[RESTAURADO]");
    } catch {
      setError("[ERROR: NO SE PUDO RESTAURAR]");
    }
  };

  const handleClearBought = async () => {
    if (!confirm(`¿Limpiar ${bought.length} producto(s) comprado(s)? Los gastos registrados se mantienen.`)) {
      return;
    }
    setClearing(true);
    setError("");
    try {
      const results = await Promise.all(
        bought.map((i) =>
          fetch("/api/shopping/list", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: i.id }),
          })
        )
      );
      const failedIds = bought.filter((_, idx) => !results[idx].ok).map((i) => i.id);
      setItems((p) => p.filter((i) => !i.is_bought || failedIds.includes(i.id)));
      if (failedIds.length > 0) {
        setError("[ERROR: ALGUNOS PRODUCTOS NO SE PUDIERON LIMPIAR]");
      } else {
        setStatus("[COMPRADOS LIMPIADOS]");
        setLastDeleted(null);
      }
    } catch {
      setError("[ERROR: NO SE PUDO LIMPIAR]");
    } finally {
      setClearing(false);
    }
  };

  const handleBuyKeyDown = (e: KeyboardEvent, item: ShoppingItem) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleBuy(item);
    } else if (e.key === "Escape") {
      setBuyingId(null);
      setBuyPrice("");
    }
  };

  return (
    <div class="sl-container">
      <div class="fh-week-header">
        <span class="fh-label">LISTA DE COMPRAS · {label}</span>
        <span class="fh-caption">{pending.length} PENDIENTES</span>
      </div>

      {status && (
        <p class="sl-status" role="status">
          {status}
          {lastDeleted && (
            <button class="sl-undo-btn" onClick={handleUndoDelete}>
              DESHACER
            </button>
          )}
        </p>
      )}
      {error && <p class="sl-error" role="alert">{error}</p>}

      {/* Add item form */}
      {!isReadOnly && (
        <form class="sl-add-form" onSubmit={handleAdd}>
          <input
            ref={addInputRef}
            type="text"
            class="sl-add-input"
            value={newName}
            onInput={(e) => setNewName((e.target as HTMLInputElement).value)}
            placeholder="Agregar producto..."
            enterkeyhint="done"
          />
          <input
            type="number"
            class="sl-add-qty"
            value={newQty}
            min={1}
            onInput={(e) => setNewQty(Math.max(1, parseInt((e.target as HTMLInputElement).value) || 1))}
            disabled={adding}
          />
          <button type="submit" class="sl-add-btn" disabled={adding || !newName.trim()}>
            <TctIcon name="plus" size={16} variant="dots" />
          </button>
        </form>
      )}

      {/* Pending items */}
      {loading ? (
        <p class="sl-loading-state">[CARGANDO...]</p>
      ) : loadError ? (
        <div class="island-error-banner" role="alert">
          <span>[NO SE PUDO CARGAR LA LISTA]</span>
          <button class="island-retry-btn" onClick={fetchItems}>
            REINTENTAR
          </button>
        </div>
      ) : (
        <>
          <div class="sl-items">
            {pending.length === 0 && (
              <p class="fh-empty" style={{ padding: "var(--space-xl) 0", textAlign: "center" }}>
                [LISTA VACÍA — AGREGA PRODUCTOS]
              </p>
            )}
            {pending.map((item) => (
              <div class="sl-item" key={item.id}>
                {buyingId === item.id ? (
                  <div class="sl-buy-row">
                    <span class="sl-item-name">{item.quantity > 1 ? `${item.quantity}× ` : ""}{item.name}</span>
                    <div class="sl-buy-input-wrap">
                      <span class="sl-buy-prefix">$</span>
                      <input
                        ref={priceInputRef}
                        type="number"
                        class="sl-buy-input"
                        value={buyPrice}
                        onInput={(e) => setBuyPrice((e.target as HTMLInputElement).value)}
                        onKeyDown={(e) => handleBuyKeyDown(e, item)}
                        placeholder="Precio"
                      />
                    </div>
                    <button class="sl-buy-confirm" onClick={() => handleBuy(item)}>
                      <TctIcon name="check" size={16} variant="dots" />
                    </button>
                    <button class="sl-buy-cancel" onClick={() => { setBuyingId(null); setBuyPrice(""); }}>
                      <TctIcon name="x" size={16} variant="dots" />
                    </button>
                  </div>
                ) : (
                  <div class="sl-item-row">
                    {!isReadOnly && (
                      <button
                        class="sl-check"
                        onClick={() => { setBuyingId(item.id); setBuyPrice(""); }}
                        title="Marcar como comprado"
                      >
                        <span class="sl-check-box" />
                      </button>
                    )}
                    <div class="sl-item-info">
                      <span class="sl-item-name">
                        {item.quantity > 1 ? `${item.quantity}× ` : ""}{item.name}
                      </span>
                      <span class="sl-item-meta">
                        <MiniAvatar url={item.profiles?.avatar_url} name={item.profiles?.display_name} />
                        {item.profiles?.display_name}
                      </span>
                    </div>
                    {!isReadOnly && (
                      <button class="sl-delete" onClick={() => handleDelete(item)} aria-label={`Eliminar ${item.name}`} title="Eliminar">
                        <TctIcon name="trash" size={15} variant="dots" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Bought items */}
          {bought.length > 0 && (
            <div class="sl-bought-section">
              <div class="fh-section-header">
                <span class="fh-label">COMPRADOS</span>
                <span class="fh-caption">{bought.length}</span>
                {!isReadOnly && (
                  <button class="sl-clear-bought" onClick={handleClearBought} disabled={clearing}>
                    {clearing ? "LIMPIANDO..." : "LIMPIAR"}
                  </button>
                )}
              </div>
              <div class="sl-items sl-bought-items">
                {bought.map((item) => (
                  <div class="sl-item sl-item-done" key={item.id}>
                    <div class="sl-item-row">
                      {!isReadOnly && (
                        <button class="sl-check sl-check-done" onClick={() => handleUnbuy(item)} title="Desmarcar">
                          <span class="sl-check-box sl-check-filled"><TctIcon name="check" size={13} variant="dots" /></span>
                        </button>
                      )}
                      <div class="sl-item-info">
                        <span class="sl-item-name sl-item-name-done">
                          {item.quantity > 1 ? `${item.quantity}× ` : ""}{item.name}
                        </span>
                      </div>
                      {item.bought_price && (
                        <span class="sl-item-price">{formatCLP(item.bought_price)}</span>
                      )}
                      {!isReadOnly && (
                        <button class="sl-delete" onClick={() => handleDelete(item)} aria-label={`Eliminar ${item.name}`} title="Eliminar">
                          <TctIcon name="trash" size={15} variant="dots" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
