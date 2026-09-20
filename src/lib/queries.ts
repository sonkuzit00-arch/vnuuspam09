import { prisma } from "@/lib/prisma";

export async function getMyAppeals(userId: string) {
  return prisma.appeal.findMany({
    where: { responsible: { some: { userId, isCurrent: true } } },
    orderBy: { updatedAt: "desc" },
    include: { responsible: { include: { user: true }, where: { isCurrent: true } } },
  });
}

/** Поручения, назначенные конкретному человеку (не обязательно он — ответственный за обращение). */
export async function getMyTasks(userId: string) {
  return prisma.appealTask.findMany({
    where: { assigneeId: userId },
    orderBy: { createdAt: "desc" },
    include: { appeal: true, assignedBy: true },
  });
}

/**
 * Обращения без маршрута (resolutionPath пуст) — их может промаршрутизировать
 * любой, кто выполняет роль КАУ по факту (Бабаханова, а также Кузнецова и
 * Астафьева как админы), независимо от того, на кого сейчас формально
 * записан ответственный.
 */
export async function getAppealsNeedingRouting() {
  return prisma.appeal.findMany({
    where: { resolutionPath: null, stage: "IN_PROGRESS" },
    orderBy: { createdAt: "asc" },
    include: { responsible: { include: { user: true }, where: { isCurrent: true } } },
  });
}

export async function getAllAppeals() {
  return prisma.appeal.findMany({
    orderBy: { updatedAt: "desc" },
    include: { responsible: { include: { user: true }, where: { isCurrent: true } } },
  });
}

export async function getAppeal(id: string) {
  return prisma.appeal.findUnique({
    where: { id },
    include: {
      responsible: { include: { user: true } },
      events: { orderBy: { createdAt: "desc" }, include: { author: true } },
      tasks: { orderBy: { createdAt: "asc" }, include: { assignedBy: true, assignee: true } },
    },
  });
}

/** Полная лента поручений по всей команде — «кому как делегируются задачи». */
export async function getAllTasks() {
  return prisma.appealTask.findMany({
    orderBy: { createdAt: "desc" },
    include: { appeal: true, assignedBy: true, assignee: true },
    take: 100,
  });
}

export async function getUsers() {
  return prisma.user.findMany({ orderBy: { name: "asc" } });
}
