-- AlterTable
ALTER TABLE "StoreSettings" ADD COLUMN     "orderEmailClosing" TEXT,
ADD COLUMN     "orderEmailIntro" TEXT,
ADD COLUMN     "orderEmailNoteCash" TEXT,
ADD COLUMN     "orderEmailNoteMercadopago" TEXT,
ADD COLUMN     "orderEmailNoteTransfer" TEXT;
