-- CreateTable
CREATE TABLE "Player" (
    "playerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "totalMatchesWon" INTEGER NOT NULL DEFAULT 0,
    "totalMatchesLost" INTEGER NOT NULL DEFAULT 0,
    "totalFramesWon" INTEGER NOT NULL DEFAULT 0,
    "totalFramesLost" INTEGER NOT NULL DEFAULT 0,
    "highBreaks" INTEGER[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("playerId")
);

-- CreateTable
CREATE TABLE "Match" (
    "id" TEXT NOT NULL,
    "player1Name" TEXT NOT NULL,
    "player2Name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "bestOf" INTEGER NOT NULL,
    "framesPlayer1" INTEGER NOT NULL,
    "framesPlayer2" INTEGER NOT NULL,
    "breaksPlayer1" INTEGER[],
    "breaksPlayer2" INTEGER[],
    "winner" TEXT,
    "rawGameLog" TEXT NOT NULL,
    "tableNumber" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Player_name_key" ON "Player"("name");
