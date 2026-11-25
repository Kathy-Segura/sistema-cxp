"use client";
import { useState } from "react";
import { Check, RotateCcw } from "lucide-react";
import type { FixedExpensePayment, FixedExpensePaymentChange, GastoFijoRecord } from "../../types";
import { fixedExpenseDueInPeriod, fixedExpensePaymentStatus } from "../../lib/fixed-expenses";
import { isoDate } from "../../utils/formatters";
import { StatusBadge } from "../tables/StatusBadge";

export function FixedExpensePaymentPanel({ expense, payments, today, onChange }: {
  expense: GastoFijoRecord;
  payments: FixedExpensePayment[];
  today: string;
  onChange: (change: FixedExpensePaymentChange) => Promise<void>;
}) {
  const [period, setPeriod] = useState(today.slice(0, 7));
  const [paidDate, setPaidDate] = useState(today);
  const [undo, setUndo] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const recorded = payments.find((payment) => payment.periodo === period)?.fecha_pago || "";
  const due = fixedExpenseDueInPeriod(expense, period);
  const status = fixedExpensePaymentStatus(due, recorded, today);

  const save = async (date: string) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await onChange({ expenseId: expense.gasto_fijo_id, period, paidDate: date, expectedPaidDate: recorded });
      setUndo(false);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "No se pudo actualizar el pago.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <fieldset className="invoice-form-group fixed-recurrence" disabled={busy}>
      <legend>Pago mensual</legend>
      <div className="form-grid">
        <div className="form-field">
          <label htmlFor="fixed-payment-period">Mes de la cuota</label>
          <input id="fixed-payment-period" type="month" value={period} onChange={(event) => {
            setPeriod(event.target.value); setUndo(false); setError("");
          }} />
        </div>
        <div className="form-field">
          <label htmlFor="fixed-payment-status">Estado de pago</label>
          <output className="invoice-field-output" id="fixed-payment-status"><StatusBadge status={status} /></output>
        </div>
        <div className="form-field">
          <label htmlFor="fixed-payment-due">Vencimiento de la cuota</label>
          <output className="invoice-field-output" id="fixed-payment-due">{due || "—"}</output>
        </div>
        <div className="form-field">
          <label htmlFor="fixed-payment-date">Fecha de pago</label>
          {recorded || !due ? (
            <output className="invoice-field-output" id="fixed-payment-date">{isoDate(recorded) || "—"}</output>
          ) : (
            <input id="fixed-payment-date" type="date" max={today} value={paidDate} onChange={(event) => setPaidDate(event.target.value)} />
          )}
        </div>
      </div>
      {error && <p className="invoice-form-error" role="alert">{error}</p>}
      {(recorded || due) && (
        <div className="fixed-payment-actions">
          {recorded ? undo ? (
            <>
              <button type="button" className="button-secondary" onClick={() => setUndo(false)}>Cancelar</button>
              <button type="button" className="button-primary" onClick={() => void save("")}>Confirmar reversión</button>
            </>
          ) : (
            <button type="button" className="button-secondary" onClick={() => setUndo(true)}><RotateCcw size={15} /> Revertir pago</button>
          ) : (
            <button type="button" className="button-primary" disabled={!isoDate(paidDate) || paidDate > today} onClick={() => void save(paidDate)}>
              <Check size={16} /> Registrar pago
            </button>
          )}
        </div>
      )}
    </fieldset>
  );
}
