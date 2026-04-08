/** @jsxImportSource preact */
import { useState, useCallback, useEffect, useRef } from "preact/hooks";

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
  const priceInputRef = useRef<HTMLInputElement>(null);

  const pending = items.filter((i) => !i.is_bought);
  const bought = items.filter((i) => i.is_bought);
  const label = listType === "aseo" ? "ASEO" : "COMIDA";

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/shopping/list?list_type=${listType}`);
      if (res.ok) {
        setItems(await res.json());
      }
    } catch (e) {
      console.error("Failed to fetch shopping list", e);
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
    try {
      const res = await fetch("/api/shopping/list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, list_type: listType, quantity: newQty }),
      });
      if (res.ok) {
        const item = await res.json();
        setItems((prev) => [item, ...prev]);
        setNewName("");
        setNewQty(1);
      }
    } catch (e) {
      console.error("Failed to add item", e);
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

    try {
      const res = await fetch("/api/shopping/list", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: item.id,
          is_bought: true,
          bought_price: price || null,
        }),
      });

      if (res.ok && price > 0 && budgetWeekId) {
        // Register as expense
        const category = listType === "aseo" ? "Supermercado" : "Supermercado";
        await fetch("/api/expenses/create-with-items", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            category,
            budget_week_id: budgetWeekId,
            items: [
              {
                name: item.name,
                quantity: item.quantity,
                unit_price: price / item.quantity,
              },
            ],
          }),
        });
      }
    } catch {
      // Revert on failure
      setItems((prev) =>
        prev.map((i) =>
          i.id === item.id ? { ...i, is_bought: false, bought_price: null } : i
        )
      );
    }
  };

  const handleUnbuy = async (item: ShoppingItem) => {
    setItems((prev) =>
      prev.map((i) =>
        i.id === item.id ? { ...i, is_bought: false, bought_price: null } : i
      )
    );
    try {
      await fetch("/api/shopping/list", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, is_bought: false }),
      });
    } catch {
      setItems((prev) =>
        prev.map((i) =>
          i.id === item.id ? { ...i, is_bought: true, bought_price: item.bought_price } : i
        )
      );
    }
  };

  const handleDelete = async (id: string) => {
    const prev = items;
    setItems((p) => p.filter((i) => i.id !== id));
    try {
      await fetch("/api/shopping/list", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
    } catch {
      setItems(prev);
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

      {/* Add item form */}
      {!isReadOnly && (
        <form class="sl-add-form" onSubmit={handleAdd}>
          <input
            type="text"
            class="sl-add-input"
            value={newName}
            onInput={(e) => setNewName((e.target as HTMLInputElement).value)}
            placeholder="Agregar producto..."
            disabled={adding}
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
            +
          </button>
        </form>
      )}

      {/* Pending items */}
      {loading ? (
        <div class="sl-skeleton-list">
          {Array.from({ length: 4 }, (_, i) => (
            <div class="sl-skeleton-row" key={i}>
              <div class="sl-skeleton-check" />
              <div class="sl-skeleton-text" style={{ width: `${50 + (i % 3) * 15}%` }} />
            </div>
          ))}
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
                      ✓
                    </button>
                    <button class="sl-buy-cancel" onClick={() => { setBuyingId(null); setBuyPrice(""); }}>
                      ✕
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
                      <button class="sl-delete" onClick={() => handleDelete(item.id)} title="Eliminar">
                        ×
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
              </div>
              <div class="sl-items sl-bought-items">
                {bought.map((item) => (
                  <div class="sl-item sl-item-done" key={item.id}>
                    <div class="sl-item-row">
                      {!isReadOnly && (
                        <button class="sl-check sl-check-done" onClick={() => handleUnbuy(item)} title="Desmarcar">
                          <span class="sl-check-box sl-check-filled">✓</span>
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
                        <button class="sl-delete" onClick={() => handleDelete(item.id)} title="Eliminar">
                          ×
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
