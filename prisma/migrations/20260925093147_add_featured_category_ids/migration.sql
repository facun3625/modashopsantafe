-- AlterTable
ALTER TABLE "StoreSettings" ADD COLUMN     "featuredCategoryIds" INTEGER[] DEFAULT ARRAY[]::INTEGER[];
