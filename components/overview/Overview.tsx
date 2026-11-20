"use client";
import { Activity, Building2, ArrowLeftRight, ArrowUpRight, CalendarDays,
  Check, ChevronDown, CloudUpload, FileText, MoreHorizontal, Plus,
} from "lucide-react";

import type { Invoice, Section } from "../../types";
import { money } from "../../utils/formatters";
import { InvoiceTable } from "../tables/InvoiceTable";

export function Overview({
  invoices,
  onNavigate,
  onCreate,
  onImport,
}: {
  invoices: Invoice[];
  onNavigate: (section: Section) => void;
  onCreate: () => void;
  onImport: () => void;
}) {
  const pending = invoices
    .filter((item) => item.status !== "Pagada")
    .reduce((sum, item) => sum + (item.pendingBalance ?? item.amount), 0);
  const overdue = invoices.filter((item) => item.status === "Vencida");
  const bars = [34, 52, 43, 67, 54, 79, 57, 68, 47, 75, 61, 89];
  return (
    <>
      <div className="welcome-row">
        <div>
          <div className="eyebrow">
            <span className="eyebrow-dot" /> MIÉRCOLES, 4 DE NOVIEMBRE DE 2026
          </div>
          <h1>
            Analisís de cuentas por pagar
          </h1>
          <p className="page-subtitle">
            Aquí tienes el estado de tus cuentas por pagar.
          </p>
        </div>
        <div className="welcome-actions">
          <button className="button-secondary" onClick={onImport}>
            <CloudUpload size={16} /> Cargar Excel
          </button>
          <button className="button-primary" onClick={onCreate}>
            <Plus size={17} /> Nueva factura
          </button>
        </div>
      </div>
      <div className="restaurant-filter">
        <Building2 size={15} />
        <span>Vista de:</span>
        <button>
          Todos los restaurantes <ChevronDown size={14} />
        </button>
        <span className="filter-period">
          <CalendarDays size={14} /> Este mes <ChevronDown size={14} />
        </span>
      </div>
      <div className="stat-grid">
        <article className="stat-card">
          <div className="stat-top">
            <span className="stat-icon stat-icon-teal">
              <FileText size={18} />
            </span>
            <span className="stat-trend positive">
              <ArrowUpRight size={14} /> 12.8%
            </span>
          </div>
          <div className="stat-title">Total por pagar</div>
          <div className="stat-value">{money(pending)}</div>
          <div className="stat-foot">
            <span>vs. mes anterior</span>
            <span className="stat-foot-strong">12 facturas abiertas</span>
          </div>
        </article>
        <article className="stat-card">
          <div className="stat-top">
            <span className="stat-icon stat-icon-amber">
              <CalendarDays size={18} />
            </span>
            <span className="stat-note">Próximos 7 días</span>
          </div>
          <div className="stat-title">Por vencer pronto</div>
          <div className="stat-value">
            C$ 51,220<span className="value-cents">.20</span>
          </div>
          <div className="stat-foot">
            <span>Requieren atención</span>
            <span className="stat-foot-strong amber-text">4 facturas</span>
          </div>
        </article>
        <article className="stat-card">
          <div className="stat-top">
            <span className="stat-icon stat-icon-red">
              <Activity size={18} />
            </span>
            <span className="stat-trend negative">
              <ArrowUpRight size={14} /> 2 nuevas
            </span>
          </div>
          <div className="stat-title">Facturas vencidas</div>
          <div className="stat-value">
            C$ 69,430<span className="value-cents">.00</span>
          </div>
          <div className="stat-foot">
            <span>Pendiente de pago</span>
            <span className="stat-foot-strong danger-text">3 facturas</span>
          </div>
        </article>
        <article className="stat-card">
          <div className="stat-top">
            <span className="stat-icon stat-icon-blue">
              <ArrowLeftRight size={18} />
            </span>
            <span className="stat-note">Este mes</span>
          </div>
          <div className="stat-title">Pagado hasta hoy</div>
          <div className="stat-value">
            C$ 128,640<span className="value-cents">.00</span>
          </div>
          <div className="stat-foot">
            <span>18 transferencias</span>
            <span className="stat-foot-strong">
              Ver reporte <ArrowUpRight size={12} />
            </span>
          </div>
        </article>
      </div>
      <div className="overview-grid">
        <section className="panel chart-panel">
          <div className="panel-heading">
            <div>
              <h2>Flujo de cuentas</h2>
              <p>Resumen de entradas y pagos</p>
            </div>
            <button className="select-button">
              Últimos 12 meses <ChevronDown size={14} />
            </button>
          </div>
          <div className="chart-legend">
            <span>
              <i className="legend-dot legend-teal" /> Facturado
            </span>
            <span>
              <i className="legend-dot legend-sand" /> Pagado
            </span>
          </div>
          <div className="chart-wrap">
            <div className="chart-y-labels">
              <span>C$ 200k</span>
              <span>C$ 150k</span>
              <span>C$ 100k</span>
              <span>C$ 50k</span>
              <span>C$ 0</span>
            </div>
            <div className="bar-chart">
              {bars.map((height, index) => (
                <div className="bar-group" key={index}>
                  <div className="bar-pair">
                    <span
                      className="bar bar-invoice"
                      style={{ height: `${height}%` }}
                    />
                    <span
                      className="bar bar-paid"
                      style={{ height: `${Math.max(19, height - 21)}%` }}
                    />
                  </div>
                  <span className="bar-label">
                    {
                      [ "D", "E", "F","M","A","M","J","J", "A","S", "O", "N",
                      ][index]
                    }
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>
        <section className="panel restaurant-panel">
          <div className="panel-heading">
            <div>
              <h2>Por restaurante</h2>
              <p>Saldo pendiente de pago</p>
            </div>
            <button
              className="icon-button small-icon"
              aria-label="Más opciones"
            >
              <MoreHorizontal size={18} />
            </button>
          </div>
          <div className="restaurant-list">
            {[
              {
                name: "Distrito Federal · Aji",
                alias: "DF · Aji",
                amount: 154430,
                color: "#d99751",
                total: "32%",
              },
              {
                name: "Café de París",
                alias: "CDP",
                amount: 98640,
                color: "#4d9282",
                total: "25%",
              },
              {
                name: "Bistro Central · La Casona",
                alias: "BC · LC",
                amount: 72420,
                color: "#7897b8",
                total: "19%",
              },
              {
                name: "Bistro Central · Villa Fontana",
                alias: "BC · VF",
                amount: 54220,
                color: "#a38bb7",
                total: "14%",
              },
              {
                name: "Bistro Central",
                alias: "BC",
                amount: 38840,
                color: "#c28178",
                total: "10%",
              },
            ].map((item) => (
              <div className="restaurant-row" key={item.alias}>
                <div className="restaurant-info">
                  <span
                    className="restaurant-dot"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="restaurant-name">{item.name}</span>
                  <span className="restaurant-total">{item.total}</span>
                </div>
                <div className="restaurant-track">
                  <span
                    style={{ width: item.total, backgroundColor: item.color }}
                  />
                </div>
                <div className="restaurant-amount">{money(item.amount)}</div>
              </div>
            ))}
          </div>
        </section>
      </div>
      <section className="panel invoices-panel">
        <div className="panel-heading invoices-heading">
          <div>
            <h2>Facturas recientes</h2>
            <p>Revisa las últimas cuentas registradas</p>
          </div>
          <button
            className="text-button"
            onClick={() => onNavigate("Facturas")}
          >
            Ver todas las facturas <ArrowUpRight size={15} />
          </button>
        </div>
        <InvoiceTable
          invoices={invoices.slice(0, 5)}
          compact
        />
      </section>
      <div className="bottom-grid">
        <section className="attention-card">
          <div className="attention-icon">
            <CalendarDays size={18} />
          </div>
          <div>
            <strong>{overdue.length} facturas necesitan tu atención</strong>
            <p>Hay pagos vencidos que requieren seguimiento.</p>
          </div>
          <button onClick={() => onNavigate("Facturas")}>
            Revisar <ArrowUpRight size={15} />
          </button>
        </section>
        <section className="activity-mini">
          <div className="activity-mini-heading">
            <div>
              <h2>Actividad reciente</h2>
              <p>Últimos movimientos del equipo</p>
            </div>
            <button
              className="text-button"
              onClick={() => onNavigate("Bitácora")}
            >
              Ver bitácora <ArrowUpRight size={14} />
            </button>
          </div>
          <div className="activity-mini-row">
            <div className="avatar avatar-small">MG</div>
            <div>
              <strong>María registró un pago</strong>
              <span>TRF-00841 · hace 18 min</span>
            </div>
            <Check size={16} />
          </div>
        </section>
      </div>
    </>
  );
}
