-- CreateTable
CREATE TABLE "PaymentMethodCategoryDiscount" (
    "id" TEXT NOT NULL,
    "paymentMethodConfigId" TEXT NOT NULL,
    "categoryId" INTEGER NOT NULL,
    "discountPct" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "PaymentMethodCategoryDiscount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentMethodCategoryDiscount_paymentMethodConfigId_categor_key" ON "PaymentMethodCategoryDiscount"("paymentMethodConfigId", "categoryId");

-- AddForeignKey
ALTER TABLE "PaymentMethodCategoryDiscount" ADD CONSTRAINT "PaymentMethodCategoryDiscount_paymentMethodConfigId_fkey" FOREIGN KEY ("paymentMethodConfigId") REFERENCES "PaymentMethodConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;
