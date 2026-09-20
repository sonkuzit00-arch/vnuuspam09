import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getMyAppeals, getMyTasks, getAppealsNeedingRouting } from "@/lib/queries";
import { StatTile } from "@/components/stat-tile";
import { AppealListItem } from "@/components/appeal-list-item";
import { TaskListItem } from "@/components/task-list-item";
import { STAGE_LABELS, STAGES } from "@/lib/constants";
import { isOverdue } from "@/lib/sla";
import { Inbox, AlertTriangle, CheckCircle2, Clock3, Route } from "lucide-react";

export default async function CabinetPage() {
  const session = await auth();
  const user = session!.user;
  if (user.role === "VIEWER") redirect("/summary");

  const [appeals, myTasks] = await Promise.all([getMyAppeals(user.id), getMyTasks(user.id)]);
  const needsRouting =
    user.role === "KAU" || user.role === "ADMIN" ? await getAppealsNeedingRouting() : [];

  const overdueCount = appeals.filter(isOverdue).length;
  const resolvedThisMonth = appeals.filter(
    (a) => a.stage === "RESOLVED" && a.resolvedAt && a.resolvedAt.getMonth() === new Date().getMonth()
  ).length;
  const inProgress = appeals.filter((a) => a.stage === "IN_PROGRESS").length;
  const openTasks = myTasks.filter((t) => t.status !== "DONE");

  const grouped = STAGES.map((stage) => ({
    stage,
    items: appeals.filter((a) => a.stage === stage),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Личный кабинет</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Всё, что назначено вам — с любого канала: почта, соцсети, приёмные, поездки.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatTile label="Всего в работе" value={appeals.length} icon={<Inbox className="h-4 w-4" />} accent="violet" />
        <StatTile label="В работе" value={inProgress} icon={<Clock3 className="h-4 w-4" />} accent="amber" />
        <StatTile label="Просрочено" value={overdueCount} icon={<AlertTriangle className="h-4 w-4" />} accent="red" />
        <StatTile label="Решено в этом месяце" value={resolvedThisMonth} icon={<CheckCircle2 className="h-4 w-4" />} accent="emerald" />
      </div>

      {needsRouting.length > 0 && (
        <div>
          <div className="mb-3 flex items-center gap-2">
            <Route className="h-4 w-4 text-violet-600" />
            <h2 className="text-sm font-semibold text-violet-700 dark:text-violet-300">
              Требуют маршрутизации
            </h2>
            <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">
              {needsRouting.length}
            </span>
          </div>
          <p className="mb-3 text-xs text-[var(--muted)]">
            Новые обращения — назначьте формат ответа/ответственного на карточке обращения.
          </p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {needsRouting.map((appeal) => (
              <AppealListItem key={appeal.id} appeal={appeal} />
            ))}
          </div>
        </div>
      )}

      {openTasks.length > 0 && (
        <div>
          <div className="mb-3 flex items-center gap-2">
            <h2 className="text-sm font-semibold text-[var(--foreground)]">Мои поручения</h2>
            <span className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-xs text-[var(--muted)]">
              {openTasks.length}
            </span>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {openTasks.map((task) => (
              <TaskListItem key={task.id} task={task} />
            ))}
          </div>
        </div>
      )}

      {appeals.length === 0 && openTasks.length === 0 && needsRouting.length === 0 && (
        <div className="rounded-2xl border border-dashed border-[var(--border)] p-10 text-center text-sm text-[var(--muted)]">
          Пока нет обращений, назначенных вам.
        </div>
      )}

      <div className="flex flex-col gap-6">
        {grouped.map((group) => (
          <div key={group.stage}>
            <div className="mb-3 flex items-center gap-2">
              <h2 className="text-sm font-semibold text-[var(--foreground)]">
                {STAGE_LABELS[group.stage]}
              </h2>
              <span className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-xs text-[var(--muted)]">
                {group.items.length}
              </span>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
              {group.items.map((appeal) => (
                <AppealListItem key={appeal.id} appeal={appeal} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
