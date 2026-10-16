"use server";

import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { notifyUsers } from "@/lib/notify";

async function requireUser() {
  const session = await auth();
  if (!session?.user) throw new Error("Не авторизован");
  return session.user;
}

export async function updateNotificationSettings(fields: {
  notifyEmail: string;
  notifyByEmail: boolean;
  notifyByTelegram: boolean;
}) {
  const user = await requireUser();
  const email = fields.notifyEmail.trim();
  if (email && !z.email().safeParse(email).success) return { error: "Некорректный email" };

  await prisma.user.update({
    where: { id: user.id },
    data: { notifyEmail: email || null, notifyByEmail: fields.notifyByEmail, notifyByTelegram: fields.notifyByTelegram },
  });
  revalidatePath("/profile");
  return {};
}

/** Одноразовый код для ссылки t.me/<бот>?start=<код>. */
export async function createTelegramLinkCode() {
  const user = await requireUser();
  const code = randomBytes(12).toString("hex");
  await prisma.user.update({ where: { id: user.id }, data: { telegramLinkCode: code } });
  return code;
}

export async function unlinkTelegram() {
  const user = await requireUser();
  await prisma.user.update({
    where: { id: user.id },
    data: { telegramChatId: null, telegramLinkCode: null, notifyByTelegram: false },
  });
  revalidatePath("/profile");
}

export async function sendTestNotification() {
  const user = await requireUser();
  await notifyUsers([user.id], { subject: "Тестовое уведомление", text: "Уведомления настроены и работают.", link: "/profile" });
}

export async function changeOwnPassword(currentPassword: string, newPassword: string) {
  const user = await requireUser();
  if (newPassword.length < 8) return { error: "Новый пароль — не короче 8 символов" };

  const dbUser = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
  if (!(await bcrypt.compare(currentPassword, dbUser.passwordHash))) return { error: "Текущий пароль неверен" };

  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(newPassword, 10) } });
  return {};
}
