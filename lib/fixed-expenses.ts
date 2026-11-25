import type { GastoFijoRecord } from "../types";
import { isoDate, money } from "../utils/formatters";

export const FIXED_EXPENSE_CATEGORIES: readonly string[] = ["Gastos fijos", "Impuestos", "Renta", "Mantenimiento", "General"];
export const FIXED_EXPENSE_REFERENCE_LIMIT = 120;
export const FIXED_EXPENSE_DESCRIPTION_LIMIT = 1000;
const dollars = new Intl.NumberFormat("es-NI", { style: "currency", currency: "USD" });
export const FIXED_EXPENSE_PAYMENTS_TAB = "gastos_fijos_pagos";
export const FIXED_EXPENSE_PAYMENT_HEADERS = ["gasto_fijo_id", "periodo", "fecha_pago", "actualizado_por", "actualizado_en"];

export function formatFixedExpenseAmount(expense: Pick<GastoFijoRecord, "moneda" | "monto_estimado">) {
  if (!Number.isFinite(expense.monto_estimado)) return "—";
  return expense.moneda === "USD" ? dollars.format(expense.monto_estimado) : money(expense.monto_estimado);
}

export function fixedExpenseDueInPeriod(expense: Pick<GastoFijoRecord, "activo" | "fecha_inicio" | "fecha_fin" | "dia_vencimiento">, period: string) {
  const first = isoDate(`${period}-01`);
  const start = isoDate(expense.fecha_inicio);
  const end = isoDate(expense.fecha_fin);
  const day = expense.dia_vencimiento;
  if (!expense.activo || !first || !start || (expense.fecha_fin && !end) || !Number.isInteger(day) || day < 1 || day > 31) return "";
  const month = new Date(`${first}T00:00:00Z`);
  month.setUTCMonth(month.getUTCMonth() + 1, 0);
  const due = `${period}-${String(Math.min(day, month.getUTCDate())).padStart(2, "0")}`;
  return due >= start && (!end || due <= end) ? due : "";
}

export function fixedExpensePaymentStatus(dueDate: string, paidDate: string, today: string) {
  if (isoDate(paidDate)) return "Pagado";
  if (!dueDate) return "Sin cuota";
  return dueDate < today ? "Vencido" : "Pendiente";
}

export function nextFixedExpenseDue(expense: Pick<GastoFijoRecord, "activo" | "fecha_inicio" | "fecha_fin" | "dia_vencimiento">, today: string) {
  const start = isoDate(expense.fecha_inicio);
  if (!start || !isoDate(today)) return "";
  const earliest = today > start ? today : start;
  const period = earliest.slice(0, 7);
  const due = fixedExpenseDueInPeriod(expense, period);
  if (due && due >= earliest) return due;
  const next = new Date(`${period}-01T00:00:00Z`);
  next.setUTCMonth(next.getUTCMonth() + 1);
  return fixedExpenseDueInPeriod(expense, next.toISOString().slice(0, 7));
}
