/*
  Warnings:

  - You are about to drop the column `redirectNumber` on the `appeals` table. All the data in the column will be lost.

*/
-- CreateTable
CREATE TABLE "appeal_outgoing_numbers" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "appealId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "label" TEXT,
    "responseReceivedAt" DATETIME,
    "responseSummary" TEXT,
    "assistanceProvided" BOOLEAN,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "appeal_outgoing_numbers_appealId_fkey" FOREIGN KEY ("appealId") REFERENCES "appeals" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_appeals" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceChannel" TEXT NOT NULL,
    "subject" TEXT,
    "receivedAtDgd" DATETIME,
    "receivedAtKau" DATETIME,
    "registrationNumber" TEXT,
    "forwardedToOp" BOOLEAN NOT NULL DEFAULT false,
    "forwardedToOpAt" DATETIME,
    "lastName" TEXT NOT NULL,
    "firstName" TEXT,
    "middleName" TEXT,
    "birthDate" DATETIME,
    "position" TEXT,
    "address" TEXT,
    "district" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "socialHandle" TEXT,
    "isCollective" BOOLEAN NOT NULL DEFAULT false,
    "signatoryCount" INTEGER,
    "goal" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "targetAudience" TEXT,
    "concept" TEXT,
    "actionPlan" TEXT,
    "resolutionPath" TEXT,
    "routingTarget" TEXT,
    "controlDate" DATETIME,
    "dzSentAt" DATETIME,
    "replySentAt" DATETIME,
    "replyNumberToCitizen" TEXT,
    "result" TEXT,
    "resolvedAt" DATETIME,
    "gratitudeSent" BOOLEAN NOT NULL DEFAULT false,
    "gratitudeSentAt" DATETIME,
    "mediaCoverageSent" BOOLEAN NOT NULL DEFAULT false,
    "mediaCoverageAt" DATETIME,
    "stage" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_appeals" ("actionPlan", "address", "birthDate", "category", "concept", "controlDate", "createdAt", "description", "district", "dzSentAt", "email", "firstName", "forwardedToOp", "forwardedToOpAt", "goal", "gratitudeSent", "gratitudeSentAt", "id", "isCollective", "lastName", "mediaCoverageAt", "mediaCoverageSent", "middleName", "phone", "position", "receivedAtDgd", "receivedAtKau", "registrationNumber", "replySentAt", "resolutionPath", "resolvedAt", "result", "routingTarget", "signatoryCount", "socialHandle", "sourceChannel", "stage", "targetAudience", "updatedAt") SELECT "actionPlan", "address", "birthDate", "category", "concept", "controlDate", "createdAt", "description", "district", "dzSentAt", "email", "firstName", "forwardedToOp", "forwardedToOpAt", "goal", "gratitudeSent", "gratitudeSentAt", "id", "isCollective", "lastName", "mediaCoverageAt", "mediaCoverageSent", "middleName", "phone", "position", "receivedAtDgd", "receivedAtKau", "registrationNumber", "replySentAt", "resolutionPath", "resolvedAt", "result", "routingTarget", "signatoryCount", "socialHandle", "sourceChannel", "stage", "targetAudience", "updatedAt" FROM "appeals";
DROP TABLE "appeals";
ALTER TABLE "new_appeals" RENAME TO "appeals";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "appeal_outgoing_numbers_appealId_idx" ON "appeal_outgoing_numbers"("appealId");
