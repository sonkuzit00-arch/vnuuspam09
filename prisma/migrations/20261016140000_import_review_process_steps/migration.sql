-- AlterTable
ALTER TABLE "appeal_events" ADD COLUMN     "actorName" TEXT,
ADD COLUMN     "channel" TEXT,
ADD COLUMN     "editedAt" TIMESTAMP(3),
ADD COLUMN     "occurredAt" TIMESTAMP(3),
ADD COLUMN     "stepNote" TEXT,
ADD COLUMN     "stepType" TEXT,
ADD COLUMN     "targetName" TEXT;

-- AlterTable
ALTER TABLE "appeal_tasks" ADD COLUMN     "completionNote" TEXT;

-- AlterTable
ALTER TABLE "appeals" ADD COLUMN     "importStatus" TEXT;

