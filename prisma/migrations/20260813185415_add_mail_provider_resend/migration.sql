-- CreateEnum
CREATE TYPE "MailProvider" AS ENUM ('smtp', 'resend');

-- AlterTable
ALTER TABLE "StoreSettings" ADD COLUMN     "mailProvider" "MailProvider" NOT NULL DEFAULT 'smtp',
ADD COLUMN     "resendApiKey" TEXT;
