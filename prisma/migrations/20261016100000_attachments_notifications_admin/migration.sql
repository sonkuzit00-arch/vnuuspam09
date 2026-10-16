-- AlterTable
ALTER TABLE "appeal_tasks" ADD COLUMN     "dueDate" TIMESTAMP(3),
ADD COLUMN     "remindedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "appeals" ADD COLUMN     "deadlineRemindedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifyByEmail" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "notifyByTelegram" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "notifyEmail" TEXT,
ADD COLUMN     "telegramChatId" TEXT,
ADD COLUMN     "telegramLinkCode" TEXT;

-- CreateTable
CREATE TABLE "appeal_attachments" (
    "id" TEXT NOT NULL,
    "appealId" TEXT NOT NULL,
    "uploadedById" TEXT,
    "fileName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "blobPathname" TEXT,
    "data" BYTEA,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "appeal_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "appeal_attachments_appealId_idx" ON "appeal_attachments"("appealId");

-- CreateIndex
CREATE UNIQUE INDEX "users_telegramLinkCode_key" ON "users"("telegramLinkCode");

-- AddForeignKey
ALTER TABLE "appeal_attachments" ADD CONSTRAINT "appeal_attachments_appealId_fkey" FOREIGN KEY ("appealId") REFERENCES "appeals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appeal_attachments" ADD CONSTRAINT "appeal_attachments_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

