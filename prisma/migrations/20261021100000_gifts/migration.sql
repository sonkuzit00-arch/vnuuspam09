-- CreateTable
CREATE TABLE "gift_items" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "nominal" INTEGER,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gift_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gift_issues" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "recipient" TEXT NOT NULL,
    "reason" TEXT,
    "approvedAt" TIMESTAMP(3) NOT NULL,
    "issuedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gift_issues_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "gift_issues_itemId_idx" ON "gift_issues"("itemId");

-- AddForeignKey
ALTER TABLE "gift_items" ADD CONSTRAINT "gift_items_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gift_issues" ADD CONSTRAINT "gift_issues_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "gift_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gift_issues" ADD CONSTRAINT "gift_issues_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
