"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { isReadOnly } from "@/lib/rbac";
import { GIFT_CATEGORIES } from "@/lib/constants";

type Result = { error?: string };

export type GiftInput = {
  category: string;
  name: string;
  description: string;
  nominal: string;
  quantity: string;
  note: string;
};

export type IssueInput = {
  quantity: string;
  recipient: string;
  reason: string;
  approvedAt: string;
};

async function requireEditor() {
  const session = await auth();
  if (!session?.user) throw new Error("Требуется вход");
  if (isReadOnly(session.user.role)) throw new Error("Недостаточно прав");
  return session.user;
}

const optional = z.string().trim().transform((v) => v || null);

const giftSchema = z.object({
  category: z.enum(GIFT_CATEGORIES, "Выберите категорию"),
  name: z.string().trim().min(2, "Укажите название"),
  description: optional,
  nominal: z
    .string()
    .trim()
    .transform((v) => (v ? Number(v.replace(/\s/g, "")) : null))
    .refine((v) => v === null || (Number.isInteger(v) && v >= 0), "Номинал — целое число рублей"),
  quantity: z.coerce.number("Укажите количество").int("Количество — целое число").min(0, "Количество не может быть меньше 0"),
  note: optional,
});

const issueSchema = z.object({
  quantity: z.coerce.number().int().min(1, "Количество — не меньше 1"),
  recipient: z.string().trim().min(2, "Укажите, кому выдан подарок"),
  reason: optional,
  approvedAt: z.coerce.date("Укажите дату согласования"),
});

export async function createGift(input: GiftInput): Promise<Result> {
  const user = await requireEditor();
  const parsed = giftSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (parsed.data.quantity < 1) return { error: "Количество — не меньше 1" };
  await prisma.giftItem.create({ data: { ...parsed.data, createdById: user.id } });
  revalidatePath("/gifts");
  return {};
}

export async function updateGift(id: string, input: GiftInput): Promise<Result> {
  await requireEditor();
  const parsed = giftSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  await prisma.giftItem.update({ where: { id }, data: parsed.data });
  revalidatePath("/gifts");
  return {};
}

export async function deleteGift(id: string): Promise<Result> {
  await requireEditor();
  await prisma.giftItem.delete({ where: { id } });
  revalidatePath("/gifts");
  return {};
}

/** Согласовано ЧСВ: списать подарок из наличия и записать, кому выдан. */
export async function issueGift(itemId: string, input: IssueInput): Promise<Result> {
  const user = await requireEditor();
  const parsed = issueSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { quantity } = parsed.data;

  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.giftItem.updateMany({
      where: { id: itemId, quantity: { gte: quantity } },
      data: { quantity: { decrement: quantity } },
    });
    if (updated.count === 0) return { error: "В наличии меньше, чем указано" };
    await tx.giftIssue.create({ data: { ...parsed.data, itemId, issuedById: user.id } });
    return {};
  });
  revalidatePath("/gifts");
  return result;
}

/** Отменить выдачу — подарок возвращается в наличие. */
export async function cancelIssue(issueId: string): Promise<Result> {
  await requireEditor();
  await prisma.$transaction(async (tx) => {
    const issue = await tx.giftIssue.delete({ where: { id: issueId } });
    await tx.giftItem.update({ where: { id: issue.itemId }, data: { quantity: { increment: issue.quantity } } });
  });
  revalidatePath("/gifts");
  return {};
}
