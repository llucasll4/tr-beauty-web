export const brazilClock = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hour12: false });
export const brazilDate = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' });
export function localDateKey(date) {
  const parts = Object.fromEntries(brazilDate.formatToParts(date).map(x => [x.type, x.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}
export function futureDates() {
  const today = localDateKey(new Date());
  const base = new Date(`${today}T12:00:00Z`);
  return Array.from({ length: 30 }, (_, i) => {
    const d = new Date(base.getTime() + i * 86400000);
    return { key: d.toISOString().slice(0, 10), label: d.toLocaleDateString('pt-BR', { timeZone: 'UTC', weekday: 'short', day: '2-digit', month: '2-digit' }) };
  });
}
export const readableDate = (iso) => new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export const WEEKDAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
export const monthLabel = (monthKey) => {
  const [y, m] = monthKey.split('-').map(Number);
  const label = new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('pt-BR', {
    timeZone: 'UTC', month: 'long', year: 'numeric',
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
};
export const offsetMonth = (monthKey, offset) => {
  const [y, m] = monthKey.split('-').map(Number);
  const newDate = new Date(Date.UTC(y, m - 1 + offset, 1));
  return newDate.toISOString().slice(0, 7);
};
export const initialBookableDate = () => futureDates().find(({ key }) => {
  const weekday = new Date(`${key}T12:00:00Z`).getUTCDay();
  return weekday >= 2 && weekday <= 6;
})?.key || localDateKey(new Date());
export function buildCalendar(monthKey, allowedDateKeys, openWeekdays = null) {
  const [year, month] = monthKey.split('-').map(Number);
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const firstColumn = (firstWeekday + 6) % 7; // Segunda-feira primeiro
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells = Array.from({ length: firstColumn }, () => null);
  for (let day = 1; day <= daysInMonth; day++) {
    const key = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
    cells.push({ key, day, enabled: allowedDateKeys.has(key) && (!openWeekdays || openWeekdays.has(weekday)) });
  }
  while (cells.length % 7) cells.push(null);
  return cells;
}

