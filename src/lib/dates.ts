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
