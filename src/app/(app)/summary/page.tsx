import Link from "next/link";
import { getAllAppeals, getUsers, getAllTasks } from "@/lib/queries";
import { requireManagementRole } from "@/lib/rbac";
import { StatTile } from "@/components/stat-tile";
import { AppealListItem } from "@/components/appeal-list-item";
import { isOverdue } from "@/lib/sla";
import { Inbox, AlertTriangle, Award, Megaphone, Timer, BarChart3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TASK_STATUS_LABELS, getChannelGroup, SOURCE_CHANNEL_GROUPS } from "@/lib/constants";
import { DailyVolumeChart, PersonResultsChart, ChannelGroupChart } from "@/components/charts";

const TASK_BADGE: Record<string, "secondary" | "warning" | "success"> = {
  PENDING: "secondary",
  IN_PROGRESS: "warning",
  DONE: "success",
};

export default async function SummaryPage() {
  await requireManagementRole();
  const [appeals, users, tasks] = await Promise.all([getAllAppeals(), getUsers(), getAllTasks()]);

  const overdue = appeals.filter(isOverdue);
  const thisMonth = new Date().getMonth();
  const resolvedThisMonth = appeals.filter((a) => a.stage === "RESOLVED" && a.resolvedAt?.getMonth() === thisMonth);
  const gratitudeRate = appeals.length
    ? Math.round((appeals.filter((a) => a.gratitudeSent).length / appeals.length) * 100)
    : 0;
  const mediaRate = appeals.length
    ? Math.round((appeals.filter((a) => a.mediaCoverageSent).length / appeals.length) * 100)
    : 0;

  const employees = users.filter((u) => u.role !== "ADMIN");
  const sources = Array.from(new Set(appeals.map((a) => a.sourceChannel))).sort();

  // --- Количественный анализ: динамика по дням (14 дней) ---
  const DAYS = 14;
  const dayLabels: string[] = [];
  const dayKeys: string[] = [];
  for (let i = DAYS - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dayKeys.push(d.toISOString().slice(0, 10));
    dayLabels.push(d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" }));
  }
  const dailyVolume = dayKeys.map((key, i) => ({
    label: dayLabels[i],
    count: appeals.filter((a) => a.createdAt.toISOString().slice(0, 10) === key).length,
  }));
  const avgPerDay = appeals.length ? (dailyVolume.reduce((s, d) => s + d.count, 0) / DAYS) : 0;

  // --- Качественный анализ: среднее время на обращение (решённые) ---
  const resolvedWithDuration = appeals.filter((a) => a.stage === "RESOLVED" && a.resolvedAt);
  const avgResolutionDays = resolvedWithDuration.length
    ? resolvedWithDuration.reduce((s, a) => s + (a.resolvedAt!.getTime() - a.createdAt.getTime()) / 86_400_000, 0) /
      resolvedWithDuration.length
    : 0;

  // --- Срез по каждому участнику: решено / в работе / просрочено ---
  const personResults = employees
    .map((e) => {
      const mine = appeals.filter((a) => a.responsible.some((r) => r.isCurrent && r.userId === e.id));
      return {
        name: e.name,
        resolved: mine.filter((a) => a.stage === "RESOLVED").length,
        overdue: mine.filter(isOverdue).length,
        inProgress: mine.filter((a) => a.stage === "IN_PROGRESS" && !isOverdue(a)).length,
      };
    })
    .filter((p) => p.resolved + p.inProgress + p.overdue > 0);

  // --- Каналы объединяются по хэштегу (ГД и т.д.) независимо от подканала ---
  const channelGroupCounts = Object.keys(SOURCE_CHANNEL_GROUPS).map((group) => ({
    group,
    count: appeals.filter((a) => getChannelGroup(a.sourceChannel) === group).length,
  }));

  const matrix = sources.map((source) => {
    const row: Record<string, number> = {};
    let total = 0;
    for (const emp of employees) {
      const count = appeals.filter(
        (a) =>
          a.sourceChannel === source &&
          a.responsible.some((r) => r.isCurrent && r.userId === emp.id)
      ).length;
      row[emp.id] = count;
      total += count;
    }
    return { source, row, total };
  });

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Общий свод</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Живая картина по всей команде — без ручной ежемесячной выгрузки почты.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatTile label="Всего обращений" value={appeals.length} icon={<Inbox className="h-4 w-4" />} accent="violet" />
        <StatTile label="Просрочено сейчас" value={overdue.length} icon={<AlertTriangle className="h-4 w-4" />} accent="red" />
        <StatTile label="Благодарности, %" value={gratitudeRate} icon={<Award className="h-4 w-4" />} accent="emerald" />
        <StatTile label="Освещено в СМИ, %" value={mediaRate} icon={<Megaphone className="h-4 w-4" />} accent="amber" />
      </div>

      {overdue.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold text-red-600 dark:text-red-400">
            Просрочено сейчас ({overdue.length})
          </h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {overdue.map((a) => (
              <AppealListItem key={a.id} appeal={a} showResponsible />
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatTile
          label="Среднее время на обращение, дней"
          value={avgResolutionDays}
          decimals={1}
          icon={<Timer className="h-4 w-4" />}
          accent="violet"
        />
        <StatTile
          label="В среднем обращений в день"
          value={avgPerDay}
          decimals={1}
          icon={<BarChart3 className="h-4 w-4" />}
          accent="amber"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Поступление обращений по дням</CardTitle>
          <CardDescription>Последние {DAYS} дней, все каналы вместе</CardDescription>
        </CardHeader>
        <CardContent>
          <DailyVolumeChart data={dailyVolume} />
        </CardContent>
      </Card>

      {personResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Результаты по каждому участнику</CardTitle>
            <CardDescription>Решено / в работе / просрочено — по текущим ответственным</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-4 text-xs text-[var(--muted)]">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: "var(--chart-good)" }} /> решено
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: "var(--muted)" }} /> в работе
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: "var(--chart-critical)" }} /> просрочено
              </span>
            </div>
            <PersonResultsChart data={personResults} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Обращения по группам каналов</CardTitle>
          <CardDescription>Все каналы «ГД; …» объединены в один хэштег независимо от подканала</CardDescription>
        </CardHeader>
        <CardContent>
          <ChannelGroupChart data={channelGroupCounts} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Источник × ответственный</CardTitle>
          <CardDescription>Сколько обращений сейчас закреплено за каждым сотрудником по каналу</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--muted)]">
                <th className="py-2 pr-4 font-medium">Источник</th>
                {employees.map((e) => (
                  <th key={e.id} className="px-3 py-2 text-center font-medium">{e.name.split(" ")[0]}</th>
                ))}
                <th className="px-3 py-2 text-center font-medium">Итого</th>
              </tr>
            </thead>
            <tbody>
              {matrix.map((row) => (
                <tr key={row.source} className="border-b border-[var(--border)] last:border-0">
                  <td className="py-2 pr-4 text-[var(--foreground)]/90">{row.source}</td>
                  {employees.map((e) => (
                    <td key={e.id} className="px-3 py-2 text-center tabular-nums text-[var(--muted)]">
                      {row.row[e.id] || ""}
                    </td>
                  ))}
                  <td className="px-3 py-2 text-center font-semibold tabular-nums">{row.total}</td>
                </tr>
              ))}
              <tr className="font-semibold">
                <td className="py-2 pr-4">Итого</td>
                {employees.map((e) => (
                  <td key={e.id} className="px-3 py-2 text-center tabular-nums">
                    {appeals.filter((a) => a.responsible.some((r) => r.isCurrent && r.userId === e.id)).length}
                  </td>
                ))}
                <td className="px-3 py-2 text-center tabular-nums">{appeals.length}</td>
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Кому как делегируются задачи</CardTitle>
          <CardDescription>Поручения по всем обращениям — кто кому что поручил и в каком статусе</CardDescription>
        </CardHeader>
        <CardContent>
          {tasks.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">Поручений пока не было.</p>
          ) : (
            <div className="flex flex-col divide-y divide-[var(--border)]">
              {tasks.map((task) => (
                <Link
                  key={task.id}
                  href={`/appeals/${task.appealId}`}
                  className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm hover:bg-[var(--surface-2)]"
                >
                  <div className="min-w-0">
                    <p className="font-medium">
                      {task.assignedBy.name} → {task.assignee.name}
                    </p>
                    <p className="truncate text-xs text-[var(--muted)]">
                      {task.description} · {task.appeal.lastName} {task.appeal.firstName ?? ""}
                    </p>
                  </div>
                  <Badge variant={TASK_BADGE[task.status] ?? "secondary"}>
                    {TASK_STATUS_LABELS[task.status as keyof typeof TASK_STATUS_LABELS] ?? task.status}
                  </Badge>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-[var(--muted)]">
        Решено в этом месяце: {resolvedThisMonth.length}
      </p>
    </div>
  );
}
