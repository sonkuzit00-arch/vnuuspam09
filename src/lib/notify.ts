import nodemailer from "nodemailer";
import { prisma } from "@/lib/prisma";

// Уведомления сотрудникам: каждый в профиле сам включает почту и/или
// Telegram. Каналы работают, только если заданы переменные окружения:
// SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASSWORD/SMTP_FROM — почта,
// TELEGRAM_BOT_TOKEN — Telegram. Ошибка отправки не ломает основное действие.

export function appUrl(path = "") {
  const base =
    process.env.APP_URL ||
    process.env.NEXTAUTH_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "");
  return base.replace(/\/$/, "") + path;
}

export const emailConfigured = () => Boolean(process.env.SMTP_HOST && process.env.SMTP_FROM);
/** Общий ящик, куда выгружаются новые обращения и отчёты (APPEALS_EMAIL_TO, можно несколько через запятую). */
export const appealsMailbox = () => (emailConfigured() && process.env.APPEALS_EMAIL_TO) || "";
export const telegramConfigured = () => Boolean(process.env.TELEGRAM_BOT_TOKEN);

let transporter: nodemailer.Transporter | undefined;
function getTransporter() {
  transporter ??= nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 465),
    secure: Number(process.env.SMTP_PORT || 465) === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
  });
  return transporter;
}

export async function sendTelegram(chatId: string, text: string) {
  const res = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
  });
  if (!res.ok) throw new Error(`Telegram ${res.status}: ${await res.text()}`);
}

export async function sendEmail(
  to: string,
  subject: string,
  text: string,
  attachments?: { filename: string; content: Buffer }[]
) {
  await getTransporter().sendMail({ from: process.env.SMTP_FROM, to, subject, text, attachments });
}

export type Notification = { subject: string; text: string; link?: string };

/** Отправить уведомление пользователям по включённым у них каналам. */
export async function notifyUsers(userIds: (string | null | undefined)[], n: Notification) {
  const ids = Array.from(new Set(userIds.filter((id): id is string => Boolean(id))));
  if (!ids.length) return;

  const users = await prisma.user.findMany({ where: { id: { in: ids }, isActive: true } });
  const body = n.link ? `${n.text}\n\n${appUrl(n.link)}` : n.text;

  await Promise.all(
    users.flatMap((u) => {
      const jobs: Promise<void>[] = [];
      if (u.notifyByTelegram && u.telegramChatId && telegramConfigured()) {
        jobs.push(sendTelegram(u.telegramChatId, `${n.subject}\n\n${body}`));
      }
      if (u.notifyByEmail && emailConfigured()) {
        jobs.push(sendEmail(u.notifyEmail || u.email, `Обращения ДГД: ${n.subject}`, body));
      }
      return jobs.map((job) => job.catch((e) => console.error(`Уведомление для ${u.email} не отправлено:`, e)));
    })
  );
}
