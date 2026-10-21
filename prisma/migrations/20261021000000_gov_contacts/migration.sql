-- CreateTable
CREATE TABLE "gov_contacts" (
    "id" TEXT NOT NULL,
    "organization" TEXT NOT NULL,
    "department" TEXT,
    "fullName" TEXT NOT NULL,
    "position" TEXT,
    "phone" TEXT,
    "mobilePhone" TEXT,
    "email" TEXT,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gov_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "gov_contacts_organization_idx" ON "gov_contacts"("organization");

-- AddForeignKey
ALTER TABLE "gov_contacts" ADD CONSTRAINT "gov_contacts_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
