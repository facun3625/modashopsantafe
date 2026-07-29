-- AlterTable
ALTER TABLE "PaymentMethodConfig" ADD COLUMN     "bankAlias" TEXT,
ADD COLUMN     "bankCbu" TEXT,
ADD COLUMN     "bankHolderName" TEXT;
