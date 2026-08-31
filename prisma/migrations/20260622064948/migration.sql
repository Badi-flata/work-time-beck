/*
  Warnings:

  - You are about to drop the column `endTime` on the `Attendance` table. All the data in the column will be lost.
  - You are about to drop the column `startTime` on the `Attendance` table. All the data in the column will be lost.
  - Added the required column `shiftEnd` to the `Attendance` table without a default value. This is not possible if the table is not empty.
  - Added the required column `shiftName` to the `Attendance` table without a default value. This is not possible if the table is not empty.
  - Added the required column `shiftStart` to the `Attendance` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Attendance" DROP COLUMN "endTime",
DROP COLUMN "startTime",
ADD COLUMN     "shiftEnd" TEXT NOT NULL,
ADD COLUMN     "shiftName" TEXT NOT NULL,
ADD COLUMN     "shiftStart" TEXT NOT NULL;
