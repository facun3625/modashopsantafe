-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "shippingAddress" TEXT,
ADD COLUMN     "shippingCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "shippingMethodId" TEXT;

-- CreateTable
CREATE TABLE "ShippingMethod" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "cost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "requiresAddress" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShippingMethod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentMethodShipping" (
    "id" TEXT NOT NULL,
    "paymentMethodConfigId" TEXT NOT NULL,
    "shippingMethodId" TEXT NOT NULL,

    CONSTRAINT "PaymentMethodShipping_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentMethodShipping_paymentMethodConfigId_shippingMethodI_key" ON "PaymentMethodShipping"("paymentMethodConfigId", "shippingMethodId");

-- AddForeignKey
ALTER TABLE "PaymentMethodShipping" ADD CONSTRAINT "PaymentMethodShipping_paymentMethodConfigId_fkey" FOREIGN KEY ("paymentMethodConfigId") REFERENCES "PaymentMethodConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentMethodShipping" ADD CONSTRAINT "PaymentMethodShipping_shippingMethodId_fkey" FOREIGN KEY ("shippingMethodId") REFERENCES "ShippingMethod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_shippingMethodId_fkey" FOREIGN KEY ("shippingMethodId") REFERENCES "ShippingMethod"("id") ON DELETE SET NULL ON UPDATE CASCADE;
