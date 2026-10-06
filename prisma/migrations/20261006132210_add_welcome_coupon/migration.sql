-- AlterTable
ALTER TABLE "StoreSettings" ADD COLUMN     "welcomeCouponDays" INTEGER NOT NULL DEFAULT 7,
ADD COLUMN     "welcomeCouponEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "welcomeCouponMinPurchase" DOUBLE PRECISION,
ADD COLUMN     "welcomeCouponType" "DiscountType" NOT NULL DEFAULT 'percentage',
ADD COLUMN     "welcomeCouponValue" DOUBLE PRECISION NOT NULL DEFAULT 10;
