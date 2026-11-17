export type Section = "Resumen" | "Facturas" | "Proveedores" | "Transferencias" | "Préstamos" | "Bitácora" | "Usuarios y roles" | "Mi perfil";
export type Invoice = { id: string; supplier: string; code: string; restaurant: string; issue: string; due: string; amount: number; status: string; category: string; dateCreated?: string; paidDate?: string };
export type Row = Record<string, string | number>;
export type RowAction = "view" | "edit" | "delete";
export type ModalKind = "invoice" | "supplier" | "payment" | "loan" | "import";
