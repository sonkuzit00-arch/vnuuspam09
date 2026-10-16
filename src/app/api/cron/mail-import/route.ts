import { NextResponse } from "next/server";
import { importAppealsFromMail, mailImportConfigured } from "@/lib/mail-import";

export const maxDuration = 60;

// Забрать новые письма из почтового ящика в обращения. Вызывается Vercel Cron
// (vercel.json) или внешним планировщиком с заголовком Authorization: Bearer CRON_SECRET.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  if (!mailImportConfigured()) return NextResponse.json({ skipped: "IMAP не настроен" });

  try {
    return NextResponse.json(await importAppealsFromMail());
  } catch (e) {
    console.error("Импорт из почты:", e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
