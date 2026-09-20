# Обращения ДГД

Внутренний сервис учёта, маршрутизации и анализа обращений граждан. Заменяет
персональные Excel-файлы одним общим сервисом: карточка на обращение, личный
кабинет сотрудника (всё, что назначено ему — с любого канала) и живой общий
свод по всей команде.

## Стек

Next.js 14 (App Router) + TypeScript, Prisma + SQLite, NextAuth (Credentials),
Tailwind CSS + shadcn-style компоненты, framer-motion.

## Запуск

```bash
npm install
cp .env.example .env      # при необходимости поменяйте NEXTAUTH_SECRET
npx prisma migrate deploy
npm run db:seed           # демо-пользователи и примеры обращений
npm run dev
```

Откройте http://localhost:3000/login — демо-доступ (пароль `demo1234`):

- `admin@dgd.local` — администратор
- `kau@dgd.local` — КАУ (видит общий свод и отчёты)
- `elena@dgd.local` — сотрудник (видит только личный кабинет)

## Деплой на Railway (публичная ссылка)

Railway запускает приложение как обычный Node-процесс с диском — наш SQLite
работает без переделки на Postgres. Шаги:

1. На [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo**
   → выбрать `sonkuzit00-arch/vnuuspam09`, ветку `claude/eloquent-noether-05ycbx`
   (или `main`, после мёрджа). Railway сам распознает Next.js через Nixpacks
   и подхватит `railway.toml` (команда запуска: `npm run deploy:start` —
   применяет миграции, сидит демо-данные и стартует сервер).
2. **Обязательно добавить Volume**, иначе база будет стираться при каждом
   передеплое: в настройках сервиса → **Volumes** → **New Volume**,
   mount path `/data`.
3. Задать переменные окружения (Settings → Variables):
   - `DATABASE_URL` = `file:/data/dev.db` (путь внутри примонтированного volume)
   - `NEXTAUTH_SECRET` = случайная строка (сгенерировать: `openssl rand -base64 32`)
   - `NEXTAUTH_URL` = публичный домен, который выдаст Railway после первого
     деплоя, например `https://vnuuspam09-production.up.railway.app`
     (можно сначала задеплоить, скопировать домен из Settings → Networking,
     затем вписать сюда и передеплоить ещё раз)
4. Deploy. После первого успешного запуска откроется публичная ссылка вида
   `https://<project>.up.railway.app/login` с демо-доступом из раздела выше.

## Структура

- `src/app/(app)/page.tsx` — личный кабинет сотрудника
- `src/app/(app)/appeals/new` — регистрация обращения
- `src/app/(app)/appeals/[id]` — карточка обращения (концепция, алгоритм,
  история взаимодействия, благодарность/СМИ)
- `src/app/(app)/summary` — общий свод (КАУ/админ)
- `src/app/(app)/reports` — отчёты за период + экспорт в CSV (КАУ/админ)
- `prisma/schema.prisma` — модель данных (супермножество полей из
  рабочего журнала + требований регламента)
- `prisma/seed.ts` — справочники и демо-данные
