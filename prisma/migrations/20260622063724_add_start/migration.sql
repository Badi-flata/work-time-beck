/*
  Warnings:

  - You are about to drop the column `excuseReasonIn` on the `Attendance` table. All the data in the column will be lost.
  - You are about to drop the column `excuseReasonOut` on the `Attendance` table. All the data in the column will be lost.
  - You are about to drop the column `isExcusedIn` on the `Attendance` table. All the data in the column will be lost.
  - You are about to drop the column `isExcusedOut` on the `Attendance` table. All the data in the column will be lost.
  - Added the required column `endTime` to the `Attendance` table without a default value. This is not possible if the table is not empty.
  - Added the required column `startTime` to the `Attendance` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Attendance" DROP COLUMN "excuseReasonIn",
DROP COLUMN "excuseReasonOut",
DROP COLUMN "isExcusedIn",
DROP COLUMN "isExcusedOut",
ADD COLUMN     "endTime" TEXT NOT NULL,
ADD COLUMN     "graceIn" INTEGER NOT NULL DEFAULT 15,
ADD COLUMN     "graceOut" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "startTime" TEXT NOT NULL;
