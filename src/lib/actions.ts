"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { createAppealSchema } from "@/lib/schemas";
import { STAGE_LABELS, TASK_STATUS_LABELS, READ_ONLY_ROLES, EDIT_BLOCKED_ROLES } from "@/lib/constants";

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
    concept: string;
    actionPlan: string;
    resolutionPath: string;
    routingTarget: string;
    result: string;
    controlDate: string;
    gratitudeSent: boolean;
    mediaCoverageSent: boolean;
    forwardedToOp: boolean;
    registrationNumber: string;
    redirectNumber: string;
  }>
) {
  const user = await requireEditor();

  const data: Record<string, unknown> = {};
  const events: { type: string; message: string; authorId: string }[] = [];

  if (fields.concept !== undefined) data.concept = fields.concept;
  if (fields.actionPlan !== undefined) data.actionPlan = fields.actionPlan;
  if (fields.resolutionPath !== undefined) {
    data.resolutionPath = fields.resolutionPath;
    events.push({ type: "STAGE_CHANGE", message: `КАУ: маршрут — «${fields.resolutionPath}»`, authorId: user.id });
  }
  if (fields.routingTarget !== undefined) data.routingTarget = fields.routingTarget;
  if (fields.result !== undefined) data.result = fields.result;
  if (fields.registrationNumber !== undefined) data.registrationNumber = fields.registrationNumber;
  if (fields.redirectNumber !== undefined) data.redirectNumber = fields.redirectNumber;
  if (fields.controlDate !== undefined) {
    data.controlDate = fields.controlDate ? new Date(fields.controlDate) : null;
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

  revalidatePath(`/appeals/${appealId}`);
  revalidatePath("/");
  revalidatePath("/summary");
}

/** Поручение по обращению — не меняет ответственного, просто ставит задачу конкретному человеку. */
export async function createAppealTask(appealId: string, assigneeId: string, description: string) {
  const user = await requireEditor();
  if (!description.trim()) throw new Error("Опишите поручение");

  const assignee = await prisma.user.findUniqueOrThrow({ where: { id: assigneeId } });

  await prisma.appealTask.create({
    data: { appealId, assignedById: user.id, assigneeId, description },
  });

  await prisma.appealEvent.create({
    data: {
      appealId,
      authorId: user.id,
      type: "NOTE",
      message: `Поручение для ${assignee.name}: ${description}`,
    },
  });

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
