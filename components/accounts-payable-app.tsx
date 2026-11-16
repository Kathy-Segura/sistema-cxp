"use client"

import { useMemo, useState } from "react"
import * as XLSX from "xlsx"
import { InvoiceTable, Modal, RecordActionModal, SectionContent } from "@/components/accounts-payable-sections"
import {
  Activity, ArrowDownToLine, ArrowLeftRight, ArrowUpRight, Bell, Building2, CalendarDays, Check,
  ChevronDown, ChevronLeft, ChevronRight, CloudUpload, FileSpreadsheet,
  FileText, HandCoins, LayoutDashboard, Menu, MoreHorizontal, Plus, Search,
  ShieldCheck, SlidersHorizontal, Users, UserRound, WalletCards, X,
} from "lucide-react"

type Section = "Resumen" | "Facturas" | "Proveedores" | "Transferencias" | "Préstamos" | "Bitácora" | "Usuarios y roles" | "Mi perfil"
type Invoice = { id: string; supplier: string; code: string; restaurant: string; issue: string; due: string; amount: number; status: string; category: string; dateCreated?: string; paidDate?: string }
type Row = Record<string, string | number>
type RowAction = "view" | "edit" | "delete"

const initialInvoices: Invoice[] = [
  { id: "FAC-16568", supplier: "Aexpress Nicaragua", code: "16568", restaurant: "CDP", issue: "28 oct 2026", due: "4 nov 2026", amount: 4620.2, status: "Pendiente", category: "Insumos" },
  { id: "FAC-16533", supplier: "Aexpress Nicaragua", code: "16533", restaurant: "CDP", issue: "26 oct 2026", due: "2 nov 2026", amount: 24280, status: "En proceso", category: "Insumos" },
  { id: "FAC-16521", supplier: "Distribuidora del Norte", code: "16521", restaurant: "DF · Aji", issue: "25 oct 2026", due: "1 nov 2026", amount: 18750, status: "Vencida", category: "Alimentos" },
  { id: "FAC-16485", supplier: "Aexpress Nicaragua", code: "16485", restaurant: "CDP", issue: "23 oct 2026", due: "30 oct 2026", amount: 27320, status: "Pendiente", category: "Insumos" },
  { id: "FAC-0926", supplier: "Alcaldía de Managua", code: "0926-BC", restaurant: "BC", issue: "1 sep 2026", due: "30 sep 2026", amount: 50000, status: "Vencida", category: "Impuestos" },
  { id: "FAC-0926-2", supplier: "Alcaldía de Managua", code: "0926-DF", restaurant: "DF · Aji", issue: "1 sep 2026", due: "30 sep 2026", amount: 35000, status: "En proceso", category: "Impuestos" },
  { id: "FAC-16402", supplier: "Empaques Central", code: "16402", restaurant: "BC · VF", issue: "20 oct 2026", due: "27 oct 2026", amount: 12890, status: "Pagada", category: "Empaques" },
  { id: "FAC-16388", supplier: "Lácteos La Vaquita", code: "16388", restaurant: "BC · LC", issue: "18 oct 2026", due: "25 oct 2026", amount: 9720, status: "Pagada", category: "Alimentos" },
  { id: "FAC-16370", supplier: "Servicios Eléctricos SA", code: "16370", restaurant: "CDP", issue: "15 oct 2026", due: "22 oct 2026", amount: 21400, status: "Pendiente", category: "Servicios" },
  { id: "FAC-16351", supplier: "Distribuidora del Norte", code: "16351", restaurant: "DF · Aji", issue: "12 oct 2026", due: "19 oct 2026", amount: 15680, status: "Vencida", category: "Alimentos" },
  { id: "FAC-16330", supplier: "Panadería San Juan", code: "16330", restaurant: "BC", issue: "9 oct 2026", due: "16 oct 2026", amount: 8140, status: "Pagada", category: "Alimentos" },
  { id: "FAC-16312", supplier: "Empaques Central", code: "16312", restaurant: "BC · VF", issue: "7 oct 2026", due: "14 oct 2026", amount: 11200, status: "Pendiente", category: "Empaques" },
]
const suppliers: Row[] = [
  { code: "PRV-001", name: "Aexpress Nicaragua", id: "J0310000001245", invoices: 18, balance: 56220.2, bank: "BAC · •• 4821", state: "Activo" },
  { code: "PRV-002", name: "Alcaldía de Managua", id: "RUC-001290", invoices: 4, balance: 170000, bank: "LAFISE · •• 1930", state: "Activo" },
  { code: "PRV-003", name: "Distribuidora del Norte", id: "J0410000003091", invoices: 12, balance: 34430, bank: "BAC · •• 1204", state: "Activo" },
  { code: "PRV-004", name: "Empaques Central", id: "J0310000004182", invoices: 9, balance: 24090, bank: "Ficohsa · •• 7710", state: "Activo" },
  { code: "PRV-005", name: "Lácteos La Vaquita", id: "J0110000000512", invoices: 7, balance: 0, bank: "LAFISE · •• 2271", state: "Activo" },
  { code: "PRV-006", name: "Servicios Eléctricos SA", id: "J0310000008014", invoices: 3, balance: 21400, bank: "BAC · •• 6041", state: "Activo" },
]
const payments: Row[] = [
  { ref: "TRF-00841", supplier: "Empaques Central", restaurant: "BC · VF", date: "4 nov 2026", method: "Transferencia", amount: 12890, status: "Completada" },
  { ref: "TRF-00840", supplier: "Lácteos La Vaquita", restaurant: "BC · LC", date: "3 nov 2026", method: "Transferencia", amount: 9720, status: "Completada" },
  { ref: "TRF-00839", supplier: "Aexpress Nicaragua", restaurant: "CDP", date: "2 nov 2026", method: "Transferencia", amount: 8500, status: "En proceso" },
  { ref: "TRF-00838", supplier: "Panadería San Juan", restaurant: "BC", date: "31 oct 2026", method: "Cheque", amount: 8140, status: "Completada" },
  { ref: "TRF-00837", supplier: "Distribuidora del Norte", restaurant: "DF · Aji", date: "30 oct 2026", method: "Transferencia", amount: 12600, status: "Completada" },
]
const loans: Row[] = [
  { bank: "BAC", number: "9338781", holder: "Loyrethe Talavera", opened: "20 feb 2024", rate: "8.75%", installment: 388.31, balance: 9538.84, date: "1 de cada mes" },
  { bank: "LAFISE Panamá", number: "110050002815", holder: "Krystian Vilchez", opened: "6 mar 2024", rate: "5.00%", installment: 198, balance: 46000, date: "6 de cada mes" },
  { bank: "LAFISE Nicaragua", number: "102171308", holder: "Krystian Vilchez", opened: "18 ene 2023", rate: "14.00%", installment: 322.29, balance: 1974.12, date: "11 de cada mes" },
  { bank: "Ficohsa", number: "46233", holder: "Elman Valle / Francisco Delvie", opened: "11 abr 2023", rate: "19.22%", installment: 377.24, balance: 5847.57, date: "11 de cada mes" },
]
const teamUsers: Row[] = [
  { initials: "MG", name: "María Gutiérrez", email: "maria@grupobuensabor.com", role: "Tesorería", access: "Pagos y transferencias", restaurants: "Todos", state: "Activo" },
  { initials: "CM", name: "Carlos Mendoza", email: "carlos@grupobuensabor.com", role: "Contabilidad", access: "Facturas y proveedores", restaurants: "Todos", state: "Activo" },
  { initials: "AL", name: "Ana López", email: "ana@grupobuensabor.com", role: "Gerencia", access: "Consulta y aprobación", restaurants: "Todos", state: "Activo" },
  { initials: "ER", name: "Ernesto Ruiz", email: "ernesto@grupobuensabor.com", role: "Tesorería", access: "Pagos y transferencias", restaurants: "CDP · BC", state: "Activo" },
]
const activity: Row[] = [
  { who: "María Gutiérrez", initials: "MG", action: "Registró un pago", detail: "TRF-00841 · Empaques Central", date: "Hoy, 10:42 a. m." },
  { who: "Carlos Mendoza", initials: "CM", action: "Actualizó factura", detail: "FAC-16533 · estado En proceso", date: "Hoy, 9:18 a. m." },
  { who: "Ana López", initials: "AL", action: "Importó 12 facturas", detail: "Carga noviembre_proveedores.xlsx", date: "Ayer, 4:36 p. m." },
  { who: "María Gutiérrez", initials: "MG", action: "Creó proveedor", detail: "PRV-006 · Servicios Eléctricos SA", date: "Ayer, 2:11 p. m." },
]
const nav: { name: Section; icon: typeof LayoutDashboard }[] = [
  { name: "Resumen", icon: LayoutDashboard }, { name: "Facturas", icon: FileText }, { name: "Proveedores", icon: Users },
  { name: "Transferencias", icon: ArrowLeftRight }, { name: "Préstamos", icon: HandCoins }, { name: "Bitácora", icon: Activity }, { name: "Usuarios y roles", icon: ShieldCheck }, { name: "Mi perfil", icon: UserRound },
]
const money = (value: number) => `C$${value.toLocaleString("es-NI", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export function AccountsPayableApp() {
  const [section, setSection] = useState<Section>("Resumen")
  const [invoices, setInvoices] = useState(initialInvoices)
  const [supplierRecords, setSupplierRecords] = useState(suppliers)
  const [paymentRecords, setPaymentRecords] = useState(payments)
  const [loanRecords, setLoanRecords] = useState(loans)
  const [logs, setLogs] = useState(activity)
  const [users, setUsers] = useState(teamUsers)
  const [modal, setModal] = useState<"invoice" | "supplier" | "payment" | "loan" | "import" | null>(null)
  const [rowDialog, setRowDialog] = useState<{ target: Section; row: Row; mode: "view" | "edit" } | null>(null)
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState("Todos los estados")
  const [dateType, setDateType] = useState("Ingreso")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [page, setPage] = useState(1)
  const [toast, setToast] = useState("")
  const [mobileOpen, setMobileOpen] = useState(false)
  const pageSize = 6
  const showToast = (message: string) => { setToast(message); window.setTimeout(() => setToast(""), 3000) }
  const invoicesFiltered = useMemo(() => invoices.filter((item) => {
    const matchesSearch = `${item.supplier} ${item.code} ${item.restaurant} ${item.id}`.toLowerCase().includes(search.toLowerCase())
    const matchesStatus = filter === "Todos los estados" || item.status === filter
    return matchesSearch && matchesStatus
  }), [invoices, search, filter])
  const addInvoice = (data: FormData) => {
    const item: Invoice = {
      id: `FAC-${String(Date.now()).slice(-5)}`, supplier: String(data.get("supplier")), code: String(data.get("number")), restaurant: String(data.get("restaurant")), issue: String(data.get("issue")), due: String(data.get("due")), amount: Number(data.get("amount")), status: "Pendiente", category: "General", dateCreated: new Date().toISOString().slice(0, 10),
    }
    setInvoices((current) => [item, ...current]); setLogs((current) => [{ who: "María Gutiérrez", initials: "MG", action: "Creó una factura", detail: `${item.id} · ${item.supplier}`, date: "Ahora" }, ...current]); setModal(null); setSection("Facturas"); showToast("Factura creada correctamente")
  }
  const addSupplier = (data: FormData) => { const name = String(data.get("name")); const code = String(data.get("code")); setSupplierRecords((current) => [{ code, name, id: String(data.get("taxId") || "—"), invoices: 0, balance: 0, bank: data.get("bank") ? `${data.get("bank")} · cuenta registrada` : "Sin cuenta registrada", state: "Activo" }, ...current]); setModal(null); setLogs((current) => [{ who: "María Gutiérrez", initials: "MG", action: "Creó un proveedor", detail: `${name} · ${code}`, date: "Ahora" }, ...current]); setSection("Proveedores"); showToast("Proveedor registrado correctamente") }
  const addPayment = (data: FormData) => { const record = { ref: String(data.get("reference")), supplier: String(data.get("supplier")), restaurant: String(data.get("restaurant")), date: String(data.get("date")), method: String(data.get("method")), amount: Number(data.get("amount")), status: "Completada" }; setPaymentRecords((current) => [record, ...current]); setModal(null); setLogs((current) => [{ who: "María Gutiérrez", initials: "MG", action: "Registró una transferencia", detail: `${record.ref} · ${record.supplier}`, date: "Ahora" }, ...current]); setSection("Transferencias"); showToast("Transferencia registrada correctamente") }
  const addLoan = (data: FormData) => { const record = { bank: String(data.get("bank")), number: String(data.get("number")), holder: String(data.get("holder")), opened: String(data.get("opened")), rate: `${data.get("rate")}%`, installment: Number(data.get("installment")), balance: Number(data.get("balance")), date: `${data.get("payday")} de cada mes` }; setLoanRecords((current) => [record, ...current]); setModal(null); setLogs((current) => [{ who: "María Gutiérrez", initials: "MG", action: "Registró un préstamo", detail: `${record.bank} · ${record.number}`, date: "Ahora" }, ...current]); showToast("Préstamo registrado correctamente") }
  const importFile = async (file?: File) => {
    if (!file) return
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true })
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" })
      const imported = rows.map((row, index) => {
        const normalized: Record<string, unknown> = {}
        Object.entries(row).forEach(([key, value]) => { normalized[key.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "")] = value })
        const pick = (...keys: string[]) => { for (const key of keys) if (normalized[key] !== undefined && normalized[key] !== "") return normalized[key]; return "" }
        const supplier = String(pick("proveedor", "supplier"))
        const code = String(pick("no. factura", "no factura", "numero de factura", "factura", "codigo"))
        const amount = Number(String(pick("monto", "importe", "amount")).replace(/[^\d.-]/g, ""))
        const restaurant = String(pick("restaurante", "restaurant"))
        if (!supplier || !code || !Number.isFinite(amount) || amount <= 0) return null
        const rawDate = pick("fecha emision", "fecha de emision", "emision")
        const dateText = rawDate instanceof Date ? rawDate.toLocaleDateString("es-NI", { day: "numeric", month: "short", year: "numeric" }) : String(rawDate || "—")
        const rawDue = pick("fecha de vencimiento", "vencimiento")
        const dueText = rawDue instanceof Date ? rawDue.toLocaleDateString("es-NI", { day: "numeric", month: "short", year: "numeric" }) : String(rawDue || "—")
        return { id: `FAC-${code}-${index}`, supplier, code, restaurant: restaurant || "CDP", issue: dateText, due: dueText, amount, status: "Pendiente", category: String(pick("categoria", "category") || "General") } as Invoice
      }).filter((item): item is Invoice => item !== null)
      if (!imported.length) { showToast("No se encontraron filas válidas. Revisa proveedor, factura y monto."); return }
      setInvoices((current) => [...imported, ...current]); setLogs((current) => [{ who: "María Gutiérrez", initials: "MG", action: `Importó ${imported.length} facturas`, detail: file.name, date: "Ahora" }, ...current]); setModal(null); setSection("Facturas"); showToast(`${imported.length} facturas importadas; ${rows.length - imported.length} filas omitidas`)
    } catch { showToast("No se pudo leer el archivo. Intenta con una plantilla XLSX válida.") }
  }
  const handleRowAction = (target: Section, row: Row, action: RowAction) => {
    const label = target === "Facturas" ? `${row.supplier} · ${row.code}` : target === "Proveedores" ? `${row.name} · ${row.code}` : target === "Transferencias" ? `${row.ref} · ${row.supplier}` : target === "Préstamos" ? `${row.bank} · ${row.number}` : target === "Usuarios y roles" ? `${row.name} · ${row.email}` : `${row.who} · ${row.action}`
    if (target === "Bitácora") { showToast(action === "view" ? `${label} · ${row.detail} · ${row.date}` : "La bitácora es un registro de solo consulta"); return }
    if (target === "Resumen") return
    if (action === "view" || action === "edit") { setRowDialog({ target, row, mode: action }); return }
    if (action === "delete") {
      if (!window.confirm(`¿Eliminar ${label}? Esta acción no se puede deshacer.`)) return
      if (target === "Facturas") setInvoices((current) => current.filter((item) => item.id !== row.id))
      if (target === "Proveedores") setSupplierRecords((current) => current.filter((item) => item.code !== row.code))
      if (target === "Transferencias") setPaymentRecords((current) => current.filter((item) => item.ref !== row.ref))
      if (target === "Préstamos") setLoanRecords((current) => current.filter((item) => item.number !== row.number))
      if (target === "Usuarios y roles") setUsers((current) => current.filter((item) => item.email !== row.email))
      showToast("Registro eliminado"); return
    }
  }
  const saveRow = (target: Section, original: Row, updated: Row) => {
    const matches = (item: Row) => target === "Facturas" ? item.id === original.id : target === "Proveedores" ? item.code === original.code : target === "Transferencias" ? item.ref === original.ref : target === "Préstamos" ? item.number === original.number : item.email === original.email
    if (target === "Facturas") setInvoices((current) => current.map((item) => matches(item as unknown as Row) ? { ...item, ...updated } as Invoice : item))
    if (target === "Proveedores") setSupplierRecords((current) => current.map((item) => matches(item) ? { ...item, ...updated } : item))
    if (target === "Transferencias") setPaymentRecords((current) => current.map((item) => matches(item) ? { ...item, ...updated } : item))
    if (target === "Préstamos") setLoanRecords((current) => current.map((item) => matches(item) ? { ...item, ...updated } : item))
    if (target === "Usuarios y roles") setUsers((current) => current.map((item) => matches(item) ? { ...item, ...updated } : item))
    setRowDialog(null); showToast("Cambios guardados correctamente")
  }
  const exportInvoices = () => {
    const data = invoicesFiltered.map((row) => ({ Proveedor: row.supplier, Restaurante: row.restaurant, Factura: row.code, "Fecha emisión": row.issue, Vencimiento: row.due, Monto: row.amount, Estado: row.status, Categoría: row.category }))
    const book = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(data), "Facturas"); XLSX.writeFile(book, "cuentas-por-pagar.xlsx"); showToast("Reporte Excel descargado")
  }
  const exportPayments = () => { const book = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(paymentRecords.map((row) => ({ Referencia: row.ref, Proveedor: row.supplier, Restaurante: row.restaurant, Fecha: row.date, Método: row.method, Monto: row.amount, Estado: row.status }))), "Transferencias"); XLSX.writeFile(book, "transferencias.xlsx"); showToast("Reporte de transferencias descargado") }
  const downloadTemplate = () => {
    const book = XLSX.utils.book_new(); const sheet = XLSX.utils.aoa_to_sheet([["Proveedor", "Restaurante", "No. Factura", "Fecha Emisión", "Días de crédito", "Fecha de Vencimiento", "Categoría", "Monto"], ["Aexpress Nicaragua", "CDP", "16569", "2026-11-05", 7, "2026-11-12", "Insumos", 27320]])
    XLSX.utils.book_append_sheet(book, sheet, "Cuentas por pagar"); XLSX.writeFile(book, "plantilla-cuentas-por-pagar.xlsx"); showToast("Plantilla Excel descargada")
  }

  return <div className="app-shell">
    <aside className={`sidebar ${mobileOpen ? "sidebar-open" : ""}`}>
      <div className="brand"><div className="brand-mark"><WalletCards size={20} strokeWidth={2.1} /></div><span>Control<span className="brand-light"> de pagos</span></span><button className="mobile-close" aria-label="Cerrar menú" onClick={() => setMobileOpen(false)}><X size={19} /></button></div>
      <div className="nav-label">MENÚ PRINCIPAL</div>
      <nav className="main-nav" aria-label="Navegación principal">{nav.map(({ name, icon: Icon }) => <button key={name} className={`nav-link ${section === name ? "active" : ""}`} onClick={() => { setSection(name); setMobileOpen(false); setPage(1) }}><Icon size={18} strokeWidth={1.8} /><span>{name}</span>{name === "Facturas" && <span className="nav-count">12</span>}</button>)}</nav>
    </aside>
    {mobileOpen && <button className="mobile-scrim" aria-label="Cerrar menú" onClick={() => setMobileOpen(false)} />}
    <main className="main-area"><header className="topbar"><button className="mobile-menu" aria-label="Abrir menú" onClick={() => setMobileOpen(true)}><Menu size={21} /></button><button className="top-profile" onClick={() => setSection("Mi perfil")} aria-label="Abrir perfil de María Gutiérrez"><span className="avatar avatar-teal">MG</span><span><strong>María Gutiérrez</strong><small>Tesorería</small></span><UserRound size={16} /></button><div className="breadcrumbs"><span>Control de pagos</span><span className="crumb-slash">/</span><strong>{section}</strong></div><div className="top-actions"><label className="global-search"><Search size={16} /><input aria-label="Buscar en el sistema" placeholder="Buscar..." onChange={(e) => { setSearch(e.target.value); if (e.target.value) setSection("Facturas") }} /><kbd>⌘ K</kbd></label><button className="icon-button notification-button" aria-label="Notificaciones" onClick={() => showToast("No tienes notificaciones nuevas")}><Bell size={18} /><i /></button></div></header>
      <div className="page-content">{section === "Resumen" ? <Overview invoices={invoices} onNavigate={setSection} onCreate={() => setModal("invoice")} onImport={() => setModal("import")} /> : <SectionContent section={section} invoices={invoices} suppliers={supplierRecords} payments={paymentRecords} loans={loanRecords} users={users} search={search} setSearch={setSearch} filter={filter} setFilter={(value) => { setFilter(value); setPage(1) }} dateType={dateType} setDateType={setDateType} dateFrom={dateFrom} setDateFrom={setDateFrom} dateTo={dateTo} setDateTo={setDateTo} page={page} setPage={setPage} pageSize={pageSize} onCreate={(kind) => setModal(kind)} onExport={section === "Transferencias" ? exportPayments : exportInvoices} onToast={showToast} onStatus={(id, status) => { setInvoices((current) => current.map((item) => item.id === id ? { ...item, status, paidDate: status === "Pagada" ? new Date().toISOString().slice(0, 10) : undefined } : item)); setLogs((current) => [{ who: "María Gutiérrez", initials: "MG", action: `Marcó factura como ${status.toLowerCase()}`, detail: id, date: "Ahora" }, ...current]); showToast(`Factura marcada como ${status.toLowerCase()}`) }} logs={logs} onAction={handleRowAction} />}</div>
    </main>
    {modal && <Modal kind={modal} onClose={() => setModal(null)} onInvoice={addInvoice} onSupplier={addSupplier} onPayment={addPayment} onLoan={addLoan} onImport={importFile} onTemplate={downloadTemplate} />}
    {rowDialog && <RecordActionModal row={rowDialog.row} mode={rowDialog.mode} onClose={() => setRowDialog(null)} onSave={(updated) => saveRow(rowDialog.target, rowDialog.row, updated)} />}
    {toast && <div className="toast-message" role="status"><Check size={17} />{toast}</div>}
  </div>
}

function Overview({ invoices, onNavigate, onCreate, onImport }: { invoices: Invoice[]; onNavigate: (section: Section) => void; onCreate: () => void; onImport: () => void }) {
  const pending = invoices.filter((item) => item.status !== "Pagada").reduce((sum, item) => sum + item.amount, 0)
  const overdue = invoices.filter((item) => item.status === "Vencida")
  const bars = [34, 52, 43, 67, 54, 79, 57, 68, 47, 75, 61, 89]
  return <><div className="welcome-row"><div><div className="eyebrow"><span className="eyebrow-dot" /> MIÉRCOLES, 4 DE NOVIEMBRE DE 2026</div><h1>Buenos días, María <span className="wave">✳</span></h1><p className="page-subtitle">Aquí tienes el estado de tus cuentas por pagar.</p></div><div className="welcome-actions"><button className="button-secondary" onClick={onImport}><CloudUpload size={16} /> Cargar Excel</button><button className="button-primary" onClick={onCreate}><Plus size={17} /> Nueva factura</button></div></div>
    <div className="restaurant-filter"><Building2 size={15} /><span>Vista de:</span><button>Todos los restaurantes <ChevronDown size={14} /></button><span className="filter-period"><CalendarDays size={14} /> Este mes <ChevronDown size={14} /></span></div>
    <div className="stat-grid"><article className="stat-card"><div className="stat-top"><span className="stat-icon stat-icon-teal"><FileText size={18} /></span><span className="stat-trend positive"><ArrowUpRight size={14} /> 12.8%</span></div><div className="stat-title">Total por pagar</div><div className="stat-value">{money(pending)}</div><div className="stat-foot"><span>vs. mes anterior</span><span className="stat-foot-strong">12 facturas abiertas</span></div></article><article className="stat-card"><div className="stat-top"><span className="stat-icon stat-icon-amber"><CalendarDays size={18} /></span><span className="stat-note">Próximos 7 días</span></div><div className="stat-title">Por vencer pronto</div><div className="stat-value">C$ 51,220<span className="value-cents">.20</span></div><div className="stat-foot"><span>Requieren atención</span><span className="stat-foot-strong amber-text">4 facturas</span></div></article><article className="stat-card"><div className="stat-top"><span className="stat-icon stat-icon-red"><Activity size={18} /></span><span className="stat-trend negative"><ArrowUpRight size={14} /> 2 nuevas</span></div><div className="stat-title">Facturas vencidas</div><div className="stat-value">C$ 69,430<span className="value-cents">.00</span></div><div className="stat-foot"><span>Pendiente de pago</span><span className="stat-foot-strong danger-text">3 facturas</span></div></article><article className="stat-card"><div className="stat-top"><span className="stat-icon stat-icon-blue"><ArrowLeftRight size={18} /></span><span className="stat-note">Este mes</span></div><div className="stat-title">Pagado hasta hoy</div><div className="stat-value">C$ 128,640<span className="value-cents">.00</span></div><div className="stat-foot"><span>18 transferencias</span><span className="stat-foot-strong">Ver reporte <ArrowUpRight size={12} /></span></div></article></div>
    <div className="overview-grid"><section className="panel chart-panel"><div className="panel-heading"><div><h2>Flujo de cuentas</h2><p>Resumen de entradas y pagos</p></div><button className="select-button">Últimos 12 meses <ChevronDown size={14} /></button></div><div className="chart-legend"><span><i className="legend-dot legend-teal" /> Facturado</span><span><i className="legend-dot legend-sand" /> Pagado</span></div><div className="chart-wrap"><div className="chart-y-labels"><span>C$ 200k</span><span>C$ 150k</span><span>C$ 100k</span><span>C$ 50k</span><span>C$ 0</span></div><div className="bar-chart">{bars.map((height, index) => <div className="bar-group" key={index}><div className="bar-pair"><span className="bar bar-invoice" style={{ height: `${height}%` }} /><span className="bar bar-paid" style={{ height: `${Math.max(19, height - 21)}%` }} /></div><span className="bar-label">{["D", "E", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N"][index]}</span></div>)}</div></div></section><section className="panel restaurant-panel"><div className="panel-heading"><div><h2>Por restaurante</h2><p>Saldo pendiente de pago</p></div><button className="icon-button small-icon" aria-label="Más opciones"><MoreHorizontal size={18} /></button></div><div className="restaurant-list">{[{ name: "Distrito Federal · Aji", alias: "DF · Aji", amount: 154430, color: "#d99751", total: "32%" }, { name: "Café de París", alias: "CDP", amount: 98640, color: "#4d9282", total: "25%" }, { name: "Bistro Central · La Casona", alias: "BC · LC", amount: 72420, color: "#7897b8", total: "19%" }, { name: "Bistro Central · Villa Fontana", alias: "BC · VF", amount: 54220, color: "#a38bb7", total: "14%" }, { name: "Bistro Central", alias: "BC", amount: 38840, color: "#c28178", total: "10%" }].map((item) => <div className="restaurant-row" key={item.alias}><div className="restaurant-info"><span className="restaurant-dot" style={{ backgroundColor: item.color }} /><span className="restaurant-name">{item.name}</span><span className="restaurant-total">{item.total}</span></div><div className="restaurant-track"><span style={{ width: item.total, backgroundColor: item.color }} /></div><div className="restaurant-amount">{money(item.amount)}</div></div>)}</div></section></div>
    <section className="panel invoices-panel"><div className="panel-heading invoices-heading"><div><h2>Facturas recientes</h2><p>Revisa las últimas cuentas registradas</p></div><button className="text-button" onClick={() => onNavigate("Facturas")}>Ver todas las facturas <ArrowUpRight size={15} /></button></div><InvoiceTable invoices={invoices.slice(0, 5)} compact onStatus={() => {}} /></section>
    <div className="bottom-grid"><section className="attention-card"><div className="attention-icon"><CalendarDays size={18} /></div><div><strong>{overdue.length} facturas necesitan tu atención</strong><p>Hay pagos vencidos que requieren seguimiento.</p></div><button onClick={() => onNavigate("Facturas")}>Revisar <ArrowUpRight size={15} /></button></section><section className="activity-mini"><div className="activity-mini-heading"><div><h2>Actividad reciente</h2><p>Últimos movimientos del equipo</p></div><button className="text-button" onClick={() => onNavigate("Bitácora")}>Ver bitácora <ArrowUpRight size={14} /></button></div><div className="activity-mini-row"><div className="avatar avatar-small">MG</div><div><strong>María registró un pago</strong><span>TRF-00841 · hace 18 min</span></div><Check size={16} /></div></section></div>
  </>
}
