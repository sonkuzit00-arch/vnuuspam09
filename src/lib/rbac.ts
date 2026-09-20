import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

const MANAGEMENT_ROLES = ["KAU", "ADMIN"];

/** Общий свод и отчёты видят только КАУ и админы — сотрудник видит только свой кабинет. */
export async function requireManagementRole() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!MANAGEMENT_ROLES.includes(session.user.role)) redirect("/");
  return session.user;
}
