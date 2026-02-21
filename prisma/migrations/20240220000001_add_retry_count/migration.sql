-- Add retryCount column
ALTER TABLE "MedicineEntry" ADD COLUMN "retryCount" INTEGER NOT NULL DEFAULT 0;
