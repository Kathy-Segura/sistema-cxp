export type Section = "Resumen" | "Facturas" | "Proveedores" | "Transferencias" | "Préstamos" | "Bitácora" | "Usuarios y roles" | "Mi perfil";
export type InvoiceStatus = "Pendiente" | "Vencida" | "Pagada";
export type InvoiceCategory = 1 | 2;
export const PAYMENT_METHODS = ["Transferencia", "Pago", "Cheque", "Efectivo"] as const;
export type PaymentMethod = typeof PAYMENT_METHODS[number];
export type Currency = "NIO" | "USD";
export type Invoice = { id: string; supplier: string; supplierId?: string; code: string; restaurant: string; issue: string; due: string; amount: number; paidAmount?: number; pendingBalance?: number; status: InvoiceStatus; category?: InvoiceCategory; dateCreated?: string; paidDate?: string };
export type Row = Record<string, string | number>;
export type RowAction = "view" | "edit" | "delete";
export type ModalKind = "invoice" | "supplier" | "payment" | "loan" | "import";

// Columnas de la plantilla refactorizada. Los IDs se usan para buscar o mutar
// una única fila en Google Sheets, nunca por posición de fila.
export interface FacturaRecord {
  factura_id: string; codigo_factura: string; proveedor_id: string; restaurante_id: string;
  numero_factura: string; fecha_ingreso: string; fecha_emision: string; fecha_vencimiento: string;
  moneda: Currency; monto_total: number; monto_pagado: number; saldo_pendiente: number;
  estado: InvoiceStatus; categoria?: InvoiceCategory;
  origen_carga: string; creado_por: string; creado_en: string; actualizado_por: string; actualizado_en: string;
}
export interface ProveedorRecord { proveedor_id: string; codigo_proveedor: string; nombre_legal: string; nombre_comercial: string; ruc: string; telefono: string; email: string; banco: string; cuenta_bancaria: string; moneda_preferida: Currency; activo: boolean; creado_por: string; creado_en: string; actualizado_en: string; }
export type SupplierInput = Pick<ProveedorRecord, "codigo_proveedor" | "nombre_legal" | "nombre_comercial" | "ruc" | "telefono" | "email" | "banco" | "cuenta_bancaria" | "moneda_preferida">;
export interface PagoRecord { pago_id: string; codigo_pago: string; factura_id: string; proveedor_id: string; restaurante_id: string; fecha_pago: string; metodo_pago: PaymentMethod; referencia: string; moneda: Currency; monto: number; banco_origen: string; cuenta_origen: string; detalle: string; soporte_url: string; registrado_por: string; registrado_en: string; }
export interface PrestamoRecord { prestamo_id: string; codigo_prestamo: string; acreedor: string; numero_prestamo: string; titular: string; restaurante_id: string; destino: string; fecha_apertura: string; fecha_vencimiento: string; moneda: Currency; monto_inicial: number; tasa_anual: number; cuota_programada: number; dia_pago: number; estado: string; notas: string; creado_por: string; creado_en: string; actualizado_en: string; }
export interface PrestamoSaldoRecord { prestamo_saldo_id: string; prestamo_id: string; periodo: string; saldo_inicial: number; interes: number; abono_capital: number; cuota_pagada: number; saldo_final: number; fecha_pago: string; referencia_pago: string; estado: string; registrado_por: string; registrado_en: string; }
