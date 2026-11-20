"use client";
import { CalendarDays, HandCoins } from "lucide-react";
import type { Invoice, Row } from "../../types";
import { money } from "../../utils/formatters";
import { StatusBadge } from "./StatusBadge";
import { ActionButtons } from "../shared/ActionButtons";

export function InvoiceTable({ invoices, compact = false, duplicateInvoiceIds, onPay, onAction }: { invoices: Invoice[]; compact?: boolean; duplicateInvoiceIds?: ReadonlySet<string>; onPay?: (id: string) => void; onAction?: (row: Row, action: "view" | "edit" | "delete") => void }) {
  return (
    <div className="table-scroll">
      <table className="data-table">
        <thead><tr>
          <th>PROVEEDOR</th><th>N.º FACTURA</th><th>RESTAURANTE</th>
          <th>FECHA EMISIÓN <CalendarDays size={12} /></th><th>VENCIMIENTO</th>
          <th className="align-right">MONTO</th>
          {!compact && <><th className="align-right">MONTO PAGADO</th><th className="align-right">SALDO</th></>}
          <th>ESTADO</th>{!compact && <th>ACCIONES</th>}
        </tr></thead>
        <tbody>{invoices.map((item) => (
          <tr key={item.id}>
            <td><div className="supplier-cell">
              <span className="supplier-avatar">{item.supplier.split(" ").slice(0, 2).map((word) => word[0]).join("")}</span>
              <span><strong>{item.supplier}</strong><small>{item.id}</small></span>
            </div></td>
            <td>
              {item.code}
              {duplicateInvoiceIds?.has(item.id) && <span className="invoice-duplicate" title="El proveedor tiene otra factura con este número">Duplicada</span>}
            </td><td><span className="restaurant-pill">{item.restaurant}</span></td>
            <td>{item.issue}</td><td className={item.status === "Vencida" ? "due-danger" : ""}>{item.due}</td>
            <td className="align-right amount-cell">{money(item.amount)}</td>
            {!compact && <>
              <td className="align-right amount-cell">{money(item.paidAmount ?? 0)}</td>
              <td className="align-right amount-cell">{money(item.pendingBalance ?? item.amount)}</td>
            </>}
            <td><StatusBadge status={item.status} /></td>
            {!compact && <td><div className="row-actions">
              <ActionButtons label={`factura ${item.id}`} onAction={(action) => onAction?.(item, action)} />
              {onPay && (item.pendingBalance ?? item.amount) > 0 && (
                <button type="button" className="row-action invoice-payment-action"
                  title="Registrar pago" aria-label={`Registrar pago de ${item.id}`} onClick={() => onPay(item.id)}>
                  <HandCoins size={16} aria-hidden="true" />
                </button>
              )}
            </div></td>}
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}
