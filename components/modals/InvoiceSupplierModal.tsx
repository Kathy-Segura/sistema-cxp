"use client";
import { useState } from "react";
import { Link2, X } from "lucide-react";
import type { Invoice, ProveedorRecord } from "../../types";
import { normalizeExcelHeader } from "../../utils/formatters";

export function InvoiceSupplierModal({ provider, invoices, onAssign, onClose }: {
  provider: ProveedorRecord;
  invoices: Invoice[];
  onAssign: (invoice: Invoice, confirmedReassignment: boolean) => Promise<void>;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const [invoiceId, setInvoiceId] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const candidates = invoices.filter((invoice) => invoice.supplierId !== provider.proveedor_id);
  const query = normalizeExcelHeader(search);
  const visible = candidates.filter((invoice) => normalizeExcelHeader(
    [invoice.id, invoice.code, invoice.supplier, invoice.restaurant].join(" "),
  ).includes(query));
  const selected = visible.find((invoice) => invoice.id === invoiceId);

  return (
    <div className="modal-backdrop" onMouseDown={(event) => {
      if (!busy && event.target === event.currentTarget) onClose();
    }}>
      <section className="modal-card invoice-workflow-card" role="dialog" aria-modal="true" aria-labelledby="invoice-supplier-title">
        <header className="modal-header">
          <span className="invoice-modal-icon" aria-hidden="true"><Link2 size={22} /></span>
          <div>
            <h2 id="invoice-supplier-title">Asociar factura existente</h2>
            <p>Proveedor de destino: {provider.nombre_legal || provider.proveedor_id}</p>
          </div>
          <button type="button" className="icon-button modal-close" aria-label="Cerrar" disabled={busy} onClick={onClose}><X size={19} /></button>
        </header>
        <form className="modal-body" onSubmit={async (event) => {
          event.preventDefault();
          if (busy || !selected || (selected.supplierId && !confirmed)) return;
          setBusy(true);
          setError("");
          try {
            await onAssign(selected, confirmed);
          } catch (error) {
            setError(error instanceof Error ? error.message : "No se pudo asociar la factura.");
          } finally {
            setBusy(false);
          }
        }}>
          <fieldset className="invoice-form-group" disabled={busy}>
            <legend>Selecciona la factura</legend>
            <div className="form-grid">
              <div className="form-field form-full">
                <label htmlFor="invoice-link-search">Buscar por número, ID, proveedor o restaurante</label>
                <input type="search" id="invoice-link-search" value={search} onChange={(event) => {
                  setSearch(event.target.value); setInvoiceId(""); setConfirmed(false); setError("");
                }} />
              </div>
              <div className="form-field form-full">
                <label htmlFor="invoice-link-id">Factura existente</label>
                <select id="invoice-link-id" required value={invoiceId} onChange={(event) => {
                  setInvoiceId(event.target.value); setConfirmed(false); setError("");
                }}>
                  <option value="" disabled>{visible.length ? "Selecciona una factura" : "No hay facturas disponibles"}</option>
                  {visible.map((invoice) => <option key={invoice.id} value={invoice.id}>
                    {invoice.id} · N.º {invoice.code} · {invoice.supplier || "Sin proveedor"} · {invoice.restaurant}
                  </option>)}
                </select>
                {!visible.length && <small>{candidates.length ? "No hay coincidencias para la búsqueda." : "No hay otras facturas para asociar."}</small>}
              </div>
              {selected?.supplierId && (
                <div className="supplier-invoice-options form-full">
                  <label>
                    <input type="checkbox" required checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
                    <span>Confirmo el cambio desde {selected.supplier || selected.supplierId}. Los pagos vinculados también quedarán asociados al proveedor de destino.</span>
                  </label>
                </div>
              )}
            </div>
          </fieldset>
          {error && <p className="invoice-form-error" role="alert">{error}</p>}
          <footer className="modal-footer">
            <button type="button" className="button-secondary" disabled={busy} onClick={onClose}>Cancelar</button>
            <button type="submit" className="button-primary" disabled={busy || !selected || (!!selected.supplierId && !confirmed)}>
              <Link2 size={16} /> Asociar factura
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
