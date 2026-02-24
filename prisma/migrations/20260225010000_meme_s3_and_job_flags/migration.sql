-- AlterTable
ALTER TABLE "MemeCache" ADD COLUMN "s3Key" TEXT,
ALTER COLUMN "b64_png" DROP NOT NULL;

-- AlterTable
ALTER TABLE "MemeJob" ADD COLUMN "requiresClientKey" BOOLEAN NOT NULL DEFAULT false;
