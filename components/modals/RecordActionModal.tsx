"use client";
import { useState } from "react";
import { Check, X } from "lucide-react";
import type { Row } from "../../types";
export function RecordActionModal({
  row,
  mode,
  onClose,
  onSave,
}: {
  row: Row;
  mode: "view" | "edit";
  onClose: () => void;
  onSave: (row: Row) => void;
}) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      Object.entries(row).map(([key, value]) => [key, String(value)]),
    ),
  );
  const title = mode === "view" ? "Detalle del registro" : "Editar registro";
  const labels: Record<string, string> = {
    id: "ID de factura",
    code: "Número de factura",
    supplier: "Proveedor",
    restaurant: "Restaurante",
    issue: "Fecha de emisión",
    due: "Fecha de vencimiento",
    amount: "Monto",
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
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="modal-card"
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
                  /^-?\d+(\.\d+)?$/.test(String(value)) && String(value).trim()
                    ? Number(value)
                    : String(value),
                ]),
              ) as Row,
            );
          }}
        >
          <div className="form-grid">
            {Object.entries(values).map(([key, value]) => (
              <div className="form-field" key={key}>
                <label htmlFor={`record-${key}`}>
                  {labels[key] ||
                    key
                      .replace(/([A-Z])/g, " $1")
                      .replace(/^./, (letter) => letter.toUpperCase())}
                </label>
                <input
                  id={`record-${key}`}
                  value={value}
                  readOnly={mode === "view"}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      [key]: event.target.value,
                    }))
                  }
                />
              </div>
            ))}
          </div>
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
