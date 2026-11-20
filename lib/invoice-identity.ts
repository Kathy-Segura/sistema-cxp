import { isoDate } from "../utils/formatters";

export const SERVICE_TYPES = ["Renta", "Préstamo", "Otro"] as const;

export function normalizeInvoiceIdentity(value: string) {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
}

function referenceToken(value: string) {
  return value.normalize("NFKD").replace(/\p{M}/gu, "").toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// The template uses the invoice-number field for service types and optional references.
export function resolveInvoiceNumber(number: string, issue: string, restaurant: string) {
  const [label, ...reference] = number.trim().split(":");
  const prefix = referenceToken(label);
  if (!SERVICE_TYPES.some((type) => referenceToken(type) === prefix)) return number.trim();

  const date = isoDate(issue);
  const location = referenceToken(restaurant);
  if (!date || !location) return "";
  return [prefix, date, location, referenceToken(reference.join(":"))].filter(Boolean).join("-");
}

export function invoiceNumberKey(provider: string, number: string) {
  return JSON.stringify([normalizeInvoiceIdentity(provider), normalizeInvoiceIdentity(number)]);
}
