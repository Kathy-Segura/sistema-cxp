// Sin datos semilla: la aplicación consume Google Sheets mediante /api/accounts-payable.
import type { Invoice, Row } from "../types";

export const initialInvoices: Invoice[] = [];
export const suppliers: Row[] = [];
export const payments: Row[] = [];
export const loans: Row[] = [];
export const teamUsers: Row[] = [];
export const activity: Row[] = [];
