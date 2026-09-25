-- AlterTable
ALTER TABLE "AiConversation" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "phone" TEXT;

-- Backfill: para usuarios que ya compraron antes de este cambio, toma el
-- teléfono de su pedido más reciente que lo tenga cargado — así no hace
-- falta esperar a la próxima compra para poder escribirles por WhatsApp
-- desde carritos abandonados.
UPDATE "User" u
SET "phone" = sub."customerPhone"
FROM (
  SELECT DISTINCT ON ("userId") "userId", "customerPhone"
  FROM "Order"
  WHERE "userId" IS NOT NULL AND "customerPhone" IS NOT NULL
  ORDER BY "userId", "createdAt" DESC
) sub
WHERE u.id = sub."userId" AND u."phone" IS NULL;
