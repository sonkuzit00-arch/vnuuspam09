// Тема письма по внутреннему регламенту:
//   «ГД; САДД / Почта / Электронная почта; Регион; ФИО; ДД.ММ.ГГГГ-ДД.ММ.ГГГГ; Проблема»
// Пример: «ГД; САДД; Ростовская область; Тимошенко М. В.; 29.08.2025-28.09.2025; Просьба …»
// После создания карточки в тему добавляется её номер «[ОГ-125]»: письма с ним
// (ответы, пересылки, «Взамен ранее направленного») прикрепляются к той же карточке.

export type ParsedSubject = {
  sourceChannel?: string;
  region?: string;
  lastName?: string;
  firstName?: string;
  middleName?: string;
  receivedAt?: Date;
  controlDate?: Date;
  problem?: string;
  isCollective: boolean;
};

const DATE_RANGE = /(\d{1,2})\.(\d{1,2})\.(\d{4})\s*[-–—]\s*(\d{1,2})\.(\d{1,2})\.(\d{4})/;
const CARD_TOKEN = /\[ОГ-(\d+)\]/i;
const REPLY_PREFIX = /^\s*((re|fw|fwd|ответ|пересл)\s*(\[\d+\])?\s*:\s*)+/i;
const REPLACEMENT = /взамен ранее направленного/i;

export function cardNumberFromSubject(subject: string | null | undefined): number | null {
  const m = subject?.match(CARD_TOKEN);
  return m ? Number(m[1]) : null;
}

export function isReplacementSubject(subject: string | null | undefined) {
  return Boolean(subject && REPLACEMENT.test(subject));
}

export function withCardToken(subject: string, number: number) {
  return CARD_TOKEN.test(subject) ? subject : `${subject} [ОГ-${number}]`;
}

function channelFromWord(word: string): string | undefined {
  const w = word.toLowerCase();
  if (w.includes("садд") || w.includes("дело")) return "ГД; САДД / «Дело»";
  if (w.includes("эл") && w.includes("почт")) return "ГД; электронная почта";
  if (w.includes("почт")) return "ГД; почта";
  if (w.includes("коммент")) return "ГД; соцсети - комментарии";
  if (w.includes("соц")) return "ГД; соцсети ДГД, личные сообщения";
  if (w.includes("сайт") && w.includes("оп")) return "сайт ОП (электронная форма)";
  if (w.includes("оп")) return "общественные приёмные (ОП)";
  if (w.includes("колл")) return "колл-центр";
  if (w.includes("поездк") || w.includes("приём") || w.includes("прием")) return "приём и рабочие поездки";
  return undefined;
}

/** «Тимошенко М. В.» / «Тимошенко М.В.» / «Тимошенко Мария Владимировна». */
export function splitFio(fio: string) {
  const cleaned = fio.replace(/\s+/g, " ").trim();
  const [lastName, ...rest] = cleaned.split(" ");
  let tail = rest.join(" ");
  // инициалы слитно «М.В.» → «М. В.»
  if (/^[А-ЯЁA-Z]\.[А-ЯЁA-Z]\.?$/.test(tail)) tail = tail.replace(/\.(?=\S)/, ". ");
  const parts = tail.split(" ").filter(Boolean);
  return { lastName, firstName: parts[0], middleName: parts.slice(1).join(" ") || undefined };
}

const toDate = (d: string, m: string, y: string) => new Date(Date.UTC(Number(y), Number(m) - 1, Number(d), 9));

/** Разобрать тему по регламенту. null — тема не в формате регламента. */
export function parseRegulationSubject(raw: string | null | undefined): ParsedSubject | null {
  if (!raw) return null;
  const subject = raw.replace(REPLY_PREFIX, "").replace(REPLACEMENT, "").replace(CARD_TOKEN, "").trim();
  const parts = subject.split(";").map((p) => p.trim()).filter(Boolean);
  const dateIdx = parts.findIndex((p) => DATE_RANGE.test(p));
  if (dateIdx < 3 || parts.length < 4) return null;

  const m = parts[dateIdx].match(DATE_RANGE)!;
  let problem = parts.slice(dateIdx + 1).join("; ").trim();
  const isCollective = /коллективн/i.test(problem);
  problem = problem.replace(/\(?\s*коллективное обращение\s*\)?/i, "").trim();

  // ГД; канал; регион; ФИО; даты; суть — канал и регион идут перед ФИО
  const fio = parts[dateIdx - 1];
  const region = parts[dateIdx - 2];
  const channelWord = parts.slice(0, dateIdx - 2).join(" ");

  return {
    sourceChannel: channelFromWord(channelWord),
    region: region || undefined,
    ...splitFio(fio),
    receivedAt: toDate(m[1], m[2], m[3]),
    controlDate: toDate(m[4], m[5], m[6]),
    problem: problem || undefined,
    isCollective,
  };
}

const ddmmyyyy = (d: Date) =>
  `${String(d.getUTCDate()).padStart(2, "0")}.${String(d.getUTCMonth() + 1).padStart(2, "0")}.${d.getUTCFullYear()}`;

const CHANNEL_WORD: Record<string, string> = {
  "ГД; САДД / «Дело»": "САДД",
  "ГД; почта": "Почта",
  "ГД; электронная почта": "Электронная почта",
};

/** Тема письма о карточке — в формате регламента и с номером карточки. */
export function formatRegulationSubject(a: {
  number: number;
  sourceChannel: string;
  region: string | null;
  lastName: string;
  firstName: string | null;
  middleName: string | null;
  receivedAtDgd: Date | null;
  createdAt: Date;
  controlDate: Date | null;
  subject: string | null;
  goal: string;
  isCollective: boolean;
}) {
  const initials = [a.firstName, a.middleName].filter(Boolean).map((n) => (n!.endsWith(".") ? n : `${n![0]}.`)).join(" ");
  const received = a.receivedAtDgd ?? a.createdAt;
  const parts = [
    "ГД",
    CHANNEL_WORD[a.sourceChannel] ?? a.sourceChannel,
    a.region || "—",
    [a.lastName, initials].filter(Boolean).join(" "),
    `${ddmmyyyy(received)}-${a.controlDate ? ddmmyyyy(a.controlDate) : "—"}`,
    `${a.subject || a.goal}${a.isCollective ? " (коллективное обращение)" : ""}`,
  ];
  return withCardToken(parts.join("; "), a.number);
}
