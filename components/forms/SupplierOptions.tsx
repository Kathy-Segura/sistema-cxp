import type { ProveedorRecord } from "../../types";

export function SupplierOptions({ providers }: { providers: ProveedorRecord[] }) {
  return [...providers]
    .sort((a, b) => (a.nombre_legal || "").localeCompare(b.nombre_legal || "", "es"))
    .map((provider) => (
      <option key={provider.proveedor_id} value={provider.proveedor_id}>
        {provider.nombre_legal || provider.proveedor_id} · {provider.codigo_proveedor || provider.proveedor_id}
      </option>
    ));
}
