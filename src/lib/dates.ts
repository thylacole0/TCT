// Chile timezone utilities — all date operations use America/Santiago
const TZ = "America/Santiago";

/** Returns today's date as YYYY-MM-DD in Chile timezone */
export function todayChile(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: TZ });
}

/** Returns a Date object set to the start of today in Chile timezone */
export function nowChile(): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date());

  const get = (type: string) => parts.find((p) => p.type === type)?.value || "0";
  return new Date(
    parseInt(get("year")),
    parseInt(get("month")) - 1,
    parseInt(get("day")),
    parseInt(get("hour")),
    parseInt(get("minute")),
    parseInt(get("second"))
  );
}

/** Formats a Date to YYYY-MM-DD using its local parts (no timezone conversion).
 *  Use this for Dates already constructed in Chile time via nowChile/getMondayChile. */
export function formatDateCL(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Returns the current hour in Chile timezone (0-23) */
export function hourChile(): number {
  return parseInt(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: TZ,
      hour: "2-digit",
      hour12: false,
    }).formatToParts(new Date()).find((p) => p.type === "hour")?.value || "0"
  );
}

/** Returns Monday of the week containing the given date (Chile timezone) */
export function getMondayChile(date?: Date): Date {
  const d = date ? new Date(date) : nowChile();
  const day = d.getDay();
  d.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Returns the 1st day of the current month (or billing cycle) in Chile timezone */
export function getMonthStartChile(date?: Date, billingStartDay?: number): Date {
  const d = date ? new Date(date) : nowChile();
  if (billingStartDay && billingStartDay > 1) {
    // Custom billing cycle: start is billingStartDay of previous month
    // when the reference date is before billingStartDay
    const day = d.getDate();
    if (day < billingStartDay) {
      d.setMonth(d.getMonth() - 1);
    }
    d.setDate(billingStartDay);
  } else {
    d.setDate(1);
  }
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Returns the last day of the month (or billing cycle) for the given date */
export function getMonthEndChile(date?: Date, billingStartDay?: number): Date {
  const d = date ? new Date(date) : nowChile();
  if (billingStartDay && billingStartDay > 1) {
    // Custom billing cycle: end is (billingStartDay - 1) of current or next month
    const day = d.getDate();
    if (day >= billingStartDay) {
      d.setMonth(d.getMonth() + 1);
    }
    d.setDate(billingStartDay - 1);
  } else {
    d.setMonth(d.getMonth() + 1, 0); // day 0 of next month = last day of current
  }
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Returns the cycle end month reference date (1st of the month when the cycle ends).
 * Useful for navigation and display when using a custom billing start day.
 * For billingStartDay=1, returns the 1st of the given date's month.
 */
export function getCycleEndRef(date?: Date, billingStartDay?: number): Date {
  const d = date ? new Date(date) : nowChile();
  if (billingStartDay && billingStartDay > 1 && d.getDate() >= billingStartDay) {
    // We're in a cycle that ends next month
    d.setMonth(d.getMonth() + 1);
  }
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Returns month start/end ISO strings for Chile timezone */
export function monthBoundsChile(): { monthStart: string; monthEnd: string } {
  const n = nowChile();
  const start = new Date(n.getFullYear(), n.getMonth(), 1);
  const end = new Date(n.getFullYear(), n.getMonth() + 1, 0, 23, 59, 59);
  return {
    monthStart: start.toISOString(),
    monthEnd: end.toISOString(),
  };
}

export type BillingCycleDay = number | "last";

export interface PersonalBillingCycle {
  start_day: BillingCycleDay;
  end_day: BillingCycleDay;
}

export const DEFAULT_PERSONAL_BILLING_CYCLE: PersonalBillingCycle = {
  start_day: 1,
  end_day: "last",
};

const CYCLE_KEY_RE = /^\d{4}-\d{2}$/;

function isCycleDay(value: unknown): value is BillingCycleDay {
  if (value === "last") return true;
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 31;
}

function coerceCycleDay(value: unknown): BillingCycleDay | null {
  if (value === "last") return "last";
  if (typeof value === "number" && Number.isFinite(value)) {
    const day = Math.round(value);
    return day >= 1 && day <= 31 ? day : null;
  }
  if (typeof value === "string") {
    if (value.trim().toLowerCase() === "last") return "last";
    const day = Number(value);
    if (Number.isFinite(day)) {
      const rounded = Math.round(day);
      return rounded >= 1 && rounded <= 31 ? rounded : null;
    }
  }
  return null;
}

export function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

export function resolveBillingCycleDay(day: BillingCycleDay, year: number, monthIndex: number): number {
  return day === "last" ? daysInMonth(year, monthIndex) : Math.min(day, daysInMonth(year, monthIndex));
}

export function normalizePersonalBillingCycle(raw: unknown, legacyStartDay?: unknown): PersonalBillingCycle {
  if (raw && typeof raw === "object") {
    const cycle = raw as Record<string, unknown>;
    const start = coerceCycleDay(cycle.start_day);
    const end = coerceCycleDay(cycle.end_day);
    if (start && end) {
      return { start_day: start, end_day: end };
    }
  }

  const legacy = coerceCycleDay(legacyStartDay);
  if (isCycleDay(legacy)) {
    if (legacy === "last") {
      return { start_day: 1, end_day: "last" };
    }
    return {
      start_day: legacy,
      end_day: legacy > 1 ? legacy - 1 : "last",
    };
  }

  return DEFAULT_PERSONAL_BILLING_CYCLE;
}

function parseCycleKey(cycleKey: string): { year: number; monthIndex: number } {
  if (!CYCLE_KEY_RE.test(cycleKey)) {
    const now = nowChile();
    return { year: now.getFullYear(), monthIndex: now.getMonth() };
  }
  const [year, month] = cycleKey.split("-").map(Number);
  return { year, monthIndex: month - 1 };
}

function addMonths(year: number, monthIndex: number, delta: number): { year: number; monthIndex: number } {
  const d = new Date(year, monthIndex + delta, 1);
  return { year: d.getFullYear(), monthIndex: d.getMonth() };
}

export function getPersonalCycleBounds(cycleKey: string, cycle: PersonalBillingCycle): { from: string; to: string } {
  const normalized = normalizePersonalBillingCycle(cycle);
  const { year, monthIndex } = parseCycleKey(cycleKey);
  const endDay = resolveBillingCycleDay(normalized.end_day, year, monthIndex);
  const end = new Date(year, monthIndex, endDay);

  // Non-overlap semantics for "último día → último día": it means the full calendar month.
  if (normalized.start_day === "last" && normalized.end_day === "last") {
    const start = new Date(year, monthIndex, 1);
    return { from: formatDateCL(start), to: formatDateCL(end) };
  }

  const startDayInClosingMonth = resolveBillingCycleDay(normalized.start_day, year, monthIndex);
  const startsPreviousMonth = startDayInClosingMonth > endDay;
  const startMonth = startsPreviousMonth ? addMonths(year, monthIndex, -1) : { year, monthIndex };
  const startDay = resolveBillingCycleDay(normalized.start_day, startMonth.year, startMonth.monthIndex);
  const start = new Date(startMonth.year, startMonth.monthIndex, startDay);

  return { from: formatDateCL(start), to: formatDateCL(end) };
}

export function cycleKeyFromDate(date: Date = nowChile(), cycle: PersonalBillingCycle = DEFAULT_PERSONAL_BILLING_CYCLE): string {
  const normalized = normalizePersonalBillingCycle(cycle);
  const d = new Date(date);
  const endDay = resolveBillingCycleDay(normalized.end_day, d.getFullYear(), d.getMonth());

  if (normalized.end_day === "last" || d.getDate() <= endDay) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }

  const close = addMonths(d.getFullYear(), d.getMonth(), 1);
  return `${close.year}-${String(close.monthIndex + 1).padStart(2, "0")}`;
}

export function formatPersonalCycleLabel(from: string, to: string): string {
  const fmt = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "short",
  }).replace(".", "").toUpperCase();
  return `${fmt(from)} — ${fmt(to)}`;
}
