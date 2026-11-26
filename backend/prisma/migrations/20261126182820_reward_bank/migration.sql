-- DropIndex
DROP INDEX "Listing_title_trgm_idx";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "rewardDaysBank" INTEGER NOT NULL DEFAULT 0;
