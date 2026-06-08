export const CATEGORIES = ['Delivery', 'Supermercado', 'Transporte', 'Gustos personales', 'Gastos del hogar', 'Suscripciones', 'Otros'];

export const CATEGORY_COLORS = {
  Delivery: '#D71921',
  Supermercado: '#4A9E5C',
  Transporte: '#5B9BF6',
  'Gustos personales': '#D4A843',
  'Gastos del hogar': '#FF8C42',
  Suscripciones: '#9B59B6',
  Otros: '#999999',
};

export const CATEGORY_ICONS = {
  Delivery: 'utensils',
  Supermercado: 'cart',
  Transporte: 'transport',
  'Gustos personales': 'sparkle',
  'Gastos del hogar': 'home',
  Suscripciones: 'repeat',
  Otros: 'tag',
};

export function normalizePersonalExpenseCategory(category) {
  return CATEGORIES.includes(category) ? category : 'Otros';
}

export function formatExpenseTime(expenseTime, createdAt) {
  if (expenseTime) {
    const parts = expenseTime.split(':');
    return parts[0] + ':' + parts[1];
  }
  if (createdAt) {
    try {
      const d = new Date(createdAt);
      const s = d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Santiago' });
      const pre = typeof s === 'string' ? s : d.toLocaleString('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false });
      return pre;
    } catch { return null; }
  }
  return null;
}

export function groupPersonalExpensesByCategory(rows) {
  const groups = {};
  for (const cat of CATEGORIES) groups[cat] = { category: cat, total: 0, count: 0, transactions: [] };

  for (const row of rows) {
    const cat = normalizePersonalExpenseCategory(row.category);
    groups[cat].transactions.push({
      ...row,
      display_time: formatExpenseTime(row.expense_time, row.created_at),
    });
    groups[cat].total += Number(row.amount) || 0;
    groups[cat].count += 1;
  }

  for (const cat of CATEGORIES) {
    groups[cat].transactions.sort((a, b) => new Date(b.expense_date + 'T' + (b.expense_time || '00:00')) - new Date(a.expense_date + 'T' + (a.expense_time || '00:00')));
  }

  return CATEGORIES.map((cat) => groups[cat]);
}
