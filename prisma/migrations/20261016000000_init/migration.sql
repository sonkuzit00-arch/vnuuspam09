-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'GD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appeals" (
    "id" TEXT NOT NULL,
    "sourceChannel" TEXT NOT NULL,
    "subject" TEXT,
    "receivedAtDgd" TIMESTAMP(3),
    "receivedAtKau" TIMESTAMP(3),
    "registrationNumber" TEXT,
    "forwardedToOp" BOOLEAN NOT NULL DEFAULT false,
    "forwardedToOpAt" TIMESTAMP(3),
    "lastName" TEXT NOT NULL,
    "firstName" TEXT,
    "middleName" TEXT,
    "birthDate" TIMESTAMP(3),
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
    "controlDate" TIMESTAMP(3),
    "dzSentAt" TIMESTAMP(3),
    "replySentAt" TIMESTAMP(3),
    "replyNumberToCitizen" TEXT,
    "result" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "gratitudeSent" BOOLEAN NOT NULL DEFAULT false,
    "gratitudeSentAt" TIMESTAMP(3),
    "mediaCoverageSent" BOOLEAN NOT NULL DEFAULT false,
    "mediaCoverageAt" TIMESTAMP(3),
    "stage" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "appeals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appeal_responsibles" (
    "id" TEXT NOT NULL,
    "appealId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "appeal_responsibles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appeal_events" (
    "id" TEXT NOT NULL,
    "appealId" TEXT NOT NULL,
    "authorId" TEXT,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "appeal_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appeal_tasks" (
    "id" TEXT NOT NULL,
    "appealId" TEXT NOT NULL,
    "assignedById" TEXT NOT NULL,
    "assigneeId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "appeal_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appeal_outgoing_numbers" (
    "id" TEXT NOT NULL,
    "appealId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "label" TEXT,
    "responseReceivedAt" TIMESTAMP(3),
    "responseSummary" TEXT,
    "assistanceProvided" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "appeal_outgoing_numbers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "appeal_responsibles_appealId_idx" ON "appeal_responsibles"("appealId");

-- CreateIndex
CREATE INDEX "appeal_responsibles_userId_idx" ON "appeal_responsibles"("userId");

-- CreateIndex
CREATE INDEX "appeal_events_appealId_idx" ON "appeal_events"("appealId");

-- CreateIndex
CREATE INDEX "appeal_tasks_appealId_idx" ON "appeal_tasks"("appealId");

-- CreateIndex
CREATE INDEX "appeal_tasks_assigneeId_idx" ON "appeal_tasks"("assigneeId");

-- CreateIndex
CREATE INDEX "appeal_outgoing_numbers_appealId_idx" ON "appeal_outgoing_numbers"("appealId");

-- AddForeignKey
ALTER TABLE "appeal_responsibles" ADD CONSTRAINT "appeal_responsibles_appealId_fkey" FOREIGN KEY ("appealId") REFERENCES "appeals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appeal_responsibles" ADD CONSTRAINT "appeal_responsibles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appeal_events" ADD CONSTRAINT "appeal_events_appealId_fkey" FOREIGN KEY ("appealId") REFERENCES "appeals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appeal_events" ADD CONSTRAINT "appeal_events_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appeal_tasks" ADD CONSTRAINT "appeal_tasks_appealId_fkey" FOREIGN KEY ("appealId") REFERENCES "appeals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appeal_tasks" ADD CONSTRAINT "appeal_tasks_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appeal_tasks" ADD CONSTRAINT "appeal_tasks_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appeal_outgoing_numbers" ADD CONSTRAINT "appeal_outgoing_numbers_appealId_fkey" FOREIGN KEY ("appealId") REFERENCES "appeals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

