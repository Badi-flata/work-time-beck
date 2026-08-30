/*
  Warnings:

  - The values [IN,OUT,FULL_DAY] on the enum `ExcuseType` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "ExcuseType_new" AS ENUM ('ABSENT', 'LATE', 'EARLY_DEPARTURE');
ALTER TABLE "Excuse" ALTER COLUMN "type" TYPE "ExcuseType_new" USING ("type"::text::"ExcuseType_new");
ALTER TYPE "ExcuseType" RENAME TO "ExcuseType_old";
ALTER TYPE "ExcuseType_new" RENAME TO "ExcuseType";
DROP TYPE "public"."ExcuseType_old";
COMMIT;
