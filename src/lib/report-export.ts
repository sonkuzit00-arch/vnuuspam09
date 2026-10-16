import { readFile } from "node:fs/promises";
import path from "node:path";
import ExcelJS from "exceljs";
import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import { formatDate, type MonthRow, type ReportData, type ReportRow } from "@/lib/reports";

const MONTH_COLUMNS: { header: string; key: keyof MonthRow; width: number }[] = [
  { header: "Месяц", key: "label", width: 18 },
  { header: "Поступило", key: "total", width: 12 },
  { header: "Решено", key: "resolved", width: 10 },
  { header: "Положительный результат", key: "positive", width: 16 },
  { header: "В работе", key: "inProgress", width: 10 },
  { header: "Просрочено", key: "overdue", width: 12 },
  { header: "Благодарности", key: "gratitude", width: 14 },
  { header: "Освещено в СМИ", key: "media", width: 14 },
];

type RowColumn = { header: string; width: number; value: (r: ReportRow) => string | Date | null };

const ROW_COLUMNS: RowColumn[] = [
  { header: "Дата поступления", width: 14, value: (r) => r.received },
  { header: "№ в САДД", width: 12, value: (r) => r.registrationNumber },
  { header: "Заявитель", width: 26, value: (r) => r.name },
  { header: "Тема", width: 34, value: (r) => r.subject },
  { header: "Канал", width: 26, value: (r) => r.channel },
  { header: "Категория", width: 20, value: (r) => r.category },
  { header: "Район", width: 16, value: (r) => r.district },
  { header: "Ответственный", width: 24, value: (r) => r.responsible },
  { header: "Статус", width: 14, value: (r) => r.stage },
  { header: "Положительный результат", width: 14, value: (r) => (r.positive ? "Да" : "Нет") },
  { header: "Результат", width: 40, value: (r) => r.result },
  { header: "Благодарность", width: 14, value: (r) => (r.gratitude ? formatDate(r.gratitudeAt) || "Да" : "") },
  { header: "СМИ", width: 8, value: (r) => (r.media ? "Да" : "") },
  { header: "Контрольный срок", width: 14, value: (r) => r.controlDate },
];

function styleHeader(sheet: ExcelJS.Worksheet) {
  const header = sheet.getRow(1);
  header.font = { bold: true };
  header.alignment = { vertical: "middle", wrapText: true };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEDE9FE" } };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
}

function addRowsSheet(wb: ExcelJS.Workbook, title: string, rows: ReportRow[]) {
  const sheet = wb.addWorksheet(title);
  sheet.columns = ROW_COLUMNS.map((c) => ({ header: c.header, width: c.width }));
  for (const r of rows) sheet.addRow(ROW_COLUMNS.map((c) => c.value(r)));
  sheet.getColumn(1).numFmt = "dd.mm.yyyy";
  sheet.getColumn(ROW_COLUMNS.length).numFmt = "dd.mm.yyyy";
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: ROW_COLUMNS.length } };
  styleHeader(sheet);
}

export async function buildReportXlsx(data: ReportData, description: string) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Обращения ДГД";

  const months = wb.addWorksheet("По месяцам");
  months.columns = MONTH_COLUMNS.map((c) => ({ header: c.header, key: c.key, width: c.width }));
  for (const m of data.months) months.addRow(m);
  const total = months.addRow(data.totals);
  total.font = { bold: true };
  styleHeader(months);
  months.addRow([]);
  months.addRow([`Фильтры: ${description}`]).font = { italic: true, color: { argb: "FF6B7280" } };
  months.addRow(["Положительный результат — обращение решено или орган власти оказал содействие."]).font = {
    italic: true,
    color: { argb: "FF6B7280" },
  };

  addRowsSheet(wb, "Положительные результаты", data.positive);
  addRowsSheet(wb, "Благодарности", data.gratitude);
  addRowsSheet(wb, "Все обращения", data.rows);

  return Buffer.from(await wb.xlsx.writeBuffer());
}

const FONT_DIR = path.join(process.cwd(), "assets", "fonts");
let fontCache: { regular: string; bold: string } | undefined;

async function loadFonts() {
  fontCache ??= {
    regular: (await readFile(path.join(FONT_DIR, "DejaVuSansCondensed.ttf"))).toString("base64"),
    bold: (await readFile(path.join(FONT_DIR, "DejaVuSansCondensed-Bold.ttf"))).toString("base64"),
  };
  return fontCache;
}

// Колонки списка в PDF — короче, чем в Excel, чтобы влезть на альбомный A4.
const PDF_ROW_COLUMNS = ["Дата", "Заявитель", "Тема", "Канал", "Ответственный", "Статус", "Результат", "Благодарность"];
function pdfRow(r: ReportRow) {
  return [
    formatDate(r.received),
    r.name,
    r.subject,
    r.channel,
    r.responsible,
    r.stage,
    r.result,
    r.gratitude ? formatDate(r.gratitudeAt) || "Да" : "",
  ];
}

export async function buildReportPdf(data: ReportData, description: string) {
  const fonts = await loadFonts();
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  doc.addFileToVFS("DejaVu.ttf", fonts.regular);
  doc.addFont("DejaVu.ttf", "DejaVu", "normal");
  doc.addFileToVFS("DejaVu-Bold.ttf", fonts.bold);
  doc.addFont("DejaVu-Bold.ttf", "DejaVu", "bold");
  doc.setFont("DejaVu", "normal");

  const tableStyles = {
    styles: { font: "DejaVu", fontSize: 8, cellPadding: 1.5, overflow: "linebreak" as const },
    headStyles: { font: "DejaVu", fontStyle: "bold" as const, fillColor: [91, 33, 182] as [number, number, number] },
    margin: { left: 12, right: 12 },
  };

  let y = 16;
  function heading(text: string) {
    if (y > 180) {
      doc.addPage();
      y = 16;
    }
    doc.setFont("DejaVu", "bold");
    doc.setFontSize(12);
    doc.text(text, 12, y);
    doc.setFont("DejaVu", "normal");
    y += 4;
  }
  function afterTable() {
    y = ((doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY ?? y) + 10;
  }

  doc.setFont("DejaVu", "bold");
  doc.setFontSize(15);
  doc.text("Отчёт по обращениям граждан", 12, y);
  y += 6;
  doc.setFont("DejaVu", "normal");
  doc.setFontSize(9);
  doc.text(`${description} · сформирован ${new Date().toLocaleString("ru-RU")}`, 12, y);
  y += 8;

  heading("По месяцам");
  autoTable(doc, {
    ...tableStyles,
    startY: y,
    head: [MONTH_COLUMNS.map((c) => c.header)],
    body: data.months.map((m) => MONTH_COLUMNS.map((c) => String(m[c.key]))),
    foot: [MONTH_COLUMNS.map((c) => String(data.totals[c.key]))],
    footStyles: { font: "DejaVu", fontStyle: "bold", fillColor: [237, 233, 254], textColor: 20 },
  });
  afterTable();

  heading(`Положительные результаты · ${data.positive.length}`);
  autoTable(doc, { ...tableStyles, startY: y, head: [PDF_ROW_COLUMNS], body: data.positive.map(pdfRow) });
  afterTable();

  heading(`Благодарности · ${data.gratitude.length}`);
  autoTable(doc, { ...tableStyles, startY: y, head: [PDF_ROW_COLUMNS], body: data.gratitude.map(pdfRow) });

  return Buffer.from(doc.output("arraybuffer"));
}
