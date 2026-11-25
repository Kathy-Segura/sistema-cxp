"use client";
import { useState } from "react";
import { CalendarClock, Check, X } from "lucide-react";
import type { FixedExpenseInput, FixedExpensePayment, FixedExpensePaymentChange, GastoFijoRecord, ProveedorRecord, RestaurantOption } from "../../types";
import { managuaDate } from "../../lib/invoice-balances";
import { FIXED_EXPENSE_CATEGORIES, FIXED_EXPENSE_DESCRIPTION_LIMIT, FIXED_EXPENSE_REFERENCE_LIMIT, formatFixedExpenseAmount, nextFixedExpenseDue } from "../../lib/fixed-expenses";
import { isoDate } from "../../utils/formatters";
import { SupplierOptions } from "../forms/SupplierOptions";
import { StatusBadge } from "../tables/StatusBadge";
import { FixedExpensePaymentPanel } from "../forms/FixedExpensePaymentPanel";

export function FixedExpenseModal({ expense, providers, restaurants, onSave, onClose, mode, payments = [], onPaymentChange }: {
  expense?: GastoFijoRecord;
  providers: ProveedorRecord[];
  restaurants: RestaurantOption[];
  onSave: (input: FixedExpenseInput, expense?: GastoFijoRecord) => Promise<void>;
  onClose: () => void;
  mode?: "view";
  payments?: FixedExpensePayment[];
  onPaymentChange?: (change: FixedExpensePaymentChange) => Promise<void>;
}) {
  const [start, setStart] = useState(expense ? isoDate(expense.fecha_inicio) : managuaDate());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const category = expense?.categoria ?? "";
  const view = mode === "view" && expense;

  return (
    <div className="modal-backdrop" onMouseDown={(event) => {
      if (!busy && event.target === event.currentTarget) onClose();
    }}>
      <section className="modal-card invoice-workflow-card" role="dialog" aria-modal="true" aria-labelledby="fixed-expense-title">
        <header className="modal-header">
          <span className="invoice-modal-icon" aria-hidden="true"><CalendarClock size={22} /></span>
          <div><h2 id="fixed-expense-title">{view ? "Detalle del gasto fijo" : expense ? "Editar gasto fijo" : "Nuevo gasto fijo"}</h2>
            <p>{view ? view.codigo_gasto || view.gasto_fijo_id : "Define el importe, el día de pago mensual y la vigencia."}</p></div>
          <button type="button" className="icon-button modal-close" aria-label="Cerrar" disabled={busy} onClick={onClose}><X size={19} /></button>
        </header>
        {view ? (
          <div className="modal-body">
            <dl className="form-grid fixed-details">
              <div><dt>N.º de referencia</dt><dd>{view.numero_referencia || "—"}</dd></div>
              <div><dt>Categoría</dt><dd>{view.categoria || "—"}</dd></div>
              <div><dt>Proveedor</dt><dd>{providers.find((provider) => provider.proveedor_id === view.proveedor_id)?.nombre_legal || view.proveedor_id || "Sin proveedor"}</dd></div>
              <div><dt>Restaurante</dt><dd>{restaurants.find(({ id }) => id === view.restaurante_id)?.name || view.restaurante_id || "General"}</dd></div>
              <div><dt>Importe mensual</dt><dd>{formatFixedExpenseAmount(view)} {view.moneda}</dd></div>
              <div><dt>Vigencia del gasto</dt><dd><StatusBadge status={view.activo ? "Activo" : "Inactivo"} /></dd></div>
              <div><dt>Día de vencimiento</dt><dd>{view.dia_vencimiento || "—"}</dd></div>
              <div><dt>Próximo vencimiento</dt><dd>{nextFixedExpenseDue(view, managuaDate()) || "—"}</dd></div>
              <div><dt>Fecha de inicio</dt><dd>{isoDate(view.fecha_inicio) || "—"}</dd></div>
              <div><dt>Fecha de fin</dt><dd>{isoDate(view.fecha_fin) || "—"}</dd></div>
              <div className="form-full fixed-description"><dt>Descripción</dt><dd>{view.descripcion || "—"}</dd></div>
            </dl>
            {onPaymentChange && <FixedExpensePaymentPanel expense={view} payments={payments} today={managuaDate()} onChange={onPaymentChange} />}
            <footer className="modal-footer"><button type="button" className="button-secondary" onClick={onClose}>Cerrar</button></footer>
          </div>
        ) : <form className="modal-body" onSubmit={async (event) => {
          event.preventDefault();
          if (busy) return;
          const data = new FormData(event.currentTarget);
          const value = (name: string) => String(data.get(name) ?? "");
          setBusy(true);
          setError("");
          try {
            await onSave({ descripcion: value("descripcion"), categoria: value("categoria"), proveedor_id: value("proveedor_id"),
              numero_referencia: value("numero_referencia"),
              restaurante_id: value("restaurante_id"), monto_estimado: Number(value("monto_estimado")), dia_vencimiento: Number(value("dia_vencimiento")),
              moneda: value("moneda") === "USD" ? "USD" : "NIO", fecha_inicio: value("fecha_inicio"), fecha_fin: value("fecha_fin"), activo: value("activo") === "true",
            }, expense);
            onClose();
          } catch (error) {
            setError(error instanceof Error ? error.message : "No se pudo guardar el gasto fijo.");
          } finally {
            setBusy(false);
          }
        }}>
          <fieldset className="invoice-form-group" disabled={busy}>
            <legend>Datos del gasto</legend>
            <div className="form-grid">
              <div className="form-field"><label htmlFor="fixed-reference">N.º de referencia</label>
                <input id="fixed-reference" name="numero_referencia" defaultValue={expense?.numero_referencia}
                  maxLength={FIXED_EXPENSE_REFERENCE_LIMIT} placeholder="Ej. 000127 o REC-015" /></div>
              <div className="form-field"><label htmlFor="fixed-category">Categoría</label>
                <select id="fixed-category" name="categoria" defaultValue={category} required>
                  <option value="" disabled>Selecciona una categoría</option>
                  {category && !FIXED_EXPENSE_CATEGORIES.includes(category) && <option value={category}>{category}</option>}
                  {FIXED_EXPENSE_CATEGORIES.map((option) => <option key={option}>{option}</option>)}
                </select></div>
              <div className="form-field"><label htmlFor="fixed-provider">Proveedor</label>
                <select id="fixed-provider" name="proveedor_id" defaultValue={expense?.proveedor_id ?? ""}>
                  <option value="">Sin proveedor</option><SupplierOptions providers={providers} />
                </select></div>
              <div className="form-field"><label htmlFor="fixed-restaurant">Restaurante</label>
                <select id="fixed-restaurant" name="restaurante_id" defaultValue={expense?.restaurante_id ?? ""}>
                  <option value="">General</option>{restaurants.map(({ id, name }) => <option value={id} key={id}>{name}</option>)}
                </select></div>
              <div className="form-field"><label htmlFor="fixed-amount">Importe mensual</label>
                <input id="fixed-amount" type="number" name="monto_estimado" min="0.01" step="0.01"
                  defaultValue={expense?.monto_estimado} required /></div>
              <div className="form-field"><label htmlFor="fixed-currency">Moneda</label>
                <select id="fixed-currency" name="moneda" defaultValue={expense?.moneda === "USD" ? "USD" : "NIO"}>
                  <option value="NIO">Córdobas (NIO)</option><option value="USD">Dólares (USD)</option>
                </select></div>
              <div className="form-field form-full"><label htmlFor="fixed-description">Descripción</label>
                <textarea id="fixed-description" name="descripcion" defaultValue={expense?.descripcion}
                  rows={4} maxLength={FIXED_EXPENSE_DESCRIPTION_LIMIT} required /></div>
            </div>
          </fieldset>
          <fieldset className="invoice-form-group fixed-recurrence" disabled={busy}>
            <legend>Recurrencia mensual</legend>
            <div className="form-grid">
              <div className="form-field"><label htmlFor="fixed-due-day">Día de vencimiento</label>
                <input id="fixed-due-day" type="number" name="dia_vencimiento" min="1" max="31" step="1"
                  defaultValue={expense?.dia_vencimiento} aria-describedby="fixed-due-day-help" required />
                <small id="fixed-due-day-help">Si el mes es más corto, vence el último día.</small></div>
              <div className="form-field"><label htmlFor="fixed-status">Vigencia del gasto</label>
                <select id="fixed-status" name="activo" defaultValue={expense && !expense.activo ? "false" : "true"}>
                  <option value="true">Activo</option><option value="false">Inactivo</option>
                </select></div>
              <div className="form-field"><label htmlFor="fixed-start">Fecha de inicio</label>
                <input id="fixed-start" type="date" name="fecha_inicio" value={start} onChange={(event) => setStart(event.target.value)} required /></div>
              <div className="form-field"><label htmlFor="fixed-end">Fecha de fin (opcional)</label>
                <input id="fixed-end" type="date" name="fecha_fin" defaultValue={isoDate(expense?.fecha_fin)} min={start || undefined} /></div>
            </div>
          </fieldset>
          {error && <p role="alert" className="invoice-form-error">{error}</p>}
          <footer className="modal-footer">
            <button type="button" className="button-secondary" disabled={busy} onClick={onClose}>Cancelar</button>
            <button type="submit" className="button-primary" disabled={busy}><Check size={16} /> Guardar gasto fijo</button>
          </footer>
        </form>}
      </section>
    </div>
  );
}
