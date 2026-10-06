-- AlterTable
ALTER TABLE "StoreSettings" ALTER COLUMN "cartAutoCloseSeconds" SET DEFAULT 2;

-- Valor por defecto de 2 segundos (el de 3 era provisorio y todavía no estaba publicado)
ALTER TABLE "StoreSettings" ALTER COLUMN "cartAutoCloseSeconds" SET DEFAULT 2;
UPDATE "StoreSettings" SET "cartAutoCloseSeconds" = 2 WHERE "cartAutoCloseSeconds" = 3;
