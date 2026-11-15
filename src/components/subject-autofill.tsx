"use client";

import { useState } from "react";
import { Wand2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { parseRegulationSubject } from "@/lib/subject-format";

const iso = (d: Date) => d.toISOString().slice(0, 10);

function setField(name: string, value: string | boolean | undefined) {
  if (value === undefined || value === "") return;
  const el = document.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(`[name="${name}"]`);
  if (!el) return;
  if (el instanceof HTMLInputElement && el.type === "checkbox") el.checked = Boolean(value);
  else el.value = String(value);
}

/** Вставьте тему письма по регламенту — поля формы заполнятся сами. */
export function SubjectAutofill() {
  const [status, setStatus] = useState<string>("");

  function apply(text: string) {
    const p = parseRegulationSubject(text);
    if (!p) {
      setStatus(text.trim() ? "Тема не в формате регламента — заполните поля вручную" : "");
      return;
    }
    setField("sourceChannel", p.sourceChannel);
    setField("region", p.region);
    setField("lastName", p.lastName);
    setField("firstName", p.firstName);
    setField("middleName", p.middleName);
    setField("receivedAtDgd", p.receivedAt && iso(p.receivedAt));
    setField("controlDate", p.controlDate && iso(p.controlDate));
    setField("subject", p.problem);
    setField("goal", p.problem);
    setField("isCollective", p.isCollective);
    setStatus("Заполнено: канал, регион, ФИО, даты, суть. Проверьте и дополните.");
  }

  return (
    <div className="flex flex-col gap-1.5 sm:col-span-2">
      <Label htmlFor="regulationSubject" className="flex items-center gap-1.5">
        <Wand2 className="h-3.5 w-3.5" /> Тема письма по регламенту — заполнит карточку
      </Label>
      <Input
        id="regulationSubject"
        placeholder="ГД; САДД; Воронежская область; Иванов И. И.; 01.11.2026-08.11.2026; Суть обращения"
        onChange={(e) => apply(e.target.value)}
      />
      {status && <p className="text-xs text-[var(--muted)]">{status}</p>}
    </div>
  );
}
