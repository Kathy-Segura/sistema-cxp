export const INVOICE_IMPORT_HEADERS = [
  "Proveedor", "Restaurante", "No. Factura", "Fecha Emisión", "Días de crédito", "Fecha de Vencimiento", "Categoría", "Monto",
] as const;

export const INVOICE_EXPORT_HEADERS = [
  "Proveedor", "Restaurante", "Factura", "Fecha emisión", "Vencimiento", "Monto", "Estado", "Categoría",
] as const;

export type InvoiceFileRow = {
  supplier: string; restaurant: string; number: string; issue: string; due: string; creditDays: number; category: string; amount: number;
};

export function isoDate(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  const source = String(value ?? "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(source) ? source : "";
}

export function dueDate(issue: string, creditDays: number) {
  if (!issue || !Number.isFinite(creditDays)) return "";
  const date = new Date(`${issue}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return "";
  date.setUTCDate(date.getUTCDate() + creditDays);
  return date.toISOString().slice(0, 10);
}
