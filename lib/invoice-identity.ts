export function normalizeInvoiceIdentity(value: string) {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
}

export function invoiceNumberKey(provider: string, number: string) {
  return JSON.stringify([normalizeInvoiceIdentity(provider), normalizeInvoiceIdentity(number)]);
}
