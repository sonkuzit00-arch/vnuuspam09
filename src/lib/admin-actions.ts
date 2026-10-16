"use server";

import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import { appUrl, telegramConfigured } from "@/lib/notify";
import { del } from "@vercel/blob";

type Result = { error?: string; password?: string };

async function requireAdmin() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") throw new Error("Доступно только администратору");
  return session.user;
}

function generatePassword() {
  return randomBytes(9).toString("base64url");
}

const userSchema = z.object({
  name: z.string().trim().min(2, "Укажите ФИО"),
  email: z.email("Некорректный email").transform((v) => v.trim().toLowerCase()),
  role: z.enum(ROLES, "Выберите роль"),
});

export async function createUser(input: { name: string; email: string; role: string; password?: string }): Promise<Result> {
  await requireAdmin();
  const parsed = userSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (input.password && input.password.length < 8) return { error: "Пароль — не короче 8 символов" };

  if (await prisma.user.findUnique({ where: { email: parsed.data.email } })) {
    return { error: "Пользователь с таким email уже есть" };
  }

  const password = input.password || generatePassword();
  await prisma.user.create({ data: { ...parsed.data, passwordHash: await bcrypt.hash(password, 10) } });
  revalidatePath("/admin/users");
  return { password };
}

export async function updateUser(userId: string, input: { name: string; email: string; role: string }): Promise<Result> {
  const admin = await requireAdmin();
  const parsed = userSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (userId === admin.id && parsed.data.role !== "ADMIN") return { error: "Нельзя снять роль администратора с самого себя" };

  const sameEmail = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (sameEmail && sameEmail.id !== userId) return { error: "Пользователь с таким email уже есть" };

  await prisma.user.update({ where: { id: userId }, data: parsed.data });
  revalidatePath("/admin/users");
  return {};
}

export async function resetUserPassword(userId: string): Promise<Result> {
  await requireAdmin();
  const password = generatePassword();
  await prisma.user.update({ where: { id: userId }, data: { passwordHash: await bcrypt.hash(password, 10) } });
  return { password };
}

/** Блокировка вместо удаления — история обращений и поручений сохраняется. */
export async function setUserActive(userId: string, isActive: boolean): Promise<Result> {
  const admin = await requireAdmin();
  if (userId === admin.id) return { error: "Нельзя заблокировать самого себя" };
  await prisma.user.update({ where: { id: userId }, data: { isActive } });
  revalidatePath("/admin/users");
  return {};
}

/** Подключить вебхук Telegram-бота к этому сайту (один раз после деплоя). */
export async function setupTelegramWebhook(): Promise<Result> {
  await requireAdmin();
  if (!telegramConfigured() || !process.env.TELEGRAM_WEBHOOK_SECRET) {
    return { error: "Задайте TELEGRAM_BOT_TOKEN и TELEGRAM_WEBHOOK_SECRET" };
  }
  const res = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: appUrl("/api/telegram/webhook"),
      secret_token: process.env.TELEGRAM_WEBHOOK_SECRET,
      allowed_updates: ["message"],
    }),
  });
  const data = (await res.json()) as { ok: boolean; description?: string };
  return data.ok ? {} : { error: data.description ?? "Telegram отклонил запрос" };
}

/** Удалить все обращения вместе с поручениями, историей и файлами. Необратимо. */
export async function deleteAllAppeals(confirmation: string): Promise<Result & { deleted?: number }> {
  await requireAdmin();
  if (confirmation.trim().toUpperCase() !== "УДАЛИТЬ") return { error: "Введите слово УДАЛИТЬ для подтверждения" };

  const blobs = await prisma.appealAttachment.findMany({
    where: { blobPathname: { not: null } },
    select: { blobPathname: true },
  });
  if (blobs.length && process.env.BLOB_READ_WRITE_TOKEN) {
    await del(blobs.map((b) => b.blobPathname!));
  }

  const { count } = await prisma.appeal.deleteMany({});
  revalidatePath("/", "layout");
  return { deleted: count };
}
