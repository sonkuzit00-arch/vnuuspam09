-- AlterTable
ALTER TABLE "appeals" ADD COLUMN     "deputySignedAt" TIMESTAMP(3),
ADD COLUMN     "dgdApprovedAt" TIMESTAMP(3),
ADD COLUMN     "isMass" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "number" SERIAL NOT NULL,
ADD COLUMN     "ogvJustification" TEXT,
ADD COLUMN     "region" TEXT,
ADD COLUMN     "routedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "appeals_number_key" ON "appeals"("number");

