"use client";
import type React from "react";
import { useMemo, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import {
  ArrowDownToLine,
  Check,
  CloudUpload,
  FileSpreadsheet,
  FileUp,
  ReceiptText,
  UploadCloud,
  Wallet,
  X,
} from "lucide-react";
import { FormField } from "../forms/FormField";
import type { Invoice } from "../../types";
import { PAYMENT_METHODS } from "../../types";
import { money } from "../../utils/formatters";
import { invoiceCategory, invoiceCreditDays, managuaDate, moneyCents } from "../../lib/invoice-balances";
import {
  discardInvoiceDuplicates, dueDate, findInvoiceDuplicates,
  INVOICE_IMPORT_HEADERS, parseInvoiceWorkbook, type InvoiceFileRow, type InvoiceImportPreview,
} from "../../lib/invoice-file-format";
import { SERVICE_TYPES } from "../../lib/invoice-identity";

const PREVIEW_PAGE_SIZE = 8;
export function Modal({
  kind,
  onClose,
  onInvoice,
  onSupplier,
  onPayment,
  onLoan,
  onImport,
  registeredInvoices,
  paymentInvoices,
  paymentInvoiceId,
  restaurants,
}: {
  kind: "invoice" | "supplier" | "payment" | "loan" | "import";
  onClose: () => void;
  onInvoice: (data: FormData) => Promise<void>;
  onSupplier: (data: FormData) => void;
  onPayment: (data: FormData) => Promise<void>;
  onLoan: (data: FormData) => void;
  onImport: (rows: InvoiceFileRow[]) => Promise<void>;
  registeredInvoices: Invoice[];
  paymentInvoices: Invoice[];
  paymentInvoiceId: string;
  restaurants: string[];
}) {
  const [file, setFile] = useState<File | undefined>();
  const [preview, setPreview] = useState<InvoiceImportPreview>();
  const [discardedCount, setDiscardedCount] = useState(0);
  const [previewPage, setPreviewPage] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [operationError, setOperationError] = useState("");
  const [issue, setIssue] = useState("");
  const [documentKind, setDocumentKind] = useState("Factura");
  const [creditDays, setCreditDays] = useState("");
  const [due, setDue] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [selectedInvoiceId, setSelectedInvoiceId] = useState(paymentInvoiceId);
  const duplicates = useMemo(() => preview ? findInvoiceDuplicates(preview.rows, preview.rowNumbers, registeredInvoices) : [],
    [preview, registeredInvoices]);
  const previewErrors = [...duplicates.map(({ sourceRow, reason }) => `Fila ${sourceRow}: ${reason}`), ...(preview?.errors ?? [])];
  const selectedInvoice = paymentInvoices.find((invoice) => invoice.id === selectedInvoiceId);
  const pendingBalance = selectedInvoice?.pendingBalance ?? selectedInvoice?.amount;
  const effectiveDue = due || dueDate(issue, Number(creditDays));
  const category = invoiceCategory(issue, effectiveDue);
  const amountCents = moneyCents(Number(paymentAmount));
  const balanceCents = moneyCents(pendingBalance ?? 0);
  const remainingAfterPayment = amountCents > 0 && amountCents <= balanceCents
    ? (balanceCents - amountCents) / 100 : undefined;
  const inputRef = useRef<HTMLInputElement>(null);
  const headerIcon = { invoice: ReceiptText, payment: Wallet, import: FileUp };
  const HeaderIcon = kind === "supplier" || kind === "loan" ? undefined : headerIcon[kind];
  const meta = {
    invoice: ["Nueva factura", "Registra una cuenta por pagar de proveedor."],
    supplier: [
      "Nuevo proveedor",
      "Agrega un proveedor al directorio del grupo.",
    ],
    payment: [
      "Registrar pago",
      "Abona una parte de la factura o liquida el saldo.",
    ],
    loan: [
      "Nuevo préstamo",
      "Agrega una obligación y configura su seguimiento.",
    ],
    import: [
      "Carga masiva de facturas",
      "Importa varias cuentas por pagar desde una plantilla Excel.",
    ],
  }[kind];
  const run = async (operation: () => Promise<void>) => {
    if (busy) return;
    setOperationError("");
    setBusy(true);
    try { await operation(); }
    catch (error) { setOperationError(error instanceof Error ? error.message : "No se pudo completar la operación."); }
    finally { setBusy(false); }
  };
  const downloadTemplate = async () => {
    const response = await fetch("/api/accounts-payable/template", { cache: "no-store" });
    if (!response.ok) throw new Error((await response.json()).error || "No se pudo descargar la plantilla.");
    const url = URL.createObjectURL(await response.blob());
    const link = document.createElement("a");
    link.href = url;
    link.download = "plantilla-cuentas-por-pagar.xlsx";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const previewFile = async (selected: File) => {
    if (busy) return;
    setFile(selected);
    setPreview(undefined);
    setDiscardedCount(0);
    setPreviewPage(0);
    await run(async () => {
      if (selected.size > 10 * 1024 * 1024) throw new Error("El archivo supera el límite de 10 MB.");
      const parsed = parseInvoiceWorkbook(await selected.arrayBuffer(), restaurants);
      if (!parsed.rows.length && !parsed.errors.length) {
        throw new Error("Agrega al menos una factura debajo de los encabezados.");
      }
      setPreview(parsed);
    });
  };
  const discardDuplicates = () => {
    if (!preview || !duplicates.length || busy) return;
    setDiscardedCount((count) => count + duplicates.length);
    setPreview(discardInvoiceDuplicates(preview, duplicates));
    setPreviewPage(0);
    setOperationError("");
  };
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    if (kind === "invoice") void run(() => onInvoice(data));
    if (kind === "supplier") onSupplier(data);
    if (kind === "payment" && !busy) void run(() => onPayment(data));
    if (kind === "loan") onLoan(data);
  };
  const onDrop = (event: React.DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setDragging(false);
    const selected = event.dataTransfer.files[0];
    if (selected) void previewFile(selected);
  };
  const previewOffset = previewPage * PREVIEW_PAGE_SIZE;
  const previewRows = preview?.rows.slice(previewOffset, previewOffset + PREVIEW_PAGE_SIZE) ?? [];
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <section
        className={`modal-card ${HeaderIcon ? "invoice-workflow-card" : ""} ${kind === "payment" ? "invoice-wide-card" : ""} ${kind === "import" && preview ? "import-preview-card" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-heading"
        aria-describedby="modal-description"
      >
        <header className="modal-header">
          {HeaderIcon && <span className="invoice-modal-icon" aria-hidden="true"><HeaderIcon size={22} /></span>}
          <div>
            {!HeaderIcon && <span className="modal-kicker">GRUPO BUEN SABOR</span>}
            <h2 id="modal-heading">{meta[0]}</h2>
            <p id="modal-description">{meta[1]}</p>
          </div>
          <button
            className="icon-button modal-close"
            onClick={onClose}
            aria-label="Cerrar"
            disabled={busy}
          >
            <X size={19} />
          </button>
        </header>
        {kind === "import" ? (
          <div className="modal-body">
            <button type="button" className="template-download" disabled={busy}
              onClick={() => void run(downloadTemplate)}>
              <span className="template-icon"><FileSpreadsheet size={20} /></span>
              <span>
                <strong>Descargar plantilla Excel</strong>
                <small>Incluye la lista actual de restaurantes</small>
              </span>
              <ArrowDownToLine size={17} />
            </button>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              hidden
              disabled={busy}
              onChange={(e: ChangeEvent<HTMLInputElement>) => {
                const selected = e.target.files?.[0];
                e.currentTarget.value = "";
                if (selected) void previewFile(selected);
              }}
            />
            <button
              type="button"
              disabled={busy}
              className={`drop-zone invoice-drop-zone ${dragging ? "drop-active" : ""}`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => inputRef.current?.click()}
            >
              <span className="upload-icon"><UploadCloud size={18} aria-hidden="true" /></span>
              <span className="invoice-drop-copy">
                <strong>{file ? file.name : "Arrastra tu archivo aquí"}</strong>
                <span>{file ? "Haz clic para reemplazarlo" : "o busca en tu equipo"}</span>
              </span>
              <small>Excel .xlsx, .xls o .csv · máximo 10 MB</small>
            </button>
            <div className="import-notes">
              <Check size={15} />
              <span>
                Elige el restaurante de la lista, usa fechas AAAA-MM-DD o DD/MM/AAAA y escribe el monto como número. La categoría se calcula según el plazo.
                Para un servicio, escribe Renta, Préstamo u Otro en No. Factura. Puedes añadir una referencia, por ejemplo «Renta: contrato 14».
              </span>
            </div>
            {operationError && <p role="alert" className="invoice-form-error">{operationError}</p>}
            {preview && (
              <section className="invoice-import-preview" aria-labelledby="invoice-preview-heading">
                <div className="invoice-preview-heading">
                  <div>
                    <h3 id="invoice-preview-heading">Vista previa</h3>
                    <p>{preview.sheetName} · {preview.rows.length} filas legibles{previewErrors.length ? ` · ${previewErrors.length} incidencias` : ""}</p>
                  </div>
                  {duplicates.length > 0 && (
                    <button type="button" className="button-secondary" disabled={busy} onClick={discardDuplicates}>
                      Descartar duplicadas ({duplicates.length})
                    </button>
                  )}
                </div>
                {discardedCount > 0 && (
                  <p className="invoice-preview-feedback" role="status">
                    {discardedCount} filas duplicadas descartadas.{" "}
                    {preview.rows.length ? `Quedan ${preview.rows.length} filas en la vista previa.` : "No quedan filas nuevas."}
                  </p>
                )}
                {previewRows.length > 0 && <>
                  <div className="table-scroll">
                    <table className="data-table" aria-label="Facturas del archivo">
                      <thead><tr><th>Fila</th>{INVOICE_IMPORT_HEADERS.map((header) => <th key={header}>{header}</th>)}</tr></thead>
                      <tbody>{previewRows.map((row, index) => {
                        const rowNumber = preview.rowNumbers[previewOffset + index];
                        return <tr key={rowNumber}>
                          <td>{rowNumber}</td><td>{row.supplier}</td><td>{row.restaurant}</td><td>{row.number}</td>
                          <td>{row.issue}</td><td>{invoiceCreditDays(row.issue, row.due)}</td><td>{row.due}</td>
                          <td>{invoiceCategory(row.issue, row.due)}</td><td className="align-right">{money(row.amount)}</td>
                        </tr>;
                      })}</tbody>
                    </table>
                  </div>
                  {preview.rows.length > PREVIEW_PAGE_SIZE && <div className="import-preview-pagination">
                    <button type="button" className="button-secondary" disabled={busy || previewPage === 0} onClick={() => setPreviewPage(previewPage - 1)}>Anterior</button>
                    <span>{previewOffset + 1}–{previewOffset + previewRows.length} de {preview.rows.length}</span>
                    <button type="button" className="button-secondary" disabled={busy || previewOffset + previewRows.length >= preview.rows.length} onClick={() => setPreviewPage(previewPage + 1)}>Siguiente</button>
                  </div>}
                </>}
              </section>
            )}
            {!!previewErrors.length && (
              <div role="alert" className="import-notes danger-text">
                <ul>
                  {previewErrors.slice(0, 10).map((error) => <li key={error}>{error}</li>)}
                  {previewErrors.length > 10 && <li>{previewErrors.length - 10} incidencias adicionales.</li>}
                </ul>
              </div>
            )}
            <footer className="modal-footer import-actions">
              <button className="button-secondary" disabled={busy} onClick={onClose}>
                Cancelar
              </button>
              <button
                className="button-primary"
                disabled={busy || !preview?.rows.length || !!previewErrors.length}
                onClick={() => { if (preview?.rows.length && !previewErrors.length) void run(() => onImport(preview.rows)); }}
              >
                <CloudUpload size={16} /> Importar facturas
              </button>
            </footer>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="modal-body">
            <div className={`form-grid ${kind === "invoice" || kind === "payment" ? "invoice-form-grid" : ""}`}>
              {kind === "invoice" && (
                <>
                  <fieldset className="invoice-form-group form-full">
                    <legend>Datos de la factura</legend>
                    <div className="form-grid">
                      <FormField label="Proveedor" name="supplier" required placeholder="Nombre del proveedor" />
                      <FormField label="Restaurante" name="restaurant" required select options={restaurants} />
                      <div className="form-field">
                        <label htmlFor="invoice-document-kind">Tipo de documento</label>
                        <select id="invoice-document-kind" name="documentKind" value={documentKind}
                          onChange={(event) => setDocumentKind(event.target.value)}>
                          <option>Factura</option>
                          {SERVICE_TYPES.map((type) => <option key={type}>{type}</option>)}
                        </select>
                      </div>
                      {documentKind === "Factura" ? (
                        <FormField label="N.º de factura" name="number" required placeholder="Número emitido por el proveedor" />
                      ) : (
                        <div className="form-field">
                          <label htmlFor="invoice-service-reference">Referencia del servicio (opcional)</label>
                          <input id="invoice-service-reference" name="serviceReference" placeholder="Contrato o cuota" />
                          <small>El identificador incluye el tipo, la fecha de emisión y el restaurante.</small>
                        </div>
                      )}
                      <div className="form-field">
                        <label htmlFor="invoice-amount">Monto total (C$) <span className="required-star">*</span></label>
                        <input id="invoice-amount" name="amount" type="number" min="0.01" step="0.01" placeholder="0.00" required />
                      </div>
                    </div>
                  </fieldset>
                  <fieldset className="invoice-form-group form-full">
                    <legend>Fechas y plazo</legend>
                    <div className="form-grid">
                      <div className="form-field">
                        <label htmlFor="invoice-issue">Fecha de emisión <span className="required-star">*</span></label>
                        <input id="invoice-issue" name="issue" type="date" required value={issue}
                          onChange={(event) => setIssue(event.target.value)} />
                      </div>
                      <div className="form-field">
                        <label htmlFor="invoice-credit">Días de crédito</label>
                        <input id="invoice-credit" name="credit" type="number" min="0" step="1"
                          value={creditDays} onChange={(event) => setCreditDays(event.target.value)} />
                        <small>Se aplican si no indicas el vencimiento.</small>
                      </div>
                      <div className="form-field">
                        <label htmlFor="invoice-due">Fecha de vencimiento</label>
                        <input id="invoice-due" name="due" type="date" min={issue || undefined} value={due}
                          onChange={(event) => setDue(event.target.value)} />
                        {!due && effectiveDue && <small>Vencimiento calculado: {effectiveDue}</small>}
                      </div>
                      <div className="form-field">
                        <label htmlFor="invoice-category">Categoría</label>
                        <output id="invoice-category" className="invoice-field-output">
                          {category === 1 ? "1 · Hasta 30 días" : category === 2 ? "2 · Desde 31 días" : "Se calcula con el plazo"}
                        </output>
                      </div>
                    </div>
                  </fieldset>
                </>
              )}
              {kind === "supplier" && (
                <>
                  <FormField
                    label="Nombre o razón social"
                    name="name"
                    required
                    placeholder="Ej. Aexpress Nicaragua"
                  />
                  <FormField
                    label="Código de proveedor"
                    name="code"
                    required
                    placeholder="Ej. PRV-007"
                  />
                  <FormField
                    label="RUC / identificación"
                    name="taxId"
                    required
                    placeholder="Número de identificación"
                  />
                  <FormField
                    label="Contacto"
                    name="contact"
                    placeholder="Nombre de contacto"
                  />
                  <FormField
                    label="Correo electrónico"
                    name="email"
                    type="email"
                    placeholder="proveedor@correo.com"
                  />
                  <FormField
                    label="Teléfono"
                    name="phone"
                    placeholder="+505 0000 0000"
                  />
                  <FormField
                    label="Banco"
                    name="bank"
                    placeholder="Nombre del banco"
                  />
                  <FormField
                    label="Cuenta bancaria"
                    name="account"
                    placeholder="Últimos dígitos o referencia"
                  />
                </>
              )}
              {kind === "payment" && (
                <>
                  {paymentInvoiceId ? (
                    <input type="hidden" name="invoice" value={selectedInvoiceId} />
                  ) : (
                    <div className="form-field form-full">
                      <label htmlFor="payment-invoice">Factura asociada</label>
                      <select id="payment-invoice" name="invoice" required value={selectedInvoiceId}
                        onChange={(event) => { setSelectedInvoiceId(event.target.value); setPaymentAmount(""); setOperationError(""); }}>
                        <option value="" disabled>{paymentInvoices.length ? "Selecciona una factura" : "No hay facturas con saldo"}</option>
                        {paymentInvoices.map((invoice) => <option key={invoice.id} value={invoice.id}>
                          {invoice.id} · N.º {invoice.code} · {invoice.supplier}
                        </option>)}
                      </select>
                    </div>
                  )}
                  {selectedInvoice && (
                    <div className="payment-summary form-full">
                      <div className="payment-summary-heading">
                        <strong>N.º {selectedInvoice.code}</strong>
                        <span>{selectedInvoice.supplier} · {selectedInvoice.restaurant}</span>
                      </div>
                      <dl>
                        <div><dt>Monto total</dt><dd>{money(selectedInvoice.amount)}</dd></div>
                        <div><dt>Pagado</dt><dd>{money(selectedInvoice.paidAmount ?? 0)}</dd></div>
                        <div className="payment-balance"><dt>Saldo pendiente</dt><dd>{money(pendingBalance ?? 0)}</dd></div>
                      </dl>
                    </div>
                  )}
                  <fieldset className="invoice-form-group form-full">
                    <legend>Datos del pago</legend>
                    <div className="form-grid">
                      <div className="form-field">
                        <label htmlFor="payment-amount">Monto de este pago <span className="required-star">*</span></label>
                        <input id="payment-amount" name="amount" type="number" required min="0.01" step="0.01"
                          max={pendingBalance} placeholder="0.00" value={paymentAmount}
                          onChange={(event) => setPaymentAmount(event.target.value)} />
                        {selectedInvoice && <button type="button" className="payment-fill" disabled={busy}
                          onClick={() => setPaymentAmount(String(pendingBalance))}>Pagar saldo completo</button>}
                        {remainingAfterPayment !== undefined &&
                          <small aria-live="polite">Saldo después de este pago: {money(remainingAfterPayment)}</small>}
                      </div>
                      <FormField label="Método de pago" name="method" required select options={[...PAYMENT_METHODS]} />
                      <div className="form-field">
                        <label htmlFor="payment-date">Fecha del pago <span className="required-star">*</span></label>
                        <input id="payment-date" name="date" required type="date" defaultValue={managuaDate()} />
                      </div>
                      <FormField label="Referencia" name="reference" required placeholder="Referencia bancaria o de recibo" />
                      <FormField label="Banco de origen" name="bank" placeholder="Opcional" />
                      <div className="form-field">
                        <label htmlFor="payment-detail">Detalle del pago</label>
                        <textarea id="payment-detail" name="detail" placeholder="Opcional" rows={2} />
                      </div>
                    </div>
                  </fieldset>
                </>
              )}
              {kind === "loan" && (
                <>
                  <FormField
                    label="Banco"
                    name="bank"
                    required
                    placeholder="Ej. BAC Nicaragua"
                  />
                  <FormField
                    label="N.º de préstamo"
                    name="number"
                    required
                    placeholder="Número de referencia"
                  />
                  <FormField
                    label="Titular"
                    name="holder"
                    required
                    placeholder="Nombre del titular"
                  />
                  <FormField
                    label="Uso del préstamo"
                    name="use"
                    placeholder="Ej. Capital de trabajo"
                  />
                  <FormField
                    label="Fecha de apertura"
                    name="opened"
                    required
                    type="date"
                  />
                  <FormField label="Fecha final" name="endDate" type="date" />
                  <FormField
                    label="Tasa de interés (%)"
                    name="rate"
                    required
                    type="number"
                    placeholder="0.00"
                  />
                  <FormField
                    label="Cuota mensual (C$)"
                    name="installment"
                    required
                    type="number"
                    placeholder="0.00"
                  />
                  <FormField
                    label="Saldo actual (C$)"
                    name="balance"
                    required
                    type="number"
                    placeholder="0.00"
                  />
                  <FormField
                    label="Día de pago mensual"
                    name="payday"
                    required
                    type="number"
                    placeholder="1"
                  />
                </>
              )}
            </div>
            {operationError && <p role="alert" className="invoice-form-error">{operationError}</p>}
            <footer className="modal-footer">
              <button
                type="button"
                className="button-secondary"
                disabled={busy}
                onClick={onClose}
              >
                Cancelar
              </button>
              <button type="submit" className="button-primary" disabled={busy || (kind === "payment" && !selectedInvoice) || (kind === "invoice" && !restaurants.length)}>
                <Check size={16} /> Guardar{" "}
                {kind === "invoice"
                  ? "factura"
                  : kind === "supplier"
                    ? "proveedor"
                    : kind === "payment"
                      ? "pago"
                      : "préstamo"}
              </button>
            </footer>
          </form>
        )}
      </section>
    </div>
  );
}
