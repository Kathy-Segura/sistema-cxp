import "server-only";
import { getSheetsClient, getSpreadsheetId } from "./google-sheets";
import type { FacturaRecord, PagoRecord, PrestamoRecord, PrestamoSaldoRecord, ProveedorRecord } from "@/types";

type Primitive = string | number | boolean;
type SheetRecord = Record<string, Primitive>;
const tabs = ["facturas", "proveedores", "pagos", "gastos_fijos", "prestamos", "prestamo_saldos", "restaurantes", "usuarios", "bitacora"] as const;

const numericColumns = new Set(["monto_total", "monto_pagado", "saldo_pendiente", "monto", "monto_inicial", "tasa_anual", "cuota_programada", "dia_pago", "saldo_inicial", "interes", "abono_capital", "cuota_pagada", "saldo_final"]);
const booleanColumns = new Set(["activo"]);
function scalar(header: string, value: unknown): Primitive {
  const source = String(value ?? "").trim();
  if (numericColumns.has(header)) return source === "" ? 0 : Number(source.replace(/[^\d.-]/g, "")) || 0;
  if (booleanColumns.has(header)) return source.toLowerCase() === "true";
  return source;
}

export class AccountsPayableRepository {
  private readonly sheets = getSheetsClient();
  private readonly spreadsheetId = getSpreadsheetId();

  async list<T extends object>(tab: (typeof tabs)[number]): Promise<T[]> {
    const { data } = await this.sheets.spreadsheets.values.get({ spreadsheetId: this.spreadsheetId, range: `${tab}!A3:ZZ` });
    const [headers = [], ...rows] = data.values ?? [];
    return rows.filter((row) => row.some((value) => String(value ?? "").trim())).map((row) => Object.fromEntries(headers.map((header, index) => [header, scalar(header, row[index])])) as T);
  }

  private async append(tab: (typeof tabs)[number], records: SheetRecord[]) {
    if (!records.length) return;
    const { data } = await this.sheets.spreadsheets.values.get({ spreadsheetId: this.spreadsheetId, range: `${tab}!A3:ZZ3` });
    const headers = data.values?.[0] ?? [];
    await this.sheets.spreadsheets.values.append({
      spreadsheetId: this.spreadsheetId,
      range: `${tab}!A4`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: records.map((record) => headers.map((header) => record[header] ?? "")) },
    });
  }

  private nextSequentialId(prefix: string, values: string[]) {
    const numbers = values.map((value) => Number(value.match(new RegExp(`^${prefix}-(\\d+)$`))?.[1] ?? 0));
    return `${prefix}-${String(Math.max(0, ...numbers) + 1).padStart(prefix === "FAC" ? 5 : 3, "0")}`;
  }

  async deleteInvoice(facturaId: string, actor = "SISTEMA") {
    const range = "facturas!A3:ZZ";
    const { data } = await this.sheets.spreadsheets.values.get({ spreadsheetId: this.spreadsheetId, range });
    const rows = data.values ?? [];
    const idColumn = rows[0]?.indexOf("factura_id") ?? -1;
    const recordIndex = rows.findIndex((row, index) => index > 0 && String(row[idColumn] ?? "") === facturaId);
    if (idColumn < 0 || recordIndex < 1) throw new Error("Factura no encontrada.");
    const spreadsheet = await this.sheets.spreadsheets.get({ spreadsheetId: this.spreadsheetId, fields: "sheets.properties(sheetId,title)" });
    const sheetId = spreadsheet.data.sheets?.find((sheet) => sheet.properties?.title === "facturas")?.properties?.sheetId;
    if (sheetId === undefined) throw new Error("No existe la pestaña facturas.");
    await this.sheets.spreadsheets.batchUpdate({ spreadsheetId: this.spreadsheetId, requestBody: { requests: [{ deleteDimension: { range: { sheetId, dimension: "ROWS", startIndex: recordIndex + 2, endIndex: recordIndex + 3 } } }] } });
    await this.append("bitacora", [{ bitacora_id: `BIT-${crypto.randomUUID()}`, fecha_hora: new Date().toISOString(), usuario_id: actor, accion: "Eliminar factura", entidad: "facturas", entidad_id: facturaId, campo: "", valor_anterior: facturaId, valor_nuevo: "", origen: "MANUAL", ip_o_sesion: "" }]);
  }

  private async updateInvoiceFields(facturaId: string, fields: Record<string, Primitive>) {
    const { data } = await this.sheets.spreadsheets.values.get({ spreadsheetId: this.spreadsheetId, range: "facturas!A3:ZZ" });
    const rows = data.values ?? []; const headers = rows[0] ?? [];
    const rowIndex = rows.findIndex((row, index) => index > 0 && String(row[headers.indexOf("factura_id")] ?? "") === facturaId);
    if (rowIndex < 1) throw new Error("Factura no encontrada.");
    const updates = Object.entries(fields).map(([header, value]) => ({ range: `facturas!${String.fromCharCode(65 + headers.indexOf(header))}${rowIndex + 3}`, values: [[value]] }));
    await this.sheets.spreadsheets.values.batchUpdate({ spreadsheetId: this.spreadsheetId, requestBody: { valueInputOption: "USER_ENTERED", data: updates } });
  }

  async recordPayment(input: { facturaRef: string; amount: number; date: string; method: string; reference: string; bank?: string; detail?: string }, actor = "SISTEMA") {
    const invoices = await this.list<FacturaRecord>("facturas");
    const invoice = invoices.find((current) => [current.factura_id, current.codigo_factura, current.numero_factura].includes(input.facturaRef));
    if (!invoice) throw new Error("No se encontró la factura asociada.");
    const monto_pagado = Math.min(invoice.monto_total, invoice.monto_pagado + input.amount);
    const saldo_pendiente = Math.max(0, invoice.monto_total - monto_pagado);
    const today = new Date().toISOString().slice(0, 10);
    const estado: FacturaRecord["estado"] = saldo_pendiente === 0 ? "Pagada" : invoice.fecha_vencimiento < today ? "Vencida" : "Pendiente";
    const now = new Date().toISOString();
    await this.updateInvoiceFields(invoice.factura_id, { monto_pagado, saldo_pendiente, estado, actualizado_por: actor, actualizado_en: now });
    const payments = await this.list<PagoRecord>("pagos");
    const pago_id = this.nextSequentialId("PAG", payments.map((payment) => payment.pago_id));
    await this.append("pagos", [{ pago_id, codigo_pago: input.reference || pago_id, factura_id: invoice.factura_id, proveedor_id: invoice.proveedor_id, restaurante_id: invoice.restaurante_id, fecha_pago: input.date, metodo_pago: input.method, referencia: input.reference, moneda: invoice.moneda, monto: input.amount, banco_origen: input.bank || "", cuenta_origen: "", detalle: input.detail || "", soporte_url: "", registrado_por: actor, registrado_en: now }]);
    await this.append("bitacora", [{ bitacora_id: `BIT-${crypto.randomUUID()}`, fecha_hora: now, usuario_id: actor, accion: "Registrar pago", entidad: "facturas", entidad_id: invoice.factura_id, campo: "monto_pagado", valor_anterior: invoice.monto_pagado, valor_nuevo: monto_pagado, origen: "MANUAL", ip_o_sesion: "" }]);
    return { facturaId: invoice.factura_id, monto_pagado, saldo_pendiente, estado };
  }

  async setInvoiceStatus(facturaId: string, requested: FacturaRecord["estado"], actor = "SISTEMA") {
    const invoice = (await this.list<FacturaRecord>("facturas")).find((current) => current.factura_id === facturaId);
    if (!invoice) throw new Error("Factura no encontrada.");
    const monto_pagado = requested === "Pagada" ? invoice.monto_total : 0;
    const saldo_pendiente = invoice.monto_total - monto_pagado;
    const actual: FacturaRecord["estado"] = saldo_pendiente === 0 ? "Pagada" : invoice.fecha_vencimiento < new Date().toISOString().slice(0, 10) ? "Vencida" : "Pendiente";
    if (requested !== actual) throw new Error(`No se puede establecer ${requested}: con el saldo y vencimiento actuales el estado debe ser ${actual}.`);
    const now = new Date().toISOString();
    await this.updateInvoiceFields(facturaId, { monto_pagado, saldo_pendiente, estado: actual, actualizado_por: actor, actualizado_en: now });
    return { facturaId, monto_pagado, saldo_pendiente, estado: actual };
  }

  async createInvoices(input: Array<{ supplier: string; restaurant: string; number: string; issue: string; due: string; amount: number; category?: string; description?: string }>, actor = "SISTEMA") {
    const [providers, restaurants, existingInvoices] = await Promise.all([this.list<ProveedorRecord>("proveedores"), this.list<SheetRecord>("restaurantes"), this.list<FacturaRecord>("facturas")]);
    const providerByName = new Map(providers.map((provider) => [provider.nombre_legal.trim().toLowerCase(), provider]));
    const restaurantByName = new Map(restaurants.map((restaurant) => [String(restaurant.nombre).trim().toLowerCase(), String(restaurant.restaurante_id)]));
    const now = new Date().toISOString();
    const date = now.slice(0, 10);
    const newProviders: SheetRecord[] = [];
    let providerSequence = providers.map((provider) => provider.proveedor_id);
    let invoiceSequence = existingInvoices.map((invoice) => invoice.factura_id);
    const invoices: SheetRecord[] = input.map((item) => {
      const providerKey = item.supplier.trim().toLowerCase();
      let provider = providerByName.get(providerKey);
      if (!provider) {
        const proveedor_id = this.nextSequentialId("PROV", providerSequence); providerSequence = [...providerSequence, proveedor_id];
        provider = { proveedor_id, codigo_proveedor: this.nextSequentialId("PRV", providers.map((current) => current.codigo_proveedor).concat(newProviders.map((current) => String(current.codigo_proveedor)))), nombre_legal: item.supplier.trim(), nombre_comercial: "", ruc: "", telefono: "", email: "", banco: "", cuenta_bancaria: "", moneda_preferida: "NIO", activo: true, creado_por: actor, creado_en: now, actualizado_en: now };
        providerByName.set(providerKey, provider); newProviders.push(provider as unknown as SheetRecord);
      }
      const restaurante_id = restaurantByName.get(item.restaurant.trim().toLowerCase());
      if (!restaurante_id) throw new Error(`Restaurante no válido: ${item.restaurant}`);
      const factura_id = this.nextSequentialId("FAC", invoiceSequence); invoiceSequence = [...invoiceSequence, factura_id];
      return { factura_id, codigo_factura: factura_id, proveedor_id: provider.proveedor_id, restaurante_id, numero_factura: item.number.trim(), fecha_ingreso: date, fecha_emision: item.issue, fecha_vencimiento: item.due, moneda: "NIO", monto_total: item.amount, monto_pagado: 0, saldo_pendiente: item.amount, estado: "Pendiente", categoria: item.category || "General", origen_carga: input.length > 1 ? "IMPORTACION" : "MANUAL", creado_por: actor, creado_en: now, actualizado_por: actor, actualizado_en: now };
    });
    await this.append("proveedores", newProviders); await this.append("facturas", invoices);
    await this.append("bitacora", invoices.map((invoice) => ({ bitacora_id: `BIT-${crypto.randomUUID()}`, fecha_hora: now, usuario_id: actor, accion: "Crear factura", entidad: "facturas", entidad_id: invoice.factura_id, campo: "", valor_anterior: "", valor_nuevo: invoice.codigo_factura, origen: invoice.origen_carga, ip_o_sesion: "" })));
    return invoices.map((invoice) => invoice.factura_id);
  }

  async dashboard() {
    const [facturas, proveedores, pagos, prestamos, prestamo_saldos, restaurantes, usuarios, bitacora] = await Promise.all([
      this.list<FacturaRecord>("facturas"), this.list<ProveedorRecord>("proveedores"), this.list<PagoRecord>("pagos"), this.list<PrestamoRecord>("prestamos"), this.list<PrestamoSaldoRecord>("prestamo_saldos"), this.list<SheetRecord>("restaurantes"), this.list<SheetRecord>("usuarios"), this.list<SheetRecord>("bitacora"),
    ]);
    const today = new Date().toISOString().slice(0, 10);
    const facturasConEstado = facturas.map((factura) => ({
      ...factura,
      estado: (factura.saldo_pendiente <= 0 ? "Pagada" : factura.fecha_vencimiento && factura.fecha_vencimiento < today ? "Vencida" : "Pendiente") as FacturaRecord["estado"],
    }));
    return { facturas: facturasConEstado, proveedores, pagos, prestamos, prestamo_saldos, restaurantes, usuarios, bitacora };
  }
}
