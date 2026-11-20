import { NextResponse } from "next/server";
import { AccountsPayableRepository } from "@/lib/accounts-payable-repository";
import { invoiceTemplate } from "@/lib/invoice-template";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await new AccountsPayableRepository().list<{ nombre: string }>("restaurantes");
    const workbook = await invoiceTemplate(rows.map(({ nombre }) => nombre ?? ""));
    return new Response(workbook, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="plantilla-cuentas-por-pagar.xlsx"',
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "No se pudo descargar la plantilla. Revisa la conexión con la pestaña restaurantes e inténtalo de nuevo." }, { status: 503 });
  }
}
