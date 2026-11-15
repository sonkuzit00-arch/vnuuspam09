import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { countNewTasks } from "@/lib/queries";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const newTasks = await countNewTasks(session.user.id);

  return <AppShell user={session.user} newTasks={newTasks}>{children}</AppShell>;
}
