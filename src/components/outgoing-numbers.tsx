"use client";

import { useState, useTransition } from "react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { addOutgoingNumber, updateOutgoingNumberResult } from "@/lib/actions";

type OutgoingNumber = {
  id: string;
  number: string;
  label: string | null;
  responseReceivedAt: Date | null;
  responseSummary: string | null;
  assistanceProvided: boolean | null;
};

export function OutgoingNumbers({
  appealId,
  items,
  readOnly,
}: {
  appealId: string;
  items: OutgoingNumber[];
  readOnly: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [number, setNumber] = useState("");
  const [label, setLabel] = useState("");

  function submitAdd() {
    if (!number.trim()) return;
    startTransition(async () => {
      await addOutgoingNumber(appealId, number, label || undefined);
      setNumber("");
      setLabel("");
      toast.success("Исходящий номер добавлен");
    });
  }

  function saveResult(id: string, fields: Parameters<typeof updateOutgoingNumberResult>[1]) {
    startTransition(async () => {
      await updateOutgoingNumberResult(id, fields);
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <Label>Номера исходящих (перенаправление, депутатский запрос…)</Label>

      {items.length === 0 && (
        <p className="text-sm text-[var(--muted)]">Исходящих номеров пока нет.</p>
      )}

      <div className="flex flex-col gap-2">
        {items.map((item) => (
          <div key={item.id} className="flex flex-col gap-2 rounded-lg border border-[var(--border)] p-2.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium">
                №{item.number}
                {item.label && <span className="font-normal text-[var(--muted)]"> · {item.label}</span>}
              </p>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="flex flex-col gap-1">
                <span className="text-[11px] text-[var(--muted)]">Дата ответа органа власти</span>
                <Input
                  type="date"
                  disabled={readOnly}
                  defaultValue={item.responseReceivedAt ? format(item.responseReceivedAt, "yyyy-MM-dd") : ""}
                  onBlur={(e) => saveResult(item.id, { responseReceivedAt: e.target.value })}
                  className="h-8 text-xs"
                />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[11px] text-[var(--muted)]">Содействие оказано</span>
                {readOnly ? (
                  <p className="text-xs">
                    {item.assistanceProvided === true ? "Да" : item.assistanceProvided === false ? "Нет" : "Ответа нет"}
                  </p>
                ) : (
                  <div className="flex gap-1">
                    {([
                      { v: true, label: "Да" },
                      { v: false, label: "Нет" },
                    ] as const).map((opt) => (
                      <button
                        key={String(opt.v)}
                        type="button"
                        disabled={pending}
                        onClick={() => saveResult(item.id, { assistanceProvided: opt.v })}
                        className={cn(
                          "rounded-md border px-2 py-1 text-xs font-medium",
                          item.assistanceProvided === opt.v
                            ? opt.v
                              ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300"
                              : "border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-500/10 dark:text-red-300"
                            : "border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-2)]"
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[11px] text-[var(--muted)]">Краткая суть ответа</span>
              {readOnly ? (
                <p className="text-xs text-[var(--foreground)]/80">{item.responseSummary || "—"}</p>
              ) : (
                <Textarea
                  defaultValue={item.responseSummary ?? ""}
                  onBlur={(e) => saveResult(item.id, { responseSummary: e.target.value })}
                  className="min-h-12 text-xs"
                  placeholder="Суть ответа органа власти"
                />
              )}
            </div>
            {item.responseReceivedAt && (
              <p className="text-[11px] text-[var(--muted)]">
                Ответ получен {format(item.responseReceivedAt, "d MMMM yyyy", { locale: ru })}
              </p>
            )}
          </div>
        ))}
      </div>

      {!readOnly && (
        <div className="flex flex-col gap-2 rounded-lg border border-dashed border-[var(--border)] p-2.5">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Input placeholder="Номер исходящего" value={number} onChange={(e) => setNumber(e.target.value)} className="h-8 text-xs" />
            <Input placeholder="Куда / что за документ (необязательно)" value={label} onChange={(e) => setLabel(e.target.value)} className="h-8 text-xs" />
          </div>
          <Button size="sm" variant="outline" className="self-start" disabled={pending || !number.trim()} onClick={submitAdd}>
            <Plus className="h-3.5 w-3.5" /> Добавить исходящий
          </Button>
        </div>
      )}
    </div>
  );
}
