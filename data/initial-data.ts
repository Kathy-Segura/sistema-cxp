import type { Invoice, Row } from "../types";

export const initialInvoices: Invoice[] = [
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
export const suppliers: Row[] = [
  { code: "PRV-001", name: "Aexpress Nicaragua", id: "J0310000001245", invoices: 18, balance: 56220.2, bank: "BAC · •• 4821", state: "Activo" },
  { code: "PRV-002", name: "Alcaldía de Managua", id: "RUC-001290", invoices: 4, balance: 170000, bank: "LAFISE · •• 1930", state: "Activo" },
  { code: "PRV-003", name: "Distribuidora del Norte", id: "J0410000003091", invoices: 12, balance: 34430, bank: "BAC · •• 1204", state: "Activo" },
  { code: "PRV-004", name: "Empaques Central", id: "J0310000004182", invoices: 9, balance: 24090, bank: "Ficohsa · •• 7710", state: "Activo" },
  { code: "PRV-005", name: "Lácteos La Vaquita", id: "J0110000000512", invoices: 7, balance: 0, bank: "LAFISE · •• 2271", state: "Activo" },
  { code: "PRV-006", name: "Servicios Eléctricos SA", id: "J0310000008014", invoices: 3, balance: 21400, bank: "BAC · •• 6041", state: "Activo" },
]
export const payments: Row[] = [
  { ref: "TRF-00841", supplier: "Empaques Central", restaurant: "BC · VF", date: "4 nov 2026", method: "Transferencia", amount: 12890, status: "Completada" },
  { ref: "TRF-00840", supplier: "Lácteos La Vaquita", restaurant: "BC · LC", date: "3 nov 2026", method: "Transferencia", amount: 9720, status: "Completada" },
  { ref: "TRF-00839", supplier: "Aexpress Nicaragua", restaurant: "CDP", date: "2 nov 2026", method: "Transferencia", amount: 8500, status: "En proceso" },
  { ref: "TRF-00838", supplier: "Panadería San Juan", restaurant: "BC", date: "31 oct 2026", method: "Cheque", amount: 8140, status: "Completada" },
  { ref: "TRF-00837", supplier: "Distribuidora del Norte", restaurant: "DF · Aji", date: "30 oct 2026", method: "Transferencia", amount: 12600, status: "Completada" },
]
export const loans: Row[] = [
  { bank: "BAC", number: "9338781", holder: "Loyrethe Talavera", opened: "20 feb 2024", rate: "8.75%", installment: 388.31, balance: 9538.84, date: "1 de cada mes" },
  { bank: "LAFISE Panamá", number: "110050002815", holder: "Krystian Vilchez", opened: "6 mar 2024", rate: "5.00%", installment: 198, balance: 46000, date: "6 de cada mes" },
  { bank: "LAFISE Nicaragua", number: "102171308", holder: "Krystian Vilchez", opened: "18 ene 2023", rate: "14.00%", installment: 322.29, balance: 1974.12, date: "11 de cada mes" },
  { bank: "Ficohsa", number: "46233", holder: "Elman Valle / Francisco Delvie", opened: "11 abr 2023", rate: "19.22%", installment: 377.24, balance: 5847.57, date: "11 de cada mes" },
]
export const teamUsers: Row[] = [
  { initials: "MG", name: "María Gutiérrez", email: "maria@grupobuensabor.com", role: "Tesorería", access: "Pagos y transferencias", restaurants: "Todos", state: "Activo" },
  { initials: "CM", name: "Carlos Mendoza", email: "carlos@grupobuensabor.com", role: "Contabilidad", access: "Facturas y proveedores", restaurants: "Todos", state: "Activo" },
  { initials: "AL", name: "Ana López", email: "ana@grupobuensabor.com", role: "Gerencia", access: "Consulta y aprobación", restaurants: "Todos", state: "Activo" },
  { initials: "ER", name: "Ernesto Ruiz", email: "ernesto@grupobuensabor.com", role: "Tesorería", access: "Pagos y transferencias", restaurants: "CDP · BC", state: "Activo" },
]
export const activity: Row[] = [
  { who: "María Gutiérrez", initials: "MG", action: "Registró un pago", detail: "TRF-00841 · Empaques Central", date: "Hoy, 10:42 a. m." },
  { who: "Carlos Mendoza", initials: "CM", action: "Actualizó factura", detail: "FAC-16533 · estado En proceso", date: "Hoy, 9:18 a. m." },
  { who: "Ana López", initials: "AL", action: "Importó 12 facturas", detail: "Carga noviembre_proveedores.xlsx", date: "Ayer, 4:36 p. m." },
  { who: "María Gutiérrez", initials: "MG", action: "Creó proveedor", detail: "PRV-006 · Servicios Eléctricos SA", date: "Ayer, 2:11 p. m." },
]

