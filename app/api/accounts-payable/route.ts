import { NextResponse } from "next/server";
import { AccountsPayableRepository, InvoiceOperationError } from "@/lib/accounts-payable-repository";
import { PAYMENT_METHODS, type PaymentMethod } from "@/types";
import { managuaDate, moneyCents } from "@/lib/invoice-balances";
import { isoDate } from "@/utils/formatters";
import { resolveInvoiceNumber } from "@/lib/invoice-identity";
import { FIXED_EXPENSE_DESCRIPTION_LIMIT, FIXED_EXPENSE_REFERENCE_LIMIT } from "@/lib/fixed-expenses";
import type { FixedExpenseInput, SupplierInput } from "@/types";

let pendingWrite = Promise.resolve();
function write<T>(operation: () => Promise<T>) {
  const result = pendingWrite.then(operation);
  pendingWrite = result.then(() => {}, () => {});
  return result;
}

export const dynamic = "force-dynamic";

function validId(id: unknown): id is string {
  return typeof id === "string" && id.length <= 128 && id.trim() === id && id.length > 0;
}

export async function GET() {
  try {
    return NextResponse.json(await new AccountsPayableRepository().dashboard());
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo consultar Google Sheets.";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (body.action === "setFixedExpensePayment") {
      const { expenseId, period, paidDate, expectedPaidDate } = body;
      const date = isoDate(paidDate);
      if (!validId(expenseId) || typeof period !== "string" || !/^[1-9]\d{3}-(0[1-9]|1[0-2])$/.test(period) ||
        typeof paidDate !== "string" || (paidDate !== "" && (!date || date > managuaDate())) ||
        typeof expectedPaidDate !== "string" || (expectedPaidDate !== "" && !isoDate(expectedPaidDate))) {
        return NextResponse.json({ error: "Revisa el período y la fecha de pago. La fecha de pago debe ser igual o anterior a hoy." }, { status: 400 });
      }
      return NextResponse.json(await write(() => new AccountsPayableRepository().setFixedExpensePayment({
        expenseId, period, paidDate: date, expectedPaidDate,
      })));
    }
    if (body.action === "saveFixedExpense") {
      const raw = body.expense ?? {};
      const field = (name: string) => typeof raw[name] === "string" ? raw[name].trim() : "";
      const id = body.expenseId ?? "";
      const expectedUpdatedAt = body.expectedUpdatedAt;
      const currency = field("moneda");
      const reference = field("numero_referencia");
      const expense: FixedExpenseInput = {
        descripcion: field("descripcion"), categoria: field("categoria"), proveedor_id: field("proveedor_id"),
        numero_referencia: raw.numero_referencia === undefined ? undefined : reference,
        restaurante_id: field("restaurante_id"), moneda: currency === "USD" ? "USD" : "NIO",
        monto_estimado: raw.monto_estimado, dia_vencimiento: raw.dia_vencimiento, activo: raw.activo,
        fecha_inicio: isoDate(field("fecha_inicio")), fecha_fin: isoDate(field("fecha_fin")),
      };
      if ((id !== "" && (!validId(id) || typeof expectedUpdatedAt !== "string")) ||
        !expense.descripcion || expense.descripcion.length > FIXED_EXPENSE_DESCRIPTION_LIMIT || !expense.categoria || expense.categoria.length > 80 ||
        (raw.numero_referencia !== undefined && (typeof raw.numero_referencia !== "string" || reference.length > FIXED_EXPENSE_REFERENCE_LIMIT)) ||
        !["NIO", "USD"].includes(currency) || typeof expense.monto_estimado !== "number" || !(moneyCents(expense.monto_estimado) > 0) ||
        !Number.isInteger(expense.dia_vencimiento) || expense.dia_vencimiento < 1 || expense.dia_vencimiento > 31 ||
        typeof expense.activo !== "boolean" || !expense.fecha_inicio || (field("fecha_fin") && !expense.fecha_fin) ||
        (expense.fecha_fin && expense.fecha_fin < expense.fecha_inicio) ||
        (expense.proveedor_id && !validId(expense.proveedor_id)) || (expense.restaurante_id && !validId(expense.restaurante_id))) {
        return NextResponse.json({ error: "Revisa la descripción, categoría, importe, día mensual y fechas de vigencia del gasto fijo." }, { status: 400 });
      }
      const result = await write(() => new AccountsPayableRepository().saveFixedExpense(expense, id, expectedUpdatedAt ?? ""));
      return NextResponse.json(result, { status: id ? 200 : 201 });
    }
    if (body.action === "assignInvoiceSupplier") {
      const { invoiceId, supplierId, expectedSupplierId, confirmedReassignment } = body;
      if (!validId(invoiceId) || !validId(supplierId) || (expectedSupplierId !== "" && !validId(expectedSupplierId))) {
        return NextResponse.json({ error: "Selecciona una factura y un proveedor registrado." }, { status: 400 });
      }
      if (expectedSupplierId && expectedSupplierId !== supplierId && confirmedReassignment !== true) {
        return NextResponse.json({ error: "Confirma el cambio de proveedor de esta factura." }, { status: 400 });
      }
      return NextResponse.json(await write(() => new AccountsPayableRepository().assignInvoiceSupplier(invoiceId, supplierId, expectedSupplierId)));
    }
    if (body.action === "saveSupplier") {
      const raw = body.supplier ?? {};
      const field = (name: string) => typeof raw[name] === "string" ? raw[name].trim() : "";
      const currency = field("moneda_preferida");
      const supplierId = body.supplierId ?? "";
      const invoiceIds = body.invoiceIds ?? [];
      const supplier: SupplierInput = {
        nombre_legal: field("nombre_legal"), nombre_comercial: field("nombre_comercial"),
        codigo_proveedor: field("codigo_proveedor"), ruc: field("ruc"), telefono: field("telefono"), email: field("email"),
        banco: field("banco"), cuenta_bancaria: field("cuenta_bancaria"), moneda_preferida: currency === "USD" ? "USD" : "NIO",
      };
      if (!supplier.nombre_legal || (!supplierId && !supplier.ruc) ||
        (supplier.ruc && (!/^[A-Za-z0-9 -]+$/.test(supplier.ruc) || !/[A-Za-z0-9]/.test(supplier.ruc))) ||
        (supplier.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(supplier.email)) ||
        !["NIO", "USD"].includes(currency) || Object.values(supplier).some((value) => value.length > 200) ||
        (supplierId !== "" && !validId(supplierId)) || !Array.isArray(invoiceIds) || !invoiceIds.every(validId)) {
        return NextResponse.json({ error: "Revisa el nombre legal, el RUC, la moneda, el correo y las facturas seleccionadas." }, { status: 400 });
      }
      const result = await write(() => new AccountsPayableRepository().saveSupplier(supplier, supplierId, [...new Set<string>(invoiceIds)]));
      return NextResponse.json(result, { status: supplierId ? 200 : 201 });
    }
    if (body.action === "recordPayment") {
      const payment = body.payment ?? {};
      const input = {
        facturaRef: String(payment.facturaRef ?? "").trim(),
        amount: Number(payment.amount),
        date: isoDate(payment.date),
        method: String(payment.method || "Pago"),
        reference: String(payment.reference ?? "").trim(),
        bank: String(payment.bank ?? "").trim(),
        detail: String(payment.detail ?? "").trim(),
      };
      if (!input.facturaRef || !input.date || !(moneyCents(input.amount) > 0) || !input.reference ||
          !PAYMENT_METHODS.includes(input.method as PaymentMethod)) {
        return NextResponse.json({ error: "Indica una factura, fecha, método, referencia y monto positivo con hasta dos decimales." }, { status: 400 });
      }
      return NextResponse.json(await write(() => new AccountsPayableRepository().recordPayment(input)));
    }
    if (body.action !== "createInvoices" || !Array.isArray(body.invoices) || !body.invoices.length) return NextResponse.json({ error: "Solicitud de facturas inválida." }, { status: 400 });
    const invoices = body.invoices.map((invoice: Record<string, unknown>) => {
      const restaurant = String(invoice.restaurant ?? "").trim();
      const issue = isoDate(invoice.issue);
      return {
        supplier: String(invoice.supplier ?? "").trim(), supplierId: String(invoice.supplierId ?? "").trim(), restaurant, issue, due: isoDate(invoice.due),
        number: resolveInvoiceNumber(String(invoice.number ?? ""), issue, restaurant),
        amount: Number(invoice.amount),
      };
    });
    if (invoices.some((invoice: { supplier: string; restaurant: string; number: string; issue: string; due: string; amount: number }) =>
      !invoice.supplier || !invoice.restaurant || !invoice.number || !isoDate(invoice.issue) ||
      !isoDate(invoice.due) || invoice.due < invoice.issue || !(moneyCents(invoice.amount) > 0))) {
      return NextResponse.json({ error: "Revisa proveedor, restaurante, número, fechas y monto de las facturas." }, { status: 400 });
    }
    const origin = body.origin === "IMPORTACION" || invoices.length > 1 ? "IMPORTACION" : "MANUAL";
    const result = await write(() => new AccountsPayableRepository().createInvoices(invoices, origin));
    return NextResponse.json({ created: result.ids.length, ...result }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudieron guardar las facturas." },
      { status: error instanceof InvoiceOperationError ? error.status : 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { facturaId, expenseId, expectedUpdatedAt } = await request.json();
    if (expenseId !== undefined) {
      if (facturaId !== undefined || !validId(expenseId) || typeof expectedUpdatedAt !== "string") {
        return NextResponse.json({ error: "Solicitud de eliminación del gasto fijo inválida." }, { status: 400 });
      }
      const audit = await write(() => new AccountsPayableRepository().deleteFixedExpense(expenseId, expectedUpdatedAt));
      return NextResponse.json({ deleted: true, expenseId, audit });
    }
    if (typeof facturaId !== "string" || !facturaId.trim() || facturaId.length > 128) {
      return NextResponse.json({ error: "ID de factura inválido." }, { status: 400 });
    }
    const id = facturaId.trim();
    await write(() => new AccountsPayableRepository().deleteInvoice(id));
    return NextResponse.json({ deleted: true, facturaId: id });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo eliminar el registro." },
      { status: error instanceof InvoiceOperationError ? error.status : 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { facturaId, estado } = await request.json();
    if (!/^FAC-\d+$/.test(String(facturaId)) || !["Pendiente", "Vencida", "Pagada"].includes(String(estado))) return NextResponse.json({ error: "Cambio de estado inválido." }, { status: 400 });
    return NextResponse.json(await new AccountsPayableRepository().setInvoiceStatus(String(facturaId), estado));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo actualizar el estado." }, { status: 400 });
  }
}
