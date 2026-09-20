# Образ для запуска на внутреннем сервере (без публичного доступа).
# Собирает и запускает приложение как обычный Node-процесс с диском —
# SQLite-файл хранится в volume /data, наружу торчит только порт 3000,
# который пробрасывается администратором исключительно на внутреннюю сеть.

FROM node:22-slim

WORKDIR /app

# openssl нужен движку Prisma, ca-certificates — на случай TLS внутри сети
RUN apt-get update -y \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

COPY . .
RUN npm run build

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

# Применяет миграции, сидит демо-данные (безопасно при повторном запуске —
# seed.ts сам пропускает шаг, если обращения уже есть) и стартует сервер.
CMD ["npm", "run", "deploy:start"]
