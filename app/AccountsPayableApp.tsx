"use client";
import { useEffect, useState } from "react";
import * as XLSX from "xlsx";
import {
  Bell, Check, Menu, Search, UserRound, WalletCards, X,
} from "lucide-react";
import type { FacturaRecord, Invoice, InvoiceStatus, PagoRecord, PrestamoRecord, PrestamoSaldoRecord, ProveedorRecord, Section, Row, RowAction } from "../types";
import {
  initialInvoices, suppliers, payments, loans, teamUsers, activity,
} from "../data/initial-data";
import { nav } from "../constants/navigation";
import {
  DEFAULT_STATUS_FILTER,
  DEFAULT_DATE_TYPE,
} from "../constants/sections";
import { Modal } from "../components/modals/Modal";
import { RecordActionModal } from "../components/modals/RecordActionModal";
import { DeleteConfirmationCard } from "../components/modals/DeleteConfirmationCard";
import { SectionContent } from "../components/sections/SectionContent";
import { Overview } from "../components/overview/Overview";
import { useToast } from "../hooks/useToast";
import { useInvoiceFilters } from "../hooks/useInvoiceFilters";
import { PageContent } from "../layout/PageContent";
import { createInvoiceExport, dueDate, parseInvoiceWorkbook, type InvoiceFileRow } from "../lib/invoice-file-format";
import { invoiceBalance, invoiceCategory, managuaDate } from "../lib/invoice-balances";

export function AccountsPayableApp() {
  const [section, setSection] = useState<Section>("Resumen");
  const [invoices, setInvoices] = useState(initialInvoices);
  const [supplierRecords, setSupplierRecords] = useState(suppliers);
  const [paymentRecords, setPaymentRecords] = useState(payments);
  const [loanRecords, setLoanRecords] = useState(loans);
  const [logs, setLogs] = useState(activity);
  const [users, setUsers] = useState(teamUsers);
  const [modal, setModal] = useState<
    "invoice" | "supplier" | "payment" | "loan" | "import" | null
  >(null);
  const [paymentInvoiceId, setPaymentInvoiceId] = useState("");
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [rowDialog, setRowDialog] = useState<{
    target: Section;
    row: Row;
    mode: "view" | "edit";
  } | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{ target: Section; row: Row; label: string } | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState(DEFAULT_STATUS_FILTER);
  const [dateType, setDateType] = useState(DEFAULT_DATE_TYPE);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [restaurantFilter, setRestaurantFilter] = useState("Todos los restaurantes");
  const [restaurantOptions, setRestaurantOptions] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const { toast, showToast } = useToast();
  const [mobileOpen, setMobileOpen] = useState(false);
  useEffect(() => {
    let active = true;
    fetch("/api/accounts-payable", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error((await response.json()).error);
        return response.json();
      })
      .then((data: { facturas: FacturaRecord[]; proveedores: ProveedorRecord[]; pagos: PagoRecord[]; prestamos: PrestamoRecord[]; prestamo_saldos: PrestamoSaldoRecord[]; restaurantes: Row[]; usuarios: Row[]; bitacora: Row[] }) => {
        if (!active) return;
        const restaurantName = new Map(data.restaurantes.map((row) => [String(row.restaurante_id), String(row.nombre)]));
        setRestaurantOptions([...new Set(data.restaurantes.map((row) => String(row.nombre ?? "").trim()).filter(Boolean))]);
        const providersById = new Map(data.proveedores.map((item) => [item.proveedor_id, item]));
        const invoiceCount = new Map<string, number>();
        const providerBalance = new Map<string, number>();
        data.facturas.forEach((item) => { invoiceCount.set(item.proveedor_id, (invoiceCount.get(item.proveedor_id) ?? 0) + 1); if (item.estado !== "Pagada") providerBalance.set(item.proveedor_id, (providerBalance.get(item.proveedor_id) ?? 0) + item.saldo_pendiente); });
        const latestPaymentDates = new Map<string, string>();
        for (const payment of data.pagos) {
          if (payment.fecha_pago > (latestPaymentDates.get(payment.factura_id) ?? "")) {
            latestPaymentDates.set(payment.factura_id, payment.fecha_pago);
          }
        }
        setInvoices(data.facturas.map((item) => ({ id: item.factura_id, supplier: providersById.get(item.proveedor_id)?.nombre_legal || item.proveedor_id, code: item.numero_factura || item.codigo_factura, restaurant: restaurantName.get(item.restaurante_id) || item.restaurante_id, issue: item.fecha_emision, due: item.fecha_vencimiento, amount: item.monto_total, paidAmount: item.monto_pagado, pendingBalance: item.saldo_pendiente, status: item.estado, category: item.categoria, dateCreated: item.fecha_ingreso, paidDate: latestPaymentDates.get(item.factura_id) })));
        setSupplierRecords(data.proveedores.map((item) => ({ code: item.codigo_proveedor, name: item.nombre_legal, id: item.ruc, invoices: invoiceCount.get(item.proveedor_id) ?? 0, balance: providerBalance.get(item.proveedor_id) ?? 0, bank: [item.banco, item.cuenta_bancaria].filter(Boolean).join(" · ") || "Sin cuenta registrada", state: item.activo ? "Activo" : "Inactivo" })));
        setPaymentRecords(data.pagos.map((item) => ({ ref: item.codigo_pago || item.referencia, supplier: providersById.get(item.proveedor_id)?.nombre_legal || item.proveedor_id, restaurant: restaurantName.get(item.restaurante_id) || item.restaurante_id, date: item.fecha_pago, method: item.metodo_pago, amount: item.monto, status: "Completada" })));
        const latestBalance = new Map<string, number>(); data.prestamo_saldos.forEach((item) => latestBalance.set(item.prestamo_id, item.saldo_final));
        setLoanRecords(data.prestamos.map((item) => ({ bank: item.acreedor, number: item.numero_prestamo, holder: item.titular, opened: item.fecha_apertura, rate: `${item.tasa_anual * 100}%`, installment: item.cuota_programada, balance: latestBalance.get(item.prestamo_id) ?? item.monto_inicial, date: `${item.dia_pago} de cada mes` })));
        setUsers(data.usuarios.map((item) => ({ initials: String(item.nombre || "US").split(" ").map((word) => word[0]).join("").slice(0, 2), name: item.nombre, email: item.email, role: item.rol, access: "Según rol", restaurants: "Todos", state: ["true", "1"].includes(String(item.activo).toLowerCase()) ? "Activo" : "Inactivo" })));
        setLogs(data.bitacora.map((item) => ({ who: item.usuario_id, initials: String(item.usuario_id).slice(0, 2), action: item.accion, detail: `${item.entidad} · ${item.entidad_id}`, date: item.fecha_hora })));
      })
      .catch((error) => active && showToast(error instanceof Error ? error.message : "No se pudo conectar con Google Sheets"));
    return () => { active = false; };
  }, []);
  const [pageSize, setPageSize] = useState(10);
  const clearInvoiceFilters = () => { setSearch(""); setFilter(DEFAULT_STATUS_FILTER); setDateType(DEFAULT_DATE_TYPE); setDateFrom(""); setDateTo(""); setRestaurantFilter("Todos los restaurantes"); setPage(1); };
  const persistInvoices = async (records: InvoiceFileRow[], origin: "MANUAL" | "IMPORTACION" = "MANUAL") => {
    const response = await fetch("/api/accounts-payable", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "createInvoices", invoices: records, origin }) });
    if (!response.ok) throw new Error((await response.json()).error || "No se pudieron guardar las facturas.");
    const { ids }: { ids: string[] } = await response.json();
    const today = managuaDate();
    const added = records.map(({ number, ...fields }, index): Invoice => ({
      ...fields, id: ids[index], code: number, paidAmount: 0, pendingBalance: fields.amount,
      category: invoiceCategory(fields.issue, fields.due),
      status: invoiceBalance(fields.amount, 0, fields.due, today).estado, dateCreated: today,
    }));
    setInvoices((current) => [...added, ...current]);
    return added;
  };
  const invoicesFiltered = useInvoiceFilters(invoices, search, filter, restaurantFilter, dateType, dateFrom, dateTo);
  const addInvoice = async (data: FormData) => {
    const issue = String(data.get("issue"));
    const creditDays = Number(data.get("credit") || 0);
    const fields: InvoiceFileRow = {
      supplier: String(data.get("supplier")),
      number: String(data.get("number")),
      restaurant: String(data.get("restaurant")),
      issue,
      due: String(data.get("due") || dueDate(issue, creditDays)),
      amount: Number(data.get("amount")),
    };
    const [item] = await persistInvoices([fields]);
    setLogs((current) => [
      {
        who: "María Gutiérrez",
        initials: "MG",
        action: "Creó una factura",
        detail: `${item.id} · ${item.supplier}`,
        date: "Ahora",
      },
      ...current,
    ]);
    setModal(null);
    setSection("Facturas");
    showToast("Factura creada correctamente");
  };
  const addSupplier = (data: FormData) => {
    const name = String(data.get("name"));
    const code = String(data.get("code"));
    setSupplierRecords((current) => [
      {
        code,
        name,
        id: String(data.get("taxId") || "—"),
        invoices: 0,
        balance: 0,
        bank: data.get("bank")
          ? `${data.get("bank")} · cuenta registrada`
          : "Sin cuenta registrada",
        state: "Activo",
      },
      ...current,
    ]);
    setModal(null);
    setLogs((current) => [
      {
        who: "María Gutiérrez",
        initials: "MG",
        action: "Creó un proveedor",
        detail: `${name} · ${code}`,
        date: "Ahora",
      },
      ...current,
    ]);
    setSection("Proveedores");
    showToast("Proveedor registrado correctamente");
  };
  const addPayment = async (data: FormData) => {
    const invoice = invoices.find((item) => item.id === data.get("invoice"));
    if (!invoice) throw new Error("Selecciona la factura que deseas abonar.");
    const payment = {
      facturaRef: invoice.id,
      reference: String(data.get("reference")),
      date: String(data.get("date")),
      method: String(data.get("method")),
      amount: Number(data.get("amount")),
      bank: String(data.get("bank") || ""),
      detail: String(data.get("detail") || ""),
    };
    try {
      const response = await fetch("/api/accounts-payable", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "recordPayment", payment }),
      });
      if (!response.ok) throw new Error((await response.json()).error);
      const result: { facturaId: string; estado: InvoiceStatus; monto_pagado: number; saldo_pendiente: number; payment: PagoRecord; alreadyRecorded: boolean } = await response.json();
      setInvoices((current) => current.map((item) => item.id === result.facturaId ? {
        ...item, status: result.estado, paidAmount: result.monto_pagado,
        pendingBalance: result.saldo_pendiente,
        paidDate: (item.paidDate ?? "") > result.payment.fecha_pago ? item.paidDate : result.payment.fecha_pago,
      } : item));
      if (!result.alreadyRecorded) {
        setPaymentRecords((current) => [{
          ref: result.payment.codigo_pago, supplier: invoice.supplier, restaurant: invoice.restaurant,
          date: result.payment.fecha_pago, method: result.payment.metodo_pago,
          amount: result.payment.monto, status: "Completada",
        }, ...current]);
        setLogs((current) => [{
          who: result.payment.registrado_por, initials: "SI", action: "Registró un pago",
          detail: `${invoice.id} · ${result.payment.referencia}`, date: result.payment.registrado_en,
        }, ...current]);
      }
      setModal(null);
      showToast(result.alreadyRecorded ? "Ese pago ya estaba registrado." :
        result.estado === "Pagada" ? "Pago registrado. Factura liquidada." : `Abono registrado. Factura ${result.estado.toLowerCase()}.`);
    } catch (error) {
      throw error instanceof Error ? error : new Error("No se pudo registrar el pago.");
    }
  };
  const addLoan = (data: FormData) => {
    const record = {
      bank: String(data.get("bank")),
      number: String(data.get("number")),
      holder: String(data.get("holder")),
      opened: String(data.get("opened")),
      rate: `${data.get("rate")}%`,
      installment: Number(data.get("installment")),
      balance: Number(data.get("balance")),
      date: `${data.get("payday")} de cada mes`,
    };
    setLoanRecords((current) => [record, ...current]);
    setModal(null);
    setLogs((current) => [
      {
        who: "María Gutiérrez",
        initials: "MG",
        action: "Registró un préstamo",
        detail: `${record.bank} · ${record.number}`,
        date: "Ahora",
      },
      ...current,
    ]);
    showToast("Préstamo registrado correctamente");
  };
  const importFile = async (file?: File) => {
    if (!file) return;
    setImportErrors([]);
    try {
      if (file.size > 10 * 1024 * 1024) throw new Error("El archivo supera el límite de 10 MB.");
      const { rows, errors } = parseInvoiceWorkbook(await file.arrayBuffer(), restaurantOptions);
      if (errors.length) {
        setImportErrors(errors);
        return;
      }
      if (!rows.length) throw new Error("Agrega al menos una factura debajo de los encabezados.");
      await persistInvoices(rows, "IMPORTACION");
      setModal(null);
      setSection("Facturas");
      setPage(1);
      showToast(`${rows.length} facturas importadas`);
    } catch (error) {
      setImportErrors([error instanceof Error ? error.message : "No se pudo importar el archivo."]);
    }
  };
  const handleRowAction = async (target: Section, row: Row, action: RowAction) => {
    const label =
      target === "Facturas"
        ? `${row.supplier} · ${row.code}`
        : target === "Proveedores"
          ? `${row.name} · ${row.code}`
          : target === "Transferencias"
            ? `${row.ref} · ${row.supplier}`
            : target === "Préstamos"
              ? `${row.bank} · ${row.number}`
              : target === "Usuarios y roles"
                ? `${row.name} · ${row.email}`
                : `${row.who} · ${row.action}`;
    if (target === "Bitácora") {
      showToast(
        action === "view"
          ? `${label} · ${row.detail} · ${row.date}`
          : "La bitácora es un registro de solo consulta",
      );
      return;
    }
    if (target === "Resumen") return;
    if (action === "view" || action === "edit") {
      setRowDialog({ target, row, mode: action });
      return;
    }
    if (action === "delete") {
      setDeleteDialog({ target, row, label });
      return;
    }
  };
  const saveRow = (target: Section, original: Row, updated: Row) => {
    const matches = (item: Row) =>
      target === "Facturas"
        ? item.id === original.id
        : target === "Proveedores"
          ? item.code === original.code
          : target === "Transferencias"
            ? item.ref === original.ref
            : target === "Préstamos"
              ? item.number === original.number
              : item.email === original.email;
    if (target === "Facturas")
      setInvoices((current) =>
        current.map((item) =>
          matches(item as unknown as Row)
            ? ({ ...item, ...updated, category: invoiceCategory(String(updated.issue), String(updated.due)) } as Invoice)
            : item,
        ),
      );
    if (target === "Proveedores")
      setSupplierRecords((current) =>
        current.map((item) => (matches(item) ? { ...item, ...updated } : item)),
      );
    if (target === "Transferencias")
      setPaymentRecords((current) =>
        current.map((item) => (matches(item) ? { ...item, ...updated } : item)),
      );
    if (target === "Préstamos")
      setLoanRecords((current) =>
        current.map((item) => (matches(item) ? { ...item, ...updated } : item)),
      );
    if (target === "Usuarios y roles")
      setUsers((current) =>
        current.map((item) => (matches(item) ? { ...item, ...updated } : item)),
      );
    setRowDialog(null);
    showToast("Cambios guardados correctamente");
  };
  const exportInvoices = () => {
    XLSX.writeFile(createInvoiceExport(invoicesFiltered), "cuentas-por-pagar.xlsx");
    showToast("Reporte Excel descargado");
  };
  const exportPayments = () => {
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      book,
      XLSX.utils.json_to_sheet(
        paymentRecords.map((row) => ({
          Referencia: row.ref,
          Proveedor: row.supplier,
          Restaurante: row.restaurant,
          Fecha: row.date,
          Método: row.method,
          Monto: row.amount,
          Estado: row.status,
        })),
      ),
      "Transferencias",
    );
    XLSX.writeFile(book, "transferencias.xlsx");
    showToast("Reporte de transferencias descargado");
  };
  const openImport = () => {
    setImportErrors([]);
    setModal("import");
  };

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileOpen ? "sidebar-open" : ""}`}>
        <div className="brand">
          <div className="brand-mark">
            <WalletCards size={20} strokeWidth={2.1} />
          </div>
          <span>
            Control<span className="brand-light"> de pagos</span>
          </span>
          <button
            className="mobile-close"
            aria-label="Cerrar menú"
            onClick={() => setMobileOpen(false)}
          >
            <X size={19} />
          </button>
        </div>
        <div className="nav-label">MENÚ PRINCIPAL</div>
        <nav className="main-nav" aria-label="Navegación principal">
          {nav.map(({ name, icon: Icon }) => (
            <button
              key={name}
              className={`nav-link ${section === name ? "active" : ""}`}
              onClick={() => {
                setSection(name);
                setMobileOpen(false);
                setPage(1);
              }}
            >
              <Icon size={18} strokeWidth={1.8} />
              <span>{name}</span>
              {name === "Facturas" && <span className="nav-count">{invoices.length}</span>}
            </button>
          ))}
        </nav>
      </aside>
      {mobileOpen && (
        <button
          className="mobile-scrim"
          aria-label="Cerrar menú"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <main className="main-area">
        <header className="topbar">
          <button
            className="mobile-menu"
            aria-label="Abrir menú"
            onClick={() => setMobileOpen(true)}
          >
            <Menu size={21} />
          </button>
          <button
            className="top-profile"
            onClick={() => setSection("Mi perfil")}
            aria-label="Abrir perfil de María Gutiérrez"
          >
            <span className="avatar avatar-teal">MG</span>
            <span>
              <strong>María Gutiérrez</strong>
              <small>Tesorería</small>
            </span>
            <UserRound size={16} />
          </button>
          <div className="breadcrumbs">
            <span>Control de pagos</span>
            <span className="crumb-slash">/</span>
            <strong>{section}</strong>
          </div>
          <div className="top-actions">
            <label className="global-search">
              <Search size={16} />
              <input
                aria-label="Buscar en el sistema"
                placeholder="Buscar..."
                onChange={(e) => {
                  setSearch(e.target.value);
                  if (e.target.value) setSection("Facturas");
                }}
              />
              <kbd>⌘ K</kbd>
            </label>
            <button
              className="icon-button notification-button"
              aria-label="Notificaciones"
              onClick={() => showToast("No tienes notificaciones nuevas")}
            >
              <Bell size={18} />
              <i />
            </button>
          </div>
        </header>
        <PageContent>
          {section === "Resumen" ? (
            <Overview
              invoices={invoices}
              onNavigate={setSection}
              onCreate={() => setModal("invoice")}
              onImport={openImport}
            />
          ) : (
            <SectionContent
              section={section}
              invoices={invoicesFiltered}
              suppliers={supplierRecords}
              payments={paymentRecords}
              loans={loanRecords}
              users={users}
              search={search}
              setSearch={setSearch}
              filter={filter}
              setFilter={(value) => {
                setFilter(value);
                setPage(1);
              }}
              dateType={dateType}
              setDateType={setDateType}
              dateFrom={dateFrom}
              setDateFrom={setDateFrom}
              dateTo={dateTo}
              setDateTo={setDateTo}
              restaurantFilter={restaurantFilter}
              setRestaurantFilter={setRestaurantFilter}
              restaurantOptions={restaurantOptions}
              onClearFilters={clearInvoiceFilters}
              page={page}
              setPage={setPage}
              pageSize={pageSize}
              setPageSize={(value) => { setPageSize(value); setPage(1); }}
              onCreate={(kind) => {
                if (kind === "import") return openImport();
                if (kind === "payment") setPaymentInvoiceId("");
                setModal(kind);
              }}
              onExport={
                section === "Transferencias" ? exportPayments : exportInvoices
              }
              onToast={showToast}
              onPay={(id) => {
                setPaymentInvoiceId(id);
                setModal("payment");
              }}
              logs={logs}
              onAction={handleRowAction}
            />
          )}
        </PageContent>
      </main>
      {modal && (
        <Modal
          kind={modal}
          onClose={() => setModal(null)}
          onInvoice={addInvoice}
          onSupplier={addSupplier}
          onPayment={addPayment}
          onLoan={addLoan}
          onImport={importFile}
          importErrors={importErrors}
          clearImportErrors={() => setImportErrors([])}
          paymentInvoices={invoices.filter((item) => (item.pendingBalance ?? item.amount) > 0)}
          paymentInvoiceId={paymentInvoiceId}
          restaurants={restaurantOptions}
        />
      )}
      {rowDialog && (
        <RecordActionModal
          row={rowDialog.row}
          invoice={rowDialog.target === "Facturas"}
          mode={rowDialog.mode}
          onClose={() => setRowDialog(null)}
          onSave={(updated) =>
            saveRow(rowDialog.target, rowDialog.row, updated)
          }
        />
      )}
      {deleteDialog && <DeleteConfirmationCard id={String(deleteDialog.target === "Facturas" ? deleteDialog.row.id : deleteDialog.row.code)} label={deleteDialog.label} onClose={() => setDeleteDialog(null)} onConfirm={async () => { if (deleteDialog.target !== "Facturas") { showToast("La eliminación remota está disponible únicamente para facturas."); setDeleteDialog(null); return; } const response = await fetch("/api/accounts-payable", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ facturaId: deleteDialog.row.id }) }); if (!response.ok) { showToast((await response.json()).error); return; } setInvoices((current) => current.filter((item) => item.id !== deleteDialog.row.id)); setDeleteDialog(null); showToast("Factura eliminada"); }} />}
      {toast && (
        <div className="toast-message" role="status">
          <Check size={17} />
          {toast}
        </div>
      )}
    </div>
  );
}
