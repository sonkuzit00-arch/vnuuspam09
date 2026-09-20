import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { getAppeal, getUsers } from "@/lib/queries";
import { AppealDetail } from "@/components/appeal-detail";

export default async function AppealPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [appeal, users, session] = await Promise.all([getAppeal(id), getUsers(), auth()]);
  if (!appeal) notFound();

  return <AppealDetail appeal={appeal} users={users} currentUser={session!.user} />;
}
