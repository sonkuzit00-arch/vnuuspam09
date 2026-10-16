"use server";

import { auth } from "@/lib/auth";
import { MANAGEMENT_ROLES } from "@/lib/constants";
import { appealsMailbox, sendEmail } from "@/lib/notify";
import { describeFilters, getReportData, type ReportFilters } from "@/lib/reports";
import { buildReportXlsx } from "@/lib/report-export";

/** Отправить Excel-отчёт с текущими фильтрами в общий ящик обращений. */
export async function emailReport(filters: ReportFilters): Promise<{ error?: string }> {
  const session = await auth();
  if (!session?.user || !(MANAGEMENT_ROLES as readonly string[]).includes(session.user.role)) {
    return { error: "Нет доступа" };
  }
  const mailbox = appealsMailbox();
  if (!mailbox) return { error: "Почта для выгрузки не настроена" };

  const description = await describeFilters(filters);
  const data = await getReportData(filters);
  const xlsx = await buildReportXlsx(data, description);
  const stamp = new Date().toISOString().slice(0, 10);

  try {
    await sendEmail(
      mailbox,
      `Отчёт по обращениям (${description})`,
      `Отчёт по обращениям граждан: ${data.rows.length} обращений, ${description}.\nОтправил(а): ${session.user.name}`,
      [{ filename: `report-${stamp}.xlsx`, content: xlsx }]
    );
  } catch (e) {
    console.error("Отчёт на почту не отправлен:", e);
    return { error: "Не удалось отправить письмо — проверьте настройки SMTP" };
  }
  return {};
}
