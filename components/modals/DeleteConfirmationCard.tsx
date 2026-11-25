"use client";
import { useState } from "react";
import { AlertTriangle, Trash2, X } from "lucide-react";

export function DeleteConfirmationCard({
  id,
  label,
  onClose,
  onConfirm,
  recordName = "factura",
}: {
  id: string;
  label: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  recordName?: string;
}) {
  const [step, setStep] = useState(1);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const proceed = async () => {
    if (saving) return;
    if (step === 1 || (step === 2 && value.trim() === id)) {
      setValue("");
      return setStep(step + 1);
    }
    if (step !== 3 || value.trim() !== "ELIMINAR") return;
    setSaving(true);
    setError("");
    try { await onConfirm(); }
    catch (error) { setError(error instanceof Error ? error.message : "No se pudo eliminar el registro."); }
    finally { setSaving(false); }
  };
  const prompt =
    step === 1
      ? "Esta acción elimina el registro de forma permanente."
      : step === 2
        ? `Escribe ${id} para confirmar el registro correcto.`
        : "Escribe ELIMINAR para ejecutar la acción.";
  return (
    <div className="modal-backdrop">
      <section
        className="modal-card delete-confirmation"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-title"
      >
        <header className="modal-header">
          <div>
            <span className="modal-kicker">CONFIRMACIÓN DE ELIMINACIÓN</span>
            <h2 id="delete-title">Eliminar {recordName}</h2>
            <p>{label}</p>
          </div>
          <button
            className="icon-button modal-close"
            onClick={onClose}
            aria-label="Cerrar"
            disabled={saving}
          >
            <X size={19} />
          </button>
        </header>
        <div className="modal-body">
          <div className="delete-card-icon">
            <AlertTriangle size={22} />
          </div>
          <strong>Paso {step} de 3</strong>
          <p>{prompt}</p>
          {step > 1 && (
            <input
              className="delete-confirmation-input"
              key={step}
              aria-label={step === 2 ? "ID interno del registro" : "Escribe ELIMINAR"}
              autoFocus
              disabled={saving}
              value={value}
              onChange={(event) => setValue(event.target.value)}
            />
          )}
          {error && <p role="alert" className="invoice-form-error">{error}</p>}
          <div className="modal-footer">
            <button className="button-secondary" onClick={onClose} disabled={saving}>
              Cancelar
            </button>
            <button
              className="button-primary delete-confirm-button"
              disabled={
                saving ||
                (step === 2 && value.trim() !== id) ||
                (step === 3 && value.trim() !== "ELIMINAR")
              }
              onClick={proceed}
            >
              <Trash2 size={16} /> {saving ? "Eliminando…" : step === 3 ? "Eliminar" : "Continuar"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
