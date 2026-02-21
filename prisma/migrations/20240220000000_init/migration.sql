-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'USER');

-- CreateEnum
CREATE TYPE "EntryStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MedicineEntry" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "medicineName" TEXT NOT NULL,
    "originalImageUrl" TEXT NOT NULL,
    "status" "EntryStatus" NOT NULL DEFAULT 'PENDING',
    "selectedImages" TEXT[],
    "processedImages" TEXT[],
    "assignedTo" TEXT,
    "digitizedBy" TEXT,
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MedicineEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE INDEX "Project_createdAt_idx" ON "Project"("createdAt");

-- CreateIndex
CREATE INDEX "MedicineEntry_projectId_status_idx" ON "MedicineEntry"("projectId", "status");

-- CreateIndex
CREATE INDEX "MedicineEntry_medicineName_idx" ON "MedicineEntry"("medicineName");

-- CreateIndex
CREATE INDEX "MedicineEntry_assignedTo_idx" ON "MedicineEntry"("assignedTo");

-- AddForeignKey
ALTER TABLE "MedicineEntry" ADD CONSTRAINT "MedicineEntry_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicineEntry" ADD CONSTRAINT "MedicineEntry_digitizedBy_fkey" FOREIGN KEY ("digitizedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
