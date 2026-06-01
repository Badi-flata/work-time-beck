/*
  Warnings:

  - You are about to drop the column `salaryDeduction` on the `EmployeeProfile` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Attendance" ADD COLUMN     "salaryDeduction" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "EmployeeProfile" DROP COLUMN "salaryDeduction";
