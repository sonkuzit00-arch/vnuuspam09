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
