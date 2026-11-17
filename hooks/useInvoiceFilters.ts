"use client";
import { useMemo } from "react";
import type { Invoice } from "../types";

export function useInvoiceFilters(invoices: Invoice[], search: string, statusFilter: string) {
  return useMemo(() => invoices.filter((item) => {
    const matchesSearch = `${item.supplier} ${item.code} ${item.restaurant} ${item.id}`
      .toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "Todos los estados" || item.status === statusFilter;
    return matchesSearch && matchesStatus;
  }), [invoices, search, statusFilter]);
}
