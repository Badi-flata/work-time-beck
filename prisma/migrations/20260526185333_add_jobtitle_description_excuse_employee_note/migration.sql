/*
  Warnings:

  - You are about to drop the column `gracePeriodMin` on the `Shift` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "ExcuseType" AS ENUM ('IN', 'OUT');

-- AlterEnum
ALTER TYPE "AttendanceStatus" ADD VALUE 'ESCAPY';

-- DropForeignKey
ALTER TABLE "EmployeeProfile" DROP CONSTRAINT "EmployeeProfile_managerId_fkey";

-- AlterTable
ALTER TABLE "Attendance" ADD COLUMN     "employeeNote" TEXT,
ADD COLUMN     "excuseReasonIn" TEXT,
ADD COLUMN     "excuseReasonOut" TEXT,
ADD COLUMN     "isExcusedIn" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isExcusedOut" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Department" ADD COLUMN     "description" TEXT;

-- AlterTable
ALTER TABLE "EmployeeProfile" ADD COLUMN     "salaryDeduction" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "managerId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Shift" DROP COLUMN "gracePeriodMin",
ADD COLUMN     "gracePeriodMinIn" INTEGER NOT NULL DEFAULT 15,
ADD COLUMN     "gracePeriodMinOut" INTEGER NOT NULL DEFAULT 30;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "imageProfile" TEXT,
ADD COLUMN     "jobTitle" TEXT;

-- CreateTable
CREATE TABLE "Excuse" (
    "id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "type" "ExcuseType" NOT NULL,
    "isApproved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attendanceId" TEXT NOT NULL,
    "submittedById" TEXT NOT NULL,

    CONSTRAINT "Excuse_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "EmployeeProfile" ADD CONSTRAINT "EmployeeProfile_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "AdminProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Excuse" ADD CONSTRAINT "Excuse_attendanceId_fkey" FOREIGN KEY ("attendanceId") REFERENCES "Attendance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
