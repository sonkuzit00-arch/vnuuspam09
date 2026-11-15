import { ImapFlow } from "imapflow";
import { simpleParser, type AddressObject, type Attachment } from "mailparser";
import { cardNumberFromSubject, isReplacementSubject, parseRegulationSubject, type ParsedSubject } from "@/lib/subject-format";
import { put } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { notifyUsers } from "@/lib/notify";
import { DEFAULT_IMPORT_REVIEWER_EMAIL, UNCLASSIFIED_CATEGORY } from "@/lib/constants";
import { MAX_ATTACHMENT_BYTES, MAX_DB_ATTACHMENT_BYTES, attachmentPrefix } from "@/lib/attachments";

// Импорт обращений из почтового ящика (Mail.ru, Яндекс и любой другой с IMAP).
// Каждое непрочитанное письмо из папки IMAP_FOLDER становится черновиком
// обращения (importStatus = PENDING) с каналом «ГД; электронная почта»,
// вложения — файлами карточки. Черновик видит только проверяющий
// (MAIL_IMPORT_RESPONSIBLE_EMAIL, по умолчанию Кузнецова): он правит карточку
// и принимает или отклоняет её. После импорта письмо помечается прочитанным;
// повторно одно и то же письмо не импортируется (уникальный Message-ID).

export const SOURCE_CHANNEL_EMAIL = "ГД; электронная почта";
const BATCH = 20; // писем за один запуск — чтобы уложиться во время функции

export const mailImportConfigured = () =>
  Boolean(process.env.IMAP_HOST && process.env.IMAP_USER && process.env.IMAP_PASSWORD);

export type MailImportResult = { imported: number; linked: number; skipped: number; errors: string[] };

async function saveAttachments(appealId: string, attachments: Attachment[]) {
  for (const file of attachments) {
    const fileName = file.filename || "вложение";
    const contentType = file.contentType || "application/octet-stream";
    if (process.env.BLOB_READ_WRITE_TOKEN && file.size <= MAX_ATTACHMENT_BYTES) {
      const blob = await put(`${attachmentPrefix(appealId)}${fileName}`, file.content, {
        access: "private",
        addRandomSuffix: true,
        contentType,
      });
      await prisma.appealAttachment.create({
        data: { appealId, fileName, contentType, size: file.size, blobPathname: blob.pathname },
      });
    } else if (!process.env.BLOB_READ_WRITE_TOKEN && file.size <= MAX_DB_ATTACHMENT_BYTES) {
      await prisma.appealAttachment.create({
        data: { appealId, fileName, contentType, size: file.size, data: new Uint8Array(file.content) },
      });
    } else {
      await prisma.appealEvent.create({
        data: { appealId, type: "NOTE", message: `Вложение «${fileName}» не сохранено: слишком большой файл` },
      });
    }
  }
}

/** Поля карточки из темы по регламенту. */
function fieldsFromParsed(p: ParsedSubject) {
  return {
    ...(p.sourceChannel ? { sourceChannel: p.sourceChannel } : {}),
    ...(p.region ? { region: p.region } : {}),
    ...(p.lastName ? { lastName: p.lastName, firstName: p.firstName ?? null, middleName: p.middleName ?? null } : {}),
    ...(p.receivedAt ? { receivedAtDgd: p.receivedAt } : {}),
    ...(p.controlDate ? { controlDate: p.controlDate } : {}),
    ...(p.problem ? { subject: p.problem, goal: p.problem } : {}),
    isCollective: p.isCollective,
  };
}

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

export const importReviewerEmail = () =>
  (process.env.MAIL_IMPORT_RESPONSIBLE_EMAIL || DEFAULT_IMPORT_REVIEWER_EMAIL).toLowerCase();

async function reviewerId() {
  const email = importReviewerEmail();
  const user = await prisma.user.findFirst({ where: { email, isActive: true } });
  if (!user) throw new Error(`Проверяющий для писем (${email}) не найден или заблокирован`);
  return user.id;
}

export async function importAppealsFromMail(): Promise<MailImportResult> {
  if (!mailImportConfigured()) throw new Error("Импорт из почты не настроен (IMAP_HOST, IMAP_USER, IMAP_PASSWORD)");

  const result: MailImportResult = { imported: 0, linked: 0, skipped: 0, errors: [] };
  const responsibleId = await reviewerId();
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
        const parsed = parseRegulationSubject(subject);
        const replacement = isReplacementSubject(subject);
        const from = sender.name ? `${sender.name} <${sender.email}>` : sender.email || "неизвестный отправитель";

        // Письмо по уже заведённой карточке: номер [ОГ-N] в теме (ответы, пересылки)
        // или «Взамен ранее направленного» с той же фамилией и датой поступления.
        const cardNumber = cardNumberFromSubject(subject);
        const existing =
          (cardNumber && (await prisma.appeal.findUnique({ where: { number: cardNumber } }))) ||
          (replacement && parsed?.lastName && parsed.receivedAt
            ? await prisma.appeal.findFirst({
                where: { lastName: parsed.lastName, receivedAtDgd: parsed.receivedAt },
                orderBy: { createdAt: "desc" },
              })
            : null);

        if (existing) {
          await prisma.appeal.update({
            where: { id: existing.id },
            data: {
              ...(replacement && parsed ? fieldsFromParsed(parsed) : {}),
              events: {
                create: {
                  type: "NOTE",
                  message:
                    (replacement ? "Письмо «Взамен ранее направленного» — карточка обновлена по теме. " : "Письмо по цепочке. ") +
                    `От: ${from}. Тема: «${subject}».` +
                    (text ? `\n${text.slice(0, 1500)}` : ""),
                },
              },
            },
          });
          await saveAttachments(existing.id, mail.attachments);
          await client.messageFlagsAdd(String(uid), ["\\Seen"], { uid: true });
          result.linked++;
          continue;
        }

        // Тема по регламенту — письмо внутреннее (КАУ, коллеги): данные заявителя
        // берём из темы, а не из отправителя.
        const applicant = parsed?.lastName
          ? { lastName: parsed.lastName, firstName: parsed.firstName ?? null, middleName: parsed.middleName ?? null, email: null }
          : { ...splitName(sender.name, sender.email), email: sender.email || null };

        const appeal = await prisma.appeal.create({
          data: {
            sourceChannel: parsed?.sourceChannel ?? SOURCE_CHANNEL_EMAIL,
            sourceMessageId: messageId,
            importStatus: "PENDING",
            subject: parsed?.problem ?? subject,
            region: parsed?.region ?? null,
            receivedAtDgd: parsed?.receivedAt ?? received,
            controlDate: parsed?.controlDate ?? null,
            receivedAtKau: new Date(),
            ...applicant,
            isCollective: parsed?.isCollective ?? false,
            goal: (parsed?.problem ?? text.split("\n").find((l) => l.trim()) ?? subject).slice(0, 500),
            description: text || null,
            category: UNCLASSIFIED_CATEGORY,
            responsible: { create: { userId: responsibleId } },
            events: {
              create: {
                type: "CREATED",
                message:
                  `Письмо импортировано из почты (от ${from}, тема «${subject}»)` +
                  (parsed ? " — поля заполнены по теме регламента" : "") +
                  " — ждёт согласования",
              },
            },
          },
        });

        await saveAttachments(appeal.id, mail.attachments);

        await client.messageFlagsAdd(String(uid), ["\\Seen"], { uid: true });
        result.imported++;

        await notifyUsers([responsibleId], {
          subject: "Письмо из почты ждёт согласования",
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
