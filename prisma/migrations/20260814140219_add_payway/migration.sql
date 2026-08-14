-- AlterEnum
ALTER TYPE "PaymentMethod" ADD VALUE 'payway';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "paywayPaymentId" INTEGER;

-- AlterTable
ALTER TABLE "PaymentMethodConfig" ADD COLUMN     "paywayPrivateKey" TEXT,
ADD COLUMN     "paywayPublicKey" TEXT,
ADD COLUMN     "paywaySandbox" BOOLEAN NOT NULL DEFAULT true;
