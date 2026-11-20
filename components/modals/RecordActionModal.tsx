"use client";
import { useState } from "react";
import { Check, X } from "lucide-react";
import type { Row } from "../../types";
import { invoiceCategory } from "../../lib/invoice-balances";
export function RecordActionModal({
  row,
  mode,
  onClose,
  onSave,
  invoice,
}: {
  row: Row;
  mode: "view" | "edit";
  onClose: () => void;
  onSave: (row: Row) => void;
  invoice?: boolean;
}) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      Object.entries(row).map(([key, value]) => [key, String(value ?? "")]),
    ),
  );
  const title = invoice
    ? mode === "view" ? "Detalle de la factura" : "Editar factura"
    : mode === "view" ? "Detalle del registro" : "Editar registro";
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
    { title: "Importes", fields: ["amount", "paidAmount", "pendingBalance"] },
  ];
  const renderField = (key: string) => {
    const label = labels[key] || key.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase());
    const category = key === "category" && invoice ? invoiceCategory(values.issue, values.due) : undefined;
    const readOnly = mode === "view" || ["paidAmount", "pendingBalance", "paidDate", "status"].includes(key) ||
      (invoice && ["id", "dateCreated", "category"].includes(key));
    return (
      <div className="form-field" key={key}>
        <label htmlFor={`record-${key}`}>{label}</label>
        {key === "category" && invoice ? (
          <output id={`record-${key}`} className="invoice-field-output">
            {category === 1 ? "1 · Hasta 30 días" : category === 2 ? "2 · Desde 31 días" : "Sin plazo válido"}
          </output>
        ) : (
          <input id={`record-${key}`} value={values[key] ?? ""} readOnly={readOnly}
            onChange={(event) => setValues((current) => ({ ...current, [key]: event.target.value }))} />
        )}
      </div>
    );
  };
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className={`modal-card ${invoice ? "invoice-workflow-card" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="record-modal-title"
      >
        <header className="modal-header">
          <div>
            <span className="modal-kicker">CONTROL DE PAGOS</span>
            <h2 id="record-modal-title">{title}</h2>
            <p>
              {mode === "view"
                ? "Información completa del registro seleccionado."
                : "Actualiza los campos y guarda los cambios."}
            </p>
          </div>
          <button
            className="icon-button modal-close"
            aria-label="Cerrar"
            onClick={onClose}
          >
            <X size={19} />
          </button>
        </header>
        <form
          className="modal-body"
          onSubmit={(event) => {
            event.preventDefault();
            onSave(
              Object.fromEntries(
                Object.entries(values).map(([key, value]) => [
                  key,
                  typeof row[key] === "number" && /^-?\d+(\.\d+)?$/.test(value)
                    ? Number(value)
                    : String(value),
                ]),
              ) as Row,
            );
          }}
        >
          {invoice ? (
            <div className="invoice-form-grid form-grid">
              {groups.map(({ title, fields }) => (
                <fieldset className="invoice-form-group form-full" key={title}>
                  <legend>{title}</legend>
                  <div className="form-grid">{fields.map(renderField)}</div>
                </fieldset>
              ))}
            </div>
          ) : <div className="form-grid">{Object.keys(values).map(renderField)}</div>}
          <footer className="modal-footer">
            <button
              type="button"
              className="button-secondary"
              onClick={onClose}
            >
              Cerrar
            </button>
            {mode === "edit" && (
              <button type="submit" className="button-primary">
                <Check size={16} /> Guardar cambios
              </button>
            )}
          </footer>
        </form>
      </section>
    </div>
  );
}
