"use client";
import { useState } from "react";
import { AlertTriangle, Trash2, X } from "lucide-react";

export function DeleteConfirmationCard({
  id,
  label,
  onClose,
  onConfirm,
}: {
  id: string;
  label: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [step, setStep] = useState(1);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const proceed = async () => {
    if (step === 1) return setStep(2);
    if (step === 2 && value === id) return setStep(3);
    if (step === 3 && value === "ELIMINAR") {
      setSaving(true);
      await onConfirm();
    }
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
      >
        <header className="modal-header">
          <div>
            <span className="modal-kicker">CONFIRMACIÓN DE ELIMINACIÓN</span>
            <h2>Eliminar registro</h2>
            <p>{label}</p>
          </div>
          <button
            className="icon-button modal-close"
            onClick={onClose}
            aria-label="Cerrar"
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
              autoFocus
              value={value}
              onChange={(event) => setValue(event.target.value)}
            />
          )}
          <div className="modal-footer">
            <button className="button-secondary" onClick={onClose}>
              Cancelar
            </button>
            <button
              className="button-primary delete-confirm-button"
              disabled={
                saving ||
                (step === 2 && value !== id) ||
                (step === 3 && value !== "ELIMINAR")
              }
              onClick={proceed}
            >
              <Trash2 size={16} /> {step === 3 ? "Eliminar" : "Continuar"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
