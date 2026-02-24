-- CreateTable
CREATE TABLE "Game" (
  "id" SERIAL NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Game_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameSession" (
  "id" SERIAL NOT NULL,
  "partyCode" TEXT NOT NULL,
  "partyId" TEXT NOT NULL,
  "gameId" INTEGER NOT NULL,
  "hostId" TEXT NOT NULL,
  "state" JSONB NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'idle',
  "metadata" JSONB,
  "startedAt" TIMESTAMP(3),
  "endedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GameSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerScore" (
  "id" SERIAL NOT NULL,
  "sessionId" INTEGER NOT NULL,
  "participantId" TEXT NOT NULL,
  "score" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "PlayerScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemeCache" (
  "id" SERIAL NOT NULL,
  "inputHash" TEXT NOT NULL,
  "b64_png" TEXT NOT NULL,
  "width" INTEGER NOT NULL,
  "height" INTEGER NOT NULL,
  "aspect" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MemeCache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemeJob" (
  "id" SERIAL NOT NULL,
  "jobId" TEXT NOT NULL,
  "inputHash" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "error" TEXT,
  "payload" JSONB NOT NULL,
  "resultId" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MemeJob_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Game_slug_key" ON "Game"("slug");
CREATE INDEX "GameSession_partyCode_idx" ON "GameSession"("partyCode");
CREATE UNIQUE INDEX "PlayerScore_sessionId_participantId_key" ON "PlayerScore"("sessionId", "participantId");
CREATE UNIQUE INDEX "MemeCache_inputHash_key" ON "MemeCache"("inputHash");
CREATE UNIQUE INDEX "MemeJob_jobId_key" ON "MemeJob"("jobId");

ALTER TABLE "GameSession" ADD CONSTRAINT "GameSession_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GameSession" ADD CONSTRAINT "GameSession_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GameSession" ADD CONSTRAINT "GameSession_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "Participant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PlayerScore" ADD CONSTRAINT "PlayerScore_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "GameSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PlayerScore" ADD CONSTRAINT "PlayerScore_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MemeJob" ADD CONSTRAINT "MemeJob_resultId_fkey" FOREIGN KEY ("resultId") REFERENCES "MemeCache"("id") ON DELETE SET NULL ON UPDATE CASCADE;
