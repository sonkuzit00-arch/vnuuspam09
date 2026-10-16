-- AlterTable
ALTER TABLE "appeals" ADD COLUMN     "sourceMessageId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "appeals_sourceMessageId_key" ON "appeals"("sourceMessageId");

