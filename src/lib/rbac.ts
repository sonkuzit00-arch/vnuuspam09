import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { MANAGEMENT_ROLES, READ_ONLY_ROLES } from "@/lib/constants";

/** Общий свод и отчёты видят КАУ, админы и наблюдатели — рабочие роли только свой кабинет. */
export async function requireManagementRole() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!(MANAGEMENT_ROLES as readonly string[]).includes(session.user.role)) redirect("/");
  return session.user;
}

export function isReadOnly(role: string) {
  return (READ_ONLY_ROLES as readonly string[]).includes(role);
}
