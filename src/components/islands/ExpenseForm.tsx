/** @jsxImportSource preact */
import { useState, useCallback } from "preact/hooks";

interface ExpenseItem {
  id: string;
  name: string;
  quantity: number;
  unit_price: number;
}

interface Props {
  budgetWeekId?: string;
  categories?: string[];
}

const DEFAULT_CATEGORIES = ["Supermercado", "Feria", "Delivery", "Otro"];

function generateId() {
  return Math.random().toString(36).substring(2, 9);
}

function formatCLP(n: number) {
  return `$${Math.round(n).toLocaleString("es-CL")}`;
}

export default function ExpenseForm({ budgetWeekId, categories }: Props) {
  const cats = categories || DEFAULT_CATEGORIES;
  const [items, setItems] = useState<ExpenseItem[]>([
    { id: generateId(), name: "", quantity: 1, unit_price: 0 },
  ]);
  const [category, setCategory] = useState(cats[0]);
  const [expenseDate, setExpenseDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const addItem = useCallback(() => {
    setItems((prev) => [
      ...prev,
      { id: generateId(), name: "", quantity: 1, unit_price: 0 },
    ]);
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => (prev.length > 1 ? prev.filter((i) => i.id !== id) : prev));
  }, []);

  const updateItem = useCallback(
    (id: string, field: keyof ExpenseItem, value: string | number) => {
      setItems((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, [field]: value } : item
        )
      );
    },
    []
  );

  const total = items.reduce((sum, i) => sum + i.quantity * i.unit_price, 0);
  const validItems = items.filter((i) => i.name.trim() && i.unit_price > 0);

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    if (validItems.length === 0) {
      setError("Agrega al menos un producto con nombre y precio");
      return;
    }
    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/expenses/create-with-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          expense_date: expenseDate,
          budget_week_id: budgetWeekId || null,
          items: validItems.map((i) => ({
            name: i.name,
            quantity: i.quantity,
            unit_price: i.unit_price,
          })),
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text);
      }

      setSuccess(true);
      setTimeout(() => {
        window.location.href = "/finanzas";
      }, 800);
    } catch (e: any) {
      setError(e.message || "Error al registrar");
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div class="ef-success">
        <span class="ef-success-icon">✓</span>
        <span class="ef-success-text">GASTO REGISTRADO</span>
        <span class="ef-success-total">{formatCLP(total)}</span>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} class="ef-form">
      {/* Category tags */}
      <div class="ef-section">
        <label class="ef-label">CATEGORÍA</label>
        <div class="ef-tags">
          {cats.map((cat) => (
            <button
              key={cat}
              type="button"
              class={`ef-tag ${category === cat ? "ef-tag-active" : ""}`}
              onClick={() => setCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Date */}
      <div class="ef-section">
        <label class="ef-label">FECHA</label>
        <input
          type="date"
          class="ef-input"
          value={expenseDate}
          onChange={(e) => setExpenseDate((e.target as HTMLInputElement).value)}
        />
      </div>

      {/* Products */}
      <div class="ef-section">
        <div class="ef-section-header">
          <label class="ef-label">PRODUCTOS</label>
          <span class="ef-count">{items.length}</span>
        </div>

        <div class="ef-items">
          {items.map((item, i) => (
            <div class="ef-item" key={item.id}>
              <div class="ef-item-row">
                <div class="ef-item-name">
                  <input
                    type="text"
                    class="ef-input"
                    placeholder="Nombre del producto"
                    value={item.name}
                    onInput={(e) =>
                      updateItem(item.id, "name", (e.target as HTMLInputElement).value)
                    }
                  />
                </div>
                <div class="ef-item-qty">
                  <input
                    type="number"
                    class="ef-input ef-input-number"
                    placeholder="Cant"
                    min="0.1"
                    step="0.1"
                    value={item.quantity || ""}
                    onInput={(e) =>
                      updateItem(
                        item.id,
                        "quantity",
                        parseFloat((e.target as HTMLInputElement).value) || 0
                      )
                    }
                  />
                </div>
                <div class="ef-item-price">
                  <input
                    type="number"
                    class="ef-input ef-input-number"
                    placeholder="Precio"
                    min="0"
                    step="1"
                    value={item.unit_price || ""}
                    onInput={(e) =>
                      updateItem(
                        item.id,
                        "unit_price",
                        parseFloat((e.target as HTMLInputElement).value) || 0
                      )
                    }
                  />
                </div>
                <div class="ef-item-total">
                  {item.quantity * item.unit_price > 0
                    ? formatCLP(item.quantity * item.unit_price)
                    : "—"}
                </div>
                <button
                  type="button"
                  class="ef-item-remove"
                  onClick={() => removeItem(item.id)}
                  disabled={items.length <= 1}
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>

        <button type="button" class="ef-add-btn" onClick={addItem}>
          + AGREGAR PRODUCTO
        </button>
      </div>

      {/* Total */}
      <div class="ef-total-section">
        <span class="ef-label">TOTAL</span>
        <span class="ef-total-value">{formatCLP(total)}</span>
      </div>

      {/* Error */}
      {error && <div class="ef-error">[ERROR: {error}]</div>}

      {/* Submit */}
      <button
        type="submit"
        class="ef-submit"
        disabled={submitting || validItems.length === 0}
      >
        {submitting ? "REGISTRANDO..." : "REGISTRAR GASTO"}
      </button>
    </form>
  );
}
