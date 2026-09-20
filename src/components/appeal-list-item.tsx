import Link from "next/link";
import { Clock, AlertTriangle, User2 } from "lucide-react";
import { StageBadge } from "@/components/stage-badge";
import { isOverdue } from "@/lib/sla";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

type AppealForList = {
  id: string;
  sourceChannel: string;
  lastName: string;
  firstName: string | null;
  goal: string;
  stage: string;
  controlDate: Date | null;
  receivedAtDgd: Date | null;
  receivedAtKau: Date | null;
  district: string | null;
  responsible: { user: { name: string } }[];
};

export function AppealListItem({ appeal, showResponsible }: { appeal: AppealForList; showResponsible?: boolean }) {
  const overdue = isOverdue(appeal);

  return (
    <Link
      href={`/appeals/${appeal.id}`}
      className="group flex flex-col gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 transition-all hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-md dark:hover:border-violet-800"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-[var(--foreground)]">
            {appeal.lastName} {appeal.firstName ?? ""}
          </p>
          <p className="text-xs text-[var(--muted)]">{appeal.sourceChannel}{appeal.district ? ` · ${appeal.district}` : ""}</p>
        </div>
        <StageBadge stage={appeal.stage} />
      </div>

      <p className="line-clamp-2 text-sm text-[var(--foreground)]/80">{appeal.goal}</p>

      <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-[var(--muted)]">
        {appeal.controlDate && (
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            до {format(appeal.controlDate, "d MMM", { locale: ru })}
          </span>
        )}
        {overdue && (
          <span className="flex items-center gap-1 font-medium text-red-600 dark:text-red-400">
            <AlertTriangle className="h-3.5 w-3.5" />
            просрочено
          </span>
        )}
        {showResponsible && appeal.responsible[0] && (
          <span className="flex items-center gap-1">
            <User2 className="h-3.5 w-3.5" />
            {appeal.responsible[0].user.name}
          </span>
        )}
      </div>
    </Link>
  );
}
