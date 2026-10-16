import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { MAX_DB_ATTACHMENT_BYTES, requireAttachmentEditor } from "@/lib/attachments";

// Загрузка без Vercel Blob (внутренний сервер): файл сохраняется в базу.
export async function POST(request: Request) {
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: "Используйте загрузку через Vercel Blob" }, { status: 400 });
  }
  const form = await request.formData();
  const appealId = String(form.get("appealId") ?? "");
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Файл не передан" }, { status: 400 });
  if (file.size > MAX_DB_ATTACHMENT_BYTES) {
    return NextResponse.json({ error: "Файл больше 10 МБ" }, { status: 413 });
  }

  let user;
  try {
    user = await requireAttachmentEditor(appealId);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 403 });
  }

  await prisma.appealAttachment.create({
    data: {
      appealId,
      uploadedById: user.id,
      fileName: file.name,
      contentType: file.type || "application/octet-stream",
      size: file.size,
      data: new Uint8Array(await file.arrayBuffer()),
    },
  });
  await prisma.appealEvent.create({
    data: { appealId, authorId: user.id, type: "NOTE", message: `Приложен файл «${file.name}»` },
  });

  revalidatePath(`/appeals/${appealId}`);
  return NextResponse.json({ ok: true });
}
