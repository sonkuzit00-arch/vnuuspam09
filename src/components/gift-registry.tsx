"use client";

import { useMemo, useState, useTransition } from "react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { CheckCircle2, Gift, Pencil, Plus, Search, Trash2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { GIFT_CATEGORIES } from "@/lib/constants";
import {
  createGift,
  updateGift,
  deleteGift,
  issueGift,
  cancelIssue,
  type GiftInput,
  type IssueInput,
} from "@/lib/gift-actions";

type GiftItem = {
  id: string;
  category: string;
  name: string;
  description: string | null;
  nominal: number | null;
  quantity: number;
  note: string | null;
};

type GiftIssue = {
  id: string;
  quantity: number;
  recipient: string;
  reason: string | null;
  approvedAt: Date;
  item: { name: string; category: string; nominal: number | null };
  issuedBy: { name: string } | null;
};

type Result = { error?: string };

const EMPTY_GIFT: GiftInput = { category: "Алкоголь", name: "", description: "", nominal: "", quantity: "1", note: "" };

function rub(n: number) {
  return `${n.toLocaleString("ru-RU")} ₽`;
}

function GiftForm({
  initial,
  pending,
  onSubmit,
  onCancel,
}: {
  initial: GiftInput;
  pending: boolean;
  onSubmit: (input: GiftInput) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState(initial);
  const field = (key: keyof GiftInput) => ({
    id: `gift-${key}`,
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm({ ...form, [key]: e.target.value }),
  });

  return (
    <form
      className="grid grid-cols-1 gap-3 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(form);
      }}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="gift-category">Категория</Label>
        <NativeSelect {...field("category")}>
          {GIFT_CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </NativeSelect>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="gift-quantity">Количество</Label>
        <Input {...field("quantity")} type="number" min={0} step={1} required />
      </div>
      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <Label htmlFor="gift-name">Название *</Label>
        <Input {...field("name")} placeholder={form.category === "Сертификат" ? "Сертификат «Галерея Чижова»" : "Коньяк «Арарат» 5 лет, 0,5 л"} required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="gift-nominal">{form.category === "Сертификат" ? "Номинал, ₽" : "Стоимость, ₽"}</Label>
        <Input {...field("nominal")} inputMode="numeric" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="gift-description">Описание</Label>
        <Input {...field("description")} placeholder="Упаковка, срок действия…" />
      </div>
      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <Label htmlFor="gift-note">Примечание</Label>
        <Textarea {...field("note")} placeholder="Где хранится, от кого поступил и т.п." />
      </div>
      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" disabled={pending}>Сохранить</Button>
        <Button type="button" variant="ghost" onClick={onCancel}>Отмена</Button>
      </div>
    </form>
  );
}

function IssueForm({
  item,
  pending,
  onSubmit,
  onCancel,
}: {
  item: GiftItem;
  pending: boolean;
  onSubmit: (input: IssueInput) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<IssueInput>({
    quantity: "1",
    recipient: "",
    reason: "",
    approvedAt: format(new Date(), "yyyy-MM-dd"),
  });
  const field = (key: keyof IssueInput) => ({
    id: `issue-${key}`,
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [key]: e.target.value }),
  });

  return (
    <form
      className="grid grid-cols-1 gap-3 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(form);
      }}
    >
      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <Label htmlFor="issue-recipient">Кому *</Label>
        <Input {...field("recipient")} placeholder="ФИО, должность, организация" required />
      </div>
      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <Label htmlFor="issue-reason">Повод</Label>
        <Input {...field("reason")} placeholder="День рождения, юбилей, благодарность…" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="issue-quantity">Количество (в наличии {item.quantity})</Label>
        <Input {...field("quantity")} type="number" min={1} max={item.quantity} step={1} required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="issue-approvedAt">Дата согласования</Label>
        <Input {...field("approvedAt")} type="date" required />
      </div>
      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" disabled={pending}>
          <CheckCircle2 className="h-4 w-4" /> Списать из наличия
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>Отмена</Button>
      </div>
    </form>
  );
}

export function GiftRegistry({ items, issues, canEdit }: { items: GiftItem[]; issues: GiftIssue[]; canEdit: boolean }) {
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [editing, setEditing] = useState<GiftItem | "new" | null>(null);
  const [issuing, setIssuing] = useState<GiftItem | null>(null);

  const q = query.trim().toLowerCase();
  const visibleItems = useMemo(
    () =>
      items.filter(
        (i) =>
          (category === "all" || i.category === category) &&
          (!q || [i.name, i.description, i.note].join(" ").toLowerCase().includes(q))
      ),
    [items, category, q]
  );
  const visibleIssues = useMemo(
    () =>
      issues.filter(
        (i) =>
          (category === "all" || i.item.category === category) &&
          (!q || [i.item.name, i.recipient, i.reason].join(" ").toLowerCase().includes(q))
      ),
    [issues, category, q]
  );

  const totals = useMemo(() => {
    const byCategory = new Map<string, number>();
    for (const i of items) byCategory.set(i.category, (byCategory.get(i.category) ?? 0) + i.quantity);
    return byCategory;
  }, [items]);

  function run(fn: () => Promise<Result>, success: string) {
    startTransition(async () => {
      try {
        const result = await fn();
        if (result.error) return void toast.error(result.error);
        toast.success(success);
        setEditing(null);
        setIssuing(null);
      } catch {
        toast.error("Не удалось выполнить действие");
      }
    });
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {GIFT_CATEGORIES.map((c) => (
          <Badge key={c} variant="secondary">
            {c}: {totals.get(c) ?? 0} шт.
          </Badge>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
          <Input
            className="pl-9"
            placeholder="Поиск: название, кому, повод…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Поиск подарков"
          />
        </div>
        <NativeSelect className="w-auto" value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Категория">
          <option value="all">Все категории</option>
          {GIFT_CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </NativeSelect>
        {canEdit && (
          <Button onClick={() => setEditing("new")}>
            <Plus className="h-4 w-4" /> Добавить подарок
          </Button>
        )}
      </div>

      <Tabs defaultValue="stock">
        <TabsList>
          <TabsTrigger value="stock">В наличии</TabsTrigger>
          <TabsTrigger value="issued">Выдано</TabsTrigger>
        </TabsList>

        <TabsContent value="stock">
          <Card>
            <CardContent className="flex flex-col gap-2 pt-5">
              {visibleItems.length === 0 && (
                <p className="text-sm text-[var(--muted)]">
                  {items.length === 0 ? "В наличии ничего нет. Нажмите «Добавить подарок»." : "Ничего не найдено."}
                </p>
              )}
              {visibleItems.map((i) => (
                <div key={i.id} className="flex flex-col gap-2 rounded-lg border border-[var(--border)] p-3 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Gift className="h-3.5 w-3.5 text-[var(--muted)]" />
                      <p className="text-sm font-medium">{i.name}</p>
                      <Badge variant="secondary">{i.category}</Badge>
                      {i.nominal !== null && <span className="text-xs text-[var(--muted)]">{rub(i.nominal)}</span>}
                    </div>
                    {(i.description || i.note) && (
                      <p className="mt-1 text-xs text-[var(--muted)]">{[i.description, i.note].filter(Boolean).join(" · ")}</p>
                    )}
                  </div>
                  <p className="text-sm font-semibold tabular-nums">{i.quantity} шт.</p>
                  {canEdit && (
                    <div className="flex gap-1">
                      <Button size="sm" disabled={pending} onClick={() => setIssuing(i)}>
                        <CheckCircle2 className="h-3.5 w-3.5" /> Согласовано ЧСВ
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setEditing(i)} aria-label="Изменить">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={pending}
                        aria-label="Удалить"
                        onClick={() =>
                          confirm(`Удалить «${i.name}» из реестра вместе с историей выдач? Если подарок выдан — нажмите «Согласовано ЧСВ».`) &&
                          run(() => deleteGift(i.id), "Удалено")
                        }
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="issued">
          <Card>
            <CardHeader>
              <CardTitle>История выдач · {visibleIssues.length}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {visibleIssues.length === 0 && <p className="text-sm text-[var(--muted)]">Выдач пока нет.</p>}
              {visibleIssues.map((s) => (
                <div key={s.id} className="flex flex-col gap-2 rounded-lg border border-[var(--border)] p-3 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium">{s.item.name}</p>
                      <Badge variant="secondary">{s.item.category}</Badge>
                      {s.quantity > 1 && <span className="text-xs text-[var(--muted)]">× {s.quantity}</span>}
                    </div>
                    <p className="mt-1 text-sm">
                      {s.recipient}
                      {s.reason && <span className="text-[var(--muted)]"> · {s.reason}</span>}
                    </p>
                    <p className="text-xs text-[var(--muted)]">
                      Согласовано ЧСВ {format(s.approvedAt, "d MMMM yyyy", { locale: ru })}
                      {s.issuedBy && ` · отметил(а) ${s.issuedBy.name}`}
                    </p>
                  </div>
                  {canEdit && (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={pending}
                      onClick={() =>
                        confirm(`Отменить выдачу «${s.item.name}» — ${s.recipient}? Подарок вернётся в наличие.`) &&
                        run(() => cancelIssue(s.id), "Выдача отменена, подарок вернулся в наличие")
                      }
                    >
                      <Undo2 className="h-3.5 w-3.5" /> Вернуть в наличие
                    </Button>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing === "new" ? "Новый подарок" : "Изменить подарок"}</DialogTitle>
            <DialogDescription>Одинаковые подарки заводите одной позицией с количеством.</DialogDescription>
          </DialogHeader>
          {editing !== null && (
            <GiftForm
              key={editing === "new" ? "new" : editing.id}
              initial={
                editing === "new"
                  ? EMPTY_GIFT
                  : {
                      category: editing.category,
                      name: editing.name,
                      description: editing.description ?? "",
                      nominal: editing.nominal?.toString() ?? "",
                      quantity: editing.quantity.toString(),
                      note: editing.note ?? "",
                    }
              }
              pending={pending}
              onCancel={() => setEditing(null)}
              onSubmit={(input) =>
                editing === "new"
                  ? run(() => createGift(input), "Подарок добавлен")
                  : run(() => updateGift(editing.id, input), "Сохранено")
              }
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={issuing !== null} onOpenChange={(open) => !open && setIssuing(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Согласовано ЧСВ: {issuing?.name}</DialogTitle>
            <DialogDescription>Подарок спишется из наличия и сохранится в истории выдач.</DialogDescription>
          </DialogHeader>
          {issuing && (
            <IssueForm
              key={issuing.id}
              item={issuing}
              pending={pending}
              onCancel={() => setIssuing(null)}
              onSubmit={(input) => run(() => issueGift(issuing.id, input), "Списано из наличия")}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
