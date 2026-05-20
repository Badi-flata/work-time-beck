/*
  Warnings:

  - Added the required column `departmentsId` to the `Shift` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Shift" ADD COLUMN     "departmentsId" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_departmentsId_fkey" FOREIGN KEY ("departmentsId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;
