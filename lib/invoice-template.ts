import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { CFB } from "xlsx";

const inputPath = "xl/worksheets/sheet1.xml";
const catalogPath = "xl/worksheets/sheet2.xml";
const catalogReference = /Restaurantes!\$A\$2:\$A\$\d+/;
const catalogRows = /(<x:sheetData>\s*<x:row\b[^>]*>[\s\S]*?<\/x:row>)[\s\S]*?(<\/x:sheetData>)/;
const escapeXml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export async function invoiceTemplate(names: string[]) {
  const restaurants = [...new Set(names.map((name) => name.trim()).filter(Boolean))];
  if (restaurants.length === 0) throw new Error("La pestaña restaurantes no tiene nombres disponibles.");
  const template = await readFile(join(process.cwd(), "public", "plantilla-cuentas-por-pagar.xlsx"));
  // Replace the catalog in the XLSX package to preserve the Excel validation and formatting.
  const archive = CFB.read(template, { type: "buffer" });
  const worksheet = (path: string) => {
    const entry = CFB.find(archive, "/" + path);
    if (!entry?.content) throw new Error("La plantilla Excel no contiene las pestañas requeridas.");
    return entry;
  };
  const inputSheet = worksheet(inputPath);
  const catalogSheet = worksheet(catalogPath);
  const input = Buffer.from(inputSheet.content).toString("utf8");
  const catalog = Buffer.from(catalogSheet.content).toString("utf8");
  if (!catalogReference.test(input) || !catalogRows.test(catalog)) {
    throw new Error("La plantilla Excel no contiene el desplegable de restaurantes.");
  }
  const rows = restaurants.map((name, index) => {
    const row = index + 2;
    return `<x:row r="${row}"><x:c r="A${row}" t="str"><x:v>${escapeXml(name)}</x:v></x:c></x:row>`;
  }).join("");
  catalogSheet.content = Buffer.from(catalog.replace(catalogRows, (_match, header, end) => header + rows + end));
  inputSheet.content = Buffer.from(input.replace(catalogReference, () => `Restaurantes!$A$2:$A$${restaurants.length + 1}`));
  catalogSheet.size = catalogSheet.content.length;
  inputSheet.size = inputSheet.content.length;
  return new Uint8Array(CFB.write(archive, { fileType: "zip", type: "buffer", compression: true }));
}
