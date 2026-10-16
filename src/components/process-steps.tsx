"use client";

import { useState, useTransition } from "react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { STEP_CHANNELS, STEP_TYPES } from "@/lib/constants";
import { addProcessStep, deleteProcessStep, updateProcessStep, type ProcessStepInput } from "@/lib/actions";

export type ProcessStep = {
  id: string;
  stepType: string | null;
  actorName: string | null;
  targetName: string | null;
  channel: string | null;
  occurredAt: Date | null;
  stepNote: string | null;
  createdAt: Date;
  editedAt: Date | null;
  message: string;
  author: { name: string } | null;
};

const STEP_BADGE: Record<string, "success" | "warning" | "destructive" | "secondary"> = {
  Согласовано: "success",
  "Согласовано с правками": "warning",
  "Не согласовано": "destructive",
};

const emptyStep = (): ProcessStepInput => ({
  stepType: "Согласовано",
  actorName: "",
  targetName: "",
  channel: "по почте",
  occurredAt: format(new Date(), "yyyy-MM-dd"),
  comment: "",
});

function StepForm({
  value,
  onChange,
  people,
  showComment,
}: {
  value: ProcessStepInput;
  onChange: (v: ProcessStepInput) => void;
  people: string[];
  showComment: boolean;
}) {
  const set = (k: keyof ProcessStepInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    onChange({ ...value, [k]: e.target.value });
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      <NativeSelect aria-label="Этап" value={value.stepType} onChange={set("stepType")}>
        {STEP_TYPES.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </NativeSelect>
      <Input aria-label="Когда" type="date" value={value.occurredAt ?? ""} onChange={set("occurredAt")} />
      <Input aria-label="Кто" list="step-people" placeholder="Кто (напр. Чижов С.В.)" value={value.actorName} onChange={set("actorName")} />
      <Input
        aria-label="Кому / от кого"
        list="step-people"
        placeholder="Кому / от кого (необязательно)"
        value={value.targetName ?? ""}
        onChange={set("targetName")}
      />
      <NativeSelect aria-label="Каким способом" value={value.channel ?? ""} onChange={set("channel")}>
        <option value="">Способ — не указан</option>
        {STEP_CHANNELS.map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </NativeSelect>
      {showComment && (
        <Input aria-label="Комментарий" placeholder="Комментарий (необязательно)" value={value.comment ?? ""} onChange={set("comment")} />
      )}
      <datalist id="step-people">
        {people.map((p) => (
          <option key={p} value={p} />
        ))}
      </datalist>
    </div>
  );
}

/**
 * Ход согласования: любой сотрудник отмечает этапы за участников, в том числе
 * за тех, кто не пользуется приложением (поступило от…, передано…, согласовано
 * по почте…), и может исправить или удалить отмеченное.
 */
export function ProcessSteps({
  appealId,
  steps,
  people,
  canEdit,
}: {
  appealId: string;
  steps: ProcessStep[];
  people: string[];
  canEdit: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState<ProcessStepInput>(emptyStep);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<ProcessStepInput>(emptyStep);

  const sorted = [...steps].sort((a, b) => (a.occurredAt ?? a.createdAt).getTime() - (b.occurredAt ?? b.createdAt).getTime());

  function run(fn: () => Promise<{ error?: string }>, success: string, after?: () => void) {
    startTransition(async () => {
      const r = await fn();
      if (r.error) return void toast.error(r.error);
      toast.success(success);
      after?.();
    });
  }

  function startEdit(s: ProcessStep) {
    setEditingId(s.id);
    setEditDraft({
      stepType: s.stepType ?? "Другое",
      actorName: s.actorName ?? "",
      targetName: s.targetName ?? "",
      channel: s.channel ?? "",
      occurredAt: s.occurredAt ? format(s.occurredAt, "yyyy-MM-dd") : "",
      comment: s.stepNote ?? "",
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ход согласования</CardTitle>
        <CardDescription>
          Отмечайте этапы за любого участника — даже если он не пользуется приложением и, например, согласовал по почте
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {canEdit && (
          <div className="flex flex-col gap-2 rounded-lg border border-dashed border-[var(--border)] p-3">
            <StepForm value={draft} onChange={setDraft} people={people} showComment />
            <Button
              size="sm"
              className="self-end"
              disabled={pending || !draft.actorName.trim()}
              onClick={() => run(() => addProcessStep(appealId, draft), "Этап отмечен", () => setDraft(emptyStep()))}
            >
              Отметить этап
            </Button>
          </div>
        )}

        {sorted.length === 0 && <p className="text-sm text-[var(--muted)]">Этапов пока не отмечено.</p>}

        <div className="flex flex-col gap-2">
          {sorted.map((s) =>
            editingId === s.id ? (
              <div key={s.id} className="flex flex-col gap-2 rounded-lg border border-violet-300 p-3">
                <StepForm value={editDraft} onChange={setEditDraft} people={people} showComment />
                <div className="flex gap-2 self-end">
                  <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>Отмена</Button>
                  <Button
                    size="sm"
                    disabled={pending || !editDraft.actorName.trim()}
                    onClick={() => run(() => updateProcessStep(s.id, editDraft), "Этап исправлен", () => setEditingId(null))}
                  >
                    Сохранить
                  </Button>
                </div>
              </div>
            ) : (
              <div key={s.id} className="flex items-start justify-between gap-2 rounded-lg border border-[var(--border)] p-3">
                <div className="flex min-w-0 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={STEP_BADGE[s.stepType ?? ""] ?? "secondary"}>{s.stepType}</Badge>
                    <span className="text-sm font-medium">{s.actorName}</span>
                    {s.targetName && (
                      <span className="text-sm text-[var(--muted)]">
                        {s.stepType === "Поступило" || s.stepType === "Получен ответ" ? "от" : "→"} {s.targetName}
                      </span>
                    )}
                    {s.channel && <span className="text-xs text-[var(--muted)]">({s.channel})</span>}
                  </div>
                  {s.stepNote && <p className="text-sm text-[var(--foreground)]/80">{s.stepNote}</p>}
                  <p className="text-xs text-[var(--muted)]">
                    {s.occurredAt ? format(s.occurredAt, "d MMMM yyyy", { locale: ru }) : ""} · отметил(а) {s.author?.name ?? "—"}
                    {s.editedAt ? " · исправлено" : ""}
                  </p>
                </div>
                {canEdit && (
                  <div className="flex shrink-0">
                    <Button variant="ghost" size="icon" aria-label="Исправить" onClick={() => startEdit(s)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Удалить"
                      disabled={pending}
                      onClick={() => confirm("Удалить этот этап?") && run(() => deleteProcessStep(s.id), "Этап удалён")}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            )
          )}
        </div>
      </CardContent>
    </Card>
  );
}
