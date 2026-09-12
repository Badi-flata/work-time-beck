-- DropForeignKey
ALTER TABLE "Department" DROP CONSTRAINT "Department_managerId_fkey";

-- DropForeignKey
ALTER TABLE "EmployeeProfile" DROP CONSTRAINT "EmployeeProfile_managerId_fkey";

-- AlterTable
ALTER TABLE "AdminProfile" ADD COLUMN     "absentDeductionEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "autoCheckoutEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "combineDeductionsOnEndShift" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "delayDeductionEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "earlyLeaveDeductionEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "isActiveDeduction" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Attendance" ADD COLUMN     "deductionBreakdown" JSONB,
ADD COLUMN     "deductionsCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "shiftId" TEXT,
ALTER COLUMN "totalWorkedHours" SET DEFAULT 0,
ALTER COLUMN "totalWorkedHours" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Department" ADD COLUMN     "absentPenaltyAmount" DOUBLE PRECISION NOT NULL DEFAULT 100.0,
ADD COLUMN     "earlyLeavePenaltyAmount" DOUBLE PRECISION NOT NULL DEFAULT 50.0,
ADD COLUMN     "latePenaltyAmount" DOUBLE PRECISION NOT NULL DEFAULT 50.0,
ADD COLUMN     "monthlyHolidays" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "monthlyWorkingDays" INTEGER NOT NULL DEFAULT 22,
ADD COLUMN     "weekendDays" INTEGER[] DEFAULT ARRAY[5, 6]::INTEGER[];

-- CreateTable
CREATE TABLE "RefreshSession" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "isRevoked" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RefreshSession_tokenHash_key" ON "RefreshSession"("tokenHash");

-- CreateIndex
CREATE INDEX "RefreshSession_userId_idx" ON "RefreshSession"("userId");

-- CreateIndex
CREATE INDEX "AdminProfile_userId_autoCheckoutEnabled_idx" ON "AdminProfile"("userId", "autoCheckoutEnabled");

-- CreateIndex
CREATE INDEX "Attendance_date_idx" ON "Attendance"("date");

-- CreateIndex
CREATE INDEX "Attendance_employeeProfileId_date_idx" ON "Attendance"("employeeProfileId", "date");

-- CreateIndex
CREATE INDEX "Attendance_date_status_idx" ON "Attendance"("date", "status");

-- CreateIndex
CREATE INDEX "EmployeeProfile_managerId_idx" ON "EmployeeProfile"("managerId");

-- CreateIndex
CREATE INDEX "EmployeeProfile_userId_idx" ON "EmployeeProfile"("userId");

-- CreateIndex
CREATE INDEX "EmployeeProfile_managerId_isWorking_idx" ON "EmployeeProfile"("managerId", "isWorking");

-- CreateIndex
CREATE INDEX "EmployeeProfile_departmentId_shiftId_idx" ON "EmployeeProfile"("departmentId", "shiftId");

-- CreateIndex
CREATE INDEX "Excuse_submittedById_idx" ON "Excuse"("submittedById");

-- CreateIndex
CREATE INDEX "Excuse_attendanceId_idx" ON "Excuse"("attendanceId");

-- CreateIndex
CREATE INDEX "Excuse_submittedById_isApproved_idx" ON "Excuse"("submittedById", "isApproved");

-- AddForeignKey
ALTER TABLE "RefreshSession" ADD CONSTRAINT "RefreshSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeProfile" ADD CONSTRAINT "EmployeeProfile_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "AdminProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "AdminProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
