-- AlterTable
ALTER TABLE "appeals" ADD COLUMN "routingTarget" TEXT;

-- CreateTable
CREATE TABLE "appeal_tasks" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "appealId" TEXT NOT NULL,
    "assignedById" TEXT NOT NULL,
    "assigneeId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    CONSTRAINT "appeal_tasks_appealId_fkey" FOREIGN KEY ("appealId") REFERENCES "appeals" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "appeal_tasks_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "appeal_tasks_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'GD',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_users" ("createdAt", "email", "id", "name", "passwordHash", "role") SELECT "createdAt", "email", "id", "name", "passwordHash", "role" FROM "users";
DROP TABLE "users";
ALTER TABLE "new_users" RENAME TO "users";
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "appeal_tasks_appealId_idx" ON "appeal_tasks"("appealId");

-- CreateIndex
CREATE INDEX "appeal_tasks_assigneeId_idx" ON "appeal_tasks"("assigneeId");
