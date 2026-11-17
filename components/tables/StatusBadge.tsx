
export function StatusBadge({ status }: { status: string }) { const cls = status === "Pagada" || status === "Completada" || status === "Activo" ? "status-green" : status === "Vencida" ? "status-red" : status === "En proceso" ? "status-blue" : "status-amber"; return <span className={`status-badge ${cls}`}><i />{status}</span> }
