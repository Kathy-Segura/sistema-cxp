import {
  Activity,
  ArrowLeftRight,
  FileText,
  HandCoins,
  LayoutDashboard,
  ShieldCheck,
  UserRound,
  Users,
} from "lucide-react";
import type { Section } from "../types";

export const nav: { name: Section; icon: typeof LayoutDashboard }[] = [
  { name: "Resumen", icon: LayoutDashboard },
  { name: "Facturas", icon: FileText },
  { name: "Proveedores", icon: Users },
  { name: "Transferencias", icon: ArrowLeftRight },
  { name: "Préstamos", icon: HandCoins },
 // { name: "Bitácora", icon: Activity },
 // { name: "Usuarios y roles", icon: ShieldCheck },
];
