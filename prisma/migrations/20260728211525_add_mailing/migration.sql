-- CreateEnum
CREATE TYPE "MailAudience" AS ENUM ('abandoned_carts', 'waitlist', 'users', 'subscribers');

-- CreateEnum
CREATE TYPE "MailCampaignStatus" AS ENUM ('sending', 'done', 'failed');

-- AlterTable
ALTER TABLE "StoreSettings" ADD COLUMN     "franchiseLocation" TEXT,
ADD COLUMN     "franchiseName" TEXT,
ADD COLUMN     "mailFromEmail" TEXT,
ADD COLUMN     "mailFromName" TEXT,
ADD COLUMN     "smtpHost" TEXT,
ADD COLUMN     "smtpPassword" TEXT,
ADD COLUMN     "smtpPort" INTEGER,
ADD COLUMN     "smtpSecure" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "smtpUser" TEXT;

-- CreateTable
CREATE TABLE "MailCampaign" (
    "id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "audiences" "MailAudience"[],
    "recipientCount" INTEGER NOT NULL DEFAULT 0,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "status" "MailCampaignStatus" NOT NULL DEFAULT 'sending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "MailCampaign_pkey" PRIMARY KEY ("id")
);
