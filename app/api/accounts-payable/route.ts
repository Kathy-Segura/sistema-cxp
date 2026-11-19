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
    if (body.action !== "createInvoices" || !Array.isArray(body.invoices) || !body.invoices.length) return NextResponse.json({ error: "Solicitud de facturas inválida." }, { status: 400 });
    const invoices = body.invoices.map((invoice: Record<string, unknown>) => ({ supplier: String(invoice.supplier ?? "").trim(), restaurant: String(invoice.restaurant ?? "").trim(), number: String(invoice.number ?? "").trim(), issue: String(invoice.issue ?? ""), due: String(invoice.due ?? ""), amount: Number(invoice.amount), category: String(invoice.category ?? "General"), description: String(invoice.description ?? "") }));
    if (invoices.some((invoice: { supplier: string; restaurant: string; number: string; issue: string; due: string; amount: number }) => !invoice.supplier || !invoice.restaurant || !invoice.number || !/^\d{4}-\d{2}-\d{2}$/.test(invoice.issue) || !/^\d{4}-\d{2}-\d{2}$/.test(invoice.due) || !Number.isFinite(invoice.amount) || invoice.amount <= 0)) return NextResponse.json({ error: "Cada factura requiere proveedor, restaurante, número, fechas ISO y monto positivo." }, { status: 400 });
    const ids = await new AccountsPayableRepository().createInvoices(invoices);
    return NextResponse.json({ created: ids.length, ids }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudieron guardar las facturas." }, { status: 500 });
  }
}
