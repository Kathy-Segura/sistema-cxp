import fs from "node:fs/promises";
import { Workbook, SpreadsheetFile } from "file:///C:/Program%20Files/WindowsApps/OpenAI.CodexPrimaryRuntime.v26-1117-1425-0_26.1117.1425.0_x64__3k8sg7r9htsxt/dependencies/node/node_modules/@oai/artifact-tool/dist/artifact_tool.mjs";

const outputDir = "C:\\Users\\DELL\\Downloads\\SCXP\\outputs\\estructura_cxp";
const wb = Workbook.create();
console.log("workbook-created");
const font = "Arial";
const navy = "#17365D";
const blue = "#D9EAF7";
const amber = "#FFF2CC";
const green = "#E2F0D9";
const red = "#FCE4D6";

const sheets = {};
for (const name of ["Dashboard", "facturas", "proveedores", "pagos", "gastos_fijos", "prestamos", "prestamo_saldos", "restaurantes", "usuarios", "bitacora", "catalogos"]) {
  sheets[name] = wb.worksheets.add(name);
  sheets[name].showGridLines = false;
  sheets[name].tabColor = name === "Dashboard" ? navy : "#5B9BD5";
}
console.log("sheets-created");

function title(sheet, text, endCol) {
  sheet.getRange(`A1:${endCol}1`).merge();
  sheet.getRange("A1").values = [[text]];
  sheet.getRange("A1").format = { fill: navy, font: { name: font, size: 14, bold: true, color: "#FFFFFF" }, horizontalAlignment: "left", verticalAlignment: "center" };
  sheet.getRange("A1").format.rowHeight = 26;
}
function header(sheet, headers) {
  const end = col(headers.length);
  sheet.getRange(`A3:${end}3`).values = [headers];
  sheet.getRange(`A3:${end}3`).format = { fill: navy, font: { name: font, size: 10, bold: true, color: "#FFFFFF" }, horizontalAlignment: "center", verticalAlignment: "center", wrapText: true, borders: { preset: "outside", style: "thin", color: "#FFFFFF" } };
  sheet.getRange(`A3:${end}3`).format.rowHeight = 34;
  sheet.getRange(`A3:${end}100`).format.font = { name: font, size: 10 };
  sheet.getRange(`A3:${end}100`).format.verticalAlignment = "center";
  sheet.freezePanes.freezeRows(3);
}
function col(n) { let s = ""; while (n) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); } return s; }
function widths(sheet, widths) { widths.forEach((w, i) => sheet.getRange(`${col(i + 1)}:${col(i + 1)}`).format.columnWidth = w); }

const facturaHeaders = ["factura_id", "codigo_factura", "proveedor_id", "restaurante_id", "numero_factura", "fecha_ingreso", "fecha_emision", "fecha_vencimiento", "moneda", "monto_total", "monto_pagado", "saldo_pendiente", "estado", "categoria", "descripcion", "archivo_url", "origen_carga", "creado_por", "creado_en", "actualizado_por", "actualizado_en"];
title(sheets.facturas, "Facturas: datos crudos. El sistema calcula estado y días vencidos.", col(facturaHeaders.length)); header(sheets.facturas, facturaHeaders);
widths(sheets.facturas, [16,16,16,16,16,14,14,16,10,14,14,14,12,18,34,34,14,16,20,16,20]);
sheets.facturas.getRange("F4:H100").format.numberFormat = "yyyy-mm-dd";
sheets.facturas.getRange("J4:L100").format.numberFormat = "#,##0.00";
sheets.facturas.getRange("F4:Q100").format.fill = amber;
sheets.facturas.getRange("A4:E100").format.fill = blue;
sheets.facturas.getRange("R4:U100").format.fill = "#F2F2F2";
sheets.facturas.getRange("H4:H100").conditionalFormats.addCustom('=AND($H4<TODAY(),$M4<>"Pagada")', { fill: red, font: { color: "#9C0006", bold: true } });
sheets.facturas.getRange("M4:M100").conditionalFormats.add("containsText", { text: "Pagada", format: { fill: green, font: { color: "#006100", bold: true } } });

const proveedorHeaders = ["proveedor_id", "codigo_proveedor", "nombre_legal", "nombre_comercial", "ruc", "telefono", "email", "banco", "cuenta_bancaria", "moneda_preferida", "activo", "creado_por", "creado_en", "actualizado_en"];
title(sheets.proveedores, "Proveedores", col(proveedorHeaders.length)); header(sheets.proveedores, proveedorHeaders); widths(sheets.proveedores, [16,16,30,28,18,16,28,18,24,16,10,16,20,20]);
sheets.proveedores.getRange("K4:K100").dataValidation = { rule: { type: "list", formula1: "catalogos!$A$3:$A$4" } };
sheets.proveedores.getRange("J4:J100").dataValidation = { rule: { type: "list", formula1: "catalogos!$C$3:$C$4" } };

const pagoHeaders = ["pago_id", "codigo_pago", "factura_id", "proveedor_id", "restaurante_id", "fecha_pago", "metodo_pago", "referencia", "moneda", "monto", "banco_origen", "cuenta_origen", "detalle", "soporte_url", "registrado_por", "registrado_en"];
title(sheets.pagos, "Pagos y transferencias", col(pagoHeaders.length)); header(sheets.pagos, pagoHeaders); widths(sheets.pagos, [16,16,16,16,16,14,16,18,10,14,20,24,34,34,16,20]);
sheets.pagos.getRange("F4:F100").format.numberFormat = "yyyy-mm-dd"; sheets.pagos.getRange("J4:J100").format.numberFormat = "#,##0.00";
sheets.pagos.getRange("G4:G100").dataValidation = { rule: { type: "list", formula1: "catalogos!$E$3:$E$5" } };

const fijoHeaders = ["gasto_fijo_id", "codigo_gasto", "proveedor_id", "restaurante_id", "categoria", "descripcion", "moneda", "monto_estimado", "dia_vencimiento", "activo", "fecha_inicio", "fecha_fin", "creado_por", "creado_en", "actualizado_en"];
title(sheets.gastos_fijos, "Gastos fijos: plantillas recurrentes; cada obligación genera una factura.", col(fijoHeaders.length)); header(sheets.gastos_fijos, fijoHeaders); widths(sheets.gastos_fijos, [16,16,16,16,18,34,10,16,16,10,14,14,16,20,20]);
sheets.gastos_fijos.getRange("H4:H100").format.numberFormat = "#,##0.00"; sheets.gastos_fijos.getRange("K4:L100").format.numberFormat = "yyyy-mm-dd";

const prestamoHeaders = ["prestamo_id", "codigo_prestamo", "acreedor", "numero_prestamo", "titular", "restaurante_id", "destino", "fecha_apertura", "fecha_vencimiento", "moneda", "monto_inicial", "tasa_anual", "cuota_programada", "dia_pago", "estado", "notas", "creado_por", "creado_en", "actualizado_en"];
title(sheets.prestamos, "Préstamos", col(prestamoHeaders.length)); header(sheets.prestamos, prestamoHeaders); widths(sheets.prestamos, [16,16,22,20,26,16,22,14,16,10,16,12,16,12,14,34,16,20,20]);
sheets.prestamos.getRange("H4:I100").format.numberFormat = "yyyy-mm-dd"; sheets.prestamos.getRange("K4:K100").format.numberFormat = "#,##0.00"; sheets.prestamos.getRange("L4:L100").format.numberFormat = "0.00%"; sheets.prestamos.getRange("M4:M100").format.numberFormat = "#,##0.00";

const saldoHeaders = ["prestamo_saldo_id", "prestamo_id", "periodo", "saldo_inicial", "interes", "abono_capital", "cuota_pagada", "saldo_final", "fecha_pago", "referencia_pago", "estado", "registrado_por", "registrado_en"];
title(sheets.prestamo_saldos, "Saldos de préstamos: una fila por préstamo y período.", col(saldoHeaders.length)); header(sheets.prestamo_saldos, saldoHeaders); widths(sheets.prestamo_saldos, [18,16,12,16,14,16,16,16,14,20,14,16,20]);
sheets.prestamo_saldos.getRange("C4:C100").format.numberFormat = "yyyy-mm"; sheets.prestamo_saldos.getRange("D4:H100").format.numberFormat = "#,##0.00"; sheets.prestamo_saldos.getRange("I4:I100").format.numberFormat = "yyyy-mm-dd";

const restHeaders = ["restaurante_id", "codigo", "nombre", "activo", "creado_en"];
title(sheets.restaurantes, "Catálogo de restaurantes", col(restHeaders.length)); header(sheets.restaurantes, restHeaders); widths(sheets.restaurantes, [16,16,28,10,20]);
sheets.restaurantes.getRange("A4:E9").values = [["RES-001","BC_LC","BC LAS COLINAS",true,new Date("2026-11-19")],["RES-002","BC_VF","BC VILLA FONTANA",true,new Date("2026-11-19")],["RES-003","CDP","CDP",true,new Date("2026-11-19")],["RES-004","AJI","AJI",true,new Date("2026-11-19")],["RES-005","LC","LC",true,new Date("2026-11-19")],["RES-006","DF","DF",true,new Date("2026-11-19")]];
sheets.restaurantes.getRange("E4:E100").format.numberFormat = "yyyy-mm-dd";

const userHeaders = ["usuario_id", "nombre", "email", "rol", "activo", "creado_en", "actualizado_en"];
title(sheets.usuarios, "Usuarios y roles", col(userHeaders.length)); header(sheets.usuarios, userHeaders); widths(sheets.usuarios, [16,28,32,18,10,20,20]);
sheets.usuarios.getRange("A4:G7").values = [["USR-001","Usuario 1","", "Gerencia",true,new Date("2026-11-19"),new Date("2026-11-19")],["USR-002","Usuario 2","", "Tesorería",true,new Date("2026-11-19"),new Date("2026-11-19")],["USR-003","Usuario 3","", "Contabilidad",true,new Date("2026-11-19"),new Date("2026-11-19")],["USR-004","Usuario 4","", "Contabilidad",true,new Date("2026-11-19"),new Date("2026-11-19")]];
sheets.usuarios.getRange("D4:D100").dataValidation = { rule: { type: "list", formula1: "catalogos!$G$3:$G$5" } }; sheets.usuarios.getRange("F4:G100").format.numberFormat = "yyyy-mm-dd";

const bitacoraHeaders = ["bitacora_id", "fecha_hora", "usuario_id", "accion", "entidad", "entidad_id", "campo", "valor_anterior", "valor_nuevo", "origen", "ip_o_sesion"];
title(sheets.bitacora, "Bitácora de actividad", col(bitacoraHeaders.length)); header(sheets.bitacora, bitacoraHeaders); widths(sheets.bitacora, [16,20,16,16,16,16,18,28,28,16,22]);
sheets.bitacora.getRange("B4:B100").format.numberFormat = "yyyy-mm-dd hh:mm";

title(sheets.catalogos, "Catálogos administrados por el sistema", "H");
sheets.catalogos.getRange("A3:H9").values = [
  ["Activo", "", "Moneda", "", "Método de pago", "", "Rol", "Estado factura"],
  [true, "", "NIO", "", "Transferencia", "", "Gerencia", "Pendiente"],
  [false, "", "USD", "", "Pago", "", "Tesorería", "Vencida"],
  [null, "", null, "", "Cheque", "", "Contabilidad", "Pagada"],
  [null, "", null, "", null, "", null, null],
  [null, "", null, "", null, "", null, null],
  [null, "", null, "", null, "", null, null]
];
sheets.catalogos.getRange("A3:H3").format = { fill: navy, font: { name: font, size: 10, bold: true, color: "#FFFFFF" }, horizontalAlignment: "center" };
widths(sheets.catalogos, [16,4,14,4,20,4,18,18]);

// Dashboard formulas read the first 5,000 rows. The application remains the source of truth for state calculation.
const d = sheets.Dashboard;
title(d, "Control de cuentas por pagar", "N");
d.getRange("A3:B8").values = [["Fecha de reporte", null],["Facturas pendientes", null],["Facturas vencidas", null],["Facturas pagadas", null],["Saldo pendiente", null],["Monto vencido", null]];
d.getRange("B3:B8").formulas = [["=TODAY()"],["=COUNTIF(facturas!$M$4:$M$1000,\"Pendiente\")"],["=COUNTIF(facturas!$M$4:$M$1000,\"Vencida\")"],["=COUNTIF(facturas!$M$4:$M$1000,\"Pagada\")"],["=SUMIF(facturas!$M$4:$M$1000,\"<>Pagada\",facturas!$L$4:$L$1000)"],["=SUMIF(facturas!$M$4:$M$1000,\"Vencida\",facturas!$L$4:$L$1000)"]];
d.getRange("A3:B8").format.borders = { preset: "all", style: "thin", color: "#D9E2F3" }; d.getRange("A3:A8").format = { fill: blue, font: { name: font, bold: true } }; d.getRange("B3:B8").format = { fill: "#FFFFFF", font: { name: font, bold: true } };
d.getRange("B3").format.numberFormat = "yyyy-mm-dd"; d.getRange("B7:B8").format.numberFormat = "#,##0.00";
d.getRange("A11:C17").values = [["Restaurante", "Saldo pendiente", "Facturas vencidas"],["BC LAS COLINAS",null,null],["BC VILLA FONTANA",null,null],["CDP",null,null],["AJI",null,null],["LC",null,null],["DF",null,null]];
d.getRange("B12:C17").formulas = [["=SUMIF(facturas!$D$4:$D$5000,\"RES-001\",facturas!$L$4:$L$5000)","=COUNTIFS(facturas!$D$4:$D$5000,\"RES-001\",facturas!$M$4:$M$5000,\"Vencida\")"],["=SUMIF(facturas!$D$4:$D$5000,\"RES-002\",facturas!$L$4:$L$5000)","=COUNTIFS(facturas!$D$4:$D$5000,\"RES-002\",facturas!$M$4:$M$5000,\"Vencida\")"],["=SUMIF(facturas!$D$4:$D$5000,\"RES-003\",facturas!$L$4:$L$5000)","=COUNTIFS(facturas!$D$4:$D$5000,\"RES-003\",facturas!$M$4:$M$5000,\"Vencida\")"],["=SUMIF(facturas!$D$4:$D$5000,\"RES-004\",facturas!$L$4:$L$5000)","=COUNTIFS(facturas!$D$4:$D$5000,\"RES-004\",facturas!$M$4:$M$5000,\"Vencida\")"],["=SUMIF(facturas!$D$4:$D$5000,\"RES-005\",facturas!$L$4:$L$5000)","=COUNTIFS(facturas!$D$4:$D$5000,\"RES-005\",facturas!$M$4:$M$5000,\"Vencida\")"],["=SUMIF(facturas!$D$4:$D$5000,\"RES-006\",facturas!$L$4:$L$5000)","=COUNTIFS(facturas!$D$4:$D$5000,\"RES-006\",facturas!$M$4:$M$5000,\"Vencida\")"]];
d.getRange("A11:C17").format.borders = { preset: "all", style: "thin", color: "#D9E2F3" }; d.getRange("A11:C11").format = { fill: navy, font: { name: font, bold: true, color: "#FFFFFF" }, horizontalAlignment: "center" }; d.getRange("B12:B17").format.numberFormat = "#,##0.00";
const chart = d.charts.add("bar", d.getRange("A11:B17")); chart.title = "Saldo pendiente por restaurante"; chart.titleTextStyle.typeface = font; chart.titleTextStyle.fontSize = 12; chart.hasLegend = false; chart.yAxis = { numberFormatCode: "#,##0", numberFormatSourceLinked: false, textStyle: { typeface: font } }; chart.setPosition("E3", "N19");
widths(d, [26,18,18,4,14,14,14,14,14,14,14,14,14,14]);
d.getRange("A21:N24").merge(); d.getRange("A21").values = [["Regla de estado para la aplicación: Pagada si saldo_pendiente = 0; Vencida si existe saldo y fecha_vencimiento < fecha actual; Pendiente en cualquier otro caso. Use fechas ISO YYYY-MM-DD y guarde las filas crudas mediante la API."]]; d.getRange("A21").format = { fill: "#F2F2F2", font: { name: font, size: 10, italic: true, color: "#595959" }, wrapText: true, verticalAlignment: "center" }; d.getRange("A21:N24").format.rowHeight = 18;

wb.recalculate();
console.log("recalculated");
const errors = await wb.inspect({ kind: "match", searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A", options: { useRegex: true, maxResults: 50 } });
console.log(errors.ndjson);
console.log("inspection-complete");
await fs.mkdir(outputDir, { recursive: true });
console.log("exporting");
const file = await SpreadsheetFile.exportXlsx(wb);
await file.save(`${outputDir}\\Plantilla_Cuentas_por_Pagar.xlsx`);
console.log("saved");
