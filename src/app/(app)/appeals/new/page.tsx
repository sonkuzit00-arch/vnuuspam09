import { getUsers } from "@/lib/queries";
import { createAppeal } from "@/lib/actions";
import { SOURCE_CHANNELS, DISTRICTS, CATEGORIES, TARGET_AUDIENCES, DEFAULT_RESPONSIBLE_BY_CHANNEL } from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { Button } from "@/components/ui/button";

export default async function NewAppealPage() {
  const users = await getUsers();
  const defaultByName = Object.values(DEFAULT_RESPONSIBLE_BY_CHANNEL);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Новое обращение</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Карточка заводится один раз — дальше видна и в кабинете ответственного, и в общем своде.
        </p>
      </div>

      <form action={createAppeal} className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Канал поступления</CardTitle>
            <CardDescription>Откуда пришло обращение — определяет маршрутизацию по регламенту</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sourceChannel">Источник *</Label>
              <NativeSelect id="sourceChannel" name="sourceChannel" required defaultValue="">
                <option value="" disabled>Выберите источник</option>
                {SOURCE_CHANNELS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </NativeSelect>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="responsibleId">Ответственный *</Label>
              <NativeSelect id="responsibleId" name="responsibleId" required defaultValue="">
                <option value="" disabled>Выберите ответственного</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}{defaultByName.includes(u.name) ? " · по умолчанию для канала" : ""}
                  </option>
                ))}
              </NativeSelect>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Заявитель</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="lastName">Фамилия *</Label>
              <Input id="lastName" name="lastName" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="firstName">Имя</Label>
              <Input id="firstName" name="firstName" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="middleName">Отчество</Label>
              <Input id="middleName" name="middleName" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="district">Район</Label>
              <NativeSelect id="district" name="district" defaultValue="">
                <option value="">—</option>
                {DISTRICTS.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </NativeSelect>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="phone">Телефон</Label>
              <Input id="phone" name="phone" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="socialHandle">Соцсети / аккаунт</Label>
              <Input id="socialHandle" name="socialHandle" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="address">Адрес</Label>
              <Input id="address" name="address" />
            </div>
            <div className="flex items-center gap-2 sm:col-span-2">
              <input id="isCollective" name="isCollective" type="checkbox" className="h-4 w-4 rounded border-[var(--border)]" />
              <Label htmlFor="isCollective" className="!text-[var(--foreground)]">Коллективное обращение</Label>
              <Input name="signatoryCount" type="number" placeholder="Кол-во подписавших" className="ml-auto w-40" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Суть обращения</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="goal">Цель обращения *</Label>
              <Textarea id="goal" name="goal" required placeholder="Что нужно сделать / чего добиться" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="description">Полное описание</Label>
              <Textarea id="description" name="description" rows={5} />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="category">Категория *</Label>
                <NativeSelect id="category" name="category" required defaultValue="">
                  <option value="" disabled>Выберите категорию</option>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </NativeSelect>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="targetAudience">Целевая аудитория</Label>
                <NativeSelect id="targetAudience" name="targetAudience" defaultValue="">
                  <option value="">—</option>
                  {TARGET_AUDIENCES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </NativeSelect>
              </div>
            </div>
            <div className="flex flex-col gap-1.5 sm:w-64">
              <Label htmlFor="controlDate">Контрольный срок</Label>
              <Input id="controlDate" name="controlDate" type="date" />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="submit" size="lg">Зарегистрировать обращение</Button>
        </div>
      </form>
    </div>
  );
}
