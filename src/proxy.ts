import { NextResponse, type NextRequest } from "next/server";

// Закрывает весь сайт HTTP Basic Auth, если заданы SITE_LOGIN и SITE_PASSWORD
// (на Vercel — Settings → Environment Variables). Без них проверка отключена.
export function proxy(request: NextRequest) {
  const login = process.env.SITE_LOGIN;
  const password = process.env.SITE_PASSWORD;
  if (!login || !password) return NextResponse.next();

  const header = request.headers.get("authorization");
  if (header?.startsWith("Basic ")) {
    const decoded = atob(header.slice(6));
    const sep = decoded.indexOf(":");
    if (sep !== -1 && decoded.slice(0, sep) === login && decoded.slice(sep + 1) === password) {
      return NextResponse.next();
    }
  }

  return new NextResponse("Требуется авторизация", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Obrashcheniya", charset="UTF-8"' },
  });
}

// Вебхук Telegram и cron Vercel защищены собственными секретами.
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/telegram/webhook|api/cron/).*)"],
};
