import type { ProveedorRecord } from "../types";
import { managuaDate } from "./invoice-balances";
import { isoDate, normalizeExcelHeader } from "../utils/formatters";

export function supplierEntryDate(value: string) {
  const source = String(value ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/i.test(source)) {
    const timestamp = new Date(source);
    return Number.isFinite(timestamp.getTime()) ? managuaDate(timestamp) : "";
  }
  return isoDate(source) || isoDate(source.split(/[T ]/, 1)[0]);
}

export function filterSuppliers<T extends { provider: ProveedorRecord; invoiceCount: number }>(
  entries: T[], search: string, from: string, to: string, association: string,
) {
  const terms = normalizeExcelHeader(search).split(/\s+/).filter(Boolean);
  return entries.filter(({ provider, invoiceCount }) => {
    const searchable = normalizeExcelHeader([
      provider.nombre_legal, provider.nombre_comercial, provider.proveedor_id,
      provider.codigo_proveedor, provider.ruc, provider.banco,
    ].join(" "));
    const date = supplierEntryDate(provider.creado_en);
    return terms.every((term) => searchable.includes(term)) &&
      (!from || (date && date >= from)) && (!to || (date && date <= to)) &&
      (association !== "with" || invoiceCount > 0) && (association !== "without" || invoiceCount === 0);
  });
}
