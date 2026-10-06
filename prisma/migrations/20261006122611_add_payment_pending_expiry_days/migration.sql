-- AlterTable
ALTER TABLE "PaymentMethodConfig" ADD COLUMN     "pendingExpiryDays" INTEGER;

-- Mantiene el comportamiento que ya había: contra entrega vence a los 5 días
UPDATE "PaymentMethodConfig" SET "pendingExpiryDays" = 5 WHERE "method" = 'contra_entrega';
