
export function StatusBadge({ status }: { status: string }) {
  const cls = ["Pagada", "Pagado", "Completada", "Activo"].includes(status) ? "status-green"
    : ["Vencida", "Vencido"].includes(status) ? "status-red"
      : status === "En proceso" ? "status-blue"
        : status === "Sin cuota" ? "status-neutral" : "status-amber";
  return <span className={`status-badge ${cls}`}><i />{status}</span>;
}
