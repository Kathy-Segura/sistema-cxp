"use client";
import { useState } from "react";
import { CalendarClock, Plus, Search, X } from "lucide-react";
import type { FixedExpenseInput, FixedExpensePayment, FixedExpensePaymentChange, GastoFijoRecord, ProveedorRecord, RestaurantOption } from "../../types";
import { sectionsMeta } from "../../constants/section-meta";
import { fixedExpenseDueInPeriod, fixedExpensePaymentStatus, formatFixedExpenseAmount, nextFixedExpenseDue } from "../../lib/fixed-expenses";
import { managuaDate } from "../../lib/invoice-balances";
import { normalizeExcelHeader } from "../../utils/formatters";
import { FixedExpenseModal } from "../modals/FixedExpenseModal";
import { DeleteConfirmationCard } from "../modals/DeleteConfirmationCard";
import { ActionButtons } from "../shared/ActionButtons";
import { SupplierOptions } from "../forms/SupplierOptions";
import { Pagination } from "../tables/Pagination";
import { StatusBadge } from "../tables/StatusBadge";

const EMPTY_FILTERS = { search: "", provider: "all", restaurant: "all", state: "all", from: "", to: "" };
type ExpenseDialog = { action: "new" } | { action: "view" | "edit" | "delete"; expense: GastoFijoRecord };

export function FixedExpensesSection({ expenses, providers, restaurants, loading, error, onSave, onDelete, payments, onPaymentChange }: {
  expenses: GastoFijoRecord[];
  providers: ProveedorRecord[];
  restaurants: RestaurantOption[];
  loading: boolean;
  error: string;
  onSave: (input: FixedExpenseInput, expense?: GastoFijoRecord) => Promise<void>;
  onDelete: (expense: GastoFijoRecord) => Promise<void>;
  payments: FixedExpensePayment[];
  onPaymentChange: (change: FixedExpensePaymentChange) => Promise<void>;
}) {
  const [dialog, setDialog] = useState<ExpenseDialog | null>(null);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const suppliersById = new Map(providers.map((provider) => [provider.proveedor_id, provider.nombre_legal]));
  const restaurantsById = new Map(restaurants.map(({ id, name }) => [id, name]));
  const query = normalizeExcelHeader(filters.search);
  const invalidRange = Boolean(filters.from && filters.to && filters.from > filters.to);
  const updateFilter = (key: keyof typeof EMPTY_FILTERS, value: string) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  };
  const resetFilters = () => { setFilters(EMPTY_FILTERS); setPage(1); };
  const hasFilters = Object.keys(EMPTY_FILTERS).some((key) => {
    const filter = key as keyof typeof EMPTY_FILTERS;
    return filters[filter] !== EMPTY_FILTERS[filter];
  });
  const today = managuaDate();
  const period = today.slice(0, 7);
  const currentPayments = new Map(payments.filter((payment) => payment.periodo === period).map((payment) => [payment.gasto_fijo_id, payment.fecha_pago]));
  const rows = expenses.map((expense) => ({
    expense,
    supplierName: suppliersById.get(expense.proveedor_id) || expense.proveedor_id || "—",
    restaurantName: restaurantsById.get(expense.restaurante_id) || expense.restaurante_id || "General",
    nextDue: nextFixedExpenseDue(expense, today),
    paymentStatus: fixedExpensePaymentStatus(fixedExpenseDueInPeriod(expense, period), currentPayments.get(expense.gasto_fijo_id) ?? "", today),
  })).filter(({ expense, supplierName, restaurantName, nextDue, paymentStatus }) => (
    !invalidRange &&
    (filters.state === "all" || filters.state === (expense.activo ? "active" : "inactive") || filters.state === paymentStatus) &&
    (filters.restaurant === "all" || (expense.restaurante_id || "") === filters.restaurant) &&
    (filters.provider === "all" || (expense.proveedor_id || "") === filters.provider) &&
    (!filters.from || (nextDue && nextDue >= filters.from)) && (!filters.to || (nextDue && nextDue <= filters.to)) &&
    normalizeExcelHeader([expense.numero_referencia, expense.gasto_fijo_id, expense.descripcion, expense.codigo_gasto, expense.categoria, supplierName, restaurantName].join(" ")).includes(query)
  ));
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(page, pages);
  const { title, description } = sectionsMeta["Gastos fijos"];

  return (
    <>
      <div className="section-heading">
        <div>
          <div className="section-kicker"><CalendarClock size={14} /> GESTIÓN FINANCIERA</div>
          <h1>{title}</h1><p className="page-subtitle">{description}</p>
        </div>
        <button type="button" className="button-primary" disabled={loading || !!error} onClick={() => setDialog({ action: "new" })}>
          <Plus size={17} /> Nuevo gasto fijo
        </button>
      </div>
      <div className="filter-bar fixed-expense-filters">
        <label className="table-search"><Search size={16} aria-hidden="true" />
          <input type="search" aria-label="Buscar gasto fijo" placeholder="Buscar referencia, descripción o proveedor" value={filters.search}
            onChange={(event) => updateFilter("search", event.target.value)} />
        </label>
        <label>Proveedor
          <select value={filters.provider} onChange={(event) => updateFilter("provider", event.target.value)}>
            <option value="all">Todos los proveedores</option><option value="">Sin proveedor</option>
            <SupplierOptions providers={providers} />
          </select>
        </label>
        <label>Restaurante
          <select value={filters.restaurant} onChange={(event) => updateFilter("restaurant", event.target.value)}>
            <option value="all">Todos los restaurantes</option><option value="">General</option>
            {restaurants.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
          </select>
        </label>
        <label>Estado
          <select value={filters.state} onChange={(event) => updateFilter("state", event.target.value)}>
            <option value="all">Todos los estados</option>
            <optgroup label="Pago del mes"><option>Pendiente</option><option>Vencido</option><option>Pagado</option><option>Sin cuota</option></optgroup>
            <optgroup label="Vigencia"><option value="active">Activos</option><option value="inactive">Inactivos</option></optgroup>
          </select>
        </label>
        <label>Vencimiento desde
          <input type="date" value={filters.from} onChange={(event) => updateFilter("from", event.target.value)} />
        </label>
        <label>Vencimiento hasta
          <input type="date" value={filters.to} min={filters.from || undefined} onChange={(event) => updateFilter("to", event.target.value)} />
        </label>
        <button type="button" className="button-secondary" onClick={resetFilters} disabled={!hasFilters}>
          <X size={15} aria-hidden="true" /> Limpiar filtros
        </button>
      </div>
      {error ? <p role="alert" className="invoice-form-error">{error}</p> : invalidRange ? (
        <p role="alert" className="invoice-form-error">La fecha final debe ser igual o posterior a la fecha inicial.</p>
      ) : loading ? (
        <p role="status" className="panel supplier-empty">Cargando gastos fijos…</p>
      ) : (
        <div className="panel table-panel">
          <div className="table-scroll">
            <table className="data-table" aria-label="Gastos fijos registrados">
              <thead><tr><th>N.º DE REFERENCIA</th><th>CATEGORÍA</th><th>PROVEEDOR</th><th>RESTAURANTE</th><th className="align-right">IMPORTE MENSUAL</th>
                <th>DÍA MENSUAL</th><th>PRÓXIMO VENCIMIENTO</th><th>PAGO {period}</th><th>VIGENCIA</th><th>ACCIONES</th></tr></thead>
              <tbody>{rows.slice((currentPage - 1) * pageSize, currentPage * pageSize).map(({ expense, supplierName, restaurantName, nextDue, paymentStatus }) => (
                <tr key={expense.gasto_fijo_id}>
                  <td><strong>{expense.numero_referencia || "—"}</strong><div>{expense.codigo_gasto || expense.gasto_fijo_id}</div></td>
                  <td>{expense.categoria || "—"}</td>
                  <td>{supplierName}</td><td>{restaurantName}</td>
                  <td className="align-right amount-cell">{formatFixedExpenseAmount(expense)}</td>
                  <td>{expense.dia_vencimiento || "—"}</td><td>{nextDue || "—"}</td>
                  <td><button type="button" className="fixed-payment-status" aria-label={`Consultar pago de ${expense.numero_referencia || expense.gasto_fijo_id}: ${paymentStatus}`}
                    onClick={() => setDialog({ action: "view", expense })}><StatusBadge status={paymentStatus} /></button></td>
                  <td><StatusBadge status={expense.activo ? "Activo" : "Inactivo"} /></td>
                  <td><ActionButtons label={`gasto ${expense.numero_referencia || expense.codigo_gasto || expense.gasto_fijo_id}`}
                    onAction={(action) => setDialog({ action, expense })} /></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          {!rows.length && <p role="status" className="supplier-empty">{expenses.length ? "No hay gastos fijos que coincidan con los filtros." : "Todavía no hay gastos fijos registrados."}</p>}
          <Pagination page={currentPage} pages={pages} total={rows.length} pageSize={pageSize} setPage={setPage}
            setPageSize={(size) => { setPageSize(size); setPage(1); }} />
        </div>
      )}
      {dialog?.action === "delete" ? (
        <DeleteConfirmationCard recordName="gasto fijo" id={dialog.expense.gasto_fijo_id}
          label={[dialog.expense.numero_referencia, dialog.expense.descripcion || dialog.expense.codigo_gasto, dialog.expense.gasto_fijo_id].filter(Boolean).join(" · ")}
          onClose={() => setDialog(null)} onConfirm={async () => { await onDelete(dialog.expense); setDialog(null); }} />
      ) : dialog && (
        <FixedExpenseModal expense={dialog.action === "new" ? undefined : dialog.expense} mode={dialog.action === "view" ? "view" : undefined}
          providers={providers} restaurants={restaurants} onSave={onSave} onClose={() => setDialog(null)}
          payments={dialog.action === "view" ? payments.filter((payment) => payment.gasto_fijo_id === dialog.expense.gasto_fijo_id) : undefined}
          onPaymentChange={onPaymentChange} />
      )}
    </>
  );
}
