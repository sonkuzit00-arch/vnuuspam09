import { NextRequest, NextResponse } from "next/server";
import { getAllAppeals } from "@/lib/queries";
import { STAGE_LABELS } from "@/lib/constants";
import { auth } from "@/lib/auth";

function csvEscape(v: string) {
  if (v.includes(",") || v.includes("\n") || v.includes('"')) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  if (!["KAU", "ADMIN"].includes(session.user.role)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from") ? new Date(searchParams.get("from")!) : undefined;
  const to = searchParams.get("to") ? new Date(searchParams.get("to")!) : undefined;
  const responsibleId = searchParams.get("responsibleId") || undefined;

  const appeals = await getAllAppeals();
  const filtered = appeals.filter((a) => {
    if (from && a.createdAt < from) return false;
    if (to && a.createdAt > to) return false;
    if (responsibleId && !a.responsible.some((r) => r.isCurrent && r.userId === responsibleId)) return false;
    return true;
  });

  const header = [
    "Дата",
    "ФИО",
    "Источник",
    "Категория",
    "Район",
    "Ответственный",
    "Статус",
    "Контрольный срок",
    "Результат",
  ];

  const rows = filtered.map((a) => [
    a.createdAt.toISOString().slice(0, 10),
    `${a.lastName} ${a.firstName ?? ""}`.trim(),
    a.sourceChannel,
    a.category,
    a.district ?? "",
    a.responsible.find((r) => r.isCurrent)?.user.name ?? "",
    STAGE_LABELS[a.stage as keyof typeof STAGE_LABELS] ?? a.stage,
    a.controlDate ? a.controlDate.toISOString().slice(0, 10) : "",
    a.result ?? "",
  ]);

  const csv = [header, ...rows].map((r) => r.map(csvEscape).join(",")).join("\n");
  const bom = "﻿"; // для корректного отображения кириллицы в Excel

  return new NextResponse(bom + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="report-${Date.now()}.csv"`,
    },
  });
}
