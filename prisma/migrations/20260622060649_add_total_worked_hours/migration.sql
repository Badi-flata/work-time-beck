/*
  Warnings:

  - You are about to drop the column `totalWorkedMinutes` on the `Attendance` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Attendance" DROP COLUMN "totalWorkedMinutes",
ADD COLUMN     "totalWorkedHours" INTEGER NOT NULL DEFAULT 0;
