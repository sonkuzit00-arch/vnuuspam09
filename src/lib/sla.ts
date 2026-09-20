import { SLA_HOURS } from "@/lib/constants";

/**
 * Просроченность обращения по регламенту:
 * - пока не назначен ответственный/не зарегистрировано в КАУ — считаем от receivedAtDgd
 * - если задан контрольный срок (controlDate) — просрочка считается по нему
 */
export function isOverdue(appeal: {
  stage: string;
  controlDate: Date | null;
  receivedAtDgd: Date | null;
  receivedAtKau: Date | null;
}): boolean {
  if (appeal.stage === "RESOLVED" || appeal.stage === "CANCELLED" || appeal.stage === "APPLICANT_DECLINED") {
    return false;
  }
  const now = new Date();
  if (appeal.controlDate) {
    return now > appeal.controlDate;
  }
  if (appeal.receivedAtKau) {
    const deadline = new Date(appeal.receivedAtKau.getTime());
    deadline.setHours(deadline.getHours() + SLA_HOURS.conceptAndPlan);
    return now > deadline;
  }
  if (appeal.receivedAtDgd) {
    const deadline = new Date(appeal.receivedAtDgd.getTime());
    deadline.setHours(deadline.getHours() + SLA_HOURS.handoffToResponsible);
    return now > deadline;
  }
  return false;
}

export function hoursUntil(date: Date | null): number | null {
  if (!date) return null;
  return Math.round((date.getTime() - Date.now()) / (1000 * 60 * 60));
}
