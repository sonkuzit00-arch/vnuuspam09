import { ImapFlow } from "imapflow";
import { simpleParser, type AddressObject } from "mailparser";
import { put } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { notifyUsers } from "@/lib/notify";
import { DEFAULT_RESPONSIBLE_NAME, UNCLASSIFIED_CATEGORY } from "@/lib/constants";
import { MAX_ATTACHMENT_BYTES, MAX_DB_ATTACHMENT_BYTES, attachmentPrefix } from "@/lib/attachments";

// Импорт обращений из почтового ящика (Mail.ru, Яндекс и любой другой с IMAP).
// Каждое непрочитанное письмо из папки IMAP_FOLDER становится обращением
// с каналом «ГД; электронная почта», вложения — файлами карточки. После
// импорта письмо помечается прочитанным; повторно одно и то же письмо не
// импортируется (уникальный Message-ID).

export const SOURCE_CHANNEL_EMAIL = "ГД; электронная почта";
const BATCH = 20; // писем за один запуск — чтобы уложиться во время функции

export const mailImportConfigured = () =>
  Boolean(process.env.IMAP_HOST && process.env.IMAP_USER && process.env.IMAP_PASSWORD);

export type MailImportResult = { imported: number; skipped: number; errors: string[] };

function senderOf(from: AddressObject | undefined) {
  const addr = from?.value?.[0];
  return { name: addr?.name?.trim() || "", email: addr?.address?.toLowerCase() || "" };
}

/** «Иванов Иван Иванович» → поля ФИО; без имени — адрес почты вместо фамилии. */
function splitName(name: string, email: string) {
  const parts = name.replace(/["']/g, "").split(/\s+/).filter(Boolean);
  if (!parts.length) return { lastName: email || "Без имени", firstName: null, middleName: null };
  return { lastName: parts[0], firstName: parts[1] ?? null, middleName: parts.slice(2).join(" ") || null };
}

async function defaultResponsibleId() {
  const byEmail = process.env.MAIL_IMPORT_RESPONSIBLE_EMAIL;
  const user =
    (byEmail && (await prisma.user.findFirst({ where: { email: byEmail.toLowerCase(), isActive: true } }))) ||
    (await prisma.user.findFirst({ where: { name: DEFAULT_RESPONSIBLE_NAME, isActive: true } })) ||
    (await prisma.user.findFirst({ where: { role: { in: ["KAU", "ADMIN"] }, isActive: true }, orderBy: { role: "desc" } }));
  if (!user) throw new Error("Нет активного пользователя КАУ/администратора для назначения обращений");
  return user.id;
}

export async function importAppealsFromMail(): Promise<MailImportResult> {
  if (!mailImportConfigured()) throw new Error("Импорт из почты не настроен (IMAP_HOST, IMAP_USER, IMAP_PASSWORD)");

  const result: MailImportResult = { imported: 0, skipped: 0, errors: [] };
  const responsibleId = await defaultResponsibleId();
  const ownAddresses = [process.env.SMTP_FROM, process.env.SMTP_USER]
    .filter(Boolean)
    .map((a) => a!.replace(/.*<|>.*/g, "").trim().toLowerCase());

  const client = new ImapFlow({
    host: process.env.IMAP_HOST!,
    port: Number(process.env.IMAP_PORT || 993),
    secure: Number(process.env.IMAP_PORT || 993) === 993,
    auth: { user: process.env.IMAP_USER!, pass: process.env.IMAP_PASSWORD! },
    logger: false,
  });

  await client.connect();
  const lock = await client.getMailboxLock(process.env.IMAP_FOLDER || "INBOX");
  try {
    const uids = (await client.search({ seen: false }, { uid: true })) || [];
    for (const uid of uids.slice(0, BATCH)) {
      try {
        const msg = await client.fetchOne(String(uid), { source: true }, { uid: true });
        if (!msg || !msg.source) continue;
        const mail = await simpleParser(msg.source);
        const sender = senderOf(mail.from);
        const messageId = mail.messageId || `imap-${process.env.IMAP_USER}-${uid}-${mail.date?.toISOString() ?? ""}`;

        // свои же письма (копии обращений, отчёты) и уже импортированные — пропускаем
        const duplicate = await prisma.appeal.findUnique({ where: { sourceMessageId: messageId }, select: { id: true } });
        if (duplicate || ownAddresses.includes(sender.email)) {
          result.skipped++;
          await client.messageFlagsAdd(String(uid), ["\\Seen"], { uid: true });
          continue;
        }

        const text = (mail.text || "").trim();
        const subject = mail.subject?.trim() || "(без темы)";
        const received = mail.date ?? new Date();
        const appeal = await prisma.appeal.create({
          data: {
            sourceChannel: SOURCE_CHANNEL_EMAIL,
            sourceMessageId: messageId,
            subject,
            receivedAtDgd: received,
            receivedAtKau: new Date(),
            ...splitName(sender.name, sender.email),
            email: sender.email || null,
            goal: (text.split("\n").find((l) => l.trim()) || subject).slice(0, 500),
            description: text || null,
            category: UNCLASSIFIED_CATEGORY,
            responsible: { create: { userId: responsibleId } },
            events: {
              create: {
                type: "CREATED",
                message: `Обращение импортировано из почты (${sender.email || "неизвестный отправитель"}, тема «${subject}»)`,
              },
            },
          },
        });

        for (const file of mail.attachments) {
          const fileName = file.filename || "вложение";
          const contentType = file.contentType || "application/octet-stream";
          if (process.env.BLOB_READ_WRITE_TOKEN && file.size <= MAX_ATTACHMENT_BYTES) {
            const blob = await put(`${attachmentPrefix(appeal.id)}${fileName}`, file.content, {
              access: "private",
              addRandomSuffix: true,
              contentType,
            });
            await prisma.appealAttachment.create({
              data: { appealId: appeal.id, fileName, contentType, size: file.size, blobPathname: blob.pathname },
            });
          } else if (!process.env.BLOB_READ_WRITE_TOKEN && file.size <= MAX_DB_ATTACHMENT_BYTES) {
            await prisma.appealAttachment.create({
              data: { appealId: appeal.id, fileName, contentType, size: file.size, data: new Uint8Array(file.content) },
            });
          } else {
            await prisma.appealEvent.create({
              data: { appealId: appeal.id, type: "NOTE", message: `Вложение «${fileName}» не сохранено: слишком большой файл` },
            });
          }
        }

        await client.messageFlagsAdd(String(uid), ["\\Seen"], { uid: true });
        result.imported++;

        await notifyUsers([responsibleId], {
          subject: "Новое обращение из почты",
          text: `${subject}\nОт: ${sender.name ? `${sender.name} <${sender.email}>` : sender.email}`,
          link: `/appeals/${appeal.id}`,
        });
      } catch (e) {
        result.errors.push(`Письмо UID ${uid}: ${(e as Error).message}`);
      }
    }
  } finally {
    lock.release();
    await client.logout().catch(() => undefined);
  }
  return result;
}
