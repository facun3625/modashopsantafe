-- AlterTable
ALTER TABLE "StoreSettings" ADD COLUMN     "address" TEXT,
ADD COLUMN     "instagramHandle" TEXT,
ADD COLUMN     "marqueeText" TEXT,
ADD COLUMN     "whatsappPhone" TEXT;

-- CreateTable
CREATE TABLE "HeroSlide" (
    "id" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "imageUrl" TEXT,
    "promoText" TEXT,
    "eyebrow" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "button1Label" TEXT,
    "button1Href" TEXT,
    "button2Label" TEXT,
    "button2Href" TEXT,
    "button3Label" TEXT,
    "button3Href" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HeroSlide_pkey" PRIMARY KEY ("id")
);
