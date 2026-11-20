import { NextResponse } from "next/server";
import { AccountsPayableRepository } from "@/lib/accounts-payable-repository";

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
      if (!String(payment.facturaRef ?? "") || !/^\d{4}-\d{2}-\d{2}$/.test(String(payment.date ?? "")) || !Number.isFinite(Number(payment.amount)) || Number(payment.amount) <= 0) return NextResponse.json({ error: "Pago inválido." }, { status: 400 });
      return NextResponse.json(await new AccountsPayableRepository().recordPayment({ facturaRef: String(payment.facturaRef), amount: Number(payment.amount), date: String(payment.date), method: String(payment.method || "Pago"), reference: String(payment.reference || ""), bank: String(payment.bank || ""), detail: String(payment.detail || "") }));
    }
    if (body.action !== "createInvoices" || !Array.isArray(body.invoices) || !body.invoices.length) return NextResponse.json({ error: "Solicitud de facturas inválida." }, { status: 400 });
    const invoices = body.invoices.map((invoice: Record<string, unknown>) => ({ supplier: String(invoice.supplier ?? "").trim(), restaurant: String(invoice.restaurant ?? "").trim(), number: String(invoice.number ?? "").trim(), issue: String(invoice.issue ?? ""), due: String(invoice.due ?? ""), amount: Number(invoice.amount), category: String(invoice.category ?? "General"), description: String(invoice.description ?? "") }));
    if (invoices.some((invoice: { supplier: string; restaurant: string; number: string; issue: string; due: string; amount: number }) => !invoice.supplier || !invoice.restaurant || !invoice.number || !/^\d{4}-\d{2}-\d{2}$/.test(invoice.issue) || !/^\d{4}-\d{2}-\d{2}$/.test(invoice.due) || !Number.isFinite(invoice.amount) || invoice.amount <= 0)) return NextResponse.json({ error: "Cada factura requiere proveedor, restaurante, número, fechas ISO y monto positivo." }, { status: 400 });
    const ids = await new AccountsPayableRepository().createInvoices(invoices);
    return NextResponse.json({ created: ids.length, ids }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudieron guardar las facturas." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { facturaId } = await request.json();
    if (!/^FAC-\d+$/.test(String(facturaId))) return NextResponse.json({ error: "ID de factura inválido." }, { status: 400 });
    await new AccountsPayableRepository().deleteInvoice(String(facturaId));
    return NextResponse.json({ deleted: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo eliminar la factura." }, { status: 500 });
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
