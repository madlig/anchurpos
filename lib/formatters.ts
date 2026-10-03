export function formatCurrency(value: number | undefined | null): string {
  if (value === undefined || value === null || isNaN(value)) {
    return "Rp 0";
  }
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatNumber(value: number | undefined | null): string {
  if (value === undefined || value === null || isNaN(value)) {
    return "0";
  }
  return new Intl.NumberFormat("id-ID").format(value);
}

export function formatDate(dateString: string | undefined | null): string {
  if (!dateString) return "-";
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return "-";
    
    return new Intl.DateTimeFormat("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    }).format(d);
  } catch {
    return "-";
  }
}

export function formatDateTime(dateString: string | undefined | null): string {
  if (!dateString) return "-";
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return "-";
    
    return new Intl.DateTimeFormat("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }).format(d);
  } catch {
    return "-";
  }
}

/**
 * Returns current date string formatted as YYYY-MM-DD in Asia/Jakarta (WIB) timezone.
 * Prevents UTC timezone drift issues where shifts before 07:00 AM WIB are treated as previous day.
 */
export function getJakartaDate(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/**
 * Safely extract HH:mm from an ISO date string in Asia/Jakarta timezone.
 * Replaces dot separator with colon so it is always compatible with <input type="time" />.
 */
export function formatTimeOnly(iso: string | null | undefined): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    return new Intl.DateTimeFormat("id-ID", {
      timeZone: "Asia/Jakarta",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
      .format(d)
      .replace(".", ":");
  } catch {
    return "";
  }
}

/**
 * Convert time string "HH:mm" to minutes from midnight (0..1439).
 */
export function timeToMinutes(t: string): number {
  if (!t || !t.includes(":")) return 0;
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

/**
 * Convert minutes from midnight to "HH:mm" (24h).
 */
export function minutesToTime(totalMin: number): string {
  let norm = Math.round(totalMin) % 1440;
  if (norm < 0) norm += 1440;
  const h = Math.floor(norm / 60);
  const m = norm % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Calculate duration in hours between two "HH:mm" time strings (handles cross-midnight).
 * Returns duration rounded to 1 decimal place.
 */
export function calcHoursBetween(inTime: string, outTime: string): number {
  if (!inTime || !outTime) return 0;
  const inMin = timeToMinutes(inTime);
  let outMin = timeToMinutes(outTime);
  if (outMin < inMin) {
    outMin += 1440;
  }
  const diffMin = outMin - inMin;
  return Math.round((diffMin / 60) * 10) / 10;
}

/**
 * Add decimal hours to a "HH:mm" time string, returning the resulting "HH:mm".
 */
export function addHoursToTime(inTime: string, hours: number): string {
  if (!inTime) return "16:00";
  const inMin = timeToMinutes(inTime);
  const addMin = Math.round((hours || 0) * 60);
  return minutesToTime(inMin + addMin);
}
