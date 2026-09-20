-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'EMPLOYEE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "appeals" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceChannel" TEXT NOT NULL,
    "receivedAtDgd" DATETIME,
    "receivedAtKau" DATETIME,
    "registrationNumber" TEXT,
    "redirectNumber" TEXT,
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
    "controlDate" DATETIME,
    "dzSentAt" DATETIME,
    "replySentAt" DATETIME,
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

-- CreateTable
CREATE TABLE "appeal_responsibles" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "appealId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,
    "assignedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "appeal_responsibles_appealId_fkey" FOREIGN KEY ("appealId") REFERENCES "appeals" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "appeal_responsibles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "appeal_events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "appealId" TEXT NOT NULL,
    "authorId" TEXT,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "appeal_events_appealId_fkey" FOREIGN KEY ("appealId") REFERENCES "appeals" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "appeal_events_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "appeal_responsibles_appealId_idx" ON "appeal_responsibles"("appealId");

-- CreateIndex
CREATE INDEX "appeal_responsibles_userId_idx" ON "appeal_responsibles"("userId");

-- CreateIndex
CREATE INDEX "appeal_events_appealId_idx" ON "appeal_events"("appealId");
