import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// Команда ровно как в ТЗ: ОП, КАУ, ГД×2, GR, BTL/БФ, два наблюдателя, два администратора.
const USERS = [
  { name: "Христенко Яна Юрьевна", email: "yana@dgd.local", role: "OP" },
  { name: "Бабаханова Виктория", email: "victoria@dgd.local", role: "KAU" },
  { name: "Сибирко Милана", email: "milana@dgd.local", role: "GD" },
  { name: "Кузнецова Софья Викторовна", email: "sofia@dgd.local", role: "ADMIN" },
  { name: "Ковешникова Елена Вячеславовна", email: "elena.k@dgd.local", role: "GR" },
  { name: "Путиева Татьяна Викторовна", email: "tatiana@dgd.local", role: "BTL_BF" },
  { name: "Свинарева Елена", email: "elena.s@dgd.local", role: "VIEWER" },
  { name: "Чижов Сергей Викторович", email: "sergey@dgd.local", role: "VIEWER" },
  { name: "Астафьева Ирина", email: "irina@dgd.local", role: "ADMIN" },
] as const;

async function main() {
  const passwordHash = await bcrypt.hash("demo1234", 10);

  const byEmail: Record<string, Awaited<ReturnType<typeof prisma.user.upsert>>> = {};
  for (const u of USERS) {
    byEmail[u.email] = await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name, role: u.role },
      create: { name: u.name, email: u.email, passwordHash, role: u.role },
    });
  }

  const victoria = byEmail["victoria@dgd.local"]; // КАУ
  const elena = byEmail["elena.k@dgd.local"]; // GR
  const sofia = byEmail["sofia@dgd.local"]; // ГД / админ
  const milana = byEmail["milana@dgd.local"]; // ГД
  const yana = byEmail["yana@dgd.local"]; // ОП
  const tatiana = byEmail["tatiana@dgd.local"]; // BTL/БФ

  const existing = await prisma.appeal.count();
  if (existing > 0) {
    console.log(`Уже есть ${existing} обращений — пропускаю сид демо-данных.`);
    await prisma.$disconnect();
    return;
  }

  const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);
  const daysAhead = (n: number) => new Date(Date.now() + n * 24 * 60 * 60 * 1000);

  // 1. Свежее обращение — ещё не промаршрутизировано, лежит у КАУ.
  const appeal1 = await prisma.appeal.create({
    data: {
      sourceChannel: "ГД: СЭД «Дело» (САДД)",
      receivedAtDgd: daysAgo(0),
      receivedAtKau: daysAgo(0),
      lastName: "Наумов", firstName: "Илья", middleName: "Сергеевич",
      address: "г. Воронеж, ул. Верхняя, д. 71",
      phone: "89102480149",
      goal: "Содействовать восстановлению электроснабжения в СНТ после аварии на кабельной линии",
      category: "Электроснабжение",
      district: "Центральный",
      stage: "IN_PROGRESS",
      responsible: { create: { userId: victoria.id } },
      events: { create: { type: "CREATED", message: "Обращение зарегистрировано (ГД: СЭД «Дело» (САДД))", authorId: victoria.id } },
    },
  });

  // 2. Полный пример цепочки из ТЗ: КАУ маршрутизирует как ДЗ и передаёт GR
  // на проработку стратегии; GR поручает ГД написать и зарегистрировать запрос.
  const appeal2 = await prisma.appeal.create({
    data: {
      sourceChannel: "ГД: Электронная почта",
      receivedAtDgd: daysAgo(6),
      receivedAtKau: daysAgo(6),
      lastName: "Коллективное обращение",
      address: "с. Стадница, Семилукский район",
      isCollective: true, signatoryCount: 80,
      goal: "Сохранить возможность обучения детей в сельской школе, не допустить закрытия здания",
      category: "Общее образование",
      district: "Рамонский",
      stage: "IN_PROGRESS",
      resolutionPath: "Депутатский запрос (ДЗ)",
      routingTarget: "Министерство образования Воронежской области",
      registrationNumber: "ЧСВ-5/612",
      responsible: {
        create: [
          { userId: victoria.id, isCurrent: false, assignedAt: daysAgo(6) },
          { userId: elena.id, isCurrent: true, assignedAt: daysAgo(5) },
        ],
      },
      events: {
        create: [
          { type: "CREATED", message: "Обращение зарегистрировано (ГД: Электронная почта)", authorId: victoria.id, createdAt: daysAgo(6) },
          { type: "STAGE_CHANGE", message: "КАУ: маршрут — «Депутатский запрос (ДЗ)»", authorId: victoria.id, createdAt: daysAgo(6) },
          { type: "STAGE_CHANGE", message: "Обращение передано: Ковешникова Елена Вячеславовна", authorId: victoria.id, createdAt: daysAgo(5) },
          { type: "NOTE", message: `Поручение для ${sofia.name}: подготовить и направить депутатский запрос, зарегистрировать в САДД, присвоить номер`, authorId: elena.id, createdAt: daysAgo(5) },
        ],
      },
      tasks: {
        create: {
          assignedById: elena.id,
          assigneeId: sofia.id,
          description: "Подготовить и направить депутатский запрос, зарегистрировать в САДД, присвоить номер",
          status: "DONE",
          createdAt: daysAgo(5),
          completedAt: daysAgo(3),
        },
      },
    },
  });
  void appeal2;

  // 3. Типовой ответ, быстро закрыт ГД (Сибирко).
  const appeal3 = await prisma.appeal.create({
    data: {
      sourceChannel: "ГД: Соц.сети — комментарии",
      receivedAtDgd: daysAgo(9), receivedAtKau: daysAgo(9),
      lastName: "Степанов", firstName: "Алексей", middleName: "Вениаминович",
      goal: "Обустроить пешеходную инфраструктуру в частном секторе рядом со школой",
      category: "Дороги",
      district: "Ленинский",
      stage: "RESOLVED",
      resolutionPath: "Типовой ответ с разъяснением",
      responsible: { create: { userId: milana.id, assignedAt: daysAgo(8) } },
      result: "Направлен типовой ответ с разъяснением норм по благоустройству и сроков",
      resolvedAt: daysAgo(2),
      gratitudeSent: true,
      events: {
        create: [
          { type: "CREATED", message: "Обращение зарегистрировано (ГД: Соц.сети — комментарии)", authorId: victoria.id, createdAt: daysAgo(9) },
          { type: "STAGE_CHANGE", message: "КАУ: маршрут — «Типовой ответ с разъяснением»", authorId: victoria.id, createdAt: daysAgo(9) },
          { type: "STAGE_CHANGE", message: "Обращение передано: Сибирко Милана", authorId: victoria.id, createdAt: daysAgo(8) },
          { type: "STAGE_CHANGE", message: "Статус изменён на «Решено»", authorId: milana.id, createdAt: daysAgo(2) },
        ],
      },
    },
  });
  void appeal3;

  // 4. ОП — перенаправление профильному комитету, просрочено.
  const appeal4 = await prisma.appeal.create({
    data: {
      sourceChannel: "Сайт ОП",
      receivedAtDgd: daysAgo(4), receivedAtKau: daysAgo(4),
      lastName: "Борискина", firstName: "Наталья", middleName: "Викторовна",
      email: "boriskina@example.com", phone: "89042126871",
      goal: "Остановить застройку водоохранной зоны",
      category: "Гражданско-правовая консультация",
      district: "Центральный",
      stage: "IN_PROGRESS",
      resolutionPath: "Перенаправление профильному комитету",
      routingTarget: "Комитет по природным ресурсам и экологии",
      controlDate: daysAgo(1),
      responsible: { create: { userId: yana.id, assignedAt: daysAgo(4) } },
      events: {
        create: [
          { type: "CREATED", message: "Обращение зарегистрировано (Сайт ОП)", authorId: victoria.id, createdAt: daysAgo(4) },
          { type: "STAGE_CHANGE", message: "КАУ: маршрут — «Перенаправление профильному комитету»", authorId: victoria.id, createdAt: daysAgo(4) },
          { type: "STAGE_CHANGE", message: "Обращение передано: Христенко Яна Юрьевна", authorId: victoria.id, createdAt: daysAgo(4) },
        ],
      },
    },
  });
  void appeal4;

  // 5. БТЛ/БФ — материальная помощь у Путиевой (2 подразделения на одном человеке).
  const appeal5 = await prisma.appeal.create({
    data: {
      sourceChannel: "Соц.сети БФ",
      receivedAtDgd: daysAgo(2), receivedAtKau: daysAgo(2),
      lastName: "Орлова", firstName: "Марина", middleName: "Петровна",
      phone: "89204567890",
      goal: "Оказать материальную помощь многодетной семье",
      category: "Материальная помощь",
      district: "Аннинский",
      stage: "IN_PROGRESS",
      resolutionPath: "БФ",
      controlDate: daysAhead(2),
      responsible: { create: { userId: tatiana.id, assignedAt: daysAgo(2) } },
      events: {
        create: [
          { type: "CREATED", message: "Обращение зарегистрировано (Соц.сети БФ)", authorId: victoria.id, createdAt: daysAgo(2) },
          { type: "STAGE_CHANGE", message: "КАУ: маршрут — «БФ»", authorId: victoria.id, createdAt: daysAgo(2) },
          { type: "STAGE_CHANGE", message: "Обращение передано: Путиева Татьяна Викторовна", authorId: victoria.id, createdAt: daysAgo(2) },
        ],
      },
    },
  });
  void appeal5;

  console.log("Сид завершён:", {
    users: USERS.length,
    appeals: 5,
    needRouting: appeal1.id,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
