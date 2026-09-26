-- CreateEnum
CREATE TYPE "PopupScope" AS ENUM ('home', 'tienda', 'all');

-- CreateEnum
CREATE TYPE "PopupFrequency" AS ENUM ('once', 'always');

-- AlterTable
ALTER TABLE "StoreSettings" ADD COLUMN     "popupBodyHtml" TEXT,
ADD COLUMN     "popupEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "popupFrequency" "PopupFrequency" NOT NULL DEFAULT 'once',
ADD COLUMN     "popupScope" "PopupScope" NOT NULL DEFAULT 'all',
ADD COLUMN     "popupTitle" TEXT;
