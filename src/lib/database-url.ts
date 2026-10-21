// Схема Prisma читает DATABASE_URL. Интеграция Neon на Vercel может создать
// переменные с другими именами — подхватываем их, если DATABASE_URL не задан.
const FALLBACKS = ["POSTGRES_PRISMA_URL", "POSTGRES_URL", "STORAGE_URL", "DATABASE_URL_UNPOOLED", "POSTGRES_URL_NON_POOLING"];

// При подключении базы с префиксом (Custom Prefix) имена получаются вида
// NEON_DATABASE_URL, STORAGE_POSTGRES_URL — ищем по окончанию имени.
const SUFFIXES = ["_DATABASE_URL", "_POSTGRES_PRISMA_URL", "_POSTGRES_URL", "_DATABASE_URL_UNPOOLED", "_POSTGRES_URL_NON_POOLING"];

function isPostgresUrl(value: string | undefined): value is string {
  return Boolean(value && /^postgres(ql)?:\/\//.test(value));
}

if (!process.env.DATABASE_URL) {
  const exact = FALLBACKS.map((k) => process.env[k]).find(isPostgresUrl);
  const prefixed = SUFFIXES.flatMap((suffix) =>
    Object.entries(process.env)
      .filter(([k, v]) => k.endsWith(suffix) && isPostgresUrl(v))
      .map(([, v]) => v)
  ).find(isPostgresUrl);
  const found = exact ?? prefixed;
  if (found) process.env.DATABASE_URL = found;
}

export {};
