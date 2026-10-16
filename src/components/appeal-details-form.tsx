"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { CATEGORIES, DISTRICTS, SOURCE_CHANNEL_GROUPS, TARGET_AUDIENCES } from "@/lib/constants";
import { updateAppealDetails, type AppealDetailsInput } from "@/lib/actions";

type Details = Required<{ [K in keyof AppealDetailsInput]: string | null }>;

/** Правка данных заявителя и сути обращения прямо в карточке. */
export function AppealDetailsForm({
  appealId,
  initial,
  onDone,
}: {
  appealId: string;
  initial: Details;
  onDone: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState<Record<string, string>>(
    Object.fromEntries(Object.entries(initial).map(([k, v]) => [k, v ?? ""]))
  );
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const withCurrent = (list: readonly string[], value: string) => (value && !list.includes(value) ? [value, ...list] : list);

  function save() {
    startTransition(async () => {
      const r = await updateAppealDetails(appealId, form);
      if (r.error) return void toast.error(r.error);
      toast.success("Карточка сохранена");
      onDone();
    });
  }

  const field = (key: string, label: string, el: React.ReactNode) => (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={`d-${key}`}>{label}</Label>
      {el}
    </div>
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {field("lastName", "Фамилия / организация*", <Input id="d-lastName" value={form.lastName} onChange={set("lastName")} />)}
        {field("firstName", "Имя", <Input id="d-firstName" value={form.firstName} onChange={set("firstName")} />)}
        {field("middleName", "Отчество", <Input id="d-middleName" value={form.middleName} onChange={set("middleName")} />)}
        {field("phone", "Телефон", <Input id="d-phone" value={form.phone} onChange={set("phone")} />)}
        {field("email", "Email", <Input id="d-email" type="email" value={form.email} onChange={set("email")} />)}
        {field("socialHandle", "Соцсети", <Input id="d-socialHandle" value={form.socialHandle} onChange={set("socialHandle")} />)}
        {field("address", "Адрес", <Input id="d-address" value={form.address} onChange={set("address")} />)}
        {field(
          "district",
          "Район",
          <NativeSelect id="d-district" value={form.district} onChange={set("district")}>
            <option value="">—</option>
            {withCurrent(DISTRICTS, form.district).map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </NativeSelect>
        )}
        {field(
          "sourceChannel",
          "Канал поступления*",
          <NativeSelect id="d-sourceChannel" value={form.sourceChannel} onChange={set("sourceChannel")}>
            {Object.entries(SOURCE_CHANNEL_GROUPS).map(([group, channels]) => (
              <optgroup key={group} label={group}>
                {channels.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </optgroup>
            ))}
          </NativeSelect>
        )}
      </div>
      {field("goal", "Суть обращения*", <Textarea id="d-goal" value={form.goal} onChange={set("goal")} className="min-h-16" />)}
      {field("description", "Описание", <Textarea id="d-description" value={form.description} onChange={set("description")} rows={5} />)}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {field(
          "category",
          "Категория*",
          <NativeSelect id="d-category" value={form.category} onChange={set("category")}>
            {withCurrent(CATEGORIES, form.category).map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </NativeSelect>
        )}
        {field(
          "targetAudience",
          "Целевая аудитория",
          <NativeSelect id="d-targetAudience" value={form.targetAudience} onChange={set("targetAudience")}>
            <option value="">—</option>
            {withCurrent(TARGET_AUDIENCES, form.targetAudience).map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </NativeSelect>
        )}
      </div>
      <div className="flex gap-2">
        <Button disabled={pending} onClick={save}>{pending ? "Сохранение…" : "Сохранить"}</Button>
        <Button variant="ghost" disabled={pending} onClick={onDone}>Отмена</Button>
      </div>
    </div>
  );
}
