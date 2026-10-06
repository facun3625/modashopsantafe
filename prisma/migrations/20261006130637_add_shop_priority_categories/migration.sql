-- AlterTable
ALTER TABLE "StoreSettings" ADD COLUMN     "shopPriorityCategoryIds" INTEGER[] DEFAULT ARRAY[]::INTEGER[];
