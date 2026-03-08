export function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function formatDateInTimezone(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone }).format(date);
}

export function dateInTimezone(timeZone: string): string {
  return formatDateInTimezone(new Date(), timeZone);
}

export function addDaysInTimezone(timeZone: string, days: number): string {
  return formatDateInTimezone(new Date(Date.now() + days * 86400000), timeZone);
}

export function formatTime(d: Date): string {
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

export function addMinutes(d: Date, minutes: number): Date {
  return new Date(d.getTime() + minutes * 60000);
}

export function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * 86400000);
}
