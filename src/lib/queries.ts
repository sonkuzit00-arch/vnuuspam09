import { prisma } from "@/lib/prisma";

export async function getMyAppeals(userId: string) {
  return prisma.appeal.findMany({
    where: { importStatus: null, responsible: { some: { userId, isCurrent: true } } },
    orderBy: { updatedAt: "desc" },
    include: { responsible: { include: { user: true }, where: { isCurrent: true } } },
  });
}

/** Поручения, назначенные конкретному человеку (не обязательно он — ответственный за обращение). */
export async function getMyTasks(userId: string) {
  return prisma.appealTask.findMany({
    where: { assigneeId: userId, appeal: { importStatus: null } },
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
    where: { importStatus: null, resolutionPath: null, stage: "IN_PROGRESS" },
    orderBy: { createdAt: "asc" },
    include: { responsible: { include: { user: true }, where: { isCurrent: true } } },
  });
}

export async function getAllAppeals() {
  return prisma.appeal.findMany({
    where: { importStatus: null },
    orderBy: { updatedAt: "desc" },
    include: { responsible: { include: { user: true }, where: { isCurrent: true } } },
  });
}

/** Письма из почты, ждущие согласования этим пользователем. */
export async function getPendingImports(userId: string) {
  return prisma.appeal.findMany({
    where: { importStatus: "PENDING", responsible: { some: { userId, isCurrent: true } } },
    orderBy: { createdAt: "asc" },
    include: { responsible: { include: { user: true }, where: { isCurrent: true } }, _count: { select: { attachments: true } } },
  });
}

export async function getAppeal(id: string) {
  return prisma.appeal.findUnique({
    where: { id },
    include: {
      responsible: { include: { user: true } },
      events: { orderBy: { createdAt: "desc" }, include: { author: true } },
      tasks: { orderBy: { createdAt: "asc" }, include: { assignedBy: true, assignee: true } },
      outgoingNumbers: { orderBy: { createdAt: "asc" } },
      attachments: {
        orderBy: { createdAt: "asc" },
        select: { id: true, fileName: true, contentType: true, size: true, createdAt: true, uploadedBy: { select: { name: true } } },
      },
    },
  });
}

/** Обращения с отметкой «Освещено в СМИ» — единственное, что видит пресс-служба. */
export async function getMediaCoverageAppeals() {
  return prisma.appeal.findMany({
    where: { importStatus: null, mediaCoverageSent: true },
    orderBy: { mediaCoverageAt: "desc" },
    include: { responsible: { include: { user: true }, where: { isCurrent: true } } },
  });
}

/** Полная лента поручений по всей команде — «кому как делегируются задачи». */
export async function getAllTasks() {
  return prisma.appealTask.findMany({
    where: { appeal: { importStatus: null } },
    orderBy: { createdAt: "desc" },
    include: { appeal: true, assignedBy: true, assignee: true },
    take: 100,
  });
}

export async function getUsers() {
  return prisma.user.findMany({ orderBy: { name: "asc" } });
}

/** Для выбора ответственного/исполнителя — без заблокированных. */
export async function getActiveUsers() {
  return prisma.user.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });
}
