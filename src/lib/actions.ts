"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { createAppealSchema } from "@/lib/schemas";
import { STAGE_LABELS } from "@/lib/constants";

async function requireUser() {
  const session = await auth();
  if (!session?.user) throw new Error("Не авторизован");
  return session.user;
}

export async function createAppeal(formData: FormData) {
  const user = await requireUser();

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
  const user = await requireUser();

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
  const user = await requireUser();
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
    result: string;
    controlDate: string;
    gratitudeSent: boolean;
    mediaCoverageSent: boolean;
    forwardedToOp: boolean;
    registrationNumber: string;
    redirectNumber: string;
  }>
) {
  const user = await requireUser();

  const data: Record<string, unknown> = {};
  const events: { type: string; message: string; authorId: string }[] = [];

  if (fields.concept !== undefined) data.concept = fields.concept;
  if (fields.actionPlan !== undefined) data.actionPlan = fields.actionPlan;
  if (fields.resolutionPath !== undefined) data.resolutionPath = fields.resolutionPath;
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
