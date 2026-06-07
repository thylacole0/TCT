export const CATEGORIES = ['Delivery', 'Supermercado', 'Transporte', 'Gustos personales', 'Otros'];

export function normalizePersonalExpenseCategory(category) {
  return CATEGORIES.includes(category) ? category : 'Otros';
}

export function formatExpenseTime(expenseTime, createdAt) {
  if (expenseTime && /^\d{2}:\d{2}/.test(expenseTime)) {
    return expenseTime.slice(0, 5);
  }
  if (!createdAt) return null;
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleTimeString('es-CL', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'America/Santiago',
  });
}

export function groupPersonalExpensesByCategory(rows) {
  const groups = new Map(
    CATEGORIES.map((category) => [category, { category, total: 0, count: 0, transactions: [] }])
  );

  for (const row of rows || []) {
    const category = normalizePersonalExpenseCategory(row.category);
    const group = groups.get(category);
    const transaction = {
      ...row,
      category,
      display_time: formatExpenseTime(row.expense_time, row.created_at),
    };
    group.total += Number(row.amount || 0);
    group.count += 1;
    group.transactions.push(transaction);
  }

  for (const group of groups.values()) {
    group.transactions.sort((a, b) => {
      const ad = `${a.expense_date || ''} ${a.expense_time || ''} ${a.created_at || ''}`;
      const bd = `${b.expense_date || ''} ${b.expense_time || ''} ${b.created_at || ''}`;
      return bd.localeCompare(ad);
    });
  }

  return Array.from(groups.values());
}
