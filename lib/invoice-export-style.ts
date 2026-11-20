import * as XLSX from "xlsx";

function appendStyle(xml: string, group: "fonts" | "fills" | "cellXfs", entry: string) {
  let index = -1;
  const section = new RegExp(`<${group} count="(\\d+)">([\\s\\S]*?)</${group}>`);
  const updated = xml.replace(section, (_match, count, content) => {
    index = Number(count);
    return `<${group} count="${index + 1}">${content}${entry}</${group}>`;
  });
  if (index < 0) throw new Error("No se encontró el estilo de los encabezados de Excel.");
  return { xml: updated, index };
}

export function invoiceExportBytes(workbook: XLSX.WorkBook) {
  // SheetJS CE writes the data and number formats. Add a shared header style to
  // the generated single-sheet XLSX without rewriting any data cells.
  const source = XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
  const archive = XLSX.CFB.read(new Uint8Array(source), { type: "array" });
  const styles = XLSX.CFB.find(archive, "/xl/styles.xml");
  const sheet = XLSX.CFB.find(archive, "/xl/worksheets/sheet1.xml");
  if (!styles?.content || !sheet?.content) throw new Error("No se encontraron los encabezados del reporte Excel.");
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  const font = appendStyle(decoder.decode(Uint8Array.from(styles.content)), "fonts",
    '<font><b/><sz val="12"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>');
  const fill = appendStyle(font.xml, "fills",
    '<fill><patternFill patternType="solid"><fgColor rgb="FF17365D"/><bgColor indexed="64"/></patternFill></fill>');
  const header = appendStyle(fill.xml, "cellXfs",
    `<xf numFmtId="0" fontId="${font.index}" fillId="${fill.index}" borderId="0" xfId="0" applyFont="1" applyFill="1"/>`);
  styles.content = encoder.encode(header.xml);
  styles.size = styles.content.length;
  const worksheet = decoder.decode(Uint8Array.from(sheet.content));
  const firstRow = /<row\b[^>]*\br="1"[^>]*>[\s\S]*?<\/row>/;
  if (!firstRow.test(worksheet)) throw new Error("El reporte Excel no tiene fila de encabezados.");
  sheet.content = encoder.encode(worksheet.replace(firstRow, (row) =>
    row.replace(/<c\b[^>]*>/g, (cell) => cell.replace(/\s+s="\d+"/, "").replace(/>$/, ` s="${header.index}">`))));
  sheet.size = sheet.content.length;
  return Uint8Array.from(XLSX.CFB.write(archive, { type: "array", fileType: "zip", compression: true }));
}

export function downloadInvoiceWorkbook(workbook: XLSX.WorkBook, filename: string) {
  const url = URL.createObjectURL(new Blob([invoiceExportBytes(workbook)], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
