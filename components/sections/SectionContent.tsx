"use client";
import {
  ArrowLeftRight,
  ArrowUpRight,
  CalendarDays,
  ChevronDown,
  CloudUpload,
  FileDown,
  Filter,
  HandCoins,
  Plus,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  X,
} from "lucide-react";
import type { Section, Invoice, Row } from "../../types";
import { sectionsMeta } from "../../constants/section-meta";
import { money } from "../../utils/formatters";
import { InvoiceTable } from "../tables/InvoiceTable";
import { StatusBadge } from "../tables/StatusBadge";
import { Pagination } from "../tables/Pagination";
import { ActionButtons } from "../shared/ActionButtons";
import { ProfileContent } from "../forms/ProfileContent";

export function SectionContent({
  section, invoices, suppliers, payments, loans, users, search, setSearch, filter,
  setFilter, dateType, setDateType, dateFrom, setDateFrom, dateTo, setDateTo,
  restaurantFilter, setRestaurantFilter, restaurantOptions, onClearFilters, page,
  setPage, pageSize, setPageSize, onCreate, onExport, onToast, onPay, logs, onAction,
}: {
  section: Section;
  invoices: Invoice[];
  suppliers: Row[];
  payments: Row[];
  loans: Row[];
  users: Row[];
  search: string;
  setSearch: (value: string) => void;
  filter: string;
  setFilter: (value: string) => void;
  dateType: string;
  setDateType: (value: string) => void;
  dateFrom: string;
  setDateFrom: (value: string) => void;
  dateTo: string;
  setDateTo: (value: string) => void;
  restaurantFilter: string;
  setRestaurantFilter: (value: string) => void;
  restaurantOptions: string[];
  onClearFilters: () => void;
  page: number;
  setPage: (value: number) => void;
  pageSize: number;
  setPageSize: (value: number) => void;
  onCreate: (
    kind: "invoice" | "supplier" | "payment" | "loan" | "import",
  ) => void;
  onExport: () => void;
  onToast: (value: string) => void;
  onPay: (id: string) => void;
  logs: Row[];
  onAction: (
    section: Section,
    row: Row,
    action: "view" | "edit" | "delete",
  ) => void;
}) {
  if (section === "Resumen") return null;
  if (section === "Mi perfil") return <ProfileContent />;
  const meta = sectionsMeta[section];
  const Icon = meta.icon;
  const searchable =
    section === "Facturas" ||
    section === "Proveedores" ||
    section === "Transferencias";
  let rows: Row[] = [];
  if (section === "Facturas") rows = invoices;
  if (section === "Proveedores")
    rows = suppliers.filter((row) =>
      `${row.name} ${row.code} ${row.id}`
        .toLowerCase()
        .includes(search.toLowerCase()),
    );
  if (section === "Transferencias")
    rows = payments.filter((row) =>
      `${row.supplier} ${row.ref} ${row.restaurant}`
        .toLowerCase()
        .includes(search.toLowerCase()),
    );
  if (section === "Préstamos") rows = loans;
  if (section === "Bitácora") rows = logs;
  if (section === "Usuarios y roles") rows = users;
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const visibleRows = rows.slice((page - 1) * pageSize, page * pageSize);
  const create = () =>
    onCreate(
      section === "Facturas"
        ? "invoice"
        : section === "Proveedores"
          ? "supplier"
          : section === "Transferencias"
            ? "payment"
            : "loan",
    );
  return (
    <>
      <div className="section-heading">
        <div>
          <div className="section-kicker">
            <Icon size={14} /> GESTIÓN FINANCIERA
          </div>
          <h1>{meta.title}</h1>
          <p className="page-subtitle">{meta.description}</p>
        </div>
        <div className="section-actions">
          {section === "Facturas" && (
            <button
              className="button-secondary"
              onClick={() => onCreate("import")}
            >
              <CloudUpload size={16} /> Importar Excel
            </button>
          )}
          {(section === "Facturas" || section === "Transferencias") && (
            <button className="button-secondary" onClick={onExport}>
              <FileDown size={16} /> Exportar
            </button>
          )}
          {(section === "Facturas" ||
            section === "Proveedores" ||
            section === "Transferencias" ||
            section === "Préstamos") && (
            <button className="button-primary" onClick={create}>
              <Plus size={17} />{" "}
              {section === "Facturas"
                ? "Nueva factura"
                : section === "Proveedores"
                  ? "Nuevo proveedor"
                  : section === "Transferencias"
                    ? "Registrar pago"
                    : "Nuevo préstamo"}
            </button>
          )}
        </div>
      </div>
      {(section === "Facturas" ||
        section === "Proveedores" ||
        section === "Transferencias") && (
        <div className="filter-bar">
          <label className="table-search">
            <Search size={16} />
            <input
              placeholder={
                section === "Facturas"
                  ? "Buscar proveedor, factura..."
                  : section === "Proveedores"
                    ? "Buscar proveedor..."
                    : "Buscar transferencia..."
              }
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </label>
          {section === "Facturas" && (
            <label className="select-wrap">
              <Filter size={15} />
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              >
                <option>Todos los estados</option>
                <option>Pendiente</option>
                <option>Vencida</option>
                <option>Pagada</option>
              </select>
              <ChevronDown size={14} />
            </label>
          )}
          {section === "Facturas" ? (
            <>
              <label className="date-filter-mode">
                <CalendarDays size={14} />
                <select
                  aria-label="Filtrar fecha por"
                  value={dateType}
                  onChange={(e) => {
                    setDateType(e.target.value);
                    setPage(1);
                  }}
                >
                  <option>Ingreso</option>
                  <option>Emisión</option>
                  <option>Pago</option>
                </select>
                <ChevronDown size={13} />
              </label>
              <label className="date-input">
                <span>Desde</span>
                <input
                  type="date"
                  aria-label="Fecha desde"
                  value={dateFrom}
                  onChange={(e) => {
                    setDateFrom(e.target.value);
                    setPage(1);
                  }}
                />
              </label>
              <label className="date-input">
                <span>Hasta</span>
                <input
                  type="date"
                  aria-label="Fecha hasta"
                  value={dateTo}
                  onChange={(e) => {
                    setDateTo(e.target.value);
                    setPage(1);
                  }}
                />
              </label>
              <label className="select-wrap">
                <SlidersHorizontal size={15} />
                <select
                  aria-label="Filtrar por restaurante"
                  value={restaurantFilter}
                  onChange={(e) => {
                    setRestaurantFilter(e.target.value);
                    setPage(1);
                  }}
                >
                  <option>Todos los restaurantes</option>
                  {restaurantOptions.map((restaurant) => (
                    <option key={restaurant}>{restaurant}</option>
                  ))}
                </select>
                <ChevronDown size={14} />
              </label>
              <button className="filter-button" onClick={onClearFilters}>
                <X size={15} /> Limpiar
              </button>
            </>
          ) : (
            <button
              className="filter-button"
              onClick={() =>
                onToast(
                  "Selecciona un rango de fechas desde el filtro de facturas",
                )
              }
            >
              <CalendarDays size={15} /> Fechas <ChevronDown size={14} />
            </button>
          )}
          <div className="table-count">{rows.length} registros</div>
        </div>
      )}
      {section === "Facturas" && (
        <div className="panel table-panel">
          <InvoiceTable
            invoices={visibleRows as unknown as Invoice[]}
            onPay={onPay}
            onAction={(row, action) => onAction(section, row, action)}
          />
          <Pagination
            page={page}
            pages={totalPages}
            total={rows.length}
            pageSize={pageSize}
            setPage={setPage}
            setPageSize={setPageSize}
          />
        </div>
      )}
      {section === "Proveedores" && (
        <div className="panel table-panel">
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>CÓDIGO / PROVEEDOR</th>
                  <th>IDENTIFICACIÓN</th>
                  <th>FACTURAS</th>
                  <th>CUENTA BANCARIA</th>
                  <th className="align-right">SALDO PENDIENTE</th>
                  <th>ESTADO</th>
                  <th>ACCIONES</th>
                </tr>
              </thead>
              <tbody>
                {(visibleRows as Row[]).map((r) => (
                  <tr key={String(r.code)}>
                    <td>
                      <div className="supplier-cell">
                        <span className="supplier-avatar supplier-avatar-purple">
                          {String(r.name)
                            .split(" ")
                            .map((w) => w[0])
                            .slice(0, 2)
                            .join("")}
                        </span>
                        <span>
                          <strong>{String(r.name)}</strong>
                          <small>{String(r.code)}</small>
                        </span>
                      </div>
                    </td>
                    <td>{String(r.id)}</td>
                    <td>
                      <button
                        className="link-button"
                        onClick={() => {
                          setSearch(String(r.name));
                        }}
                      >
                        {" "}
                        {r.invoices} facturas <ArrowUpRight size={12} />
                      </button>
                    </td>
                    <td>{String(r.bank)}</td>
                    <td className="align-right amount-cell">
                      {money(Number(r.balance))}
                    </td>
                    <td>
                      <StatusBadge status={String(r.state)} />
                    </td>
                    <td>
                      <ActionButtons
                        label={`proveedor ${r.name}`}
                        onAction={(action) => onAction(section, r, action)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={page}
            pages={totalPages}
            total={rows.length}
            pageSize={pageSize}
            setPage={setPage}
          />
        </div>
      )}
      {section === "Transferencias" && (
        <div className="panel table-panel">
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>REFERENCIA</th>
                  <th>PROVEEDOR</th>
                  <th>RESTAURANTE</th>
                  <th>FECHA</th>
                  <th>MÉTODO</th>
                  <th className="align-right">MONTO</th>
                  <th>ESTADO</th>
                  <th>ACCIONES</th>
                </tr>
              </thead>
              <tbody>
                {(visibleRows as Row[]).map((r) => (
                  <tr key={String(r.ref)}>
                    <td className="reference-cell">{String(r.ref)}</td>
                    <td>
                      <strong>{String(r.supplier)}</strong>
                    </td>
                    <td>
                      <span className="restaurant-pill">
                        {String(r.restaurant)}
                      </span>
                    </td>
                    <td>{String(r.date)}</td>
                    <td>
                      <span className="method-icon">
                        <ArrowLeftRight size={14} /> {String(r.method)}
                      </span>
                    </td>
                    <td className="align-right amount-cell">
                      {money(Number(r.amount))}
                    </td>
                    <td>
                      <StatusBadge status={String(r.status)} />
                    </td>
                    <td>
                      <ActionButtons
                        label={`transferencia ${r.ref}`}
                        onAction={(action) => onAction(section, r, action)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={page}
            pages={totalPages}
            total={rows.length}
            pageSize={pageSize}
            setPage={setPage}
          />
        </div>
      )}
      {section === "Préstamos" && (
        <>
          <div className="loan-summary-grid">
            <div className="loan-summary-card">
              <span>Saldo total de préstamos</span>
              <strong>
                {money(rows.reduce((s, r) => s + Number(r.balance), 0))}
              </strong>
              <small>4 préstamos activos</small>
            </div>
            <div className="loan-summary-card">
              <span>Cuotas mensuales</span>
              <strong>
                {money(rows.reduce((s, r) => s + Number(r.installment), 0))}
              </strong>
              <small>Próximo pago: 6 de noviembre</small>
            </div>
            <div className="loan-summary-card">
              <span>Próximas cuotas</span>
              <strong>
                2 <em>este mes</em>
              </strong>
              <small>La próxima vence en 2 días</small>
            </div>
          </div>
          <div className="panel table-panel">
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>BANCO / PRÉSTAMO</th>
                    <th>TITULAR</th>
                    <th>APERTURA</th>
                    <th>TASA</th>
                    <th>PRÓXIMO PAGO</th>
                    <th className="align-right">CUOTA MENSUAL</th>
                    <th className="align-right">SALDO ACTUAL</th>
                    <th>ACCIONES</th>
                  </tr>
                </thead>
                <tbody>
                  {(visibleRows as Row[]).map((r) => (
                    <tr key={String(r.number)}>
                      <td>
                        <div className="supplier-cell">
                          <span className="supplier-avatar supplier-avatar-gold">
                            <HandCoins size={16} />
                          </span>
                          <span>
                            <strong>{String(r.bank)}</strong>
                            <small>N.º {String(r.number)}</small>
                          </span>
                        </div>
                      </td>
                      <td>{String(r.holder)}</td>
                      <td>{String(r.opened)}</td>
                      <td>
                        <span className="rate-pill">
                          {String(r.rate)} anual
                        </span>
                      </td>
                      <td>{String(r.date)}</td>
                      <td className="align-right amount-cell">
                        {money(Number(r.installment))}
                      </td>
                      <td className="align-right amount-cell">
                        {money(Number(r.balance))}
                      </td>
                      <td>
                        <ActionButtons
                          label={`préstamo ${r.number}`}
                          onAction={(action) => onAction(section, r, action)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              page={page}
              pages={totalPages}
              total={rows.length}
              pageSize={pageSize}
              setPage={setPage}
            />
          </div>
        </>
      )}
      {section === "Usuarios y roles" && (
        <>
          <div className="role-summary">
            <div className="role-summary-icon">
              <ShieldCheck size={20} />
            </div>
            <div>
              <strong>Acceso seguro para tu equipo</strong>
              <span>
                Asigna permisos según las responsabilidades de cada persona. Las
                acciones quedan registradas en la bitácora.
              </span>
            </div>
            <span className="role-summary-count">4 usuarios · 3 roles</span>
          </div>
          <div className="panel table-panel">
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>USUARIO</th>
                    <th>ROL</th>
                    <th>PERMISOS</th>
                    <th>RESTAURANTES</th>
                    <th>ESTADO</th>
                    <th>ACCIONES</th>
                  </tr>
                </thead>
                <tbody>
                  {(visibleRows as Row[]).map((r) => (
                    <tr key={String(r.email)}>
                      <td>
                        <div className="supplier-cell">
                          <span className="avatar avatar-small">
                            {String(r.initials)}
                          </span>
                          <span>
                            <strong>{String(r.name)}</strong>
                            <small>{String(r.email)}</small>
                          </span>
                        </div>
                      </td>
                      <td>
                        <span
                          className={`role-pill role-${String(r.role).toLowerCase()}`}
                        >
                          {String(r.role)}
                        </span>
                      </td>
                      <td>{String(r.access)}</td>
                      <td>{String(r.restaurants)}</td>
                      <td>
                        <StatusBadge status={String(r.state)} />
                      </td>
                      <td>
                        <ActionButtons
                          label={`usuario ${r.name}`}
                          onAction={(action) => onAction(section, r, action)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              page={page}
              pages={totalPages}
              total={rows.length}
              pageSize={pageSize}
              setPage={setPage}
            />
          </div>
        </>
      )}
      {section === "Bitácora" && (
        <div className="panel audit-panel">
          <div className="audit-toolbar">
            <div>
              <strong>Registro de actividad</strong>
              <span>Actividad de todos los usuarios del sistema</span>
            </div>
            <button
              className="filter-button"
              onClick={() =>
                onToast("Mostrando actividad de todos los usuarios")
              }
            >
              <CalendarDays size={15} /> Últimos 30 días{" "}
              <ChevronDown size={14} />
            </button>
          </div>
          <div className="audit-list">
            {(visibleRows as Row[]).map((r, i) => (
              <div className="audit-row" key={`${String(r.who)}-${i}`}>
                <div className={`avatar audit-avatar audit-avatar-${i % 3}`}>
                  {String(r.initials)}
                </div>
                <div className="audit-content">
                  <div>
                    <strong>{String(r.who)}</strong>
                    <span>{String(r.action).toLowerCase()}</span>
                  </div>
                  <p>{String(r.detail)}</p>
                </div>
                <time>{String(r.date)}</time>
                <ActionButtons
                  label="registro de actividad"
                  actions={["view"]}
                  onAction={(action) => onAction(section, r, action)}
                />
              </div>
            ))}
          </div>
          <Pagination
            page={page}
            pages={totalPages}
            total={rows.length}
            pageSize={pageSize}
            setPage={setPage}
          />
        </div>
      )}
    </>
  );
}
