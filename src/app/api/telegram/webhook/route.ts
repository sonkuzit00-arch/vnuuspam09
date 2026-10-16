import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendTelegram } from "@/lib/notify";

type Update = { message?: { chat: { id: number }; text?: string } };

// Вебхук бота: сотрудник открывает ссылку из профиля, бот получает
// «/start <код>» и привязывает этот чат к учётной записи.
export async function POST(request: Request) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret || request.headers.get("x-telegram-bot-api-secret-token") !== secret) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const update = (await request.json()) as Update;
  const message = update.message;
  if (!message?.text) return NextResponse.json({ ok: true });

  const chatId = String(message.chat.id);
  const [command, code] = message.text.trim().split(/\s+/);

  if (command === "/start" && code) {
    const user = await prisma.user.findUnique({ where: { telegramLinkCode: code } });
    if (user) {
      await prisma.user.update({
        where: { id: user.id },
        data: { telegramChatId: chatId, telegramLinkCode: null, notifyByTelegram: true },
      });
      await sendTelegram(chatId, `Готово, ${user.name}! Уведомления сервиса «Обращения ДГД» будут приходить сюда.`);
    } else {
      await sendTelegram(chatId, "Код привязки не найден или устарел. Получите новую ссылку в профиле на сайте.");
    }
  } else if (command === "/stop") {
    await prisma.user.updateMany({ where: { telegramChatId: chatId }, data: { telegramChatId: null, notifyByTelegram: false } });
    await sendTelegram(chatId, "Уведомления отключены.");
  } else {
    await sendTelegram(chatId, "Чтобы получать уведомления, откройте профиль на сайте и нажмите «Привязать Telegram».");
  }

  return NextResponse.json({ ok: true });
}
