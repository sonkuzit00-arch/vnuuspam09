import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { notifyUsers } from "@/lib/notify";

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

  return NextResponse.json({ tasks: tasks.length, appeals: appeals.length });
}
