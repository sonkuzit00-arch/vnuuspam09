import { prisma } from "@/lib/prisma";

export async function getMyAppeals(userId: string) {
  return prisma.appeal.findMany({
    where: { responsible: { some: { userId, isCurrent: true } } },
    orderBy: { updatedAt: "desc" },
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
    },
  });
}

export async function getUsers() {
  return prisma.user.findMany({ orderBy: { name: "asc" } });
}
