-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "transferProofUrl" TEXT;

-- CreateTable
CREATE TABLE "PaymentMethodConfig" (
    "id" TEXT NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "discountPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "mpAccessToken" TEXT,
    "mpPublicKey" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentMethodConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentMethodConfig_method_key" ON "PaymentMethodConfig"("method");
