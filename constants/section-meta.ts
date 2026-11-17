import {
  ArrowLeftRight,
  FileText,
  HandCoins,
  ShieldCheck,
  Users,
  WalletCards,
} from "lucide-react";
import type { Section } from "../types";
export const sectionsMeta: Record<
  Exclude<Section, "Resumen" | "Mi perfil">,
  { title: string; description: string; icon: any }
> = {
  Facturas: {
    title: "Facturas por pagar",
    description:
      "Administra y da seguimiento a las facturas de tus proveedores.",
    icon: FileText,
  },
  Proveedores: {
    title: "Proveedores",
    description: "Directorio de proveedores y sus cuentas por pagar asociadas.",
    icon: Users,
  },
  Transferencias: {
    title: "Pagos y transferencias",
    description:
      "Consulta los pagos realizados y registra nuevas transferencias.",
    icon: ArrowLeftRight,
  },
  Préstamos: {
    title: "Préstamos",
    description: "Controla saldos, cuotas mensuales y fechas de pago.",
    icon: HandCoins,
  },
  Bitácora: {
    title: "Bitácora de actividad",
    description: "Historial de acciones y cambios realizados por el equipo.",
    icon: WalletCards,
  },
  "Usuarios y roles": {
    title: "Usuarios y permisos",
    description:
      "Define quién puede consultar, registrar o aprobar las operaciones.",
    icon: ShieldCheck,
  },
};
