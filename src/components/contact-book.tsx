"use client";

import { useMemo, useState, useTransition } from "react";
import { Building2, Mail, Pencil, Phone, Plus, Search, Smartphone, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { createContact, updateContact, deleteContact, type ContactInput } from "@/lib/contact-actions";

type Contact = {
  id: string;
  organization: string;
  department: string | null;
  fullName: string;
  position: string | null;
  phone: string | null;
  mobilePhone: string | null;
  email: string | null;
  note: string | null;
};

const EMPTY: ContactInput = {
  organization: "",
  department: "",
  fullName: "",
  position: "",
  phone: "",
  mobilePhone: "",
  email: "",
  note: "",
};

function toInput(c: Contact): ContactInput {
  return {
    organization: c.organization,
    department: c.department ?? "",
    fullName: c.fullName,
    position: c.position ?? "",
    phone: c.phone ?? "",
    mobilePhone: c.mobilePhone ?? "",
    email: c.email ?? "",
    note: c.note ?? "",
  };
}

function telHref(phone: string) {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

function ContactForm({
  initial,
  organizations,
  pending,
  onSubmit,
  onCancel,
}: {
  initial: ContactInput;
  organizations: string[];
  pending: boolean;
  onSubmit: (input: ContactInput) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState(initial);
  const field = (key: keyof ContactInput) => ({
    id: `contact-${key}`,
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm({ ...form, [key]: e.target.value }),
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
        <Label htmlFor="contact-organization">Орган власти *</Label>
        <Input {...field("organization")} list="contact-organizations" placeholder="Напр. Департамент ЖКХ и энергетики" required />
        <datalist id="contact-organizations">
          {organizations.map((o) => (
            <option key={o} value={o} />
          ))}
        </datalist>
      </div>
      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <Label htmlFor="contact-department">Управление / отдел</Label>
        <Input {...field("department")} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="contact-fullName">ФИО *</Label>
        <Input {...field("fullName")} required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="contact-position">Должность</Label>
        <Input {...field("position")} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="contact-phone">Рабочий телефон</Label>
        <Input {...field("phone")} type="tel" placeholder="+7 (473) 000-00-00, доб. 123" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="contact-mobilePhone">Мобильный</Label>
        <Input {...field("mobilePhone")} type="tel" placeholder="+7 900 000-00-00" />
      </div>
      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <Label htmlFor="contact-email">Email</Label>
        <Input {...field("email")} type="email" />
      </div>
      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <Label htmlFor="contact-note">Примечание</Label>
        <Textarea {...field("note")} placeholder="По каким вопросам обращаться, удобное время и т.п." />
      </div>
      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" disabled={pending}>Сохранить</Button>
        <Button type="button" variant="ghost" onClick={onCancel}>Отмена</Button>
      </div>
    </form>
  );
}

export function ContactBook({ contacts, canEdit }: { contacts: Contact[]; canEdit: boolean }) {
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Contact | "new" | null>(null);

  const organizations = useMemo(() => [...new Set(contacts.map((c) => c.organization))], [contacts]);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const digits = q.replace(/\D/g, "");
    const filtered = contacts.filter((c) => {
      if (!q) return true;
      const text = [c.organization, c.department, c.fullName, c.position, c.email, c.note].join(" ").toLowerCase();
      const phones = [c.phone, c.mobilePhone].join(" ").replace(/\D/g, "");
      return text.includes(q) || (digits.length >= 3 && phones.includes(digits));
    });
    const map = new Map<string, Contact[]>();
    for (const c of filtered) map.set(c.organization, [...(map.get(c.organization) ?? []), c]);
    return [...map.entries()];
  }, [contacts, query]);

  function run(fn: () => Promise<{ error?: string }>, success: string) {
    startTransition(async () => {
      try {
        const result = await fn();
        if (result.error) return void toast.error(result.error);
        toast.success(success);
        setEditing(null);
      } catch {
        toast.error("Не удалось выполнить действие");
      }
    });
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
          <Input
            className="pl-9"
            placeholder="Поиск: ФИО, орган, должность, телефон…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Поиск контактов"
          />
        </div>
        {canEdit && (
          <Button onClick={() => setEditing("new")}>
            <Plus className="h-4 w-4" /> Добавить контакт
          </Button>
        )}
      </div>

      {contacts.length === 0 ? (
        <Card>
          <CardContent className="pt-5 text-sm text-[var(--muted)]">
            Книжка пока пуста. {canEdit && "Нажмите «Добавить контакт», чтобы записать первого сотрудника органа власти."}
          </CardContent>
        </Card>
      ) : groups.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">Ничего не найдено по запросу «{query}».</p>
      ) : (
        groups.map(([organization, items]) => (
          <Card key={organization}>
            <CardHeader>
              <CardTitle className="flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5" /> {organization}
                <span className="font-normal text-[var(--muted)]">· {items.length}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {items.map((c) => (
                <div key={c.id} className="flex flex-col gap-2 rounded-lg border border-[var(--border)] p-3 sm:flex-row sm:items-start">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{c.fullName}</p>
                    {(c.position || c.department) && (
                      <p className="text-xs text-[var(--muted)]">{[c.position, c.department].filter(Boolean).join(" · ")}</p>
                    )}
                    <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                      {c.phone && (
                        <a href={telHref(c.phone)} className="flex items-center gap-1 hover:underline">
                          <Phone className="h-3.5 w-3.5 text-[var(--muted)]" /> {c.phone}
                        </a>
                      )}
                      {c.mobilePhone && (
                        <a href={telHref(c.mobilePhone)} className="flex items-center gap-1 hover:underline">
                          <Smartphone className="h-3.5 w-3.5 text-[var(--muted)]" /> {c.mobilePhone}
                        </a>
                      )}
                      {c.email && (
                        <a href={`mailto:${c.email}`} className="flex items-center gap-1 break-all hover:underline">
                          <Mail className="h-3.5 w-3.5 text-[var(--muted)]" /> {c.email}
                        </a>
                      )}
                    </div>
                    {c.note && <p className="mt-1.5 whitespace-pre-line text-xs text-[var(--muted)]">{c.note}</p>}
                  </div>
                  {canEdit && (
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" onClick={() => setEditing(c)} aria-label="Изменить">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={pending}
                        aria-label="Удалить"
                        onClick={() => confirm(`Удалить контакт ${c.fullName}?`) && run(() => deleteContact(c.id), "Контакт удалён")}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        ))
      )}

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing === "new" ? "Новый контакт" : "Изменить контакт"}</DialogTitle>
            <DialogDescription>Обязательно: орган власти, ФИО и телефон или email.</DialogDescription>
          </DialogHeader>
          {editing !== null && (
            <ContactForm
              key={editing === "new" ? "new" : editing.id}
              initial={editing === "new" ? EMPTY : toInput(editing)}
              organizations={organizations}
              pending={pending}
              onCancel={() => setEditing(null)}
              onSubmit={(input) =>
                editing === "new"
                  ? run(() => createContact(input), "Контакт добавлен")
                  : run(() => updateContact(editing.id, input), "Сохранено")
              }
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
