import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isReadOnly } from "@/lib/rbac";
import { ContactBook } from "@/components/contact-book";

export default async function ContactsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const contacts = await prisma.govContact.findMany({
    orderBy: [{ organization: "asc" }, { fullName: "asc" }],
    select: {
      id: true,
      organization: true,
      department: true,
      fullName: true,
      position: true,
      phone: true,
      mobilePhone: true,
      email: true,
      note: true,
    },
  });

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Контакты ОГВ</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Сотрудники органов власти, с которыми работаем по обращениям. Книжка общая — записи видят все пользователи.
        </p>
      </div>
      <ContactBook contacts={contacts} canEdit={!isReadOnly(session.user.role)} />
    </div>
  );
}
