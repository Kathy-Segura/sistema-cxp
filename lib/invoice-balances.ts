import type { InvoiceCategory, InvoiceStatus } from "../types";
import { isoDate } from "../utils/formatters";

export function invoiceCreditDays(issue: string, due: string) {
  const start = isoDate(issue);
  const end = isoDate(due);
  if (!start || !end || end < start) return undefined;
  return (Date.parse(end) - Date.parse(start)) / 86_400_000;
}

export function invoiceCategory(issue: string, due: string): InvoiceCategory | undefined {
  const days = invoiceCreditDays(issue, due);
  return days === undefined ? undefined : days <= 30 ? 1 : 2;
}

export function moneyValue(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : NaN;
  const text = String(value ?? "").trim().replace(/^(?:C\$|NIO|USD|\$)\s*/i, "");
  if (/^-?\d+(?:\.\d{1,2})?$/.test(text)) return Number(text);
  if (/^-?\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?$/.test(text)) return Number(text.replace(/,/g, ""));
  if (/^-?\d+,[0-9]{1,2}$|^-?\d{1,3}(?:\.\d{3})+,[0-9]{1,2}$/.test(text)) {
    return Number(text.replace(/\./g, "").replace(",", "."));
  }
  return NaN;
}

export function moneyCents(value: number) {
  const cents = Math.round(value * 100);
  return Number.isSafeInteger(cents) && Math.abs(value * 100 - cents) < 0.000001 ? cents : NaN;
}

export function managuaDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "America/Managua", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date);
  const part = (name: string) => parts.find(({ type }) => type === name)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function invoiceBalance(total: number, paid: number, due: string, today: string) {
  const remainingCents = Math.max(0, moneyCents(total) - moneyCents(paid));
  const estado: InvoiceStatus = total > 0 && remainingCents === 0
    ? "Pagada"
    : due && due < today ? "Vencida" : "Pendiente";
  return { monto_pagado: paid, saldo_pendiente: remainingCents / 100, estado };
}
