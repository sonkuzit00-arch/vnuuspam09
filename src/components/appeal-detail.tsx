"use client";

import { useState, useTransition } from "react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { motion } from "framer-motion";
import {
  Phone,
  Mail,
  MapPin,
  Users,
  Clock,
  CheckCircle2,
  Send,
  Megaphone,
  Award,
  Forward,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { StageBadge } from "@/components/stage-badge";
import { STAGES, STAGE_LABELS, RESOLUTION_PATHS } from "@/lib/constants";
import { isOverdue } from "@/lib/sla";
import { cn } from "@/lib/utils";
import type { getAppeal } from "@/lib/queries";
import { updateAppealStage, addAppealNote, updateAppealFields } from "@/lib/actions";

type Appeal = NonNullable<Awaited<ReturnType<typeof getAppeal>>>;

const EVENT_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  CREATED: Send,
  STAGE_CHANGE: CheckCircle2,
  DZ_SENT: Forward,
  GRATITUDE: Award,
  MEDIA: Megaphone,
  NOTE: Clock,
};

function fmt(d: Date | null) {
  return d ? format(d, "d MMMM yyyy, HH:mm", { locale: ru }) : "—";
}

export function AppealDetail({ appeal }: { appeal: Appeal }) {
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState("");
  const overdue = isOverdue(appeal);

  const responsible = appeal.responsible.find((r) => r.isCurrent)?.user ?? appeal.responsible[0]?.user;

  function handleStage(stage: string) {
    startTransition(async () => {
      await updateAppealStage(appeal.id, stage);
      toast.success(`Статус: ${STAGE_LABELS[stage as keyof typeof STAGE_LABELS]}`);
    });
  }

  function handleField(name: Parameters<typeof updateAppealFields>[1]) {
    startTransition(async () => {
      await updateAppealFields(appeal.id, name);
    });
  }

  function submitNote() {
    if (!note.trim()) return;
    startTransition(async () => {
      await addAppealNote(appeal.id, note);
      setNote("");
      toast.success("Комментарий добавлен");
    });
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              {appeal.lastName} {appeal.firstName} {appeal.middleName}
            </h1>
            <StageBadge stage={appeal.stage} />
            {overdue && <Badge variant="destructive">просрочено</Badge>}
          </div>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {appeal.sourceChannel} · зарегистрировано {fmt(appeal.receivedAtKau ?? appeal.createdAt)}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {STAGES.map((s) => (
            <Button
              key={s}
              size="sm"
              variant={appeal.stage === s ? "default" : "outline"}
              disabled={pending}
              onClick={() => handleStage(s)}
            >
              {STAGE_LABELS[s]}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Суть обращения</CardTitle>
              <CardDescription>{appeal.category}{appeal.targetAudience ? ` · ${appeal.targetAudience}` : ""}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <p className="text-sm font-medium">{appeal.goal}</p>
              {appeal.description && (
                <p className="whitespace-pre-line text-sm text-[var(--foreground)]/80">{appeal.description}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Концепция и алгоритм решения</CardTitle>
              <CardDescription>Согласовывается с СД до начала работы (регламент)</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <EditableField
                label="Концепция"
                defaultValue={appeal.concept ?? ""}
                onSave={(v) => handleField({ concept: v })}
              />
              <EditableField
                label="Алгоритм действий"
                defaultValue={appeal.actionPlan ?? ""}
                onSave={(v) => handleField({ actionPlan: v })}
                rows={5}
              />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label>Путь решения</Label>
                  <NativeSelect
                    defaultValue={appeal.resolutionPath ?? ""}
                    onChange={(e) => handleField({ resolutionPath: e.target.value })}
                  >
                    <option value="">—</option>
                    {RESOLUTION_PATHS.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </NativeSelect>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Контрольный срок</Label>
                  <Input
                    type="date"
                    defaultValue={appeal.controlDate ? format(appeal.controlDate, "yyyy-MM-dd") : ""}
                    onBlur={(e) => handleField({ controlDate: e.target.value })}
                  />
                </div>
              </div>
              <EditableField
                label="Результат"
                defaultValue={appeal.result ?? ""}
                onSave={(v) => handleField({ result: v })}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>История взаимодействия</CardTitle>
              <CardDescription>Полная CRM-история по обращению (требование регламента)</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex gap-2">
                <Textarea
                  placeholder="Добавить заметку / этап переписки…"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="min-h-16"
                />
                <Button onClick={submitNote} disabled={pending || !note.trim()}>Добавить</Button>
              </div>
              <ol className="flex flex-col gap-4 border-l border-[var(--border)] pl-4">
                {appeal.events.map((ev) => {
                  const Icon = EVENT_ICON[ev.type] ?? Clock;
                  return (
                    <motion.li
                      key={ev.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="relative"
                    >
                      <span className="absolute -left-[21px] flex h-4 w-4 items-center justify-center rounded-full bg-violet-600 text-white">
                        <Icon className="h-2.5 w-2.5" />
                      </span>
                      <p className="text-sm">{ev.message}</p>
                      <p className="text-xs text-[var(--muted)]">
                        {ev.author?.name ?? "Система"} · {fmt(ev.createdAt)}
                      </p>
                    </motion.li>
                  );
                })}
              </ol>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Заявитель</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2.5 text-sm">
              {appeal.phone && (
                <div className="flex items-center gap-2 text-[var(--foreground)]/80">
                  <Phone className="h-3.5 w-3.5 text-[var(--muted)]" /> {appeal.phone}
                </div>
              )}
              {appeal.email && (
                <div className="flex items-center gap-2 text-[var(--foreground)]/80">
                  <Mail className="h-3.5 w-3.5 text-[var(--muted)]" /> {appeal.email}
                </div>
              )}
              {appeal.address && (
                <div className="flex items-center gap-2 text-[var(--foreground)]/80">
                  <MapPin className="h-3.5 w-3.5 text-[var(--muted)]" /> {appeal.address}
                </div>
              )}
              {appeal.isCollective && (
                <div className="flex items-center gap-2 text-[var(--foreground)]/80">
                  <Users className="h-3.5 w-3.5 text-[var(--muted)]" /> Коллективное · {appeal.signatoryCount ?? "?"} подписей
                </div>
              )}
              {responsible && (
                <div className="mt-2 rounded-lg bg-[var(--surface-2)] p-2.5 text-xs">
                  Ответственный: <span className="font-medium">{responsible.name}</span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Маршрутизация</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
              <EditableField
                label="Номер регистрации"
                defaultValue={appeal.registrationNumber ?? ""}
                onSave={(v) => handleField({ registrationNumber: v })}
                compact
              />
              <EditableField
                label="Номер перенаправления"
                defaultValue={appeal.redirectNumber ?? ""}
                onSave={(v) => handleField({ redirectNumber: v })}
                compact
              />
              <ToggleRow
                label="Отправлено в ОП"
                checked={appeal.forwardedToOp}
                onChange={(v) => handleField({ forwardedToOp: v })}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Закрытие обращения</CardTitle>
              <CardDescription>Обязательные шаги по регламенту</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <ToggleRow
                label="Благодарственное письмо"
                checked={appeal.gratitudeSent}
                onChange={(v) => handleField({ gratitudeSent: v })}
                icon={Award}
              />
              <ToggleRow
                label="Освещено в СМИ"
                checked={appeal.mediaCoverageSent}
                onChange={(v) => handleField({ mediaCoverageSent: v })}
                icon={Megaphone}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function EditableField({
  label,
  defaultValue,
  onSave,
  rows,
  compact,
}: {
  label: string;
  defaultValue: string;
  onSave: (v: string) => void;
  rows?: number;
  compact?: boolean;
}) {
  const [value, setValue] = useState(defaultValue);
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      {compact ? (
        <Input value={value} onChange={(e) => setValue(e.target.value)} onBlur={() => onSave(value)} />
      ) : (
        <Textarea
          value={value}
          rows={rows}
          onChange={(e) => setValue(e.target.value)}
          onBlur={() => onSave(value)}
          placeholder="—"
        />
      )}
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
  icon: Icon,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn(
        "flex items-center justify-between rounded-lg border px-3 py-2 text-sm transition-colors",
        checked
          ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300"
          : "border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)]/80 hover:bg-[var(--surface-2)]"
      )}
    >
      <span className="flex items-center gap-2">
        {Icon && <Icon className="h-3.5 w-3.5" />}
        {label}
      </span>
      <span className={cn("h-4 w-4 rounded-full border", checked ? "border-emerald-500 bg-emerald-500" : "border-[var(--border)]")} />
    </button>
  );
}
