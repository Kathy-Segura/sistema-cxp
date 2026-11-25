"use client";
import { useEffect, useState } from "react";
import * as XLSX from "xlsx";
import {
  Bell, Check, Menu, Search, UserRound, WalletCards, X,
} from "lucide-react";
import type { FacturaRecord, FixedExpenseInput, FixedExpensePayment, FixedExpensePaymentChange, GastoFijoRecord, Invoice, InvoiceStatus, PagoRecord, PrestamoRecord, PrestamoSaldoRecord, ProveedorRecord, RestaurantOption, Section, Row, RowAction } from "../types";
import {
  initialInvoices, payments, loans, teamUsers, activity,
} from "../data/initial-data";
import { nav } from "../constants/navigation";
import {
  DEFAULT_STATUS_FILTER,
  DEFAULT_DATE_TYPE,
} from "../constants/sections";
import { Modal } from "../components/modals/Modal";
import { RecordActionModal } from "../components/modals/RecordActionModal";
import { InvoiceSupplierModal } from "../components/modals/InvoiceSupplierModal";
import { DeleteConfirmationCard } from "../components/modals/DeleteConfirmationCard";
import { SectionContent } from "../components/sections/SectionContent";
import { SupplierSection } from "../components/sections/SupplierSection";
import { FixedExpensesSection } from "../components/sections/FixedExpensesSection";
import { Overview } from "../components/overview/Overview";
import { useToast } from "../hooks/useToast";
import { useInvoiceFilters } from "../hooks/useInvoiceFilters";
import { PageContent } from "../layout/PageContent";
import { createInvoiceExport, dueDate, type InvoiceFileRow } from "../lib/invoice-file-format";
import { downloadInvoiceWorkbook } from "../lib/invoice-export-style";
import { invoiceBalance, invoiceCategory, managuaDate } from "../lib/invoice-balances";
import { invoiceNumberKey, resolveInvoiceNumber, SERVICE_TYPES } from "../lib/invoice-identity";

export function AccountsPayableApp() {
  const [section, setSection] = useState<Section>("Resumen");
  const [invoices, setInvoices] = useState(initialInvoices);
  const [supplierRecords, setSupplierRecords] = useState<ProveedorRecord[]>([]);
  const [fixedExpenses, setFixedExpenses] = useState<GastoFijoRecord[]>([]);
  const [fixedExpensePayments, setFixedExpensePayments] = useState<FixedExpensePayment[]>([]);
  const [supplierContext, setSupplierContext] = useState<ProveedorRecord>();
  const [invoiceSupplier, setInvoiceSupplier] = useState<ProveedorRecord>();
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState("");
  const [paymentRecords, setPaymentRecords] = useState(payments);
  const [loanRecords, setLoanRecords] = useState(loans);
  const [logs, setLogs] = useState(activity);
  const [users, setUsers] = useState(teamUsers);
  const [modal, setModal] = useState<
    "invoice" | "supplier" | "payment" | "loan" | "import" | null
  >(null);
  const [paymentInvoiceId, setPaymentInvoiceId] = useState("");
  const [rowDialog, setRowDialog] = useState<{
    target: Section;
    row: Row;
    mode: "view" | "edit";
  } | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{ id: string; label: string } | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState(DEFAULT_STATUS_FILTER);
  const [dateType, setDateType] = useState(DEFAULT_DATE_TYPE);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [restaurantFilter, setRestaurantFilter] = useState("Todos los restaurantes");
  const [restaurants, setRestaurants] = useState<RestaurantOption[]>([]);
  const restaurantOptions = [...new Set(restaurants.map(({ name }) => name))];
  const [page, setPage] = useState(1);
  const { toast, showToast } = useToast();
  const [mobileOpen, setMobileOpen] = useState(false);
  const closeModal = () => { setModal(null); setSupplierContext(undefined); };
  useEffect(() => {
    let active = true;
    fetch("/api/accounts-payable", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error((await response.json()).error);
        return response.json();
      })
      .then((data: { facturas: FacturaRecord[]; proveedores: ProveedorRecord[]; pagos: PagoRecord[]; gastos_fijos: GastoFijoRecord[]; gastos_fijos_pagos: FixedExpensePayment[]; prestamos: PrestamoRecord[]; prestamo_saldos: PrestamoSaldoRecord[]; restaurantes: Row[]; usuarios: Row[]; bitacora: Row[] }) => {
        if (!active) return;
        const restaurantName = new Map(data.restaurantes.map((row) => [String(row.restaurante_id), String(row.nombre)]));
        setRestaurants(data.restaurantes.map((row) => ({ id: String(row.restaurante_id ?? "").trim(), name: String(row.nombre ?? "").trim() }))
          .filter(({ id, name }) => id && name));
        setFixedExpenses(data.gastos_fijos.filter((expense) => expense.gasto_fijo_id));
        setFixedExpensePayments(data.gastos_fijos_pagos ?? []);
        const providersById = new Map(data.proveedores.map((item) => [item.proveedor_id, item]));
        const latestPaymentDates = new Map<string, string>();
        for (const payment of data.pagos) {
          if (payment.fecha_pago > (latestPaymentDates.get(payment.factura_id) ?? "")) {
            latestPaymentDates.set(payment.factura_id, payment.fecha_pago);
          }
        }
        setInvoices(data.facturas.map((item) => ({ id: item.factura_id, supplierId: item.proveedor_id, supplier: providersById.get(item.proveedor_id)?.nombre_legal || item.proveedor_id, code: item.numero_factura || item.codigo_factura, restaurant: restaurantName.get(item.restaurante_id) || item.restaurante_id, issue: item.fecha_emision, due: item.fecha_vencimiento, amount: item.monto_total, paidAmount: item.monto_pagado, pendingBalance: item.saldo_pendiente, status: item.estado, category: item.categoria, dateCreated: item.fecha_ingreso, paidDate: latestPaymentDates.get(item.factura_id) })));
        setSupplierRecords(data.proveedores.filter((provider) => provider.proveedor_id));
        setPaymentRecords(data.pagos.map((item) => ({ ref: item.codigo_pago || item.referencia, invoiceId: item.factura_id, supplierId: item.proveedor_id, supplier: providersById.get(item.proveedor_id)?.nombre_legal || item.proveedor_id, restaurant: restaurantName.get(item.restaurante_id) || item.restaurante_id, date: item.fecha_pago, method: item.metodo_pago, amount: item.monto, status: "Completada" })));
        const latestBalance = new Map<string, number>(); data.prestamo_saldos.forEach((item) => latestBalance.set(item.prestamo_id, item.saldo_final));
        setLoanRecords(data.prestamos.map((item) => ({ bank: item.acreedor, number: item.numero_prestamo, holder: item.titular, opened: item.fecha_apertura, rate: `${item.tasa_anual * 100}%`, installment: item.cuota_programada, balance: latestBalance.get(item.prestamo_id) ?? item.monto_inicial, date: `${item.dia_pago} de cada mes` })));
        setUsers(data.usuarios.map((item) => ({ initials: String(item.nombre || "US").split(" ").map((word) => word[0]).join("").slice(0, 2), name: item.nombre, email: item.email, role: item.rol, access: "Según rol", restaurants: "Todos", state: ["true", "1"].includes(String(item.activo).toLowerCase()) ? "Activo" : "Inactivo" })));
        setLogs(data.bitacora.map((item) => ({ who: item.usuario_id, initials: String(item.usuario_id).slice(0, 2), action: item.accion, detail: `${item.entidad} · ${item.entidad_id}`, date: item.fecha_hora })));
      })
      .catch((error) => {
        if (!active) return;
        const message = error instanceof Error ? error.message : "No se pudo conectar con Google Sheets";
        setDashboardError(message);
        showToast(message);
      })
      .finally(() => { if (active) setDashboardLoading(false); });
    return () => { active = false; };
  }, []);
  const [pageSize, setPageSize] = useState(10);
  const clearInvoiceFilters = () => { setSearch(""); setFilter(DEFAULT_STATUS_FILTER); setDateType(DEFAULT_DATE_TYPE); setDateFrom(""); setDateTo(""); setRestaurantFilter("Todos los restaurantes"); setPage(1); };
  const persistInvoices = async (records: InvoiceFileRow[], origin: "MANUAL" | "IMPORTACION" = "MANUAL") => {
    const response = await fetch("/api/accounts-payable", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "createInvoices", invoices: records, origin }) });
    if (!response.ok) throw new Error((await response.json()).error || "No se pudieron guardar las facturas.");
    const { ids, providerIds, newProviders }: { ids: string[]; providerIds: string[]; newProviders: ProveedorRecord[] } = await response.json();
    const today = managuaDate();
    const names = new Map([...supplierRecords, ...newProviders].map((provider) => [provider.proveedor_id, provider.nombre_legal]));
    const added = records.map(({ number, ...fields }, index): Invoice => ({
      ...fields, id: ids[index], supplierId: providerIds[index], supplier: names.get(providerIds[index]) || fields.supplier,
      code: number, paidAmount: 0, pendingBalance: fields.amount,
      category: invoiceCategory(fields.issue, fields.due),
      status: invoiceBalance(fields.amount, 0, fields.due, today).estado, dateCreated: today,
    }));
    setInvoices((current) => [...added, ...current]);
    if (newProviders.length) setSupplierRecords((current) => [...newProviders, ...current]);
    return added;
  };
  const invoicesFiltered = useInvoiceFilters(invoices, search, filter, restaurantFilter, dateType, dateFrom, dateTo);
  const invoiceCounts = new Map<string, number>();
  for (const invoice of invoices) {
    const key = invoiceNumberKey(invoice.supplierId || invoice.supplier, invoice.code);
    invoiceCounts.set(key, (invoiceCounts.get(key) ?? 0) + 1);
  }
  const duplicateInvoiceIds = new Set(invoices.filter((invoice) =>
    (invoiceCounts.get(invoiceNumberKey(invoice.supplierId || invoice.supplier, invoice.code)) ?? 0) > 1).map((invoice) => invoice.id));
  const addInvoice = async (data: FormData) => {
    const selected = supplierRecords.find((provider) => provider.proveedor_id === data.get("supplierId"));
    if (!selected) throw new Error("Selecciona un proveedor registrado.");
    const issue = String(data.get("issue"));
    const restaurant = String(data.get("restaurant") ?? "");
    const service = SERVICE_TYPES.find((type) => type === data.get("documentKind"));
    const reference = service ? `${service}: ${data.get("serviceReference") ?? ""}` : String(data.get("number") ?? "");
    const creditDays = Number(data.get("credit") || 0);
    const fields: InvoiceFileRow = {
      supplier: selected.nombre_legal || selected.proveedor_id,
      supplierId: selected.proveedor_id,
      number: resolveInvoiceNumber(reference, issue, restaurant),
      restaurant,
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
    closeModal();
    if (!supplierContext) setSection("Facturas");
    showToast("Factura creada correctamente");
  };
  const appendAudit = (audit: Row[]) => {
    if (!audit.length) return;
    setLogs((current) => [...audit.map((item) => ({ who: item.usuario_id, initials: String(item.usuario_id).slice(0, 2),
      action: item.accion, detail: `${item.entidad} · ${item.entidad_id}`, date: item.fecha_hora })), ...current]);
  };
  const saveFixedExpense = async (input: FixedExpenseInput, original?: GastoFijoRecord) => {
    const response = await fetch("/api/accounts-payable", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "saveFixedExpense", expense: input, expenseId: original?.gasto_fijo_id,
        expectedUpdatedAt: original?.actualizado_en ?? "" }),
    });
    if (!response.ok) throw new Error((await response.json()).error || "No se pudo guardar el gasto fijo.");
    const { expense, audit }: { expense: GastoFijoRecord; audit: Row } = await response.json();
    setFixedExpenses((current) => original
      ? current.map((item) => item.gasto_fijo_id === expense.gasto_fijo_id ? expense : item)
      : [expense, ...current]);
    appendAudit([audit]);
    showToast(original ? "Gasto fijo actualizado" : "Gasto fijo registrado");
  };
  const deleteFixedExpense = async (expense: GastoFijoRecord) => {
    const expenseId = expense.gasto_fijo_id;
    const response = await fetch("/api/accounts-payable", {
      method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expenseId, expectedUpdatedAt: expense.actualizado_en ?? "" }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "No se pudo eliminar el gasto fijo.");
    if (!result.deleted || result.expenseId !== expenseId) throw new Error("La API no confirmó la eliminación del gasto fijo.");
    setFixedExpenses((current) => current.filter((item) => item.gasto_fijo_id !== expenseId));
    if (result.audit) appendAudit([result.audit]);
    showToast("Gasto fijo eliminado");
  };
  const setFixedExpensePayment = async (change: FixedExpensePaymentChange) => {
    const response = await fetch("/api/accounts-payable", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "setFixedExpensePayment", ...change }),
    });
    const result: { error?: string; payment?: FixedExpensePayment; audit?: Row } = await response.json();
    if (!response.ok) throw new Error(result.error || "No se pudo actualizar el pago.");
    const payment = result.payment;
    if (payment) setFixedExpensePayments((current) => [payment, ...current.filter((record) =>
      record.gasto_fijo_id !== payment.gasto_fijo_id || record.periodo !== payment.periodo)]);
    if (result.audit) appendAudit([result.audit]);
    showToast(change.paidDate ? "Pago del gasto fijo registrado" : "Pago del gasto fijo revertido");
  };
  const assignInvoiceSupplier = async (invoiceId: string, supplierId: string, expectedSupplierId: string, confirmedReassignment: boolean) => {
    const response = await fetch("/api/accounts-payable", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "assignInvoiceSupplier", invoiceId, supplierId, expectedSupplierId, confirmedReassignment }),
    });
    if (!response.ok) throw new Error((await response.json()).error || "No se pudo asociar la factura.");
    const result: { invoiceId: string; supplierId: string; supplier: string; audit: Row[] } = await response.json();
    const updated = { supplierId: result.supplierId, supplier: result.supplier };
    setInvoices((current) => current.map((item) => item.id === result.invoiceId ? { ...item, ...updated } : item));
    setPaymentRecords((current) => current.map((item) => item.invoiceId === result.invoiceId ? { ...item, ...updated } : item));
    appendAudit(result.audit);
    return updated;
  };
  const saveSupplier = async (data: FormData) => {
    const supplierId = supplierContext?.proveedor_id;
    const response = await fetch("/api/accounts-payable", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "saveSupplier", supplierId, supplier: Object.fromEntries(data), invoiceIds: data.getAll("invoiceIds") }),
    });
    if (!response.ok) throw new Error((await response.json()).error || "No se pudo guardar el proveedor.");
    const { provider, invoiceIds, audit }: { provider: ProveedorRecord; invoiceIds: string[]; audit: Row[] } = await response.json();
    const id = provider.proveedor_id;
    const assigned = new Set(invoiceIds);
    setSupplierRecords((current) => supplierId
      ? current.map((item) => item.proveedor_id === id ? provider : item) : [provider, ...current]);
    setInvoices((current) => current.map((item) => item.supplierId === id || assigned.has(item.id)
      ? { ...item, supplierId: id, supplier: provider.nombre_legal } : item));
    setPaymentRecords((current) => current.map((item) => item.supplierId === id || (!item.supplierId && assigned.has(String(item.invoiceId)))
      ? { ...item, supplierId: id, supplier: provider.nombre_legal } : item));
    appendAudit(audit);
    closeModal();
    showToast(supplierId ? "Proveedor actualizado" : "Proveedor registrado correctamente");
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
          ref: result.payment.codigo_pago, invoiceId: invoice.id, supplierId: invoice.supplierId || "", supplier: invoice.supplier, restaurant: invoice.restaurant,
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
  const importInvoices = async (rows: InvoiceFileRow[]) => {
    await persistInvoices(rows, "IMPORTACION");
    setModal(null);
    setSection("Facturas");
    setPage(1);
    showToast(`${rows.length} facturas importadas`);
  };
  const deleteInvoice = async (id: string) => {
    const response = await fetch("/api/accounts-payable", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ facturaId: id }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "No se pudo eliminar la factura.");
    if (!result.deleted || result.facturaId !== id) throw new Error("La API no confirmó la eliminación de esta factura.");
    setInvoices((current) => current.filter((item) => item.id !== id));
    setPage(1);
    setDeleteDialog(null);
    showToast(`Factura ${id} eliminada`);
  };
  const handleRowAction = async (target: Section, row: Row, action: RowAction) => {
    const label =
      target === "Facturas"
        ? `${row.supplier} · N.º ${row.code} · ${row.id}`
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
      if (target !== "Facturas") {
        showToast("La eliminación remota está disponible únicamente para facturas.");
        return;
      }
      setDeleteDialog({ id: String(row.id), label });
      return;
    }
  };
  const saveRow = async (target: Section, original: Row, updated: Row, confirmedReassignment: boolean) => {
    const originalSupplierId = String(original.supplierId ?? "");
    const newSupplierId = String(updated.supplierId ?? "");
    const association = target === "Facturas" && newSupplierId && newSupplierId !== originalSupplierId
      ? await assignInvoiceSupplier(String(original.id), newSupplierId, originalSupplierId, confirmedReassignment)
      : undefined;
    const matches = (item: Row) =>
      target === "Facturas"
        ? item.id === original.id
        : target === "Transferencias"
            ? item.ref === original.ref
            : target === "Préstamos"
              ? item.number === original.number
              : item.email === original.email;
    if (target === "Facturas")
      setInvoices((current) =>
        current.map((item) =>
          matches(item as unknown as Row)
            ? ({ ...item, ...updated, ...association, category: invoiceCategory(String(updated.issue), String(updated.due)) } as Invoice)
            : item,
        ),
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
    showToast(association ? "Proveedor asociado a la factura" : "Cambios guardados correctamente");
  };
  const exportInvoices = () => {
    try {
      downloadInvoiceWorkbook(createInvoiceExport(invoicesFiltered), "cuentas-por-pagar.xlsx");
      showToast("Reporte Excel descargado");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "No se pudo exportar el reporte.");
    }
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
          ) : section === "Gastos fijos" ? (
            <FixedExpensesSection expenses={fixedExpenses} providers={supplierRecords} restaurants={restaurants}
              loading={dashboardLoading} error={dashboardError} onSave={saveFixedExpense} onDelete={deleteFixedExpense}
              payments={fixedExpensePayments} onPaymentChange={setFixedExpensePayment} />
          ) : section === "Proveedores" ? (
            <SupplierSection providers={supplierRecords} invoices={invoices} loading={dashboardLoading} error={dashboardError}
              onCreate={() => { setSupplierContext(undefined); setModal("supplier"); }}
              onEdit={(provider) => { setSupplierContext(provider); setModal("supplier"); }}
              onAssociate={setInvoiceSupplier}
              onInvoice={(provider) => { setSupplierContext(provider); setModal("invoice"); }} />
          ) : (
            <SectionContent
              section={section}
              invoices={invoicesFiltered}
              duplicateInvoiceIds={duplicateInvoiceIds}
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
          onClose={closeModal}
          onInvoice={addInvoice}
          onSupplier={saveSupplier}
          supplier={supplierContext}
          providers={supplierRecords}
          onPayment={addPayment}
          onLoan={addLoan}
          onImport={importInvoices}
          registeredInvoices={invoices}
          paymentInvoices={invoices.filter((item) => (item.pendingBalance ?? item.amount) > 0)}
          paymentInvoiceId={paymentInvoiceId}
          restaurants={restaurantOptions}
        />
      )}
      {rowDialog && (
        <RecordActionModal
          row={rowDialog.row}
          invoice={rowDialog.target === "Facturas"}
          providers={supplierRecords}
          mode={rowDialog.mode}
          onClose={() => setRowDialog(null)}
          onSave={(updated, confirmed) =>
            saveRow(rowDialog.target, rowDialog.row, updated, confirmed)
          }
        />
      )}
      {invoiceSupplier && (
        <InvoiceSupplierModal provider={invoiceSupplier} invoices={invoices} onClose={() => setInvoiceSupplier(undefined)}
          onAssign={async (invoice, confirmed) => {
            await assignInvoiceSupplier(invoice.id, invoiceSupplier.proveedor_id, invoice.supplierId || "", confirmed);
            setInvoiceSupplier(undefined);
            showToast(`Factura ${invoice.id} asociada al proveedor`);
          }} />
      )}
      {deleteDialog && (
        <DeleteConfirmationCard id={deleteDialog.id} label={deleteDialog.label}
          onClose={() => setDeleteDialog(null)} onConfirm={() => deleteInvoice(deleteDialog.id)} />
      )}
      {toast && (
        <div className="toast-message" role="status">
          <Check size={17} />
          {toast}
        </div>
      )}
    </div>
  );
}
