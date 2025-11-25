/*
  Warnings:

  - You are about to drop the column `updatedAt` on the `Habit` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Habit" DROP COLUMN "updatedAt",
ALTER COLUMN "difficulty" DROP DEFAULT,
ALTER COLUMN "reminderTime" DROP NOT NULL;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "updatedAt",
ADD COLUMN     "boostReceived" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "Identity" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Identity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Identity_name_key" ON "Identity"("name");

-- CreateIndex
CREATE INDEX "Boost_receiverId_idx" ON "Boost"("receiverId");

-- CreateIndex
CREATE INDEX "Boost_senderId_idx" ON "Boost"("senderId");

-- CreateIndex
CREATE INDEX "Completion_habitId_idx" ON "Completion"("habitId");

-- CreateIndex
CREATE INDEX "Completion_userId_idx" ON "Completion"("userId");

-- CreateIndex
CREATE INDEX "Completion_completedAt_idx" ON "Completion"("completedAt");

-- CreateIndex
CREATE INDEX "Habit_userId_idx" ON "Habit"("userId");

-- CreateIndex
CREATE INDEX "Reflection_userId_idx" ON "Reflection"("userId");
