import { prisma } from "@/lib/prisma";
import { isOverdue } from "@/lib/sla";
import { STAGE_LABELS, SOURCE_CHANNEL_GROUPS, getChannelGroup, isPriorityRegion } from "@/lib/constants";

// Общие данные отчётов: страница /reports и выгрузки CSV / Excel / PDF
// считают одно и то же по одинаковым фильтрам.

export type ReportFilters = {
  from?: string;
  to?: string;
  responsibleId?: string;
  channel?: string; // конкретный канал или «group:ГД» — вся группа каналов
};

export function parseReportFilters(params: URLSearchParams | Record<string, string | undefined>): ReportFilters {
  const read = (k: string) => (params instanceof URLSearchParams ? params.get(k) : params[k]) || undefined;
  return { from: read("from"), to: read("to"), responsibleId: read("responsibleId"), channel: read("channel") };
}

export function reportQuery(filters: ReportFilters) {
  return new URLSearchParams(Object.entries(filters).filter(([, v]) => v) as [string, string][]).toString();
}

export const CHANNEL_GROUP_PREFIX = "group:";
export const CHANNEL_FILTER_OPTIONS = Object.entries(SOURCE_CHANNEL_GROUPS).flatMap(([group, channels]) => [
  { value: `${CHANNEL_GROUP_PREFIX}${group}`, label: `${group} — все каналы` },
  ...channels.map((c) => ({ value: c, label: `  ${c}` })),
]);

async function loadAppeals() {
  return prisma.appeal.findMany({
    where: { importStatus: null },
    orderBy: { createdAt: "asc" },
    include: {
      responsible: { where: { isCurrent: true }, include: { user: { select: { id: true, name: true } } } },
      outgoingNumbers: { select: { assistanceProvided: true, responseSummary: true } },
    },
  });
}
type LoadedAppeal = Awaited<ReturnType<typeof loadAppeals>>[number];

/** Дата поступления для отчётов — по ней группируем по месяцам. */
export function receivedDate(a: { receivedAtDgd: Date | null; createdAt: Date }) {
  return a.receivedAtDgd ?? a.createdAt;
}

/** Положительный результат: обращение решено или орган власти оказал содействие. */
export function isPositive(a: LoadedAppeal) {
  return a.stage === "RESOLVED" || a.outgoingNumbers.some((o) => o.assistanceProvided === true);
}

const MONTHS = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];

export type ReportRow = {
  id: string;
  received: Date;
  name: string;
  subject: string;
  channel: string;
  category: string;
  district: string;
  responsible: string;
  stage: string;
  positive: boolean;
  result: string;
  gratitude: boolean;
  gratitudeAt: Date | null;
  media: boolean;
  controlDate: Date | null;
  registrationNumber: string;
};

export type MonthRow = {
  key: string;
  label: string;
  total: number;
  resolved: number;
  positive: number;
  inProgress: number;
  overdue: number;
  gratitude: number;
  media: number;
};

function toRow(a: LoadedAppeal): ReportRow {
  return {
    id: a.id,
    received: receivedDate(a),
    name: [a.lastName, a.firstName, a.middleName].filter(Boolean).join(" "),
    subject: a.subject ?? a.goal,
    channel: a.sourceChannel,
    category: a.category,
    district: a.district ?? "",
    responsible: a.responsible[0]?.user.name ?? "",
    stage: STAGE_LABELS[a.stage as keyof typeof STAGE_LABELS] ?? a.stage,
    positive: isPositive(a),
    result:
      a.result ??
      a.outgoingNumbers.map((o) => o.responseSummary).filter(Boolean).join("; "),
    gratitude: a.gratitudeSent,
    gratitudeAt: a.gratitudeSentAt,
    media: a.mediaCoverageSent,
    controlDate: a.controlDate,
    registrationNumber: a.registrationNumber ?? "",
  };
}

export async function getReportData(filters: ReportFilters) {
  const from = filters.from ? new Date(filters.from) : undefined;
  // «по» включительно — до конца выбранного дня
  const to = filters.to ? new Date(new Date(filters.to).getTime() + 86_400_000) : undefined;

  const appeals = (await loadAppeals()).filter((a) => {
    const d = receivedDate(a);
    if (from && d < from) return false;
    if (to && d >= to) return false;
    if (filters.responsibleId && a.responsible[0]?.userId !== filters.responsibleId) return false;
    if (filters.channel) {
      if (filters.channel.startsWith(CHANNEL_GROUP_PREFIX)) {
        if (getChannelGroup(a.sourceChannel) !== filters.channel.slice(CHANNEL_GROUP_PREFIX.length)) return false;
      } else if (a.sourceChannel !== filters.channel) return false;
    }
    return true;
  });

  const monthMap = new Map<string, MonthRow>();
  for (const a of appeals) {
    const d = receivedDate(a);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const m =
      monthMap.get(key) ??
      { key, label: `${MONTHS[d.getMonth()]} ${d.getFullYear()}`, total: 0, resolved: 0, positive: 0, inProgress: 0, overdue: 0, gratitude: 0, media: 0 };
    m.total++;
    if (a.stage === "RESOLVED") m.resolved++;
    if (isPositive(a)) m.positive++;
    if (a.stage === "IN_PROGRESS") m.inProgress++;
    if (isOverdue(a)) m.overdue++;
    if (a.gratitudeSent) m.gratitude++;
    if (a.mediaCoverageSent) m.media++;
    monthMap.set(key, m);
  }
  const months = Array.from(monthMap.values()).sort((x, y) => x.key.localeCompare(y.key));
  const totals = months.reduce(
    (t, m) => {
      for (const k of ["total", "resolved", "positive", "inProgress", "overdue", "gratitude", "media"] as const) t[k] += m[k];
      return t;
    },
    { key: "total", label: "Итого", total: 0, resolved: 0, positive: 0, inProgress: 0, overdue: 0, gratitude: 0, media: 0 } as MonthRow
  );

  const rows = appeals.map(toRow);
  return {
    appeals,
    rows,
    months,
    totals,
    kpi: computeKpi(appeals),
    breakdowns: {
      category: groupStats(appeals, (a) => a.category),
      region: groupStats(appeals, (a) => (a.region ? `${a.region}${isPriorityRegion(a.region) ? " ★" : ""}` : "Регион не указан")),
      channel: groupStats(appeals, (a) =>
        a.sourceChannel.startsWith("ГД") ? a.sourceChannel : `${getChannelGroup(a.sourceChannel)} · ${a.sourceChannel}`
      ),
      format: groupStats(appeals, (a) => a.resolutionPath ?? "Не промаршрутизировано"),
      responsible: groupStats(appeals, (a) => a.responsible[0]?.user.name ?? "Без ответственного"),
    },
    positive: rows.filter((r) => r.positive),
    gratitude: rows.filter((r) => r.gratitude),
  };
}

export type ReportData = Awaited<ReturnType<typeof getReportData>>;

export async function describeFilters(filters: ReportFilters) {
  const parts: string[] = [];
  const fmt = (s: string) => new Date(s).toLocaleDateString("ru-RU");
  if (filters.from || filters.to) parts.push(`период: ${filters.from ? `с ${fmt(filters.from)}` : ""} ${filters.to ? `по ${fmt(filters.to)}` : ""}`.trim());
  else parts.push("период: всё время");
  if (filters.responsibleId) {
    const u = await prisma.user.findUnique({ where: { id: filters.responsibleId }, select: { name: true } });
    if (u) parts.push(`ответственный: ${u.name}`);
  }
  if (filters.channel) {
    parts.push(
      `канал: ${filters.channel.startsWith(CHANNEL_GROUP_PREFIX) ? `${filters.channel.slice(CHANNEL_GROUP_PREFIX.length)} (все)` : filters.channel}`
    );
  }
  return parts.join(", ");
}

export function formatDate(d: Date | null) {
  return d ? d.toLocaleDateString("ru-RU") : "";
}

// ---------------------------------------------------------------------------
// Аналитика: сколько поступило, сколько отработано, сколько времени уходит
// ---------------------------------------------------------------------------

const HOUR = 3_600_000;
const DAY = 86_400_000;
/** По 59-ФЗ — 30 дней, если контрольный срок не задан. */
const LEGAL_TERM_DAYS = 30;

const isClosed = (a: LoadedAppeal) => a.stage !== "IN_PROGRESS";
const daysToClose = (a: LoadedAppeal) => (a.resolvedAt ? (a.resolvedAt.getTime() - receivedDate(a).getTime()) / DAY : null);
const hoursToRoute = (a: LoadedAppeal) => (a.routedAt ? (a.routedAt.getTime() - receivedDate(a).getTime()) / HOUR : null);
/** Закрыто в срок: до контрольной даты (включительно), без неё — за 30 дней. */
function closedInTime(a: LoadedAppeal) {
  if (!a.resolvedAt) return null;
  if (a.controlDate) return a.resolvedAt.getTime() <= a.controlDate.getTime() + DAY;
  return (daysToClose(a) ?? 0) <= LEGAL_TERM_DAYS;
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);
function median(xs: number[]) {
  if (!xs.length) return null;
  const v = [...xs].sort((a, b) => a - b);
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}
const pct = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : null);
const nums = (xs: (number | null)[]) => xs.filter((x): x is number => x !== null);

export type StatRow = {
  label: string;
  total: number;
  closed: number;
  inProgress: number;
  overdue: number;
  positive: number;
  positivePct: number | null;
  avgDays: number | null;
  inTimePct: number | null;
  dz: number;
  gratitude: number;
};

export function groupStats(appeals: LoadedAppeal[], key: (a: LoadedAppeal) => string): StatRow[] {
  const groups = new Map<string, LoadedAppeal[]>();
  for (const a of appeals) groups.set(key(a), [...(groups.get(key(a)) ?? []), a]);
  return Array.from(groups.entries())
    .map(([label, list]) => {
      const closed = list.filter(isClosed);
      const timed = nums(closed.map(closedInTime).map((v) => (v === null ? null : Number(v))));
      const positive = list.filter(isPositive).length;
      return {
        label,
        total: list.length,
        closed: closed.length,
        inProgress: list.length - closed.length,
        overdue: list.filter(isOverdue).length,
        positive,
        positivePct: pct(positive, closed.length),
        avgDays: avg(nums(closed.map(daysToClose))),
        inTimePct: timed.length ? Math.round((timed.filter(Boolean).length / timed.length) * 100) : null,
        dz: list.filter((a) => a.dzSentAt).length,
        gratitude: list.filter((a) => a.gratitudeSent).length,
      };
    })
    .sort((x, y) => y.total - x.total);
}

export type Kpi = ReturnType<typeof computeKpi>;

export function computeKpi(appeals: LoadedAppeal[]) {
  const closed = appeals.filter(isClosed);
  const timed = nums(closed.map(closedInTime).map((v) => (v === null ? null : Number(v))));
  const closeDays = nums(closed.map(daysToClose));
  const routeHours = nums(appeals.map(hoursToRoute));
  const positive = appeals.filter(isPositive).length;
  const outgoing = appeals.flatMap((a) => a.outgoingNumbers);
  const answered = outgoing.filter((o) => o.assistanceProvided !== null);
  return {
    total: appeals.length,
    closed: closed.length,
    inProgress: appeals.length - closed.length,
    overdue: appeals.filter(isOverdue).length,
    positive,
    positivePct: pct(positive, closed.length),
    inTimePct: timed.length ? Math.round((timed.filter(Boolean).length / timed.length) * 100) : null,
    avgDaysToClose: avg(closeDays),
    medianDaysToClose: median(closeDays),
    avgHoursToRoute: avg(routeHours),
    dzSent: appeals.filter((a) => a.dzSentAt).length,
    ogvAnswered: answered.length,
    ogvAssistancePct: pct(answered.filter((o) => o.assistanceProvided).length, answered.length),
    gratitude: appeals.filter((a) => a.gratitudeSent).length,
    media: appeals.filter((a) => a.mediaCoverageSent).length,
    mass: appeals.filter((a) => a.isMass).length,
    collective: appeals.filter((a) => a.isCollective).length,
    priorityRegion: appeals.filter((a) => isPriorityRegion(a.region)).length,
  };
}

/** Строки «показатель — значение» для Excel/PDF и письма-журнала. */
export function kpiLines(k: Kpi): [string, string][] {
  const n = (v: number | null, digits = 1) => (v === null ? "—" : v.toFixed(digits).replace(".", ","));
  const p = (v: number | null) => (v === null ? "—" : `${v}%`);
  return [
    ["Поступило обращений", String(k.total)],
    ["Отработано (закрыто)", String(k.closed)],
    ["В работе", String(k.inProgress)],
    ["Просрочено", String(k.overdue)],
    ["Закрыто в срок", p(k.inTimePct)],
    ["Положительный результат", `${k.positive} (${p(k.positivePct)} от закрытых)`],
    ["Среднее время до маршрутизации КАУ, ч", n(k.avgHoursToRoute)],
    ["Среднее время отработки, дней", n(k.avgDaysToClose)],
    ["Медиана времени отработки, дней", n(k.medianDaysToClose)],
    ["Направлено ДЗ", String(k.dzSent)],
    ["Ответов ОГВ получено / с содействием", `${k.ogvAnswered} / ${p(k.ogvAssistancePct)}`],
    ["Благодарности", String(k.gratitude)],
    ["Освещено в СМИ", String(k.media)],
    ["Из приоритетных регионов", String(k.priorityRegion)],
    ["Массовые / коллективные", `${k.mass} / ${k.collective}`],
  ];
}
