"use client";
import { useState } from "react";
import * as XLSX from "xlsx";
import {
  Bell, Check, Menu, Search, UserRound, WalletCards, X,
} from "lucide-react";
import type { Section, Invoice, Row, RowAction } from "../types";
import {
  initialInvoices, suppliers, payments, loans, teamUsers, activity,
} from "../data/initial-data";
import { nav } from "../constants/navigation";
import {
  PAGE_SIZE,
  DEFAULT_STATUS_FILTER,
  DEFAULT_DATE_TYPE,
} from "../constants/sections";
import { Modal } from "../components/modals/Modal";
import { RecordActionModal } from "../components/modals/RecordActionModal";
import { SectionContent } from "../components/sections/SectionContent";
import { Overview } from "../components/overview/Overview";
import { useToast } from "../hooks/useToast";
import { useInvoiceFilters } from "../hooks/useInvoiceFilters";
import { PageContent } from "../layout/PageContent";

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
  const [rowDialog, setRowDialog] = useState<{
    target: Section;
    row: Row;
    mode: "view" | "edit";
  } | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState(DEFAULT_STATUS_FILTER);
  const [dateType, setDateType] = useState(DEFAULT_DATE_TYPE);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const { toast, showToast } = useToast();
  const [mobileOpen, setMobileOpen] = useState(false);
  const pageSize = PAGE_SIZE;
  const invoicesFiltered = useInvoiceFilters(invoices, search, filter);
  const addInvoice = (data: FormData) => {
    const item: Invoice = {
      id: `FAC-${String(Date.now()).slice(-5)}`,
      supplier: String(data.get("supplier")),
      code: String(data.get("number")),
      restaurant: String(data.get("restaurant")),
      issue: String(data.get("issue")),
      due: String(data.get("due")),
      amount: Number(data.get("amount")),
      status: "Pendiente",
      category: "General",
      dateCreated: new Date().toISOString().slice(0, 10),
    };
    setInvoices((current) => [item, ...current]);
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
  const addPayment = (data: FormData) => {
    const record = {
      ref: String(data.get("reference")),
      supplier: String(data.get("supplier")),
      restaurant: String(data.get("restaurant")),
      date: String(data.get("date")),
      method: String(data.get("method")),
      amount: Number(data.get("amount")),
      status: "Completada",
    };
    setPaymentRecords((current) => [record, ...current]);
    setModal(null);
    setLogs((current) => [
      {
        who: "María Gutiérrez",
        initials: "MG",
        action: "Registró una transferencia",
        detail: `${record.ref} · ${record.supplier}`,
        date: "Ahora",
      },
      ...current,
    ]);
    setSection("Transferencias");
    showToast("Transferencia registrada correctamente");
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
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), {
        type: "array",
        cellDates: true,
      });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
        defval: "",
      });
      const imported = rows
        .map((row, index) => {
          const normalized: Record<string, unknown> = {};
          Object.entries(row).forEach(([key, value]) => {
            normalized[
              key
                .toLowerCase()
                .trim()
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
            ] = value;
          });
          const pick = (...keys: string[]) => {
            for (const key of keys)
              if (normalized[key] !== undefined && normalized[key] !== "")
                return normalized[key];
            return "";
          };
          const supplier = String(pick("proveedor", "supplier"));
          const code = String(
            pick(
              "no. factura",
              "no factura",
              "numero de factura",
              "factura",
              "codigo",
            ),
          );
          const amount = Number(
            String(pick("monto", "importe", "amount")).replace(/[^\d.-]/g, ""),
          );
          const restaurant = String(pick("restaurante", "restaurant"));
          if (!supplier || !code || !Number.isFinite(amount) || amount <= 0)
            return null;
          const rawDate = pick("fecha emision", "fecha de emision", "emision");
          const dateText =
            rawDate instanceof Date
              ? rawDate.toLocaleDateString("es-NI", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })
              : String(rawDate || "—");
          const rawDue = pick("fecha de vencimiento", "vencimiento");
          const dueText =
            rawDue instanceof Date
              ? rawDue.toLocaleDateString("es-NI", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })
              : String(rawDue || "—");
          return {
            id: `FAC-${code}-${index}`,
            supplier,
            code,
            restaurant: restaurant || "CDP",
            issue: dateText,
            due: dueText,
            amount,
            status: "Pendiente",
            category: String(pick("categoria", "category") || "General"),
          } as Invoice;
        })
        .filter((item): item is Invoice => item !== null);
      if (!imported.length) {
        showToast(
          "No se encontraron filas válidas. Revisa proveedor, factura y monto.",
        );
        return;
      }
      setInvoices((current) => [...imported, ...current]);
      setLogs((current) => [
        {
          who: "María Gutiérrez",
          initials: "MG",
          action: `Importó ${imported.length} facturas`,
          detail: file.name,
          date: "Ahora",
        },
        ...current,
      ]);
      setModal(null);
      setSection("Facturas");
      showToast(
        `${imported.length} facturas importadas; ${rows.length - imported.length} filas omitidas`,
      );
    } catch {
      showToast(
        "No se pudo leer el archivo. Intenta con una plantilla XLSX válida.",
      );
    }
  };
  const handleRowAction = (target: Section, row: Row, action: RowAction) => {
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
      if (
        !window.confirm(`¿Eliminar ${label}? Esta acción no se puede deshacer.`)
      )
        return;
      if (target === "Facturas")
        setInvoices((current) => current.filter((item) => item.id !== row.id));
      if (target === "Proveedores")
        setSupplierRecords((current) =>
          current.filter((item) => item.code !== row.code),
        );
      if (target === "Transferencias")
        setPaymentRecords((current) =>
          current.filter((item) => item.ref !== row.ref),
        );
      if (target === "Préstamos")
        setLoanRecords((current) =>
          current.filter((item) => item.number !== row.number),
        );
      if (target === "Usuarios y roles")
        setUsers((current) =>
          current.filter((item) => item.email !== row.email),
        );
      showToast("Registro eliminado");
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
            ? ({ ...item, ...updated } as Invoice)
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
    const data = invoicesFiltered.map((row) => ({
      Proveedor: row.supplier,
      Restaurante: row.restaurant,
      Factura: row.code,
      "Fecha emisión": row.issue,
      Vencimiento: row.due,
      Monto: row.amount,
      Estado: row.status,
      Categoría: row.category,
    }));
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      book,
      XLSX.utils.json_to_sheet(data),
      "Facturas",
    );
    XLSX.writeFile(book, "cuentas-por-pagar.xlsx");
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
  const downloadTemplate = () => {
    const book = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet([
      [
        "Proveedor",
        "Restaurante",
        "No. Factura",
        "Fecha Emisión",
        "Días de crédito",
        "Fecha de Vencimiento",
        "Categoría",
        "Monto",
      ],
      [
        "Aexpress Nicaragua",
        "CDP",
        "16569",
        "2026-11-05",
        7,
        "2026-11-12",
        "Insumos",
        27320,
      ],
    ]);
    XLSX.utils.book_append_sheet(book, sheet, "Cuentas por pagar");
    XLSX.writeFile(book, "plantilla-cuentas-por-pagar.xlsx");
    showToast("Plantilla Excel descargada");
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
              {name === "Facturas" && <span className="nav-count">12</span>}
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
              onImport={() => setModal("import")}
            />
          ) : (
            <SectionContent
              section={section}
              invoices={invoices}
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
              page={page}
              setPage={setPage}
              pageSize={pageSize}
              onCreate={(kind) => setModal(kind)}
              onExport={
                section === "Transferencias" ? exportPayments : exportInvoices
              }
              onToast={showToast}
              onStatus={(id, status) => {
                setInvoices((current) =>
                  current.map((item) =>
                    item.id === id
                      ? {
                          ...item,
                          status,
                          paidDate:
                            status === "Pagada"
                              ? new Date().toISOString().slice(0, 10)
                              : undefined,
                        }
                      : item,
                  ),
                );
                setLogs((current) => [
                  {
                    who: "María Gutiérrez",
                    initials: "MG",
                    action: `Marcó factura como ${status.toLowerCase()}`,
                    detail: id,
                    date: "Ahora",
                  },
                  ...current,
                ]);
                showToast(`Factura marcada como ${status.toLowerCase()}`);
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
          onTemplate={downloadTemplate}
        />
      )}
      {rowDialog && (
        <RecordActionModal
          row={rowDialog.row}
          mode={rowDialog.mode}
          onClose={() => setRowDialog(null)}
          onSave={(updated) =>
            saveRow(rowDialog.target, rowDialog.row, updated)
          }
        />
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
