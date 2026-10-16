// Схема Prisma читает DATABASE_URL. Интеграция Neon на Vercel может создать
// переменные с другими именами — подхватываем их, если DATABASE_URL не задан.
const FALLBACKS = ["POSTGRES_PRISMA_URL", "POSTGRES_URL", "DATABASE_URL_UNPOOLED", "POSTGRES_URL_NON_POOLING"];

if (!process.env.DATABASE_URL) {
  const found = FALLBACKS.map((k) => process.env[k]).find(Boolean);
  if (found) process.env.DATABASE_URL = found;
}

export {};
