import { prisma } from "@/lib/prisma";
import { isOverdue } from "@/lib/sla";
import { STAGE_LABELS, SOURCE_CHANNEL_GROUPS, getChannelGroup } from "@/lib/constants";

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
