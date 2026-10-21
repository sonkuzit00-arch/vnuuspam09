"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { isReadOnly } from "@/lib/rbac";

type Result = { error?: string };

export type ContactInput = {
  organization: string;
  department: string;
  fullName: string;
  position: string;
  phone: string;
  mobilePhone: string;
  email: string;
  note: string;
};

async function requireEditor() {
  const session = await auth();
  if (!session?.user) throw new Error("Требуется вход");
  if (isReadOnly(session.user.role)) throw new Error("Недостаточно прав");
  return session.user;
}

const optional = z.string().trim().transform((v) => v || null);

const contactSchema = z
  .object({
    organization: z.string().trim().min(2, "Укажите орган власти"),
    department: optional,
    fullName: z.string().trim().min(2, "Укажите ФИО"),
    position: optional,
    phone: optional,
    mobilePhone: optional,
    email: z.union([z.literal(""), z.email("Некорректный email")]).transform((v) => v.trim().toLowerCase() || null),
    note: optional,
  })
  .refine((c) => c.phone || c.mobilePhone || c.email, "Укажите телефон или email");

export async function createContact(input: ContactInput): Promise<Result> {
  const user = await requireEditor();
  const parsed = contactSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  await prisma.govContact.create({ data: { ...parsed.data, createdById: user.id } });
  revalidatePath("/contacts");
  return {};
}

export async function updateContact(id: string, input: ContactInput): Promise<Result> {
  await requireEditor();
  const parsed = contactSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  await prisma.govContact.update({ where: { id }, data: parsed.data });
  revalidatePath("/contacts");
  return {};
}

export async function deleteContact(id: string): Promise<Result> {
  await requireEditor();
  await prisma.govContact.delete({ where: { id } });
  revalidatePath("/contacts");
  return {};
}
