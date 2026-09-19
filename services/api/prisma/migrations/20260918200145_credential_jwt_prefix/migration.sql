/*
  Warnings:

  - Added the required column `jwt_prefix` to the `credentials` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "credentials" ADD COLUMN     "jwt_prefix" TEXT NOT NULL;
