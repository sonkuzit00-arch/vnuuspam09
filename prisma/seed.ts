import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// Команда ровно как в ТЗ: ОП, КАУ, ГД×2, GR, BTL/БФ, согласующий, наблюдатель,
// пресс-служба, два администратора.
const USERS = [
  { name: "Христенко Яна Юрьевна", email: "yana@dgd.local", role: "OP" },
  { name: "Бабаханова Виктория", email: "victoria@dgd.local", role: "KAU" },
  { name: "Сибирко Милана", email: "milana@dgd.local", role: "GD" },
  { name: "Кузнецова Софья Викторовна", email: "sofia@dgd.local", role: "ADMIN" },
  { name: "Ковешникова Елена Вячеславовна", email: "elena.k@dgd.local", role: "GR" },
  { name: "Путиева Татьяна Викторовна", email: "tatiana@dgd.local", role: "BTL_BF" },
  { name: "Свинарева Елена", email: "elena.s@dgd.local", role: "VIEWER" },
  { name: "Чижов Сергей Викторович", email: "sergey@dgd.local", role: "APPROVER" },
  { name: "Боровкова Наталья", email: "natalya@dgd.local", role: "PRESS" },
  { name: "Астафьева Ирина", email: "irina@dgd.local", role: "ADMIN" },
] as const;

async function main() {
  // На внутреннем сервере переопределите пароль переменной окружения перед
  // первым запуском сидирования: SEED_PASSWORD=... npm run db:seed
  const password = process.env.SEED_PASSWORD || "demo1234";
  const passwordHash = await bcrypt.hash(password, 10);

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
  const sergey = byEmail["sergey@dgd.local"]; // согласующий (Чижов)

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
      sourceChannel: "ГД; САДД / «Дело»",
      subject: "Отсутствие электроснабжения в СНТ",
      createdAt: daysAgo(0),
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
      events: { create: { type: "CREATED", message: "Обращение зарегистрировано (ГД; САДД / «Дело»)", authorId: victoria.id } },
    },
  });

  // 2. Полный пример цепочки согласования: КАУ маршрутизирует как ДЗ и
  // передаёт GR на проработку стратегии → GR поручает ГД написать запрос →
  // автор направляет запрос GR на согласование → GR согласовывает и вносит
  // правки → автор направляет итоговый текст на согласование Чижову →
  // Чижов (только согласовывает) утверждает. Плюс исходящий номер с
  // результатом ответа органа власти.
  const appeal2 = await prisma.appeal.create({
    data: {
      sourceChannel: "ГД; электронная почта",
      subject: "О сохранении школы в с. Стадница",
      createdAt: daysAgo(11),
      receivedAtDgd: daysAgo(11),
      receivedAtKau: daysAgo(11),
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
      replyNumberToCitizen: "ЧСВ-4/188",
      responsible: {
        create: [
          { userId: victoria.id, isCurrent: false, assignedAt: daysAgo(11) },
          { userId: elena.id, isCurrent: true, assignedAt: daysAgo(10) },
        ],
      },
      events: {
        create: [
          { type: "CREATED", message: "Обращение зарегистрировано (ГД; электронная почта)", authorId: victoria.id, createdAt: daysAgo(11) },
          { type: "STAGE_CHANGE", message: "КАУ: маршрут — «Депутатский запрос (ДЗ)»", authorId: victoria.id, createdAt: daysAgo(11) },
          { type: "STAGE_CHANGE", message: "Обращение передано: Ковешникова Елена Вячеславовна", authorId: victoria.id, createdAt: daysAgo(10) },
          { type: "NOTE", message: `Поручение для ${sofia.name}: подготовить текст депутатского запроса`, authorId: elena.id, createdAt: daysAgo(10) },
          { type: "NOTE", message: `Поручение для ${elena.name}: согласовать подготовленный текст запроса`, authorId: sofia.id, createdAt: daysAgo(9) },
          { type: "NOTE", message: "Согласовано с правками: уточнены основания по ст. 22 ФЗ №273-ФЗ", authorId: elena.id, createdAt: daysAgo(8.5) },
          { type: "NOTE", message: `Поручение для ${sergey.name}: согласовать итоговый текст запроса`, authorId: sofia.id, createdAt: daysAgo(8) },
          { type: "STAGE_CHANGE", message: "Поручение: статус «Выполнено»", authorId: sergey.id, createdAt: daysAgo(7.5) },
          { type: "NOTE", message: "Исходящий №ЧСВ-5/612 (Министерство образования Воронежской области)", authorId: sofia.id, createdAt: daysAgo(7) },
        ],
      },
      tasks: {
        create: [
          {
            assignedById: elena.id,
            assigneeId: sofia.id,
            description: "Подготовить текст депутатского запроса",
            status: "DONE",
            createdAt: daysAgo(10),
            completedAt: daysAgo(9),
          },
          {
            assignedById: sofia.id,
            assigneeId: elena.id,
            description: "Согласовать подготовленный текст запроса, при необходимости внести правки",
            status: "DONE",
            createdAt: daysAgo(9),
            completedAt: daysAgo(8.5),
          },
          {
            assignedById: sofia.id,
            assigneeId: sergey.id,
            description: "Согласовать итоговый текст запроса перед направлением в министерство",
            status: "DONE",
            createdAt: daysAgo(8),
            completedAt: daysAgo(7.5),
          },
        ],
      },
      outgoingNumbers: {
        create: {
          number: "ЧСВ-5/612",
          label: "Депутатский запрос в Минобразования ВО",
          createdAt: daysAgo(7),
          responseReceivedAt: daysAgo(1),
          responseSummary:
            "Реорганизация проведена с соблюдением ст. 22 ФЗ №273-ФЗ; права обучающихся на качественное образование не нарушены, автобусное обслуживание организовано.",
          assistanceProvided: false,
        },
      },
    },
  });
  void appeal2;

  // 3. Типовой ответ, быстро закрыт ГД (Сибирко) — плюс освещение в СМИ
  // (единственное, что увидит пресс-служба).
  const appeal3 = await prisma.appeal.create({
    data: {
      sourceChannel: "ГД; соцсети - комментарии",
      subject: "Тротуар у лицея №65",
      createdAt: daysAgo(9),
      receivedAtDgd: daysAgo(9), receivedAtKau: daysAgo(9),
      lastName: "Степанов", firstName: "Алексей", middleName: "Вениаминович",
      goal: "Обустроить пешеходную инфраструктуру в частном секторе рядом со школой",
      category: "Дороги",
      district: "Ленинский",
      stage: "RESOLVED",
      resolutionPath: "Типовой ответ с разъяснением",
      replyNumberToCitizen: "ЧСВ-4/201",
      responsible: { create: { userId: milana.id, assignedAt: daysAgo(8) } },
      result: "Направлен типовой ответ с разъяснением норм по благоустройству и сроков",
      resolvedAt: daysAgo(2),
      gratitudeSent: true,
      mediaCoverageSent: true,
      mediaCoverageAt: daysAgo(1),
      events: {
        create: [
          { type: "CREATED", message: "Обращение зарегистрировано (ГД; соцсети - комментарии)", authorId: victoria.id, createdAt: daysAgo(9) },
          { type: "STAGE_CHANGE", message: "КАУ: маршрут — «Типовой ответ с разъяснением»", authorId: victoria.id, createdAt: daysAgo(9) },
          { type: "STAGE_CHANGE", message: "Обращение передано: Сибирко Милана", authorId: victoria.id, createdAt: daysAgo(8) },
          { type: "STAGE_CHANGE", message: "Статус изменён на «Решено»", authorId: milana.id, createdAt: daysAgo(2) },
          { type: "MEDIA", message: "Материал направлен в СМИ", authorId: milana.id, createdAt: daysAgo(1) },
        ],
      },
    },
  });
  void appeal3;

  // 4. ОП — перенаправление профильному комитету, просрочено, с исходящим
  // номером и результатом (содействие не оказано).
  const appeal4 = await prisma.appeal.create({
    data: {
      sourceChannel: "сайт ОП (электронная форма)",
      subject: "Застройка водоохранной зоны у СНТ «Оргнефть»",
      createdAt: daysAgo(4),
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
          { type: "CREATED", message: "Обращение зарегистрировано (сайт ОП (электронная форма))", authorId: victoria.id, createdAt: daysAgo(4) },
          { type: "STAGE_CHANGE", message: "КАУ: маршрут — «Перенаправление профильному комитету»", authorId: victoria.id, createdAt: daysAgo(4) },
          { type: "STAGE_CHANGE", message: "Обращение передано: Христенко Яна Юрьевна", authorId: victoria.id, createdAt: daysAgo(4) },
        ],
      },
      outgoingNumbers: {
        create: {
          number: "ЧСВ-4/192",
          label: "Перенаправление в прокуратуру Советского района",
          createdAt: daysAgo(3),
        },
      },
    },
  });
  void appeal4;

  // 5. БТЛ/БФ — материальная помощь у Путиевой (2 подразделения на одном человеке).
  const appeal5 = await prisma.appeal.create({
    data: {
      sourceChannel: "колл-центр",
      subject: "Материальная помощь многодетной семье",
      createdAt: daysAgo(2),
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
          { type: "CREATED", message: "Обращение зарегистрировано (колл-центр)", authorId: victoria.id, createdAt: daysAgo(2) },
          { type: "STAGE_CHANGE", message: "КАУ: маршрут — «БФ»", authorId: victoria.id, createdAt: daysAgo(2) },
          { type: "STAGE_CHANGE", message: "Обращение передано: Путиева Татьяна Викторовна", authorId: victoria.id, createdAt: daysAgo(2) },
        ],
      },
    },
  });
  void appeal5;

  // 6. Рабочая поездка — капремонт СДК, решено (для полноты разбивки по группам каналов).
  const appeal6 = await prisma.appeal.create({
    data: {
      sourceChannel: "приём и рабочие поездки",
      subject: "Капремонт сельского дома культуры",
      createdAt: daysAgo(6),
      receivedAtDgd: daysAgo(6), receivedAtKau: daysAgo(6),
      lastName: "Степанищева", firstName: "Елена", middleName: "Владимировна",
      goal: "Провести капитальный ремонт сельского дома культуры",
      category: "Кап.ремонт",
      district: "Грибановский",
      stage: "RESOLVED",
      resolutionPath: "Депутатский запрос (ДЗ)",
      responsible: { create: { userId: elena.id, assignedAt: daysAgo(6) } },
      result: "Объект включён в программу капремонта на следующий год",
      resolvedAt: daysAgo(1),
      gratitudeSent: true,
      events: {
        create: [
          { type: "CREATED", message: "Обращение зарегистрировано (приём и рабочие поездки)", authorId: victoria.id, createdAt: daysAgo(6) },
          { type: "STAGE_CHANGE", message: "КАУ: маршрут — «Депутатский запрос (ДЗ)»", authorId: victoria.id, createdAt: daysAgo(6) },
          { type: "STAGE_CHANGE", message: "Обращение передано: Ковешникова Елена Вячеславовна", authorId: victoria.id, createdAt: daysAgo(6) },
          { type: "STAGE_CHANGE", message: "Статус изменён на «Решено»", authorId: elena.id, createdAt: daysAgo(1) },
        ],
      },
    },
  });
  void appeal6;

  // 7. Личные сообщения ДГД — зарегистрировано Кузнецовой, которая (как и
  // Сибирко, Ковешникова) сразу ставит Бабаханову ответственной за
  // распределение — обычный порядок регистрации, свежее (для графика по дням).
  const appeal7 = await prisma.appeal.create({
    data: {
      sourceChannel: "личные сообщения ДГД",
      subject: "Вывоз ТКО в микрорайоне",
      createdAt: daysAgo(1),
      receivedAtDgd: daysAgo(1), receivedAtKau: daysAgo(1),
      lastName: "Милованов", firstName: "Пётр", middleName: "Иванович",
      goal: "Провести проверку вывоза ТКО в микрорайоне",
      category: "Твёрдые коммунальные отходы (ТКО) / вывоз мусора",
      district: "Железнодорожный",
      stage: "IN_PROGRESS",
      responsible: { create: { userId: victoria.id, assignedAt: daysAgo(1) } },
      events: {
        create: [
          { type: "CREATED", message: "Обращение зарегистрировано Кузнецовой С.В. (личные сообщения ДГД), ответственная за распределение — Бабаханова В.", authorId: sofia.id, createdAt: daysAgo(1) },
        ],
      },
    },
  });
  void appeal7;

  console.log("Сид завершён:", {
    users: USERS.length,
    appeals: 7,
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
