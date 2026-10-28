/*
  Warnings:

  - You are about to drop the column `createdAt` on the `Event` table. All the data in the column will be lost.
  - You are about to drop the column `rotationY` on the `Seat` table. All the data in the column will be lost.
  - You are about to drop the column `x` on the `Seat` table. All the data in the column will be lost.
  - You are about to drop the column `y` on the `Seat` table. All the data in the column will be lost.
  - You are about to drop the column `z` on the `Seat` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `Venue` table. All the data in the column will be lost.
  - You are about to drop the column `level` on the `Zone` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[venueId,idx]` on the table `Seat` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `idx` to the `Seat` table without a default value. This is not possible if the table is not empty.
  - Added the required column `posX` to the `Seat` table without a default value. This is not possible if the table is not empty.
  - Added the required column `posY` to the `Seat` table without a default value. This is not possible if the table is not empty.
  - Added the required column `posZ` to the `Seat` table without a default value. This is not possible if the table is not empty.
  - Added the required column `rotY` to the `Seat` table without a default value. This is not possible if the table is not empty.
  - Added the required column `venueId` to the `Seat` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "Event_venueId_idx";

-- DropIndex
DROP INDEX "Order_userId_idx";

-- AlterTable
ALTER TABLE "Event" DROP COLUMN "createdAt",
ADD COLUMN     "description" TEXT;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "cardLast4" TEXT;

-- AlterTable
ALTER TABLE "Seat" DROP COLUMN "rotationY",
DROP COLUMN "x",
DROP COLUMN "y",
DROP COLUMN "z",
ADD COLUMN     "idx" INTEGER NOT NULL,
ADD COLUMN     "posX" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "posY" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "posZ" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "rotY" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "venueId" TEXT NOT NULL,
ALTER COLUMN "row" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN     "usedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Venue" DROP COLUMN "createdAt",
ADD COLUMN     "description" TEXT;

-- AlterTable
ALTER TABLE "Zone" DROP COLUMN "level",
ADD COLUMN     "sortIdx" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "Event_venueId_date_idx" ON "Event"("venueId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "Seat_venueId_idx_key" ON "Seat"("venueId", "idx");

-- AddForeignKey
ALTER TABLE "Seat" ADD CONSTRAINT "Seat_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE;
