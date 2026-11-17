import type { Section } from "../types";
export const PAGE_SIZE = 6;
export const DEFAULT_STATUS_FILTER = "Todos los estados";
export const DEFAULT_DATE_TYPE = "Ingreso";
export const PROFILE_NAME = "María Gutiérrez";
export const PROFILE_INITIALS = "MG";
export const PROFILE_ROLE = "Tesorería";
export const SECTIONS = ["Resumen", "Facturas", "Proveedores", "Transferencias", "Préstamos", "Bitácora", "Usuarios y roles", "Mi perfil"] as const satisfies readonly Section[];
