"use client";
import { CalendarDays } from "lucide-react";
import type { Invoice, Row } from "../../types";
import { money } from "../../utils/formatters";
import { StatusBadge } from "./StatusBadge";
import { ActionButtons } from "../shared/ActionButtons";

export function InvoiceTable({ invoices, compact = false, onStatus, onAction }: { invoices: Invoice[]; compact?: boolean; onStatus: (id: string, status: "Pendiente" | "Vencida" | "Pagada") => void; onAction?: (row: Row, action: "view" | "edit" | "delete") => void }) {
  return <div className="table-scroll"><table className="data-table"><thead><tr><th>PROVEEDOR</th><th>N.º FACTURA</th><th>RESTAURANTE</th><th>FECHA EMISIÓN <CalendarDays size={12} /></th><th>VENCIMIENTO</th><th className="align-right">MONTO</th><th>ESTADO</th>{!compact && <th>ACCIONES</th>}</tr></thead><tbody>{invoices.map((item) => <tr key={item.id}><td><div className="supplier-cell"><span className="supplier-avatar">{item.supplier.split(" ").slice(0, 2).map((word) => word[0]).join("")}</span><span><strong>{item.supplier}</strong><small>{item.id}</small></span></div></td><td>{item.code}</td><td><span className="restaurant-pill">{item.restaurant}</span></td><td>{item.issue}</td><td className={item.status === "Vencida" ? "due-danger" : ""}>{item.due}</td><td className="align-right amount-cell">{money(item.amount)}</td><td><StatusBadge status={item.status} /></td>{!compact && <td><div className="row-actions"><ActionButtons label={`factura ${item.id}`} onAction={(action) => onAction?.(item, action)} /><select className="status-select" aria-label={`Cambiar estado de ${item.id}`} value={item.status} onChange={(event) => onStatus(item.id, event.target.value as "Pendiente" | "Vencida" | "Pagada")}><option>Pendiente</option><option>Vencida</option><option>Pagada</option></select></div></td>}</tr>)}</tbody></table></div>
}
