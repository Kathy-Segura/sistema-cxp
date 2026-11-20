import "server-only";
import { getSheetsClient, getSpreadsheetId } from "./google-sheets";
import type { FacturaRecord, PagoRecord, PrestamoRecord, PrestamoSaldoRecord, ProveedorRecord } from "@/types";
import { invoiceBalance, invoiceCategory, managuaDate, moneyCents, moneyValue } from "./invoice-balances";
import { isoDate } from "../utils/formatters";
import { invoiceNumberKey, normalizeInvoiceIdentity } from "./invoice-identity";

type Primitive = string | number | boolean;
type SheetRecord = Record<string, Primitive>;
const tabs = ["facturas", "proveedores", "pagos", "gastos_fijos", "prestamos", "prestamo_saldos", "restaurantes", "usuarios", "bitacora"] as const;

const numericColumns = new Set(["monto_total", "monto_pagado", "saldo_pendiente", "monto", "monto_inicial", "tasa_anual", "cuota_programada", "dia_pago", "saldo_inicial", "interes", "abono_capital", "cuota_pagada", "saldo_final"]);
const booleanColumns = new Set(["activo"]);
function scalar(header: string, value: unknown): Primitive {
  const source = String(value ?? "").trim();
  if (["monto_total", "monto_pagado", "monto", "saldo_pendiente"].includes(header)) {
    return source === "" ? 0 : moneyValue(value);
  }
  if (numericColumns.has(header)) return source === "" ? 0 : Number(source.replace(/[^\d.-]/g, "")) || 0;
  if (booleanColumns.has(header)) return source.toLowerCase() === "true";
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

export class InvoiceOperationError extends Error {
  constructor(message: string, readonly status: 404 | 409) {
    super(message);
  }
}

export class AccountsPayableRepository {
  private readonly sheets = getSheetsClient();
  private readonly spreadsheetId = getSpreadsheetId();

  async list<T extends object>(tab: (typeof tabs)[number]): Promise<T[]> {
    const { data } = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId, range: `${tab}!A3:ZZ`,
      ...(tab === "facturas" || tab === "pagos" ? { valueRenderOption: "UNFORMATTED_VALUE", dateTimeRenderOption: "FORMATTED_STRING" } : {}),
    });
    const [headers = [], ...rows] = data.values ?? [];
    return parseRecords<T>(headers, rows.filter((row) => row.some((value) => String(value ?? "").trim())));
  }

  private async sheetIds() {
    const { data } = await this.sheets.spreadsheets.get({
      spreadsheetId: this.spreadsheetId, fields: "sheets.properties(sheetId,title)",
    });
    return (tab: string) => {
      const id = data.sheets?.find((sheet) => sheet.properties?.title === tab)?.properties?.sheetId;
      if (id == null) throw new Error(`No existe la pestaña ${tab}.`);
      return id;
    };
  }

  private nextSequentialId(prefix: string, values: string[]) {
    const numbers = values.map((value) => Number(value.match(new RegExp(`^${prefix}-(\\d+)$`))?.[1] ?? 0));
    return `${prefix}-${String(Math.max(0, ...numbers) + 1).padStart(prefix === "FAC" ? 5 : 3, "0")}`;
  }

  async deleteInvoice(facturaId: string, actor = "SISTEMA") {
    const [{ data }, sheetId] = await Promise.all([
      this.sheets.spreadsheets.values.batchGet({
        spreadsheetId: this.spreadsheetId, ranges: ["facturas!A3:ZZ", "bitacora!A3:ZZ"],
        valueRenderOption: "UNFORMATTED_VALUE", dateTimeRenderOption: "FORMATTED_STRING",
      }),
      this.sheetIds(),
    ]);
    const [facturas, bitacora] = data.valueRanges ?? [];
    const [headers = [], ...rows] = facturas?.values ?? [];
    const [auditHeaders = [], ...auditRows] = bitacora?.values ?? [];
    const idColumn = columnIndex(headers, "factura_id");
    const matches = rows.flatMap((row, index) => String(row[idColumn] ?? "").trim() === facturaId ? [index] : []);
    if (matches.length > 1) throw new InvoiceOperationError("El ID interno aparece en más de una fila. Corrige esos IDs en Google Sheets para poder eliminar la factura correcta.", 409);
    if (!matches.length) {
      const deleted = parseRecords<SheetRecord>(auditHeaders, auditRows).some((record) =>
        record.entidad === "facturas" && record.entidad_id === facturaId && record.accion === "Eliminar factura");
      if (deleted) return;
      throw new InvoiceOperationError("Factura no encontrada. Actualiza la lista.", 404);
    }
    const [index] = matches;
    const original = Object.fromEntries(headers.flatMap((header, col) => header ? [[header, rows[index][col] ?? ""]] : []));
    const audit = {
      bitacora_id: `BIT-${crypto.randomUUID()}`, fecha_hora: new Date().toISOString(), usuario_id: actor,
      accion: "Eliminar factura", entidad: "facturas", entidad_id: facturaId, campo: "registro",
      valor_anterior: JSON.stringify(original), valor_nuevo: "", origen: "MANUAL", ip_o_sesion: "",
    };
    const startIndex = index + 3;
    await this.sheets.spreadsheets.batchUpdate({
      spreadsheetId: this.spreadsheetId,
      requestBody: { requests: [
        { deleteDimension: { range: { sheetId: sheetId("facturas"), dimension: "ROWS", startIndex, endIndex: startIndex + 1 } } },
        appendCells(sheetId("bitacora"), auditHeaders, [audit]),
      ] },
    }, { retry: false });
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

  async createInvoices(input: Array<{ supplier: string; restaurant: string; number: string; issue: string; due: string; amount: number }>, origin = "MANUAL", actor = "SISTEMA") {
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
    const providerNames = new Map(providers.map((provider) => [provider.proveedor_id, provider.nombre_legal]));
    const restaurantByName = new Map(restaurants.map((restaurant) => [String(restaurant.nombre).trim().toLowerCase(), String(restaurant.restaurante_id)]));
    const now = new Date().toISOString();
    const date = managuaDate();
    const newProviders: SheetRecord[] = [];
    const registered = new Set(existingInvoices.map((invoice) =>
      invoiceNumberKey(providerNames.get(invoice.proveedor_id) || invoice.proveedor_id, invoice.numero_factura)));
    let providerSequence = providers.map((provider) => provider.proveedor_id);
    const invoiceSequence = [
      ...existingInvoices.map((invoice) => invoice.factura_id),
      ...parseRecords<SheetRecord>(auditHeaders, auditRows)
        .filter((record) => record.entidad === "facturas").map((record) => String(record.entidad_id ?? "")),
      ...parseRecords<PagoRecord>(paymentHeaders, paymentRows).map((payment) => payment.factura_id ?? ""),
    ];
    const invoices: SheetRecord[] = input.map((item) => {
      const providerKey = normalizeInvoiceIdentity(item.supplier);
      const key = invoiceNumberKey(providerKey, item.number);
      if (registered.has(key)) throw new InvoiceOperationError(`El proveedor ${item.supplier} ya tiene registrada la factura N.º ${item.number}.`, 409);
      registered.add(key);
      let provider = providerByName.get(providerKey);
      if (!provider) {
        const proveedor_id = this.nextSequentialId("PROV", providerSequence); providerSequence = [...providerSequence, proveedor_id];
        provider = { proveedor_id, codigo_proveedor: this.nextSequentialId("PRV", providers.map((current) => current.codigo_proveedor).concat(newProviders.map((current) => String(current.codigo_proveedor)))), nombre_legal: item.supplier.trim(), nombre_comercial: "", ruc: "", telefono: "", email: "", banco: "", cuenta_bancaria: "", moneda_preferida: "NIO", activo: true, creado_por: actor, creado_en: now, actualizado_en: now };
        providerByName.set(providerKey, provider); newProviders.push(provider as unknown as SheetRecord);
      }
      const restaurante_id = restaurantByName.get(item.restaurant.trim().toLowerCase());
      if (!restaurante_id) throw new Error(`Restaurante no válido: ${item.restaurant}`);
      const factura_id = this.nextSequentialId("FAC", invoiceSequence);
      invoiceSequence.push(factura_id);
      return { factura_id, codigo_factura: factura_id, proveedor_id: provider.proveedor_id, restaurante_id, numero_factura: item.number.trim(), fecha_ingreso: date, fecha_emision: item.issue, fecha_vencimiento: item.due, moneda: "NIO", monto_total: item.amount, ...invoiceBalance(item.amount, 0, item.due, date), categoria: invoiceCategory(item.issue, item.due) ?? "", origen_carga: origin, creado_por: actor, creado_en: now, actualizado_por: actor, actualizado_en: now };
    });
    const audit = invoices.map((invoice) => ({ bitacora_id: `BIT-${crypto.randomUUID()}`, fecha_hora: now, usuario_id: actor, accion: "Crear factura", entidad: "facturas", entidad_id: invoice.factura_id, campo: "", valor_anterior: "", valor_nuevo: invoice.codigo_factura, origen: invoice.origen_carga, ip_o_sesion: "" }));
    await this.sheets.spreadsheets.batchUpdate({
      spreadsheetId: this.spreadsheetId, requestBody: { requests: [
        ...(newProviders.length ? [appendCells(sheetId("proveedores"), providerHeaders, newProviders)] : []),
        appendCells(sheetId("facturas"), invoiceHeaders, invoices),
        appendCells(sheetId("bitacora"), auditHeaders, audit),
      ] },
    }, { retry: false });
    return invoices.map((invoice) => invoice.factura_id);
  }

  async dashboard() {
    const [facturas, proveedores, pagos, prestamos, prestamo_saldos, restaurantes, usuarios, bitacora] = await Promise.all([
      this.list<FacturaRecord>("facturas"), this.list<ProveedorRecord>("proveedores"), this.list<PagoRecord>("pagos"), this.list<PrestamoRecord>("prestamos"), this.list<PrestamoSaldoRecord>("prestamo_saldos"), this.list<SheetRecord>("restaurantes"), this.list<SheetRecord>("usuarios"), this.list<SheetRecord>("bitacora"),
    ]);
    const today = managuaDate();
    const facturasConEstado = facturas.map((factura) => ({
      ...factura,
      categoria: invoiceCategory(factura.fecha_emision, factura.fecha_vencimiento),
      ...invoiceBalance(factura.monto_total, factura.monto_pagado, isoDate(factura.fecha_vencimiento), today),
    }));
    return { facturas: facturasConEstado, proveedores, pagos, prestamos, prestamo_saldos, restaurantes, usuarios, bitacora };
  }
}
