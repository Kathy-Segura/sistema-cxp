import * as XLSX from "xlsx";
import { invoiceCategory, invoiceCreditDays, moneyCents, moneyValue } from "./invoice-balances";
import { isoDate, normalizeExcelHeader } from "../utils/formatters";
import type { Invoice } from "../types";
import { invoiceNumberKey, resolveInvoiceNumber } from "./invoice-identity";

export const INVOICE_IMPORT_HEADERS = [
  "Proveedor", "Restaurante", "No. Factura", "Fecha Emisión", "Días de crédito", "Fecha de Vencimiento", "Categoría", "Monto",
] as const;

export const INVOICE_EXPORT_HEADERS = [
  ...INVOICE_IMPORT_HEADERS, "Monto pagado", "Saldo pendiente", "Estado",
] as const;

export type InvoiceFileRow = {
  supplier: string; restaurant: string; number: string; issue: string; due: string; amount: number;
};

type InvoiceDuplicate = { sourceRow: number; reason: string };
export type InvoiceImportPreview = {
  rows: InvoiceFileRow[]; rowNumbers: number[]; errors: string[]; sheetName: string;
};

export function discardInvoiceDuplicates(preview: InvoiceImportPreview, duplicates: InvoiceDuplicate[]): InvoiceImportPreview {
  const discarded = new Set(duplicates.map(({ sourceRow }) => sourceRow));
  return {
    ...preview,
    rows: preview.rows.filter((_, index) => !discarded.has(preview.rowNumbers[index])),
    rowNumbers: preview.rowNumbers.filter((row) => !discarded.has(row)),
  };
}

export function findInvoiceDuplicates(rows: InvoiceFileRow[], rowNumbers: number[], invoices: Invoice[]) {
  const registered = new Set(invoices.map((invoice) => invoiceNumberKey(invoice.supplier, invoice.code)));
  const seen = new Map<string, number>();
  const duplicates: InvoiceDuplicate[] = [];
  rows.forEach((row, index) => {
    const key = invoiceNumberKey(row.supplier, row.number);
    const sourceRow = rowNumbers[index];
    const firstRow = seen.get(key);
    if (registered.has(key)) {
      duplicates.push({ sourceRow, reason: `${row.supplier} ya tiene la factura N.º ${row.number} registrada.` });
    } else if (firstRow !== undefined) {
      duplicates.push({ sourceRow, reason: `La factura N.º ${row.number} de ${row.supplier} se repite en la fila ${firstRow}.` });
    }
    seen.set(key, firstRow ?? sourceRow);
  });
  return duplicates;
}

export function dueDate(issue: string, creditDays: number) {
  if (!issue || !Number.isSafeInteger(creditDays) || creditDays < 0) return "";
  const date = new Date(`${issue}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return "";
  date.setUTCDate(date.getUTCDate() + creditDays);
  return Number.isFinite(date.getTime()) ? isoDate(date.toISOString().slice(0, 10)) : "";
}

const importColumns = {
  supplier: ["proveedor", "supplier"],
  restaurant: ["restaurante", "restaurant"],
  number: ["no factura", "n factura", "numero factura", "numero de factura", "factura", "codigo"],
  issue: ["fecha emision", "fecha de emision", "emision"],
  credit: ["dias de credito", "dias credito", "credit days"],
  due: ["fecha de vencimiento", "fecha vencimiento", "vencimiento"],
  amount: ["monto", "monto total", "importe", "amount"],
} as const;
type ImportColumn = keyof typeof importColumns;
const columnKeys = Object.keys(importColumns) as ImportColumn[];
const importColumnOrder: Record<ImportColumn, number> = {
  supplier: 0, restaurant: 1, number: 2, issue: 3, credit: 4, due: 5, amount: 7,
};
const headerKey = (value: unknown) => normalizeExcelHeader(String(value ?? ""))
  .replace(/[._º°]/g, " ").replace(/\s+/g, " ").trim();

export function parseInvoiceWorkbook(bytes: ArrayBuffer, restaurants: readonly string[] = []): InvoiceImportPreview {
  const workbook = XLSX.read(bytes, { type: "array", raw: true, cellDates: false, codepage: 65001 });
  const required: ImportColumn[] = ["supplier", "restaurant", "number", "issue", "amount"];
  for (const name of workbook.SheetNames) {
    const sheet = workbook.Sheets[name];
    if (!sheet["!ref"]) continue;
    const range = XLSX.utils.decode_range(sheet["!ref"]);
    const cell = (row: number, col: number) => sheet[XLSX.utils.encode_cell({ r: row, c: col })] as XLSX.CellObject | undefined;
    for (let header = range.s.r; header <= Math.min(range.e.r, range.s.r + 9); header++) {
      const columns = new Map<ImportColumn, number>();
      for (let col = range.s.c; col <= Math.min(range.e.c, range.s.c + 255); col++) {
        const label = headerKey(cell(header, col)?.v);
        const key = columnKeys.find((key) => (importColumns[key] as readonly string[]).includes(label));
        if (key && !columns.has(key)) columns.set(key, col);
      }
      if (!required.every((key) => columns.has(key)) || (!columns.has("due") && !columns.has("credit"))) continue;

      const rows: InvoiceFileRow[] = [];
      const rowNumbers: number[] = [];
      const errors: string[] = [];
      const dataColumns = new Set(columns.values());
      const dataRows = new Set<number>();
      for (const address of Object.keys(sheet)) {
        if (address.startsWith("!") || sheet[address]?.v == null) continue;
        const { r, c } = XLSX.utils.decode_cell(address);
        if (r > header && dataColumns.has(c)) dataRows.add(r);
      }
      for (const row of [...dataRows].sort((a, b) => a - b)) {
        const field = (key: ImportColumn) => {
          const col = columns.get(key);
          return col === undefined ? undefined : cell(row, col);
        };
        const value = (key: ImportColumn) => {
          const entry = field(key);
          return entry?.t === "e" ? undefined : entry?.v;
        };
        const string = (key: ImportColumn) => String(value(key) ?? "").trim();
        if (!columnKeys.some((key) => field(key)?.t === "e" || string(key))) continue;
        const date = (key: ImportColumn) => {
          const raw = value(key);
          if (typeof raw !== "number") return isoDate(raw);
          const parts = XLSX.SSF.parse_date_code(raw, { date1904: !!workbook.Workbook?.WBProps?.date1904 });
          return parts ? isoDate(`${parts.y}-${String(parts.m).padStart(2, "0")}-${String(parts.d).padStart(2, "0")}`) : "";
        };
        const supplier = string("supplier");
        const numberCell = field("number");
        const inputNumber = typeof numberCell?.v === "number" && /^0\d+$/.test(numberCell.w ?? "")
          ? numberCell.w! : string("number");
        const restaurantText = string("restaurant");
        const restaurant = restaurants.length
          ? restaurants.find((name) => headerKey(name) === headerKey(restaurantText))
          : restaurantText;
        const issue = date("issue");
        const number = resolveInvoiceNumber(inputNumber, issue, restaurant ?? "");
        const credit = string("credit") ? Number(value("credit")) : 0;
        const due = string("due") ? date("due") : dueDate(issue, credit);
        const amount = moneyValue(value("amount"));
        const problems: string[] = [];
        const excelErrors = columnKeys.filter((key) => field(key)?.t === "e")
          .map((key) => INVOICE_IMPORT_HEADERS[importColumnOrder[key]]);
        if (excelErrors.length) problems.push(`error de Excel en ${excelErrors.join(", ")}`);
        if (!supplier) problems.push("falta Proveedor");
        if (!inputNumber) problems.push("falta No. Factura o tipo de servicio (Renta, Préstamo u Otro)");
        else if (!number && issue && restaurant) problems.push("referencia del servicio no válida");
        if (!restaurant) problems.push("Restaurante no válido");
        if (!issue) problems.push("Fecha Emisión no válida");
        if (!due || (issue && due < issue)) problems.push("Fecha de Vencimiento o Días de crédito no válidos");
        if (!(moneyCents(amount) > 0)) problems.push("Monto debe ser positivo y tener hasta dos decimales");
        if (problems.length) errors.push(`Fila ${row + 1}: ${problems.join(", ")}.`);
        else if (restaurant) {
          rows.push({ supplier, restaurant, number, issue, due, amount });
          rowNumbers.push(row + 1);
        }
      }
      return { rows, rowNumbers, errors, sheetName: name };
    }
  }
  throw new Error("No se encontraron los encabezados de carga. Usa la plantilla de Cuentas por pagar.");
}

function excelDate(value: string) {
  const date = isoDate(value);
  return date ? (Date.parse(date) - Date.UTC(1899, 11, 30)) / 86_400_000 : null;
}

function invoiceFileValues(row: InvoiceFileRow) {
  return [
    row.supplier, row.restaurant, row.number, excelDate(row.issue), invoiceCreditDays(row.issue, row.due),
    excelDate(row.due), invoiceCategory(row.issue, row.due), row.amount,
  ];
}

export function createInvoiceExport(invoices: Invoice[]) {
  const data = invoices.map((invoice) => [
    ...invoiceFileValues({ ...invoice, number: invoice.code }), invoice.paidAmount ?? 0,
    invoice.pendingBalance ?? invoice.amount, invoice.status,
  ]);
  const sheet = XLSX.utils.aoa_to_sheet([[...INVOICE_EXPORT_HEADERS], ...data]);
  sheet["!cols"] = [26, 24, 17, 17, 17, 24, 13, 17, 17, 19, 14].map((wch) => ({ wch }));
  sheet["!autofilter"] = { ref: `A1:K${data.length + 1}` };
  for (let row = 2; row <= data.length + 1; row++) {
    for (const letter of ["D", "F"]) if (sheet[letter + row]) sheet[letter + row].z = "yyyy-mm-dd";
    for (const letter of ["H", "I", "J"]) if (sheet[letter + row]) sheet[letter + row].z = "#,##0.00";
  }
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Facturas");
  return book;
}
