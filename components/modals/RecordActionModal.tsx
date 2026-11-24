"use client";
import { useState } from "react";
import { Check, Pencil, ReceiptText, X } from "lucide-react";
import type { ProveedorRecord, Row } from "../../types";
import { SupplierOptions } from "../forms/SupplierOptions";
import { invoiceCategory } from "../../lib/invoice-balances";
import { isoDate } from "../../utils/formatters";
import { StatusBadge } from "../tables/StatusBadge";

const isInvoiceDateField = (key: string) => key === "issue" || key === "due";

export function RecordActionModal({
  row,
  mode,
  onClose,
  onSave,
  invoice,
  providers = [],
}: {
  row: Row;
  mode: "view" | "edit";
  onClose: () => void;
  onSave: (row: Row, confirmedReassignment: boolean) => void | Promise<void>;
  invoice?: boolean;
  providers?: ProveedorRecord[];
}) {
  const isInvoiceEdit = invoice && mode === "edit";
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      Object.entries(row).map(([key, value]) => [
        key,
        isInvoiceEdit && isInvoiceDateField(key) ? isoDate(value) : String(value ?? ""),
      ]),
    ),
  );
  const originalSupplierId = String(row.supplierId ?? "");
  const supplierId = values.supplierId ?? "";
  const needsConfirmation = isInvoiceEdit && !!originalSupplierId && supplierId !== originalSupplierId;
  const title = invoice
    ? mode === "view" ? "Detalle de la factura" : "Editar factura"
    : mode === "view" ? "Detalle del registro" : "Editar registro";
  const HeaderIcon = mode === "edit" ? Pencil : ReceiptText;
  const labels: Record<string, string> = {
    id: "ID de factura",
    code: "Número de factura",
    supplier: "Proveedor",
    restaurant: "Restaurante",
    issue: "Fecha de emisión",
    due: "Fecha de vencimiento",
    amount: "Monto",
    paidAmount: "Monto pagado",
    pendingBalance: "Saldo pendiente",
    status: "Estado",
    category: "Categoría",
    dateCreated: "Fecha de ingreso",
    paidDate: "Fecha de pago",
    name: "Nombre",
    email: "Correo electrónico",
    bank: "Banco",
    number: "Número",
    holder: "Titular",
    opened: "Fecha de apertura",
    rate: "Tasa anual",
    installment: "Cuota programada",
    balance: "Saldo",
  };
  const groups = [
    { title: "Datos de la factura", fields: ["id", "supplier", "code", "restaurant", "status"] },
    { title: "Fechas y plazo", fields: ["issue", "due", "dateCreated", "paidDate", "category"] },
    { title: "Importes", className: "invoice-amount-grid", fields: ["amount", "paidAmount", "pendingBalance"] },
  ];
  const renderField = (key: string) => {
    const label = labels[key] || key.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase());
    const editDate = isInvoiceEdit && isInvoiceDateField(key);
    const category = key === "category" && invoice ? invoiceCategory(values.issue, values.due) : undefined;
    const readOnly = mode === "view" || ["paidAmount", "pendingBalance", "paidDate", "status"].includes(key) ||
      (invoice && ["id", "dateCreated", "category"].includes(key));
    return (
      <div className="form-field" key={key}>
        <label htmlFor={`record-${key}`}>{label}{editDate && <span className="required-star"> *</span>}</label>
        {key === "supplier" && isInvoiceEdit ? (
          <>
            <select id="record-supplier" value={supplierId} disabled={saving} onChange={(event) => {
              setValues((current) => ({ ...current, supplierId: event.target.value }));
              setConfirmed(false);
              setSaveError("");
            }}>
              <option value="" disabled={!!originalSupplierId}>Sin proveedor</option>
              {!!originalSupplierId && !providers.some((provider) => provider.proveedor_id === originalSupplierId) && (
                <option value={originalSupplierId}>{String(row.supplier || originalSupplierId)}</option>
              )}
              <SupplierOptions providers={providers} />
            </select>
            {needsConfirmation && <div className="supplier-invoice-options">
              <label>
                <input type="checkbox" required checked={confirmed} disabled={saving} onChange={(event) => setConfirmed(event.target.checked)} />
                <span>Confirmo el cambio de proveedor de la factura y de sus pagos vinculados.</span>
              </label>
            </div>}
          </>
        ) : key === "category" && invoice ? (
          <output id={`record-${key}`} className="invoice-field-output">
            {category === 1 ? "1 · Hasta 30 días" : category === 2 ? "2 · Desde 31 días" : "Sin plazo válido"}
          </output>
        ) : key === "status" && invoice ? (
          <output id="record-status" className="invoice-field-output">
            {values.status ? <StatusBadge status={values.status} /> : "—"}
          </output>
        ) : (
          <input
            id={`record-${key}`}
            type={editDate ? "date" : "text"}
            value={values[key] ?? ""}
            readOnly={readOnly}
            disabled={saving}
            required={editDate}
            min={editDate && key === "due" ? values.issue || undefined : undefined}
            onChange={(event) => setValues((current) => ({ ...current, [key]: event.target.value }))}
          />
        )}
      </div>
    );
  };
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (!saving && event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className={`modal-card ${invoice ? "invoice-workflow-card invoice-wide-card" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="record-modal-title"
        aria-describedby="record-modal-description"
      >
        <header className="modal-header">
          {invoice && <span className="invoice-modal-icon" aria-hidden="true"><HeaderIcon size={22} /></span>}
          <div>
            {!invoice && <span className="modal-kicker">CONTROL DE PAGOS</span>}
            <h2 id="record-modal-title">{title}</h2>
            <p id="record-modal-description">
              {mode === "view"
                ? "Información completa del registro seleccionado."
                : "Actualiza los campos y guarda los cambios."}
            </p>
          </div>
          <button
            className="icon-button modal-close"
            aria-label="Cerrar"
            disabled={saving}
            onClick={onClose}
          >
            <X size={19} />
          </button>
        </header>
        <form
          className="modal-body"
          onSubmit={async (event) => {
            event.preventDefault();
            if (mode !== "edit" || saving || (needsConfirmation && !confirmed)) return;
            setSaving(true);
            setSaveError("");
            try {
              await onSave(Object.fromEntries(
                Object.entries(values).map(([key, value]) => [
                  key,
                  typeof row[key] === "number" && /^-?\d+(\.\d+)?$/.test(value)
                    ? Number(value)
                    : String(value),
                ]),
              ) as Row, confirmed);
            } catch (error) {
              setSaveError(error instanceof Error ? error.message : "No se pudieron guardar los cambios.");
            } finally {
              setSaving(false);
            }
          }}
        >
          {invoice ? (
            <div className="invoice-form-grid form-grid">
              {groups.map(({ title, className, fields }) => (
                <fieldset className="invoice-form-group form-full" key={title}>
                  <legend>{title}</legend>
                  <div className={`form-grid ${className ?? ""}`}>{fields.map(renderField)}</div>
                </fieldset>
              ))}
            </div>
          ) : <div className="form-grid">{Object.keys(values).map(renderField)}</div>}
          {saveError && <p className="invoice-form-error" role="alert">{saveError}</p>}
          <footer className="modal-footer">
            <button
              type="button"
              className="button-secondary"
              disabled={saving}
              onClick={onClose}
            >
              Cerrar
            </button>
            {mode === "edit" && (
              <button type="submit" className="button-primary" disabled={saving || (needsConfirmation && !confirmed)}>
                <Check size={16} /> Guardar cambios
              </button>
            )}
          </footer>
        </form>
      </section>
    </div>
  );
}
