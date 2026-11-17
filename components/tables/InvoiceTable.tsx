"use client";
import { CalendarDays, Check } from "lucide-react";
import type { Invoice, Row } from "../../types";
import { money } from "../../utils/formatters";
import { StatusBadge } from "./StatusBadge";
import { ActionButtons } from "../shared/ActionButtons";

export function InvoiceTable({ invoices, compact = false, onStatus, onAction }: { invoices: Invoice[]; compact?: boolean; onStatus: (id: string, status: string) => void; onAction?: (row: Row, action: "view" | "edit" | "delete") => void }) {
  return <div className="table-scroll"><table className="data-table"><thead><tr><th>PROVEEDOR / FACTURA</th><th>RESTAURANTE</th><th>FECHA EMISIÓN <CalendarDays size={12} /></th><th>VENCIMIENTO</th><th className="align-right">MONTO</th><th>ESTADO</th>{!compact && <th>ACCIONES</th>}</tr></thead><tbody>{invoices.map((item) => <tr key={item.id}><td><div className="supplier-cell"><span className="supplier-avatar">{item.supplier.split(" ").slice(0, 2).map((word) => word[0]).join("")}</span><span><strong>{item.supplier}</strong><small>{item.code}</small></span></div></td><td><span className="restaurant-pill">{item.restaurant}</span></td><td>{item.issue}</td><td className={item.status === "Vencida" ? "due-danger" : ""}>{item.due}</td><td className="align-right amount-cell">{money(item.amount)}</td><td><StatusBadge status={item.status} /></td>{!compact && <td><div className="row-actions"><ActionButtons label={`factura ${item.code}`} onAction={(action) => onAction?.(item, action)} /><button className="row-action" aria-label={item.status === "Pagada" ? `Reabrir factura ${item.code}` : `Marcar pagada ${item.code}`} title={item.status === "Pagada" ? "Reabrir" : "Marcar pagada"} onClick={() => onStatus(item.id, item.status === "Pagada" ? "Pendiente" : "Pagada")}><Check size={15} /></button></div></td>}</tr>)}</tbody></table></div>
}
