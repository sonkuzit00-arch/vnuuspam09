import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EDIT_BLOCKED_ROLES } from "@/lib/constants";

export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;
// Без Vercel Blob файл кладётся в базу — держим его небольшим.
export const MAX_DB_ATTACHMENT_BYTES = 10 * 1024 * 1024;

export function attachmentPrefix(appealId: string) {
  return `appeals/${appealId}/`;
}

/** Пользователь может прикладывать файлы к этому обращению. */
export async function requireAttachmentEditor(appealId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Не авторизован");
  if ((EDIT_BLOCKED_ROLES as readonly string[]).includes(session.user.role)) {
    throw new Error("Эта роль не может прикладывать файлы");
  }
  await prisma.appeal.findUniqueOrThrow({ where: { id: appealId }, select: { id: true } });
  return session.user;
}
