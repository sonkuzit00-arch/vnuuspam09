import { NextResponse } from "next/server";
import { get } from "@vercel/blob";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Скачивание вложения — только для вошедших сотрудников (файлы приватные).
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });

  const { id } = await params;
  const attachment = await prisma.appealAttachment.findUnique({
    where: { id },
    include: { appeal: { select: { mediaCoverageSent: true } } },
  });
  if (!attachment) return new NextResponse("Not found", { status: 404 });
  if (session.user.role === "PRESS" && !attachment.appeal.mediaCoverageSent) {
    return new NextResponse("Not found", { status: 404 });
  }

  const headers = {
    "Content-Type": attachment.contentType,
    "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(attachment.fileName)}`,
    "Cache-Control": "private, no-store",
  };

  if (attachment.data) {
    return new NextResponse(new Uint8Array(attachment.data), { headers });
  }
  if (attachment.blobPathname) {
    const blob = await get(attachment.blobPathname, { access: "private" });
    if (blob?.statusCode === 200) return new NextResponse(blob.stream, { headers });
  }
  return new NextResponse("Not found", { status: 404 });
}
