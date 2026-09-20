import { Badge } from "@/components/ui/badge";
import { STAGE_LABELS } from "@/lib/constants";

const VARIANT: Record<string, "default" | "secondary" | "success" | "warning" | "destructive"> = {
  IN_PROGRESS: "warning",
  RESOLVED: "success",
  CANCELLED: "secondary",
  REFUSED: "destructive",
  APPLICANT_DECLINED: "secondary",
};

export function StageBadge({ stage }: { stage: string }) {
  return (
    <Badge variant={VARIANT[stage] ?? "secondary"}>
      {STAGE_LABELS[stage as keyof typeof STAGE_LABELS] ?? stage}
    </Badge>
  );
}
