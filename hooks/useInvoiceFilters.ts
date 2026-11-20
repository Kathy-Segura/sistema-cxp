"use client";
import { useMemo } from "react";
import type { Invoice } from "../types";
import { isoDate, toIsoDate } from "../utils/formatters";

export function useInvoiceFilters(
  invoices: Invoice[], search: string, statusFilter: string, restaurant: string,
  dateType: string, dateFrom: string, dateTo: string,
) {
  return useMemo(() => invoices.filter((item) => {
    const matchesSearch = `${item.supplier} ${item.code} ${item.restaurant} ${item.id}`
      .toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "Todos los estados" || item.status === statusFilter;
    const dateValue = dateType === "Pago" ? item.paidDate :
      dateType === "Emisión" ? item.issue : item.dateCreated || item.issue;
    const date = isoDate(dateValue) || toIsoDate(dateValue);
    return matchesSearch && matchesStatus &&
      (restaurant === "Todos los restaurantes" || item.restaurant === restaurant) &&
      (!dateFrom || (date && date >= dateFrom)) && (!dateTo || (date && date <= dateTo));
  }), [invoices, search, statusFilter, restaurant, dateType, dateFrom, dateTo]);
}
