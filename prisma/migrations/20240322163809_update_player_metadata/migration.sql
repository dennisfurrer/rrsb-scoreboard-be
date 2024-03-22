/*
  Warnings:

  - You are about to drop the column `player1FlagUrl` on the `Match` table. All the data in the column will be lost.
  - You are about to drop the column `player1ImageUrl` on the `Match` table. All the data in the column will be lost.
  - You are about to drop the column `player2FlagUrl` on the `Match` table. All the data in the column will be lost.
  - You are about to drop the column `player2ImageUrl` on the `Match` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Match" DROP COLUMN "player1FlagUrl",
DROP COLUMN "player1ImageUrl",
DROP COLUMN "player2FlagUrl",
DROP COLUMN "player2ImageUrl",
ADD COLUMN     "player1NationIOC" TEXT,
ADD COLUMN     "player2NationIOC" TEXT;
