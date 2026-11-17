export const money = (value: number) =>
  `C$${value.toLocaleString("es-NI", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const toIsoDate = (value?: string) => {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const match = value.toLowerCase().match(/(\d{1,2})\s+([a-záéíóú.]+)\s+(\d{4})/);
  if (!match) return "";
  const months: Record<string, string> = {
    ene: "01", feb: "02", mar: "03", abr: "04", may: "05", jun: "06",
    jul: "07", ago: "08", sep: "09", oct: "10", nov: "11", dic: "12",
  };
  const month = months[match[2].slice(0, 3)];
  return month ? `${match[3]}-${month}-${match[1].padStart(2, "0")}` : "";
};

export const normalizeExcelHeader = (key: string) =>
  key.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
