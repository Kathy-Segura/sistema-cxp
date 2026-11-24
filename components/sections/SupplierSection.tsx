"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Link2, Plus, Search, UsersRound, X } from "lucide-react";
import type { Invoice, ProveedorRecord } from "../../types";
import { filterSuppliers, supplierEntryDate } from "../../lib/supplier-filters";
import { money } from "../../utils/formatters";
import { ActionButtons } from "../shared/ActionButtons";
import { InvoiceTable } from "../tables/InvoiceTable";
import { Pagination } from "../tables/Pagination";
import { StatusBadge } from "../tables/StatusBadge";

export function SupplierSection({ providers, invoices, loading, error, onCreate, onEdit, onInvoice, onAssociate }: {
  providers: ProveedorRecord[];
  invoices: Invoice[];
  loading: boolean;
  error: string;
  onCreate: () => void;
  onEdit: (provider: ProveedorRecord) => void;
  onInvoice: (provider: ProveedorRecord) => void;
  onAssociate: (provider: ProveedorRecord) => void;
}) {
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [association, setAssociation] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedId, setSelectedId] = useState("");
  const detail = useRef<HTMLElement>(null);
  const invoicesBySupplier = new Map<string, Invoice[]>();
  for (const invoice of invoices) {
    if (!invoice.supplierId) continue;
    const existing = invoicesBySupplier.get(invoice.supplierId);
    if (existing) existing.push(invoice);
    else invoicesBySupplier.set(invoice.supplierId, [invoice]);
  }
  const entries = providers.map((provider) => ({ provider, invoiceCount: invoicesBySupplier.get(provider.proveedor_id)?.length ?? 0 }));
  const invalidRange = Boolean(from && to && from > to);
  const filtered = invalidRange ? [] : filterSuppliers(entries, search, from, to, association);
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pages);
  const selected = providers.find((provider) => provider.proveedor_id === selectedId);
  const associated = invoicesBySupplier.get(selectedId) ?? [];
  useEffect(() => {
    if (selectedId) detail.current?.focus();
  }, [selectedId]);

  return (
    <>
      <div className="section-heading">
        <div>
          <div className="section-kicker"><UsersRound size={14} /> GESTIÓN FINANCIERA</div>
          <h1>Proveedores</h1>
          <p className="page-subtitle">Consulta el directorio y las facturas de cada proveedor.</p>
        </div>
        <button type="button" className="button-primary" disabled={loading || !!error} onClick={onCreate}><Plus size={17} /> Nuevo proveedor</button>
      </div>
      <div className="filter-bar supplier-filters" aria-label="Filtros de proveedores">
        <label className="table-search">
          <Search size={16} aria-hidden="true" />
          <input type="search" aria-label="Buscar proveedor" placeholder="Buscar por nombre, código, RUC o banco" value={search}
            onChange={(event) => { setSearch(event.target.value); setPage(1); }} />
        </label>
        <label>Ingreso desde<input type="date" value={from} onChange={(event) => { setFrom(event.target.value); setPage(1); }} /></label>
        <label>Ingreso hasta<input type="date" value={to} min={from || undefined} onChange={(event) => { setTo(event.target.value); setPage(1); }} /></label>
        <label>Facturas asociadas<select value={association} onChange={(event) => { setAssociation(event.target.value); setPage(1); }}>
          <option value="">Todos</option><option value="with">Con facturas</option><option value="without">Sin facturas</option>
        </select></label>
        <button type="button" className="button-secondary" onClick={() => {
          setSearch(""); setFrom(""); setTo(""); setAssociation(""); setPage(1);
        }}>Limpiar filtros</button>
      </div>
      {selected && (
        <section className="panel table-panel supplier-invoices" ref={detail} tabIndex={-1} aria-labelledby="supplier-invoices-title">
          <header>
            <div>
              <h2 id="supplier-invoices-title">Facturas de {selected.nombre_legal}</h2>
              <p>{[selected.codigo_proveedor || selected.proveedor_id, selected.nombre_comercial, selected.email, selected.telefono].filter(Boolean).join(" · ")}</p>
            </div>
            <div className="section-actions">
              <button type="button" className="button-primary" onClick={() => onAssociate(selected)}><Link2 size={16} /> Asociar factura existente</button>
              <button type="button" className="button-secondary" onClick={() => onInvoice(selected)}><Plus size={16} /> Nueva factura</button>
              <button type="button" className="button-secondary" onClick={() => setSelectedId("")}><X size={16} /> Cerrar</button>
            </div>
          </header>
          {associated.length ? <InvoiceTable invoices={associated} compact /> : <p className="supplier-empty">Este proveedor todavía no tiene facturas asociadas.</p>}
        </section>
      )}
      {error ? <p className="invoice-form-error" role="alert">{error}</p> : invalidRange ? (
        <p className="invoice-form-error" role="alert">La fecha final debe ser igual o posterior a la fecha inicial.</p>
      ) : loading ? <p className="panel supplier-empty" role="status">Cargando proveedores…</p> : (
        <div className="panel table-panel">
          <div className="table-scroll">
            <table className="data-table" aria-label="Proveedores">
              <thead><tr><th>PROVEEDOR</th><th>RUC</th><th>FECHA DE INGRESO</th><th>FACTURAS ASOCIADAS</th><th>BANCO</th><th className="align-right">SALDO PENDIENTE</th><th>ESTADO</th><th>ACCIONES</th></tr></thead>
              <tbody>{filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize).map(({ provider, invoiceCount }) => {
                const id = provider.proveedor_id;
                const balance = (invoicesBySupplier.get(id) ?? []).reduce((sum, invoice) => sum + (invoice.pendingBalance ?? (invoice.status === "Pagada" ? 0 : invoice.amount)), 0);
                return <tr key={id}>
                  <td><strong>{provider.nombre_legal || id}</strong><div>{provider.codigo_proveedor || id}</div></td>
                  <td>{provider.ruc || "—"}</td><td>{supplierEntryDate(provider.creado_en) || "—"}</td>
                  <td><button type="button" className="link-button" aria-expanded={selectedId === id} onClick={() => setSelectedId(id)}>
                    {invoiceCount} {invoiceCount === 1 ? "factura" : "facturas"} <ArrowUpRight size={12} />
                  </button></td>
                  <td>{provider.banco || "—"}</td><td className="align-right amount-cell">{money(balance)}</td>
                  <td><StatusBadge status={provider.activo ? "Activo" : "Inactivo"} /></td>
                  <td><ActionButtons label={`proveedor ${provider.nombre_legal}`} actions={["view", "edit"]}
                    onAction={(action) => action === "view" ? setSelectedId(id) : onEdit(provider)} /></td>
                </tr>;
              })}</tbody>
            </table>
          </div>
          {!filtered.length && <p className="supplier-empty" role="status">{providers.length ? "No hay proveedores que coincidan con los filtros." : "Todavía no hay proveedores registrados."}</p>}
          <Pagination page={currentPage} pages={pages} total={filtered.length} pageSize={pageSize} setPage={setPage}
            setPageSize={(size) => { setPageSize(size); setPage(1); }} />
        </div>
      )}
    </>
  );
}
