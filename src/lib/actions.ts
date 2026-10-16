"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { createAppealSchema } from "@/lib/schemas";
import { STAGE_LABELS, TASK_STATUS_LABELS, READ_ONLY_ROLES, EDIT_BLOCKED_ROLES } from "@/lib/constants";
import { notifyUsers, appealsMailbox, sendEmail, appUrl } from "@/lib/notify";
import { attachmentPrefix, requireAttachmentEditor } from "@/lib/attachments";
import { del, head } from "@vercel/blob";

function appealTitle(a: { lastName: string; firstName?: string | null; subject?: string | null }) {
  return `${a.lastName}${a.firstName ? ` ${a.firstName}` : ""}${a.subject ? ` — ${a.subject}` : ""}`;
}

async function requireUser() {
  const session = await auth();
  if (!session?.user) throw new Error("Не авторизован");
  return session.user;
}

/** Наблюдатель и согласующий (Свинарева, Чижов) не создают и не редактируют обращения. */
async function requireEditor() {
  const user = await requireUser();
  if ((EDIT_BLOCKED_ROLES as readonly string[]).includes(user.role)) {
    throw new Error("Эта роль доступна только для просмотра / согласования");
  }
  return user;
}

export async function createAppeal(formData: FormData) {
  const user = await requireEditor();

  const raw = Object.fromEntries(formData.entries());
  const cleaned = Object.fromEntries(
    Object.entries(raw).map(([k, v]) => [k, v === "" ? undefined : v])
  );
  const parsed = createAppealSchema.safeParse({
    ...cleaned,
    isCollective: raw.isCollective === "on",
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((i) => i.message).join(", "));
  }

  const data = parsed.data;
  const now = new Date();

  const appeal = await prisma.appeal.create({
    data: {
      sourceChannel: data.sourceChannel,
      subject: data.subject,
      receivedAtDgd: now,
      receivedAtKau: now,
      lastName: data.lastName,
      firstName: data.firstName,
      middleName: data.middleName,
      phone: data.phone,
      email: data.email,
      socialHandle: data.socialHandle,
      address: data.address,
      district: data.district,
      isCollective: data.isCollective ?? false,
      signatoryCount: data.signatoryCount,
      goal: data.goal,
      description: data.description,
      category: data.category,
      targetAudience: data.targetAudience,
      controlDate: data.controlDate ? new Date(data.controlDate) : null,
      responsible: { create: { userId: data.responsibleId } },
      events: {
        create: {
          type: "CREATED",
          message: `Обращение зарегистрировано (${data.sourceChannel})`,
          authorId: user.id,
        },
      },
    },
  });

  const mailbox = appealsMailbox();
  if (mailbox) {
    const responsible = await prisma.user.findUnique({ where: { id: data.responsibleId }, select: { name: true } });
    const lines = [
      `Канал: ${appeal.sourceChannel}`,
      `Заявитель: ${[appeal.lastName, appeal.firstName, appeal.middleName].filter(Boolean).join(" ")}`,
      appeal.phone && `Телефон: ${appeal.phone}`,
      appeal.email && `Email: ${appeal.email}`,
      appeal.district && `Район: ${appeal.district}`,
      `Категория: ${appeal.category}`,
      appeal.subject && `Тема: ${appeal.subject}`,
      `Суть: ${appeal.goal}`,
      appeal.description && `Описание: ${appeal.description}`,
      `Ответственный: ${responsible?.name ?? "—"}`,
      appeal.controlDate && `Контрольный срок: ${appeal.controlDate.toLocaleDateString("ru-RU")}`,
      `Зарегистрировал(а): ${user.name}`,
      "",
      appUrl(`/appeals/${appeal.id}`),
    ].filter((l): l is string => typeof l === "string");
    after(() =>
      sendEmail(mailbox, `Новое обращение: ${appealTitle(appeal)}`, lines.join("\n")).catch((e) =>
        console.error("Копия обращения на почту не отправлена:", e)
      )
    );
  }

  if (data.responsibleId !== user.id) {
    after(() =>
      notifyUsers([data.responsibleId], {
        subject: "Вам назначено новое обращение",
        text: `${appealTitle(appeal)}\nКанал: ${appeal.sourceChannel}\nЗарегистрировал(а): ${user.name}`,
        link: `/appeals/${appeal.id}`,
      })
    );
  }

  revalidatePath("/");
  revalidatePath("/summary");
  redirect(`/appeals/${appeal.id}`);
}

export async function updateAppealStage(appealId: string, stage: string) {
  const user = await requireEditor();

  await prisma.appeal.update({
    where: { id: appealId },
    data: {
      stage,
      resolvedAt: stage === "RESOLVED" ? new Date() : undefined,
      events: {
        create: {
          type: "STAGE_CHANGE",
          message: `Статус изменён на «${STAGE_LABELS[stage as keyof typeof STAGE_LABELS] ?? stage}»`,
          authorId: user.id,
        },
      },
    },
  });

  revalidatePath(`/appeals/${appealId}`);
  revalidatePath("/");
  revalidatePath("/summary");
}

export async function addAppealNote(appealId: string, message: string) {
  const user = await requireEditor();
  if (!message.trim()) return;

  await prisma.appealEvent.create({
    data: { appealId, authorId: user.id, type: "NOTE", message },
  });

  revalidatePath(`/appeals/${appealId}`);
}

export async function updateAppealFields(
  appealId: string,
  fields: Partial<{
    subject: string;
    concept: string;
    actionPlan: string;
    resolutionPath: string;
    routingTarget: string;
    result: string;
    controlDate: string;
    receivedAtDgd: string;
    gratitudeSent: boolean;
    mediaCoverageSent: boolean;
    forwardedToOp: boolean;
    registrationNumber: string;
    replyNumberToCitizen: string;
  }>
) {
  const user = await requireEditor();

  const data: Record<string, unknown> = {};
  const events: { type: string; message: string; authorId: string }[] = [];

  if (fields.subject !== undefined) data.subject = fields.subject;
  if (fields.concept !== undefined) data.concept = fields.concept;
  if (fields.actionPlan !== undefined) data.actionPlan = fields.actionPlan;
  if (fields.resolutionPath !== undefined) {
    data.resolutionPath = fields.resolutionPath;
    events.push({ type: "STAGE_CHANGE", message: `КАУ: маршрут — «${fields.resolutionPath}»`, authorId: user.id });
  }
  if (fields.routingTarget !== undefined) data.routingTarget = fields.routingTarget;
  if (fields.result !== undefined) data.result = fields.result;
  if (fields.registrationNumber !== undefined) data.registrationNumber = fields.registrationNumber;
  if (fields.replyNumberToCitizen !== undefined) data.replyNumberToCitizen = fields.replyNumberToCitizen;
  if (fields.controlDate !== undefined) {
    data.controlDate = fields.controlDate ? new Date(fields.controlDate) : null;
    data.deadlineRemindedAt = null; // новый срок — новое напоминание
  }
  if (fields.receivedAtDgd !== undefined) {
    data.receivedAtDgd = fields.receivedAtDgd ? new Date(fields.receivedAtDgd) : null;
  }
  if (fields.gratitudeSent !== undefined) {
    data.gratitudeSent = fields.gratitudeSent;
    data.gratitudeSentAt = fields.gratitudeSent ? new Date() : null;
    events.push({ type: "GRATITUDE", message: fields.gratitudeSent ? "Благодарственное письмо отправлено" : "Отметка о благодарности снята", authorId: user.id });
  }
  if (fields.mediaCoverageSent !== undefined) {
    data.mediaCoverageSent = fields.mediaCoverageSent;
    data.mediaCoverageAt = fields.mediaCoverageSent ? new Date() : null;
    events.push({ type: "MEDIA", message: fields.mediaCoverageSent ? "Материал направлен в СМИ" : "Отметка об СМИ снята", authorId: user.id });
  }
  if (fields.forwardedToOp !== undefined) {
    data.forwardedToOp = fields.forwardedToOp;
    data.forwardedToOpAt = fields.forwardedToOp ? new Date() : null;
  }

  await prisma.appeal.update({
    where: { id: appealId },
    data: { ...data, events: events.length ? { create: events } : undefined },
  });

  revalidatePath(`/appeals/${appealId}`);
  revalidatePath("/");
  revalidatePath("/summary");
}

/** Передать обращение целиком другому ответственному (напр. КАУ → GR). */
export async function reassignResponsible(appealId: string, newResponsibleId: string) {
  const user = await requireEditor();

  const newResponsible = await prisma.user.findUniqueOrThrow({ where: { id: newResponsibleId } });
  const appeal = await prisma.appeal.findUniqueOrThrow({ where: { id: appealId } });

  await prisma.$transaction([
    prisma.appealResponsible.updateMany({
      where: { appealId, isCurrent: true },
      data: { isCurrent: false },
    }),
    prisma.appealResponsible.create({
      data: { appealId, userId: newResponsibleId },
    }),
    prisma.appealEvent.create({
      data: {
        appealId,
        authorId: user.id,
        type: "STAGE_CHANGE",
        message: `Обращение передано: ${newResponsible.name}`,
      },
    }),
  ]);

  if (newResponsibleId !== user.id) {
    after(() =>
      notifyUsers([newResponsibleId], {
        subject: "Вам передано обращение",
        text: `${appealTitle(appeal)}\nПередал(а): ${user.name}`,
        link: `/appeals/${appealId}`,
      })
    );
  }

  revalidatePath(`/appeals/${appealId}`);
  revalidatePath("/");
  revalidatePath("/summary");
}

/** Поручение по обращению — не меняет ответственного, просто ставит задачу конкретному человеку. */
export async function createAppealTask(appealId: string, assigneeId: string, description: string, dueDate?: string) {
  const user = await requireEditor();
  if (!description.trim()) throw new Error("Опишите поручение");

  const assignee = await prisma.user.findUniqueOrThrow({ where: { id: assigneeId } });
  const appeal = await prisma.appeal.findUniqueOrThrow({ where: { id: appealId } });
  const due = dueDate ? new Date(dueDate) : null;
  const dueText = due ? ` (срок — ${due.toLocaleDateString("ru-RU")})` : "";

  await prisma.appealTask.create({
    data: { appealId, assignedById: user.id, assigneeId, description, dueDate: due },
  });

  await prisma.appealEvent.create({
    data: {
      appealId,
      authorId: user.id,
      type: "NOTE",
      message: `Поручение для ${assignee.name}: ${description}${dueText}`,
    },
  });

  if (assigneeId !== user.id) {
    after(() =>
      notifyUsers([assigneeId], {
        subject: "Новое поручение",
        text: `${description}${dueText}\nОбращение: ${appealTitle(appeal)}\nПоручил(а): ${user.name}`,
        link: `/appeals/${appealId}`,
      })
    );
  }

  revalidatePath(`/appeals/${appealId}`);
  revalidatePath("/");
  revalidatePath("/summary");
}

/**
 * Статус поручения может менять исполнитель/постановщик/админ/КАУ; согласующий
 * (APPROVER, напр. Чижов) — только по своим поручениям, это и есть его
 * единственное действие в системе (согласование).
 */
export async function updateTaskStatus(taskId: string, status: string) {
  const user = await requireUser();
  if ((READ_ONLY_ROLES as readonly string[]).includes(user.role)) {
    throw new Error("Роль «Наблюдатель» доступна только для просмотра");
  }

  const existing = await prisma.appealTask.findUniqueOrThrow({ where: { id: taskId } });
  if (user.role === "APPROVER" && existing.assigneeId !== user.id) {
    throw new Error("Можно согласовывать только поручения, адресованные вам");
  }

  const task = await prisma.appealTask.update({
    where: { id: taskId },
    data: { status, completedAt: status === "DONE" ? new Date() : null },
  });

  if (status === "DONE" && existing.status !== "DONE" && task.assignedById !== user.id) {
    after(() =>
      notifyUsers([task.assignedById], {
        subject: "Поручение выполнено",
        text: `${user.name}: «${task.description}»`,
        link: `/appeals/${task.appealId}`,
      })
    );
  }

  await prisma.appealEvent.create({
    data: {
      appealId: task.appealId,
      authorId: user.id,
      type: "STAGE_CHANGE",
      message: `Поручение: статус «${TASK_STATUS_LABELS[status as keyof typeof TASK_STATUS_LABELS] ?? status}»`,
    },
  });

  revalidatePath(`/appeals/${task.appealId}`);
  revalidatePath("/");
  revalidatePath("/summary");
}

/** Добавить исходящий номер (перенаправление, депутатский запрос…) — их может быть несколько. */
export async function addOutgoingNumber(appealId: string, number: string, label?: string) {
  const user = await requireEditor();
  if (!number.trim()) throw new Error("Укажите номер исходящего");

  await prisma.appealOutgoingNumber.create({
    data: { appealId, number, label: label || undefined },
  });

  await prisma.appealEvent.create({
    data: {
      appealId,
      authorId: user.id,
      type: "NOTE",
      message: `Исходящий №${number}${label ? ` (${label})` : ""}`,
    },
  });

  revalidatePath(`/appeals/${appealId}`);
}

/** Зафиксировать результат ответа органа власти по конкретному исходящему. */
export async function updateOutgoingNumberResult(
  outgoingId: string,
  fields: Partial<{ responseReceivedAt: string; responseSummary: string; assistanceProvided: boolean | null }>
) {
  const user = await requireEditor();

  const data: Record<string, unknown> = {};
  if (fields.responseReceivedAt !== undefined) {
    data.responseReceivedAt = fields.responseReceivedAt ? new Date(fields.responseReceivedAt) : null;
  }
  if (fields.responseSummary !== undefined) data.responseSummary = fields.responseSummary;
  if (fields.assistanceProvided !== undefined) data.assistanceProvided = fields.assistanceProvided;

  const outgoing = await prisma.appealOutgoingNumber.update({ where: { id: outgoingId }, data });

  if (fields.assistanceProvided !== undefined) {
    const verdict = fields.assistanceProvided === true ? "содействие оказано" : fields.assistanceProvided === false ? "содействие не оказано" : "результат не определён";
    await prisma.appealEvent.create({
      data: {
        appealId: outgoing.appealId,
        authorId: user.id,
        type: "NOTE",
        message: `Ответ по исходящему №${outgoing.number}: ${verdict}`,
      },
    });
  }

  revalidatePath(`/appeals/${outgoing.appealId}`);
}

/** Зарегистрировать файл, который браузер уже загрузил в Vercel Blob. */
export async function registerBlobAttachment(appealId: string, pathname: string, fileName: string) {
  const user = await requireAttachmentEditor(appealId);
  if (!pathname.startsWith(attachmentPrefix(appealId))) throw new Error("Неверный путь файла");

  const blob = await head(pathname);
  await prisma.appealAttachment.create({
    data: {
      appealId,
      uploadedById: user.id,
      fileName,
      contentType: blob.contentType,
      size: blob.size,
      blobPathname: blob.pathname,
    },
  });
  await prisma.appealEvent.create({
    data: { appealId, authorId: user.id, type: "NOTE", message: `Приложен файл «${fileName}»` },
  });

  revalidatePath(`/appeals/${appealId}`);
}

export async function deleteAttachment(attachmentId: string) {
  const attachment = await prisma.appealAttachment.findUniqueOrThrow({
    where: { id: attachmentId },
    select: { id: true, appealId: true, fileName: true, blobPathname: true },
  });
  const user = await requireAttachmentEditor(attachment.appealId);

  if (attachment.blobPathname) await del(attachment.blobPathname);
  await prisma.appealAttachment.delete({ where: { id: attachment.id } });
  await prisma.appealEvent.create({
    data: { appealId: attachment.appealId, authorId: user.id, type: "NOTE", message: `Удалён файл «${attachment.fileName}»` },
  });

  revalidatePath(`/appeals/${attachment.appealId}`);
}
