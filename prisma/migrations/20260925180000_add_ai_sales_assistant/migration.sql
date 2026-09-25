CREATE TYPE "AiProvider" AS ENUM ('openai', 'gemini');
CREATE TYPE "AiMessageRole" AS ENUM ('user', 'assistant');

ALTER TABLE "StoreSettings"
ADD COLUMN "aiAssistantEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "aiProvider" "AiProvider",
ADD COLUMN "aiApiKey" TEXT,
ADD COLUMN "aiModel" TEXT,
ADD COLUMN "aiAssistantName" TEXT,
ADD COLUMN "aiWelcomeMessage" TEXT,
ADD COLUMN "aiInstructions" TEXT,
ADD COLUMN "aiHumanHandoffEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "aiHumanDays" INTEGER[] NOT NULL DEFAULT ARRAY[1, 2, 3, 4, 5, 6]::INTEGER[],
ADD COLUMN "aiHumanStartTime" TEXT NOT NULL DEFAULT '09:00',
ADD COLUMN "aiHumanEndTime" TEXT NOT NULL DEFAULT '18:00';

CREATE TABLE "AiConversation" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AiConversation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AiMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" "AiMessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "productIds" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AiMessage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AiConversation_sessionId_key" ON "AiConversation"("sessionId");
CREATE INDEX "AiConversation_userId_idx" ON "AiConversation"("userId");
CREATE INDEX "AiConversation_updatedAt_idx" ON "AiConversation"("updatedAt");
CREATE INDEX "AiMessage_conversationId_createdAt_idx" ON "AiMessage"("conversationId", "createdAt");

ALTER TABLE "AiConversation"
ADD CONSTRAINT "AiConversation_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AiMessage"
ADD CONSTRAINT "AiMessage_conversationId_fkey"
FOREIGN KEY ("conversationId") REFERENCES "AiConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
