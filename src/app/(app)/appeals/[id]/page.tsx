import { notFound } from "next/navigation";
import { getAppeal } from "@/lib/queries";
import { AppealDetail } from "@/components/appeal-detail";

export default async function AppealPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const appeal = await getAppeal(id);
  if (!appeal) notFound();

  return <AppealDetail appeal={appeal} />;
}
