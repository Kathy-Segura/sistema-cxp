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
      return { factura_id, codigo_factura: item.number.trim(), proveedor_id: provider.proveedor_id, restaurante_id, numero_factura: item.number.trim(), fecha_ingreso: date, fecha_emision: item.issue, fecha_vencimiento: item.due, moneda: "NIO", monto_total: item.amount, monto_pagado: 0, saldo_pendiente: item.amount, estado: "Pendiente", categoria: item.category || "General", descripcion: item.description || "", archivo_url: "", origen_carga: input.length > 1 ? "IMPORTACION" : "MANUAL", creado_por: actor, creado_en: now, actualizado_por: actor, actualizado_en: now };
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
