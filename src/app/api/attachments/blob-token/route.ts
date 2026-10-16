import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { attachmentPrefix, MAX_ATTACHMENT_BYTES, requireAttachmentEditor } from "@/lib/attachments";

// Выдаёт браузеру одноразовый токен на загрузку файла напрямую в Vercel Blob
// (так обходится лимит 4.5 МБ на тело запроса к функции Vercel).
export async function POST(request: Request) {
  const body = (await request.json()) as HandleUploadBody;
  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const appealId = clientPayload ?? "";
        await requireAttachmentEditor(appealId);
        if (!pathname.startsWith(attachmentPrefix(appealId))) throw new Error("Неверный путь файла");
        return { maximumSizeInBytes: MAX_ATTACHMENT_BYTES, addRandomSuffix: true };
      },
    });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
