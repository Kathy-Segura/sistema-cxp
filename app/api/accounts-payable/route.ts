import { NextResponse } from "next/server";
import { AccountsPayableRepository, InvoiceOperationError } from "@/lib/accounts-payable-repository";
import { PAYMENT_METHODS, type PaymentMethod } from "@/types";
import { moneyCents } from "@/lib/invoice-balances";
import { isoDate } from "@/utils/formatters";

let pendingWrite = Promise.resolve();
function write<T>(operation: () => Promise<T>) {
  const result = pendingWrite.then(operation);
  pendingWrite = result.then(() => {}, () => {});
  return result;
}

export const dynamic = "force-dynamic";

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
    const invoices = body.invoices.map((invoice: Record<string, unknown>) => ({
      supplier: String(invoice.supplier ?? "").trim(), restaurant: String(invoice.restaurant ?? "").trim(),
      number: String(invoice.number ?? "").trim(), issue: isoDate(invoice.issue), due: isoDate(invoice.due),
      amount: Number(invoice.amount),
    }));
    if (invoices.some((invoice: { supplier: string; restaurant: string; number: string; issue: string; due: string; amount: number }) =>
      !invoice.supplier || !invoice.restaurant || !invoice.number || !isoDate(invoice.issue) ||
      !isoDate(invoice.due) || invoice.due < invoice.issue || !(moneyCents(invoice.amount) > 0))) {
      return NextResponse.json({ error: "Revisa proveedor, restaurante, número, fechas y monto de las facturas." }, { status: 400 });
    }
    const origin = body.origin === "IMPORTACION" || invoices.length > 1 ? "IMPORTACION" : "MANUAL";
    const ids = await write(() => new AccountsPayableRepository().createInvoices(invoices, origin));
    return NextResponse.json({ created: ids.length, ids }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudieron guardar las facturas." },
      { status: error instanceof InvoiceOperationError ? error.status : 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { facturaId } = await request.json();
    if (typeof facturaId !== "string" || !facturaId.trim() || facturaId.length > 128) {
      return NextResponse.json({ error: "ID de factura inválido." }, { status: 400 });
    }
    const id = facturaId.trim();
    await write(() => new AccountsPayableRepository().deleteInvoice(id));
    return NextResponse.json({ deleted: true, facturaId: id });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo eliminar la factura." },
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
