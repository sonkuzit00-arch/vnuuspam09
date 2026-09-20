import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const EMPLOYEES = [
  { name: "Ковешникова Елена Вячеславовна", email: "elena@dgd.local" },
  { name: "Кузнецова Софья", email: "sofia@dgd.local" },
  { name: "Христенко Яна Юрьевна", email: "yana@dgd.local" },
  { name: "Сибирко Милана", email: "milana@dgd.local" },
  { name: "Путиева Татьяна Викторовна", email: "tatiana@dgd.local" },
  { name: "Родионова Анастасия Сергеевна", email: "anastasia@dgd.local" },
  { name: "Константинов Кирилл Константинович", email: "kirill@dgd.local" },
  { name: "Карташева Екатерина Анатольевна", email: "ekaterina@dgd.local" },
  { name: "Бражникова Влада Витальевна", email: "vlada@dgd.local" },
  { name: "Черкасов Владимир Нальдович", email: "vladimir@dgd.local" },
  { name: "Новикова Любовь Игоревна", email: "lyubov@dgd.local" },
  { name: "Дашкова Виктория", email: "viktoria@dgd.local" },
];

async function main() {
  const passwordHash = await bcrypt.hash("demo1234", 10);

  const admin = await prisma.user.upsert({
    where: { email: "admin@dgd.local" },
    update: {},
    create: { name: "Администратор", email: "admin@dgd.local", passwordHash, role: "ADMIN" },
  });

  const kau = await prisma.user.upsert({
    where: { email: "kau@dgd.local" },
    update: {},
    create: { name: "Бабаханова Виктория (КАУ)", email: "kau@dgd.local", passwordHash, role: "KAU" },
  });

  const employeeUsers = [];
  for (const e of EMPLOYEES) {
    const u = await prisma.user.upsert({
      where: { email: e.email },
      update: {},
      create: { name: e.name, email: e.email, passwordHash, role: "EMPLOYEE" },
    });
    employeeUsers.push(u);
  }

  const [elena, sofia, yana, milana, tatiana, anastasia] = employeeUsers;

  const existing = await prisma.appeal.count();
  if (existing > 0) {
    console.log(`Уже есть ${existing} обращений — пропускаю сид демо-данных.`);
    await prisma.$disconnect();
    return;
  }

  const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);
  const daysAhead = (n: number) => new Date(Date.now() + n * 24 * 60 * 60 * 1000);

  const sample = [
    {
      sourceChannel: "Соц.сети ДГД",
      lastName: "Наумов", firstName: "Илья", middleName: "Сергеевич",
      address: "г. Воронеж, ул. Верхняя, д. 71",
      phone: "89102480149",
      goal: "Содействовать восстановлению электроснабжения в СНТ после аварии на кабельной линии",
      description: "Заявитель сообщает о длительных перебоях электроснабжения в СНТ из-за повреждённого магистрального кабеля; просит содействия в организации технологического присоединения к сетям с достаточной мощностью.",
      category: "Электроснабжение",
      targetAudience: "ЦА Строительство",
      district: "Центральный",
      stage: "IN_PROGRESS",
      responsible: elena,
      concept: "Направить депутатский запрос в министерство энергетики и сетевую организацию для уточнения сроков технологического присоединения",
      actionPlan: "1) Запрос в Минэнерго ВО — до 25 числа. 2) Запрос в сетевую компанию — до 25 числа. 3) Контроль ответа — начало следующего месяца.",
      controlDate: daysAhead(4),
      registrationNumber: "ЧСВ-5/612",
    },
    {
      sourceChannel: "Думская почта ДГД",
      lastName: "Коллективное обращение", firstName: null, middleName: null,
      address: "с. Стадница, Семилукский район",
      isCollective: true, signatoryCount: 80,
      goal: "Сохранить возможность обучения детей в сельской школе, не допустить закрытия здания",
      description: "Родители обучающихся просят не закрывать здание школы в селе по экономическим причинам.",
      category: "Общее образование",
      targetAudience: "ЦА Общее образование",
      district: "Рамонский",
      stage: "RESOLVED",
      responsible: elena,
      concept: "Запросить официальную позицию администрации района и министерства образования",
      actionPlan: "Депутатский запрос → получение ответа → информирование заявителей",
      result: "Получен официальный ответ министерства образования, заявители проинформированы о принятом решении",
      resolvedAt: daysAgo(10),
      gratitudeSent: true,
    },
    {
      sourceChannel: "Сайт ОП",
      lastName: "Степанов", firstName: "Алексей", middleName: "Вениаминович",
      email: "alex@example.com",
      goal: "Обустроить пешеходную инфраструктуру в частном секторе рядом со школой",
      description: "Жители просят обустроить тротуар для безопасности детей на пути в школу.",
      category: "Дороги",
      targetAudience: "ЦА Транспорт",
      district: "Ленинский",
      stage: "IN_PROGRESS",
      responsible: yana,
      concept: "Направить депутатский запрос в министерство дорожной деятельности",
      actionPlan: "Запрос в министерство → запрос главе города → контроль сроков",
      controlDate: daysAgo(2),
      registrationNumber: "ЧСВ-4/192",
    },
    {
      sourceChannel: "Соц.сети ОП",
      lastName: "Борискина", firstName: "Наталья", middleName: "Викторовна",
      email: "boriskina@example.com", phone: "89042126871",
      goal: "Остановить застройку водоохранной зоны, инициировать изменения в законодательство",
      description: "Заявитель просит остановить застройку в зоне затопления и инициировать поправки в Земельный и Водный кодексы.",
      category: "Гражданско-правовая консультация",
      targetAudience: "ЦА Строительство",
      district: "Центральный",
      stage: "RESOLVED",
      responsible: sofia,
      concept: "Юридическая консультация + мониторинг профильного законопроекта",
      actionPlan: "Разъяснение права на судебную защиту, отслеживание прохождения законопроекта в Госдуме",
      result: "Заявителю разъяснён порядок судебной защиты, законопроект принят и подписан",
      resolvedAt: daysAgo(5),
      mediaCoverageSent: true,
    },
    {
      sourceChannel: "Рабочая поездка ДГД",
      lastName: "Степанищева", firstName: "Елена", middleName: "Владимировна",
      goal: "Провести капитальный ремонт сельского дома культуры",
      description: "Жители района просят включить капремонт СДК в программу на ближайший период.",
      category: "Кап.ремонт",
      targetAudience: "ЦА Культура",
      district: "Грибановский",
      stage: "IN_PROGRESS",
      responsible: elena,
      concept: "Депутатский запрос в министерство культуры о включении объекта в программу капремонта",
      controlDate: daysAhead(1),
    },
    {
      sourceChannel: "Почта КЦ",
      lastName: "Орлова", firstName: "Марина", middleName: "Петровна",
      phone: "89204567890",
      goal: "Оказать материальную помощь многодетной семье",
      category: "Материальная помощь",
      targetAudience: "ЦА Социальный Фонд России и социальная защита",
      district: "Аннинский",
      stage: "IN_PROGRESS",
      responsible: tatiana,
      resolutionPath: "БФ",
      controlDate: daysAgo(1),
    },
    {
      sourceChannel: "Соц.сети ДГД",
      lastName: "Гришин", firstName: "Олег", middleName: null,
      goal: "Просьба разбить сквер во дворе — заявитель впоследствии отозвал обращение",
      category: "Благоустройство",
      district: "Поворинский",
      stage: "APPLICANT_DECLINED",
      responsible: anastasia,
      result: "Заявитель отозвал обращение",
    },
    {
      sourceChannel: "ОП online",
      lastName: "Милованов", firstName: "Пётр", middleName: "Иванович",
      goal: "Провести проверку вывоза ТКО в микрорайоне",
      category: "Твёрдые коммунальные отходы (ТКО) / вывоз мусора",
      district: "Железнодорожный",
      stage: "IN_PROGRESS",
      responsible: milana,
      controlDate: daysAgo(3),
    },
  ] as const;

  for (const s of sample) {
    await prisma.appeal.create({
      data: {
        sourceChannel: s.sourceChannel,
        receivedAtDgd: daysAgo(12),
        receivedAtKau: daysAgo(12),
        registrationNumber: "registrationNumber" in s ? s.registrationNumber : undefined,
        lastName: s.lastName,
        firstName: s.firstName ?? undefined,
        middleName: s.middleName ?? undefined,
        address: "address" in s ? s.address : undefined,
        phone: "phone" in s ? s.phone : undefined,
        email: "email" in s ? s.email : undefined,
        isCollective: "isCollective" in s ? s.isCollective : false,
        signatoryCount: "signatoryCount" in s ? s.signatoryCount : undefined,
        goal: s.goal,
        description: "description" in s ? s.description : undefined,
        category: s.category,
        targetAudience: "targetAudience" in s ? s.targetAudience : undefined,
        district: s.district,
        stage: s.stage,
        concept: "concept" in s ? s.concept : undefined,
        actionPlan: "actionPlan" in s ? s.actionPlan : undefined,
        resolutionPath: "resolutionPath" in s ? s.resolutionPath : undefined,
        result: "result" in s ? s.result : undefined,
        controlDate: "controlDate" in s ? s.controlDate : undefined,
        resolvedAt: "resolvedAt" in s ? s.resolvedAt : undefined,
        gratitudeSent: "gratitudeSent" in s ? s.gratitudeSent : false,
        mediaCoverageSent: "mediaCoverageSent" in s ? s.mediaCoverageSent : false,
        responsible: { create: { userId: s.responsible.id } },
        events: {
          create: [
            { type: "CREATED", message: `Обращение зарегистрировано (${s.sourceChannel})`, authorId: kau.id },
            ...(s.stage === "RESOLVED"
              ? [{ type: "STAGE_CHANGE", message: "Статус изменён на «Решено»", authorId: s.responsible.id }]
              : []),
          ],
        },
      },
    });
  }

  console.log("Сид завершён:", { admin: admin.email, kau: kau.email, employees: employeeUsers.length, appeals: sample.length });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
