import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { MANAGEMENT_ROLES } from "@/lib/constants";
import { describeFilters, formatDate, getReportData, parseReportFilters } from "@/lib/reports";
import { buildReportPdf, buildReportXlsx } from "@/lib/report-export";

function csvEscape(v: string) {
  if (v.includes(",") || v.includes("\n") || v.includes('"')) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}

// ?format=xlsx | pdf | csv (по умолчанию csv) + фильтры страницы отчётов.
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  if (!(MANAGEMENT_ROLES as readonly string[]).includes(session.user.role)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const filters = parseReportFilters(searchParams);
  const data = await getReportData(filters);
  const format = searchParams.get("format") ?? "csv";
  const stamp = new Date().toISOString().slice(0, 10);

  if (format === "xlsx") {
    const body = await buildReportXlsx(data, await describeFilters(filters));
    return new NextResponse(new Uint8Array(body), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="report-${stamp}.xlsx"`,
      },
    });
  }

  if (format === "pdf") {
    const body = await buildReportPdf(data, await describeFilters(filters));
    return new NextResponse(new Uint8Array(body), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="report-${stamp}.pdf"`,
      },
    });
  }

  const header = ["Дата", "ФИО", "Источник", "Категория", "Район", "Ответственный", "Статус", "Положительный результат", "Благодарность", "Контрольный срок", "Результат"];
  const rows = data.rows.map((r) => [
    formatDate(r.received),
    r.name,
    r.channel,
    r.category,
    r.district,
    r.responsible,
    r.stage,
    r.positive ? "Да" : "Нет",
    r.gratitude ? "Да" : "",
    formatDate(r.controlDate),
    r.result,
  ]);

  const csv = [header, ...rows].map((r) => r.map(csvEscape).join(",")).join("\n");
  const bom = "﻿"; // для корректного отображения кириллицы в Excel

  return new NextResponse(bom + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="report-${stamp}.csv"`,
    },
  });
}
