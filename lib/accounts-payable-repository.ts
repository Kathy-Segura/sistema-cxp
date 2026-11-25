import "server-only";
import { getSheetsClient, getSpreadsheetId } from "./google-sheets";
import type { FacturaRecord, FixedExpenseInput, FixedExpensePayment, FixedExpensePaymentChange, GastoFijoRecord, PagoRecord, PrestamoRecord, PrestamoSaldoRecord, ProveedorRecord, SupplierInput } from "@/types";
import { invoiceBalance, invoiceCategory, managuaDate, moneyCents, moneyValue } from "./invoice-balances";
import { isoDate } from "../utils/formatters";
import { invoiceNumberKey, normalizeInvoiceIdentity } from "./invoice-identity";
import { FIXED_EXPENSE_CATEGORIES, FIXED_EXPENSE_PAYMENT_HEADERS, FIXED_EXPENSE_PAYMENTS_TAB, fixedExpenseDueInPeriod } from "./fixed-expenses";

type Primitive = string | number | boolean;
type SheetRecord = Record<string, Primitive>;
const tabs = ["facturas", "proveedores", "pagos", "gastos_fijos", FIXED_EXPENSE_PAYMENTS_TAB, "prestamos", "prestamo_saldos", "restaurantes", "usuarios", "bitacora"] as const;

const numericColumns = new Set(["monto_total", "monto_pagado", "saldo_pendiente", "monto", "monto_inicial", "tasa_anual", "cuota_programada", "dia_pago", "dia_vencimiento", "saldo_inicial", "interes", "abono_capital", "cuota_pagada", "saldo_final"]);
const booleanColumns = new Set(["activo"]);
function scalar(header: string, value: unknown): Primitive {
  const source = String(value ?? "").trim();
  if (["monto_total", "monto_pagado", "monto", "saldo_pendiente", "monto_estimado"].includes(header)) {
    return source === "" ? 0 : moneyValue(value);
  }
  if (numericColumns.has(header)) return source === "" ? 0 : Number(source.replace(/[^\d.-]/g, "")) || 0;
  if (booleanColumns.has(header)) return ["true", "1", "sí", "si", "activo", "verdadero"].includes(source.toLowerCase());
  return source;
}

function parseRecords<T>(headers: string[], rows: unknown[][]): T[] {
  return rows.map((row) => Object.fromEntries(headers.map((header, index) =>
    [header, scalar(header, row[index])])) as T);
}

function columnIndex(headers: string[], field: string) {
  const index = headers.indexOf(field);
  if (index < 0 || headers.lastIndexOf(field) !== index) throw new Error(`Revisa la columna ${field} en Google Sheets.`);
  return index;
}

function cell(value: Primitive) {
  if (typeof value === "number") return { userEnteredValue: { numberValue: value } };
  if (typeof value === "boolean") return { userEnteredValue: { boolValue: value } };
  return { userEnteredValue: { stringValue: value } };
}

function appendCells(sheetId: number, headers: string[], records: SheetRecord[]) {
  Object.keys(records[0]).forEach((field) => columnIndex(headers, field));
  return { appendCells: {
    sheetId, fields: "userEnteredValue",
    rows: records.map((record) => ({ values: headers.map((header) => cell(record[header] ?? "")) })),
  } };
}

function updateRowCells(sheetId: number, headers: string[], rowIndex: number, changes: SheetRecord) {
  return Object.entries(changes).map(([field, value]) => ({
    updateCells: {
      start: { sheetId, rowIndex, columnIndex: columnIndex(headers, field) },
      rows: [{ values: [cell(value)] }], fields: "userEnteredValue",
    },
  }));
}

function auditEntry(actor: string, now: string, accion: string, entidad: string, entidad_id: string, campo: string, valor_anterior: string, valor_nuevo: string) {
  return { bitacora_id: `BIT-${crypto.randomUUID()}`, fecha_hora: now, usuario_id: actor, accion, entidad, entidad_id,
    campo, valor_anterior, valor_nuevo, origen: "MANUAL", ip_o_sesion: "" };
}

function invoiceSupplierChanges({ invoiceValues, paymentValues, assignments, supplierId, sheetId, actor, now }: {
  invoiceValues: unknown[][]; paymentValues: unknown[][]; assignments: { invoiceId: string; expectedSupplierId: string }[];
  supplierId: string; sheetId: (tab: string) => number; actor: string; now: string;
}) {
  const [invoiceHeader = [], ...invoiceRows] = invoiceValues;
  const [paymentHeader = [], ...paymentRows] = paymentValues;
  const invoiceHeaders = invoiceHeader.map(String);
  const paymentHeaders = paymentHeader.map(String);
  const invoices = parseRecords<FacturaRecord>(invoiceHeaders, invoiceRows);
  const payments = parseRecords<PagoRecord>(paymentHeaders, paymentRows);
  const numbers = new Set(invoices.filter((invoice) => invoice.proveedor_id === supplierId)
    .map((invoice) => normalizeInvoiceIdentity(invoice.numero_factura || invoice.codigo_factura || "")));
  const requests: ReturnType<typeof updateRowCells> = [];
  const audit: ReturnType<typeof auditEntry>[] = [];
  for (const { invoiceId, expectedSupplierId } of assignments) {
    const matches = invoices.filter((invoice) => invoice.factura_id === invoiceId);
    if (!matches.length) throw new InvoiceOperationError(`No se encontró la factura ${invoiceId}.`, 404);
    if (matches.length > 1) throw new InvoiceOperationError(`El ID ${invoiceId} está duplicado en Google Sheets.`, 409);
    const [invoice] = matches;
    const previous = invoice.proveedor_id || "";
    if (previous === supplierId) continue;
    if (previous !== expectedSupplierId) throw new InvoiceOperationError(`El proveedor de la factura ${invoiceId} cambió. Actualiza la página y verifica la asociación.`, 409);
    const number = normalizeInvoiceIdentity(invoice.numero_factura || invoice.codigo_factura || "");
    if (number && numbers.has(number)) throw new InvoiceOperationError(`El proveedor de destino ya tiene registrado el número de la factura ${invoiceId}.`, 409);
    if (number) numbers.add(number);
    requests.push(...updateRowCells(sheetId("facturas"), invoiceHeaders, invoices.indexOf(invoice) + 3,
      { proveedor_id: supplierId, actualizado_por: actor, actualizado_en: now }));
    payments.forEach((payment, index) => {
      if (payment.factura_id !== invoiceId || payment.proveedor_id === supplierId) return;
      if (payment.proveedor_id && payment.proveedor_id !== previous) {
        throw new InvoiceOperationError(`Un pago de la factura ${invoiceId} está asociado a un proveedor distinto. Revisa ese pago antes de cambiar la asociación.`, 409);
      }
      requests.push(...updateRowCells(sheetId("pagos"), paymentHeaders, index + 3, { proveedor_id: supplierId }));
    });
    audit.push(auditEntry(actor, now, "Asociar factura", "facturas", invoiceId, "proveedor_id", previous, supplierId));
  }
  return { requests, audit };
}

export class InvoiceOperationError extends Error {
  constructor(message: string, readonly status: 400 | 404 | 409) {
    super(message);
  }
}

export class AccountsPayableRepository {
  private readonly sheets = getSheetsClient();
  private readonly spreadsheetId = getSpreadsheetId();

  async list<T extends object>(tab: (typeof tabs)[number]): Promise<T[]> {
    const { data } = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId, range: `${tab}!A3:${tab === FIXED_EXPENSE_PAYMENTS_TAB ? "E" : "ZZ"}`,
      ...(["facturas", "pagos", "gastos_fijos", FIXED_EXPENSE_PAYMENTS_TAB].includes(tab) ? { valueRenderOption: "UNFORMATTED_VALUE", dateTimeRenderOption: "FORMATTED_STRING" } : {}),
    });
    const [headers = [], ...rows] = data.values ?? [];
    return parseRecords<T>(headers, rows.filter((row) => row.some((value) => String(value ?? "").trim())));
  }

  private async sheetDirectory() {
    const { data } = await this.sheets.spreadsheets.get({
      spreadsheetId: this.spreadsheetId, fields: "sheets.properties(sheetId,title)",
    });
    const entries = new Map<string, number>();
    for (const { properties } of data.sheets ?? []) {
      if (properties?.title && properties.sheetId != null) entries.set(properties.title, properties.sheetId);
    }
    return entries;
  }

  private async sheetIds() {
    const directory = await this.sheetDirectory();
    return (tab: string) => {
      const id = directory.get(tab);
      if (id == null) throw new Error(`No existe la pestaña ${tab}.`);
      return id;
    };
  }

  async setFixedExpensePayment({ expenseId, period, paidDate, expectedPaidDate }: FixedExpensePaymentChange, actor = "SISTEMA") {
    const directory = await this.sheetDirectory();
    const existingSheetId = directory.get(FIXED_EXPENSE_PAYMENTS_TAB);
    const ranges = ["gastos_fijos!A3:ZZ", "bitacora!A3:ZZ3"];
    if (existingSheetId !== undefined) ranges.push(`${FIXED_EXPENSE_PAYMENTS_TAB}!A3:E`);
    const { data } = await this.sheets.spreadsheets.values.batchGet({ spreadsheetId: this.spreadsheetId,
      ranges, valueRenderOption: "UNFORMATTED_VALUE", dateTimeRenderOption: "FORMATTED_STRING" });
    const [expenses, auditRange, paidRange] = data.valueRanges ?? [];
    const [headers = [], ...rows] = expenses?.values ?? [];
    const matches = parseRecords<GastoFijoRecord>(headers, rows).filter(({ gasto_fijo_id }) => gasto_fijo_id === expenseId);
    if (!matches.length) throw new InvoiceOperationError("No se encontró el gasto fijo.", 404);
    if (matches.length !== 1) throw new InvoiceOperationError("El ID del gasto fijo está duplicado.", 409);
    const [expense] = matches;
    const [paymentHeaders = [], ...paymentRows] = paidRange?.values ?? [];
    if (existingSheetId !== undefined) FIXED_EXPENSE_PAYMENT_HEADERS.forEach((field) => columnIndex(paymentHeaders, field));
    const payments = parseRecords<FixedExpensePayment>(paymentHeaders, paymentRows);
    const found = payments.filter((row) => row.gasto_fijo_id === expenseId && row.periodo === period);
    if (found.length > 1) throw new InvoiceOperationError("El gasto tiene pagos duplicados para ese mes en Google Sheets.", 409);
    const [current] = found;
    const previous = current?.fecha_pago || "";
    if (previous === paidDate) return { payment: current, audit: undefined };
    if (previous !== expectedPaidDate) throw new InvoiceOperationError("El pago cambió. Actualiza la página y revisa el estado del mes.", 409);
    if (paidDate && !current?.fecha_pago && !fixedExpenseDueInPeriod(expense, period)) {
      throw new InvoiceOperationError("El gasto fijo no tiene una cuota vigente para ese mes.", 400);
    }
    const now = new Date().toISOString();
    const payment: FixedExpensePayment = { gasto_fijo_id: expenseId, periodo: period, fecha_pago: paidDate, actualizado_por: actor, actualizado_en: now };
    const audit = auditEntry(actor, now, paidDate ? "Registrar pago de gasto fijo" : "Revertir pago de gasto fijo",
      FIXED_EXPENSE_PAYMENTS_TAB, `${expenseId}/${period}`, "fecha_pago", previous, paidDate);
    const [auditHeaders = []] = auditRange?.values ?? [];
    const auditId = directory.get("bitacora");
    if (auditId === undefined) throw new Error("No existe la pestaña bitacora.");
    const usedIds = new Set(directory.values());
    let newSheetId = 1;
    while (usedIds.has(newSheetId)) newSheetId++;
    const paymentSheetId = existingSheetId ?? newSheetId;
    const requests = existingSheetId === undefined ? [
      { addSheet: { properties: { sheetId: paymentSheetId, title: FIXED_EXPENSE_PAYMENTS_TAB, gridProperties: { frozenRowCount: 3 } } } },
      { updateCells: { start: { sheetId: paymentSheetId, rowIndex: 2, columnIndex: 0 },
        rows: [{ values: FIXED_EXPENSE_PAYMENT_HEADERS.map(cell) }], fields: "userEnteredValue" } },
      appendCells(paymentSheetId, FIXED_EXPENSE_PAYMENT_HEADERS, [{ ...payment }]),
    ] : current ? updateRowCells(paymentSheetId, paymentHeaders, payments.indexOf(current) + 3, { ...payment })
      : [appendCells(paymentSheetId, paymentHeaders, [{ ...payment }])];
    await this.sheets.spreadsheets.batchUpdate({ spreadsheetId: this.spreadsheetId,
      requestBody: { requests: [...requests, appendCells(auditId, auditHeaders, [audit])] } }, { retry: false });
    return { payment, audit };
  }

  private nextSequentialId(prefix: string, values: string[]) {
    const numbers = values.map((value) => Number(value.match(new RegExp(`^${prefix}-(\\d+)$`))?.[1] ?? 0));
    return `${prefix}-${String(Math.max(0, ...numbers) + 1).padStart(prefix === "FAC" ? 5 : 3, "0")}`;
  }

  async saveFixedExpense(input: FixedExpenseInput, id: string, expectedUpdatedAt: string, actor = "SISTEMA") {
    const [{ data }, sheetId] = await Promise.all([
      this.sheets.spreadsheets.values.batchGet({ spreadsheetId: this.spreadsheetId,
        ranges: ["gastos_fijos!A3:ZZ", "proveedores!A3:ZZ", "restaurantes!A3:ZZ", "bitacora!A3:ZZ"],
        valueRenderOption: "UNFORMATTED_VALUE", dateTimeRenderOption: "FORMATTED_STRING" }),
      this.sheetIds(),
    ]);
    const [expenseRange, supplierRange, restaurantRange, auditRange] = data.valueRanges ?? [];
    const [headers = [], ...rows] = expenseRange?.values ?? [];
    const [auditHeaders = [], ...auditRows] = auditRange?.values ?? [];
    // Los catálogos pueden reordenar columnas. Resolvemos cada ID por encabezado.
    const catalogHasId = (values: unknown[][], field: string, value: string) => {
      if (!value) return true;
      const [header = [], ...entries] = values;
      const index = columnIndex(header.map(String), field);
      return entries.some((entry) => String(entry[index] ?? "").trim() === value);
    };
    if (!catalogHasId(supplierRange?.values ?? [], "proveedor_id", input.proveedor_id)) {
      throw new InvoiceOperationError("No se encontró el proveedor del gasto fijo.", 404);
    }
    if (!catalogHasId(restaurantRange?.values ?? [], "restaurante_id", input.restaurante_id)) {
      throw new InvoiceOperationError("No se encontró el restaurante del gasto fijo.", 404);
    }
    const expenses = parseRecords<GastoFijoRecord>(headers, rows);
    const matches = id ? expenses.filter((expense) => expense.gasto_fijo_id === id) : [];
    if (id && !matches.length) throw new InvoiceOperationError("No se encontró el gasto fijo.", 404);
    if (matches.length > 1) throw new InvoiceOperationError("El ID del gasto fijo está duplicado en Google Sheets.", 409);
    const [current] = matches;
    if (current && (current.actualizado_en ?? "") !== expectedUpdatedAt) {
      throw new InvoiceOperationError("El gasto fijo cambió. Actualiza la página antes de editarlo de nuevo.", 409);
    }
    if (!FIXED_EXPENSE_CATEGORIES.includes(input.categoria) && input.categoria !== current?.categoria) {
      throw new InvoiceOperationError("Selecciona una categoría de la lista de gastos fijos.", 400);
    }
    const deleted = parseRecords<SheetRecord>(auditHeaders, auditRows)
      .filter((entry) => entry.entidad === "gastos_fijos" && entry.accion === "Eliminar gasto fijo");
    const deletedCodes = deleted.flatMap((entry) => {
      try {
        const code = JSON.parse(String(entry.valor_anterior))?.codigo_gasto;
        return typeof code === "string" ? [code] : [];
      } catch { return []; }
    });
    const gasto_fijo_id = id || this.nextSequentialId("FIJ", [...expenses.map((expense) => expense.gasto_fijo_id), ...deleted.map((entry) => String(entry.entidad_id ?? ""))]);
    const codigo_gasto = current?.codigo_gasto || this.nextSequentialId("GF", [...expenses.map((expense) => expense.codigo_gasto), ...deletedCodes]);
    const now = new Date().toISOString();
    const expenseFields = { ...input, numero_referencia: input.numero_referencia ?? current?.numero_referencia ?? "", codigo_gasto, actualizado_en: now };
    const expense: GastoFijoRecord = { gasto_fijo_id, creado_por: current?.creado_por ?? actor, creado_en: current?.creado_en ?? now, ...expenseFields };
    const audit = auditEntry(actor, now, current ? "Editar gasto fijo" : "Crear gasto fijo", "gastos_fijos", gasto_fijo_id,
      "registro", current?.descripcion ?? "", expense.descripcion);
    const fixedSheetId = sheetId("gastos_fijos");
    await this.sheets.spreadsheets.batchUpdate({ spreadsheetId: this.spreadsheetId, requestBody: { requests: [
      ...(current ? updateRowCells(fixedSheetId, headers, expenses.indexOf(current) + 3, expenseFields) : [appendCells(fixedSheetId, headers, [{ ...expense }])]),
      appendCells(sheetId("bitacora"), auditHeaders, [audit]),
    ] } }, { retry: false });
    return { expense, audit };
  }

  async saveSupplier(input: SupplierInput, id: string, invoiceIds: string[], actor = "SISTEMA") {
    const ranges = ["proveedores!A3:ZZ", "bitacora!A3:ZZ3"];
    if (invoiceIds.length) ranges.push("facturas!A3:ZZ", "pagos!A3:ZZ");
    const [{ data }, sheetId] = await Promise.all([
      this.sheets.spreadsheets.values.batchGet({ spreadsheetId: this.spreadsheetId, ranges }),
      this.sheetIds(),
    ]);
    const [providerRange, auditRange, invoiceRange, paymentRange] = data.valueRanges ?? [];
    const [providerHeaders = [], ...providerRows] = providerRange?.values ?? [];
    const [auditHeaders = []] = auditRange?.values ?? [];
    const providers = parseRecords<ProveedorRecord>(providerHeaders, providerRows);
    const matches = id ? providers.filter((provider) => provider.proveedor_id === id) : [];
    if (id && !matches.length) throw new InvoiceOperationError("No se encontró el proveedor.", 404);
    if (matches.length > 1) throw new InvoiceOperationError("El ID del proveedor está duplicado en Google Sheets.", 409);
    const [current] = matches;
    const taxKey = (ruc: string) => (ruc ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    const others = providers.filter((provider) => provider.proveedor_id && provider.proveedor_id !== id);
    const code = input.codigo_proveedor || current?.codigo_proveedor || this.nextSequentialId("PRV", others.map((provider) => provider.codigo_proveedor));
    const comparable = [
      ["codigo_proveedor", code, normalizeInvoiceIdentity],
      ["nombre_legal", input.nombre_legal, normalizeInvoiceIdentity],
      ["ruc", input.ruc, taxKey],
    ] as const;
    if (comparable.some(([field, value, normalize]) => {
      const key = normalize(value);
      return key && key !== normalize(current?.[field] ?? "") && others.some((provider) => normalize(provider[field] ?? "") === key);
    })) {
      throw new InvoiceOperationError("Ya existe un proveedor con ese código, nombre legal o RUC. Abre su ficha para actualizarlo.", 409);
    }
    if (current?.ruc && !input.ruc) throw new InvoiceOperationError("El RUC registrado es obligatorio.", 409);
    const proveedor_id = id || this.nextSequentialId("PROV", others.map((provider) => provider.proveedor_id));
    const now = new Date().toISOString();
    const fields = { ...input, codigo_proveedor: code, actualizado_en: now };
    const provider: ProveedorRecord = { proveedor_id, activo: current?.activo ?? true,
      creado_por: current?.creado_por ?? actor, creado_en: current?.creado_en ?? now, ...fields };
    const links = invoiceSupplierChanges({ invoiceValues: invoiceRange?.values ?? [], paymentValues: paymentRange?.values ?? [],
      assignments: invoiceIds.map((invoiceId) => ({ invoiceId, expectedSupplierId: "" })), supplierId: proveedor_id, sheetId, actor, now });
    const audit = [auditEntry(actor, now, current ? "Editar proveedor" : "Crear proveedor", "proveedores", proveedor_id,
      "nombre_legal", current?.nombre_legal ?? "", provider.nombre_legal), ...links.audit];
    await this.sheets.spreadsheets.batchUpdate({ spreadsheetId: this.spreadsheetId, requestBody: { requests: [
      ...(current ? updateRowCells(sheetId("proveedores"), providerHeaders, providers.indexOf(current) + 3, fields)
        : [appendCells(sheetId("proveedores"), providerHeaders, [{ ...provider }])]),
      ...links.requests, appendCells(sheetId("bitacora"), auditHeaders, audit),
    ] } }, { retry: false });
    return { provider, invoiceIds, audit };
  }

  async assignInvoiceSupplier(invoiceId: string, supplierId: string, expectedSupplierId: string, actor = "SISTEMA") {
    const [{ data }, sheetId] = await Promise.all([
      this.sheets.spreadsheets.values.batchGet({ spreadsheetId: this.spreadsheetId,
        ranges: ["proveedores!A3:ZZ", "facturas!A3:ZZ", "pagos!A3:ZZ", "bitacora!A3:ZZ3"],
        valueRenderOption: "UNFORMATTED_VALUE", dateTimeRenderOption: "FORMATTED_STRING" }),
      this.sheetIds(),
    ]);
    const [providerRange, invoiceRange, paymentRange, auditRange] = data.valueRanges ?? [];
    const [providerHeaders = [], ...providerRows] = providerRange?.values ?? [];
    const [auditHeaders = []] = auditRange?.values ?? [];
    const matches = parseRecords<ProveedorRecord>(providerHeaders, providerRows).filter((provider) => provider.proveedor_id === supplierId);
    if (!matches.length) throw new InvoiceOperationError("No se encontró el proveedor seleccionado.", 404);
    if (matches.length > 1) throw new InvoiceOperationError("El ID del proveedor está duplicado en Google Sheets.", 409);
    const [provider] = matches;
    const { requests, audit } = invoiceSupplierChanges({ invoiceValues: invoiceRange?.values ?? [], paymentValues: paymentRange?.values ?? [],
      assignments: [{ invoiceId, expectedSupplierId }], supplierId, sheetId, actor, now: new Date().toISOString() });
    if (requests.length) {
      await this.sheets.spreadsheets.batchUpdate({ spreadsheetId: this.spreadsheetId, requestBody: {
        requests: [...requests, appendCells(sheetId("bitacora"), auditHeaders, audit)],
      } }, { retry: false });
    }
    return { invoiceId, supplierId, supplier: provider.nombre_legal || supplierId, audit };
  }

  async deleteInvoice(facturaId: string, actor = "SISTEMA") {
    return this.deleteRecord("facturas", "factura_id", facturaId, "Eliminar factura", actor);
  }

  async deleteFixedExpense(expenseId: string, expectedUpdatedAt: string, actor = "SISTEMA") {
    return this.deleteRecord("gastos_fijos", "gasto_fijo_id", expenseId, "Eliminar gasto fijo", actor, expectedUpdatedAt);
  }

  private async deleteRecord(tab: "facturas" | "gastos_fijos", idHeader: string, id: string, action: string, actor: string, expectedUpdatedAt?: string) {
    const [{ data }, sheetId] = await Promise.all([
      this.sheets.spreadsheets.values.batchGet({
        spreadsheetId: this.spreadsheetId, ranges: [`${tab}!A3:ZZ`, "bitacora!A3:ZZ"],
        valueRenderOption: "UNFORMATTED_VALUE", dateTimeRenderOption: "FORMATTED_STRING",
      }),
      this.sheetIds(),
    ]);
    const [records, bitacora] = data.valueRanges ?? [];
    const [headers = [], ...rows] = records?.values ?? [];
    const [auditHeaders = [], ...auditRows] = bitacora?.values ?? [];
    const idColumn = columnIndex(headers, idHeader);
    const matches = rows.flatMap((row, index) => String(row[idColumn] ?? "").trim() === id ? [index] : []);
    if (matches.length > 1) throw new InvoiceOperationError("El ID interno aparece en más de una fila. Corrige esos IDs en Google Sheets para poder eliminar el registro correcto.", 409);
    if (!matches.length) {
      const deleted = parseRecords<SheetRecord>(auditHeaders, auditRows).some((record) =>
        record.entidad === tab && record.entidad_id === id && record.accion === action);
      if (deleted) return;
      throw new InvoiceOperationError("No se encontró el registro. Actualiza la lista.", 404);
    }
    const [index] = matches;
    if (expectedUpdatedAt !== undefined && String(rows[index][columnIndex(headers, "actualizado_en")] ?? "").trim() !== expectedUpdatedAt) {
      throw new InvoiceOperationError("El gasto fijo cambió. Actualiza la página antes de eliminarlo.", 409);
    }
    const original = Object.fromEntries(headers.flatMap((header, col) => header ? [[header, rows[index][col] ?? ""]] : []));
    const audit = auditEntry(actor, new Date().toISOString(), action, tab, id, "registro", JSON.stringify(original), "");
    const startIndex = index + 3;
    await this.sheets.spreadsheets.batchUpdate({
      spreadsheetId: this.spreadsheetId,
      requestBody: { requests: [
        { deleteDimension: { range: { sheetId: sheetId(tab), dimension: "ROWS", startIndex, endIndex: startIndex + 1 } } },
        appendCells(sheetId("bitacora"), auditHeaders, [audit]),
      ] },
    }, { retry: false });
    return audit;
  }

  async recordPayment(input: { facturaRef: string; amount: number; date: string; method: string; reference: string; bank?: string; detail?: string }, actor = "SISTEMA") {
    const [values, sheetId] = await Promise.all([
      this.sheets.spreadsheets.values.batchGet({
        spreadsheetId: this.spreadsheetId, ranges: ["facturas!A3:ZZ", "pagos!A3:ZZ", "bitacora!A3:ZZ3"],
        valueRenderOption: "UNFORMATTED_VALUE", dateTimeRenderOption: "FORMATTED_STRING",
      }),
      this.sheetIds(),
    ]);
    const [invoicesRange, paymentsRange, auditRange] = values.data.valueRanges ?? [];
    const [invoiceHeaders = [], ...invoiceRows] = invoicesRange?.values ?? [];
    const [paymentHeaders = [], ...paymentRows] = paymentsRange?.values ?? [];
    const [auditHeaders = []] = auditRange?.values ?? [];
    const invoices = parseRecords<FacturaRecord>(invoiceHeaders, invoiceRows);
    columnIndex(invoiceHeaders, "factura_id");
    const matches = invoices.filter((item) => item.factura_id === input.facturaRef);
    const candidates = matches.length ? matches : invoices.filter((item) =>
      item.factura_id && [item.codigo_factura, item.numero_factura].includes(input.facturaRef));
    if (candidates.length !== 1) throw new Error(candidates.length
      ? "El número coincide con varias facturas. Usa el ID interno." : "No se encontró la factura asociada.");
    const invoice = candidates[0];
    const rowIndex = invoices.indexOf(invoice) + 3;
    const today = managuaDate();
    const due = isoDate(invoice.fecha_vencimiento);
    const current = invoiceBalance(invoice.monto_total, invoice.monto_pagado, due, today);
    const paymentCents = moneyCents(input.amount);
    const totalCents = moneyCents(invoice.monto_total);
    const paidCents = moneyCents(invoice.monto_pagado);
    if (!(totalCents > 0) || !(paidCents >= 0) || paidCents > totalCents) throw new Error("Revisa el total y el monto pagado de la factura en Google Sheets.");
    if (!(paymentCents > 0) || !input.reference) throw new Error("Indica un monto de hasta dos decimales y una referencia de pago.");

    const payments = parseRecords<PagoRecord>(paymentHeaders, paymentRows).filter((item) => item.pago_id);
    const existingPayment = payments.find((item) => item.factura_id === invoice.factura_id && item.referencia === input.reference);
    if (existingPayment) {
      if (moneyCents(existingPayment.monto) !== paymentCents || isoDate(existingPayment.fecha_pago) !== input.date ||
          existingPayment.metodo_pago !== input.method || existingPayment.banco_origen !== (input.bank || "") ||
          existingPayment.detalle !== (input.detail || "")) {
        throw new Error("Esa referencia ya está registrada para esta factura.");
      }
      return { facturaId: invoice.factura_id, ...current, payment: existingPayment, alreadyRecorded: true };
    }
    if (paymentCents > totalCents - paidCents) throw new Error("El monto del pago excede el saldo pendiente.");
    const balance = invoiceBalance(invoice.monto_total, (paidCents + paymentCents) / 100, due, today);
    const now = new Date().toISOString();
    const pago_id = this.nextSequentialId("PAG", payments.map((payment) => payment.pago_id));
    const payment = {
      pago_id, codigo_pago: input.reference, factura_id: invoice.factura_id, proveedor_id: invoice.proveedor_id,
      restaurante_id: invoice.restaurante_id, fecha_pago: input.date, metodo_pago: input.method, referencia: input.reference,
      moneda: invoice.moneda, monto: paymentCents / 100, banco_origen: input.bank || "", cuenta_origen: "",
      detalle: input.detail || "", soporte_url: "", registrado_por: actor, registrado_en: now,
    };
    const audit = {
      bitacora_id: `BIT-${crypto.randomUUID()}`, fecha_hora: now, usuario_id: actor, accion: "Registrar pago",
      entidad: "facturas", entidad_id: invoice.factura_id, campo: "monto_pagado", valor_anterior: invoice.monto_pagado,
      valor_nuevo: balance.monto_pagado, origen: "MANUAL", ip_o_sesion: "",
    };
    const invoiceUpdates = Object.entries({ ...balance, actualizado_por: actor, actualizado_en: now }).map(([field, value]) => ({
      updateCells: {
        start: { sheetId: sheetId("facturas"), rowIndex, columnIndex: columnIndex(invoiceHeaders, field) },
        rows: [{ values: [cell(value)] }], fields: "userEnteredValue",
      },
    }));
    await this.sheets.spreadsheets.batchUpdate({
      spreadsheetId: this.spreadsheetId,
      requestBody: { requests: [ ...invoiceUpdates, appendCells(sheetId("pagos"), paymentHeaders, [payment]), appendCells(sheetId("bitacora"), auditHeaders, [audit]) ] },
    }, { retry: false });
    return { facturaId: invoice.factura_id, ...balance, payment, alreadyRecorded: false };
  }

  async setInvoiceStatus(facturaId: string, requested: FacturaRecord["estado"]) {
    const invoice = (await this.list<FacturaRecord>("facturas")).find((current) => current.factura_id === facturaId);
    if (!invoice) throw new Error("Factura no encontrada.");
    const balance = invoiceBalance(invoice.monto_total, invoice.monto_pagado, isoDate(invoice.fecha_vencimiento), managuaDate());
    if (requested !== balance.estado) {
      throw new Error(requested === "Pagada" ? "Registra el pago del saldo pendiente." :
        `El estado calculado por saldo y vencimiento es ${balance.estado}.`);
    }
    return { facturaId, ...balance };
  }

  async createInvoices(input: Array<{ supplier: string; supplierId?: string; restaurant: string; number: string; issue: string; due: string; amount: number }>, origin = "MANUAL", actor = "SISTEMA") {
    const [{ data }, sheetId] = await Promise.all([
      this.sheets.spreadsheets.values.batchGet({
        spreadsheetId: this.spreadsheetId,
        ranges: ["proveedores", "restaurantes", "facturas", "bitacora", "pagos"].map((tab) => `${tab}!A3:ZZ`),
        valueRenderOption: "UNFORMATTED_VALUE", dateTimeRenderOption: "FORMATTED_STRING",
      }),
      this.sheetIds(),
    ]);
    const [providerRange, restaurantRange, invoiceRange, auditRange, paymentRange] = data.valueRanges ?? [];
    const [providerHeaders = [], ...providerRows] = providerRange?.values ?? [];
    const [restaurantHeaders = [], ...restaurantRows] = restaurantRange?.values ?? [];
    const [invoiceHeaders = [], ...invoiceRows] = invoiceRange?.values ?? [];
    const [auditHeaders = [], ...auditRows] = auditRange?.values ?? [];
    const [paymentHeaders = [], ...paymentRows] = paymentRange?.values ?? [];
    const providers = parseRecords<ProveedorRecord>(providerHeaders, providerRows).filter((provider) => provider.proveedor_id);
    const restaurants = parseRecords<SheetRecord>(restaurantHeaders, restaurantRows);
    const existingInvoices = parseRecords<FacturaRecord>(invoiceHeaders, invoiceRows).filter((invoice) => invoice.factura_id);
    const providerByName = new Map(providers.map((provider) => [normalizeInvoiceIdentity(provider.nombre_legal), provider]));
    const providerById = new Map(providers.map((provider) => [provider.proveedor_id, provider]));
    const restaurantByName = new Map(restaurants.map((restaurant) => [String(restaurant.nombre).trim().toLowerCase(), String(restaurant.restaurante_id)]));
    const now = new Date().toISOString();
    const date = managuaDate();
    const newProviders: ProveedorRecord[] = [];
    const registered = new Set(existingInvoices.map((invoice) =>
      invoiceNumberKey(invoice.proveedor_id, invoice.numero_factura || invoice.codigo_factura || "")));
    let providerSequence = providers.map((provider) => provider.proveedor_id);
    const invoiceSequence = [
      ...existingInvoices.map((invoice) => invoice.factura_id),
      ...parseRecords<SheetRecord>(auditHeaders, auditRows)
        .filter((record) => record.entidad === "facturas").map((record) => String(record.entidad_id ?? "")),
      ...parseRecords<PagoRecord>(paymentHeaders, paymentRows).map((payment) => payment.factura_id ?? ""),
    ];
    const invoices: SheetRecord[] = input.map((item) => {
      const providerKey = normalizeInvoiceIdentity(item.supplier);
      let provider = item.supplierId ? providerById.get(item.supplierId) : providerByName.get(providerKey);
      if (item.supplierId && !provider) throw new InvoiceOperationError("No se encontró el proveedor asignado a la factura.", 404);
      if (!provider) {
        const proveedor_id = this.nextSequentialId("PROV", providerSequence); providerSequence = [...providerSequence, proveedor_id];
        provider = { proveedor_id, codigo_proveedor: this.nextSequentialId("PRV", providers.map((current) => current.codigo_proveedor).concat(newProviders.map((current) => String(current.codigo_proveedor)))), nombre_legal: item.supplier.trim(), nombre_comercial: "", ruc: "", telefono: "", email: "", banco: "", cuenta_bancaria: "", moneda_preferida: "NIO", activo: true, creado_por: actor, creado_en: now, actualizado_en: now };
        providerByName.set(providerKey, provider); newProviders.push(provider);
      }
      const key = invoiceNumberKey(provider.proveedor_id, item.number);
      if (registered.has(key)) throw new InvoiceOperationError(`El proveedor ${provider.nombre_legal} ya tiene registrada la factura N.º ${item.number}.`, 409);
      registered.add(key);
      const restaurante_id = restaurantByName.get(item.restaurant.trim().toLowerCase());
      if (!restaurante_id) throw new Error(`Restaurante no válido: ${item.restaurant}`);
      const factura_id = this.nextSequentialId("FAC", invoiceSequence);
      invoiceSequence.push(factura_id);
      return { factura_id, codigo_factura: factura_id, proveedor_id: provider.proveedor_id, restaurante_id, numero_factura: item.number.trim(), fecha_ingreso: date, fecha_emision: item.issue, fecha_vencimiento: item.due, moneda: "NIO", monto_total: item.amount, ...invoiceBalance(item.amount, 0, item.due, date), categoria: invoiceCategory(item.issue, item.due) ?? "", origen_carga: origin, creado_por: actor, creado_en: now, actualizado_por: actor, actualizado_en: now };
    });
    const audit = invoices.map((invoice) => ({ bitacora_id: `BIT-${crypto.randomUUID()}`, fecha_hora: now, usuario_id: actor, accion: "Crear factura", entidad: "facturas", entidad_id: invoice.factura_id, campo: "", valor_anterior: "", valor_nuevo: invoice.codigo_factura, origen: invoice.origen_carga, ip_o_sesion: "" }));
    await this.sheets.spreadsheets.batchUpdate({
      spreadsheetId: this.spreadsheetId, requestBody: { requests: [
        ...(newProviders.length ? [appendCells(sheetId("proveedores"), providerHeaders, newProviders.map((provider) => ({ ...provider })))] : []),
        appendCells(sheetId("facturas"), invoiceHeaders, invoices),
        appendCells(sheetId("bitacora"), auditHeaders, audit),
      ] },
    }, { retry: false });
    return { ids: invoices.map((invoice) => invoice.factura_id), providerIds: invoices.map((invoice) => invoice.proveedor_id), newProviders };
  }

  async dashboard() {
    const fixedExpensePayments = this.sheetDirectory().then((directory) => directory.has(FIXED_EXPENSE_PAYMENTS_TAB)
      ? this.list<FixedExpensePayment>(FIXED_EXPENSE_PAYMENTS_TAB) : []);
    const [facturas, proveedores, pagos, gastos_fijos, gastos_fijos_pagos, prestamos, prestamo_saldos, restaurantes, usuarios, bitacora] = await Promise.all([
      this.list<FacturaRecord>("facturas"), this.list<ProveedorRecord>("proveedores"), this.list<PagoRecord>("pagos"), this.list<GastoFijoRecord>("gastos_fijos"), fixedExpensePayments, this.list<PrestamoRecord>("prestamos"), this.list<PrestamoSaldoRecord>("prestamo_saldos"), this.list<SheetRecord>("restaurantes"), this.list<SheetRecord>("usuarios"), this.list<SheetRecord>("bitacora"),
    ]);
    const today = managuaDate();
    const facturasConEstado = facturas.map((factura) => ({
      ...factura,
      categoria: invoiceCategory(factura.fecha_emision, factura.fecha_vencimiento),
      ...invoiceBalance(factura.monto_total, factura.monto_pagado, isoDate(factura.fecha_vencimiento), today),
    }));
    return { facturas: facturasConEstado, proveedores, pagos, gastos_fijos, gastos_fijos_pagos, prestamos, prestamo_saldos, restaurantes, usuarios, bitacora };
  }
}
