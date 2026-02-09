ALTER TABLE "Party" ADD COLUMN "currentIndex" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Party" ADD COLUMN "micLocked" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Party" ADD COLUMN "seatLocked" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Participant" ADD COLUMN "muted" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "PlaylistItem" (
    "id" TEXT NOT NULL,
    "partyId" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "contentType" TEXT NOT NULL,
    "contentUrl" TEXT NOT NULL,
    "title" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlaylistItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PlaylistItem_partyId_orderIndex_idx" ON "PlaylistItem"("partyId", "orderIndex");

ALTER TABLE "PlaylistItem" ADD CONSTRAINT "PlaylistItem_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE CASCADE ON UPDATE CASCADE;
