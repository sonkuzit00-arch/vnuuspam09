import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { notifyUsers, emailConfigured, sendEmail, appUrl } from "@/lib/notify";
import { getReportData, kpiLines } from "@/lib/reports";
import { buildReportXlsx } from "@/lib/report-export";
import { isPriorityRegion, STAGE_LABELS } from "@/lib/constants";
import { isOverdue } from "@/lib/sla";

const DAY_MS = 24 * 60 * 60 * 1000;

function dueText(due: Date, now: Date) {
  return due < now ? `просрочено (срок был ${due.toLocaleDateString("ru-RU")})` : `срок ${due.toLocaleDateString("ru-RU")}`;
}

// Ежедневно (vercel.json → crons): напоминания о поручениях и контрольных
// сроках обращений, которые истекают в ближайшие сутки или уже истекли.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const now = new Date();
  const horizon = new Date(now.getTime() + DAY_MS);

  const tasks = await prisma.appealTask.findMany({
    where: { status: { not: "DONE" }, remindedAt: null, dueDate: { lte: horizon } },
    include: { appeal: { select: { lastName: true, subject: true } } },
  });
  for (const t of tasks) {
    await notifyUsers([t.assigneeId], {
      subject: "Срок поручения",
      text: `«${t.description}» — ${dueText(t.dueDate!, now)}\nОбращение: ${t.appeal.lastName}${t.appeal.subject ? ` — ${t.appeal.subject}` : ""}`,
      link: `/appeals/${t.appealId}`,
    });
    await prisma.appealTask.update({ where: { id: t.id }, data: { remindedAt: now } });
  }

  const appeals = await prisma.appeal.findMany({
    where: { importStatus: null, stage: "IN_PROGRESS", deadlineRemindedAt: null, controlDate: { lte: horizon } },
    include: { responsible: { where: { isCurrent: true }, select: { userId: true } } },
  });
  for (const a of appeals) {
    await notifyUsers(a.responsible.map((r) => r.userId), {
      subject: "Контрольный срок обращения",
      text: `${a.lastName}${a.subject ? ` — ${a.subject}` : ""}: ${dueText(a.controlDate!, now)}`,
      link: `/appeals/${a.id}`,
    });
    await prisma.appeal.update({ where: { id: a.id }, data: { deadlineRemindedAt: now } });
  }

  const journal = await sendDailyJournal(now).catch((e) => {
    console.error("Журнал обращений не отправлен:", e);
    return "ошибка отправки";
  });

  return NextResponse.json({ tasks: tasks.length, appeals: appeals.length, journal });
}

/**
 * Ежедневный журнал обращений руководителям (регламент): что в работе, сроки,
 * регион, суть, куда направлено, кто ведёт + ключевые показатели и Excel.
 * Адресаты — REPORTS_EMAIL_TO (несколько через запятую), иначе APPEALS_EMAIL_TO.
 */
async function sendDailyJournal(now: Date) {
  const to = process.env.REPORTS_EMAIL_TO || process.env.APPEALS_EMAIL_TO;
  if (!to || !emailConfigured()) return "не настроен";

  const data = await getReportData({});
  const since = new Date(now.getTime() - DAY_MS);
  const newCount = data.appeals.filter((a) => a.createdAt >= since).length;
  const open = data.appeals
    .filter((a) => a.stage === "IN_PROGRESS")
    .sort(
      (a, b) =>
        Number(isPriorityRegion(b.region)) - Number(isPriorityRegion(a.region)) ||
        (a.controlDate?.getTime() ?? Infinity) - (b.controlDate?.getTime() ?? Infinity)
    );

  const lines = open.map((a) =>
    [
      `ОГ-${a.number}`,
      isOverdue(a) ? "ПРОСРОЧЕНО" : STAGE_LABELS[a.stage as keyof typeof STAGE_LABELS],
      a.controlDate ? `срок ${a.controlDate.toLocaleDateString("ru-RU")}` : "срок не задан",
      a.region ?? "регион не указан",
      [a.lastName, a.firstName].filter(Boolean).join(" "),
      a.subject ?? a.goal,
      a.routingTarget ? `→ ${a.routingTarget}` : a.resolutionPath ?? "не промаршрутизировано",
      a.responsible[0]?.user.name ?? "",
    ].join(" · ")
  );

  const text = [
    `Журнал обращений на ${now.toLocaleDateString("ru-RU")}`,
    `Новых за сутки: ${newCount}. В работе: ${open.length}.`,
    "",
    ...kpiLines(data.kpi).map(([k, v]) => `${k}: ${v}`),
    "",
    "В РАБОТЕ (приоритетные регионы и ближайшие сроки — сверху):",
    ...(lines.length ? lines : ["— нет"]),
    "",
    appUrl("/reports"),
  ].join("\n");

  const xlsx = await buildReportXlsx(data, "период: всё время");
  await sendEmail(to, `Журнал обращений на ${now.toLocaleDateString("ru-RU")}`, text, [
    { filename: `journal-${now.toISOString().slice(0, 10)}.xlsx`, content: xlsx },
  ]);
  return `отправлен: ${open.length} в работе`;
}
