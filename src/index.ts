import bodyParser from "body-parser";
import cors from "cors";
import { isValid, parseISO } from "date-fns";
import dotenv from "dotenv";
import express, { Application, Request, Response } from "express";
import prisma from "./lib/prisma";

//For env File
dotenv.config();

const app: Application = express();
const corsOptions = {
  origin: "*",
  credentials: true, //access-control-allow-credentials:true
  optionSuccessStatus: 200,
};

app.use(cors(corsOptions));
const port = process.env.PORT || 8000;

app.listen(port, () => {
  console.log(`Server is running on port: ${port}`);
});

app.get("/health", (req: Request, res: Response) => {
  res.send("RRSB Scoreboard API");
});

// ##################################################################################
app.post(
  "/api/matches",
  bodyParser.json(),
  async (req: Request, res: Response) => {
    try {
      const match = await prisma.match.create({
        data: {
          player1Name: req.body.players[0].name,
          player2Name: req.body.players[1].name,
          player1NationIOC: req.body.players[0].nationalityIOC || "",
          player2NationIOC: req.body.players[1].nationalityIOC || "",
          active: true,
          bestOf: req.body.bestOf,
          framesPlayer1: req.body.players[0].frames,
          framesPlayer2: req.body.players[1].frames,
          breaksPlayer1: req.body.players[0].highbreaks,
          breaksPlayer2: req.body.players[1].highbreaks,
          winner: req.body.players[0].winner
            ? req.body.players[0].name
            : req.body.players[1].winner
            ? req.body.players[1].name
            : null,
          rawGameLog: JSON.stringify(req.body, null, 2),
          tableNumber: req.body.tableNumber
            ? Number(req.body.tableNumber)
            : null,
        },
      });
      res.send({ data: { matchId: match.id } });
    } catch (e) {
      console.log("Error while storing Match record in DB: " + e);
    }
    console.log(`Received POST request to /api/matches`);
  }
);
app.patch(
  "/api/matches",
  bodyParser.json(),
  async (req: Request, res: Response) => {
    console.log(
      `Received PATCH request to /api/matches for matchId: ${req.body.matchState.matchId}`
    );
    try {
      await prisma.match.upsert({
        where: { id: req.body.matchState.matchId },
        update: {
          active: req.body.type === "END_MATCH" ? false : true,
          bestOf: req.body.matchState.bestOf,
          framesPlayer1: req.body.matchState.players[0].frames,
          framesPlayer2: req.body.matchState.players[1].frames,
          breaksPlayer1: {
            set: req.body.matchState.players[0].highbreaks || [],
          },
          breaksPlayer2: {
            set: req.body.matchState.players[1].highbreaks || [],
          },
          winner: req.body.matchState.players[0].winner
            ? req.body.matchState.players[0].name
            : req.body.matchState.players[1].winner
            ? req.body.matchState.players[1].name
            : null,
          rawGameLog: JSON.stringify(req.body.matchState, null, 2),
        },
        create: {
          player1Name: req.body.matchState.players[0].name,
          player2Name: req.body.matchState.players[1].name,
          active: req.body.type === "END_MATCH" ? false : true,
          bestOf: req.body.matchState.bestOf,
          framesPlayer1: req.body.matchState.players[0].frames,
          framesPlayer2: req.body.matchState.players[1].frames,
          breaksPlayer1: {
            set: req.body.matchState.players[0].highbreaks || [],
          },
          breaksPlayer2: {
            set: req.body.matchState.players[1].highbreaks || [],
          },
          winner: req.body.matchState.players[0].winner
            ? req.body.matchState.players[0].name
            : req.body.matchState.players[1].winner
            ? req.body.matchState.players[1].name
            : null,
          rawGameLog: JSON.stringify(req.body.matchState, null, 2),
          tableNumber: req.body.tableNumber
            ? Number(req.body.tableNumber)
            : null,
        },
      });
      res.send({ data: { matchId: req.body.matchState.matchId } });
    } catch (e) {
      console.log("Error while updating Match record in DB: " + e);
      console.error(e);
    }
  }
);
app.get("/api/matches/live", async (req: Request, res: Response) => {
  console.log(
    `Received GET request to /api/matches/live with params: ${JSON.stringify(
      req.body,
      null,
      2
    )}`
  );
  try {
    // for each table (assume there are 9 tables, numbered from 1-9), get the latest match where active = true
    const NUMBER_OF_TABLES = 9;
    const matches = [];

    for (let i = 1; i <= NUMBER_OF_TABLES; i++) {
      const match = await prisma.match.findFirst({
        where: {
          tableNumber: i,
          player1Name: {
            not: { in: ["Spieler A", "Spieler B", "Player1", "Player2"] },
          },
          player2Name: {
            not: { in: ["Spieler A", "Spieler B", "Player1", "Player2"] },
          },
        },
        orderBy: { updatedAt: "desc" },
      });
      if (match) {
        matches.push(match);
      }
    }
    res.json({ data: matches });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});
// ##################################################################################

app.get("/breaks/leaderboard", async (req: Request, res: Response) => {
  try {
    const playersBreaksList = await fetchHighestBreaksPerPlayer(25);

    res.json({ data: playersBreaksList });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/breaks/:date", async (req: Request, res: Response) => {
  const dateString = req.params.date;
  try {
    // Validate and parse the date
    const date = parseISO(dateString);
    if (!isValid(date)) {
      return res.status(400).json({ error: "Invalid date format" });
    }

    // Extract year, month, and day
    const year = date.getFullYear();
    const month = date.getMonth() + 1; // month is 0-indexed
    const day = date.getDate();

    // Perform the database query
    const playersBreaksList = await fetchBreaksByDate(year, month, day);

    // Respond with the data
    res.json({ data: playersBreaksList });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/data/years", async (req: Request, res: Response) => {
  try {
    const query = `
      SELECT DISTINCT
        EXTRACT(YEAR FROM "createdAt")::integer as year
      FROM "Match"
      WHERE "createdAt" IS NOT NULL
      ORDER BY year DESC;
    `;

    const years = await prisma.$queryRawUnsafe<{ year: number }[]>(query);
    const formattedYears = years.map((y) => y.year);

    res.json({ data: formattedYears });
  } catch (error) {
    console.error("Error fetching years:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/breaks/year/:year", async (req: Request, res: Response) => {
  const year = parseInt(req.params.year);

  if (isNaN(year)) {
    return res.status(400).json({ error: "Invalid year format" });
  }

  try {
    const playersBreaksList = await fetchBreaksByYear(year);
    res.json({ data: playersBreaksList });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/players/:playerName", async (req: Request, res: Response) => {
  const playerName = req.params.playerName;
  // get all matches where player1Name or player2Name is equal to playerName
  const matches = await prisma.match.findMany({
    where: {
      OR: [{ player1Name: playerName }, { player2Name: playerName }],
    },
    orderBy: { createdAt: "desc" },
  });

  let nationality = null;

  for (let i = 0; i < matches.length; i++) {
    if (matches[i].player1Name === playerName) {
      if (matches[i].player1NationIOC !== "") {
        nationality = matches[i].player1NationIOC;
        break;
      }
    } else {
      if (matches[i].player2NationIOC !== "") {
        nationality = matches[i].player2NationIOC;
        break;
      }
    }
  }

  const breaksListPlayer = (await fetchPlayerHighBreaks(
    playerName,
    10
  )) as any[];

  let highestBreakPerMatch: number[] = [];
  for (let i = 0; i < matches.length; i++) {
    if (matches[i].player1Name === playerName) {
      if (matches[i].breaksPlayer1.length > 0) {
        highestBreakPerMatch.push(matches[i].breaksPlayer1[0]);
      }
    } else {
      if (matches[i].breaksPlayer2.length > 0) {
        highestBreakPerMatch.push(matches[i].breaksPlayer2[0]);
      }
    }
  }
  const averageBreakPerMatch = Math.round(
    highestBreakPerMatch.reduce((a, b) => a + b, 0) /
      highestBreakPerMatch.length
  );

  const playerStats = {
    name: playerName,
    nationality,
    matchesPlayed: matches.length,
    matchesCompleted: matches.filter((match) => match.winner).length,
    matchesWon: matches.filter((match) => match.winner === playerName).length,
    matchesLost: matches.filter(
      (match) => match.winner && match.winner !== playerName
    ).length,
    framesWon: matches.reduce(
      (total, match) =>
        match.player1Name === playerName
          ? total + match.framesPlayer1
          : match.player2Name === playerName
          ? total + match.framesPlayer2
          : total,
      0
    ),
    framesLost: matches.reduce(
      (total, match) =>
        match.player1Name === playerName
          ? total + match.framesPlayer2
          : match.player2Name === playerName
          ? total + match.framesPlayer1
          : total,
      0
    ),
    highBreaks: breaksListPlayer[0]?.highbreaks || [],
    incompleteMatches: matches.filter((match) => !match.winner).length,
    averageBreakPerMatch,
  };

  res.json({ data: playerStats });
});

async function fetchBreaksByDate(year: number, month: number, day: number) {
  const query = `
      WITH PlayerBreaks AS (
          SELECT 
              m."createdAt",
              unnest(m."breaksPlayer1") AS hb,
              m."player1Name" AS "playerName"
          FROM "Match" m
          WHERE EXTRACT(YEAR FROM m."createdAt") = $1
            AND EXTRACT(MONTH FROM m."createdAt") = $2
            AND EXTRACT(DAY FROM m."createdAt") = $3
            AND m."breaksPlayer1" IS NOT NULL
          
          UNION ALL
          
          SELECT 
              m."createdAt",
              unnest(m."breaksPlayer2") AS hb,
              m."player2Name" AS "playerName"
          FROM "Match" m
          WHERE EXTRACT(YEAR FROM m."createdAt") = $1
            AND EXTRACT(MONTH FROM m."createdAt") = $2
            AND EXTRACT(DAY FROM m."createdAt") = $3
            AND m."breaksPlayer2" IS NOT NULL
      )
      SELECT 
          pb."playerName",
          array_agg(pb.hb ORDER BY pb.hb DESC) FILTER (WHERE pb.hb IS NOT NULL) AS highBreaks
      FROM PlayerBreaks pb
      GROUP BY pb."playerName"
      ORDER BY max(pb.hb) DESC;
  `;

  return await prisma.$queryRawUnsafe(query, year, month, day);
}

async function fetchHighestBreaksPerPlayer(breaksPerPlayer = 25) {
  const query = `
  WITH player_breaks AS (
    SELECT 
        m."player1Name" AS name, unnest(m."breaksPlayer1") AS highBreak
    FROM 
        "Match" m
    WHERE 
        m."breaksPlayer1" IS NOT NULL AND
        m."player1Name" <> 'Spieler A' AND
        m."player1Name" <> 'Spieler B' AND
        m."player1Name" <> '1' AND
        m."player1Name" <> '2' AND
        m."player1Name" NOT LIKE '@Neuer Spieler%'
    UNION ALL
    SELECT 
        m."player2Name" AS name, unnest(m."breaksPlayer2") AS highBreak
    FROM 
        "Match" m
    WHERE 
        m."breaksPlayer2" IS NOT NULL AND
        m."player2Name" <> 'Spieler A' AND
        m."player2Name" <> 'Spieler B' AND
        m."player2Name" <> '1' AND
        m."player2Name" <> '2' AND
        m."player2Name" NOT LIKE '@Neuer Spieler%'
  ), ranked_breaks AS (
    SELECT 
        name, 
        highBreak,
        row_number() OVER (PARTITION BY name ORDER BY highBreak DESC) AS rn
    FROM 
        player_breaks
  )
  SELECT 
      name, 
      array_agg(highBreak ORDER BY highBreak DESC) AS highBreaks
  FROM 
      ranked_breaks
  WHERE
      rn <= $1
  GROUP BY 
      name
  ORDER BY 
      highBreaks DESC;
  `;

  return await prisma.$queryRawUnsafe(query, breaksPerPlayer);
}

async function fetchPlayerHighBreaks(playerName: string, breaksPerPlayer = 25) {
  const query = `
  WITH player_breaks AS (
    SELECT 
        m."player1Name" AS name, unnest(m."breaksPlayer1") AS highBreak
    FROM 
        "Match" m
    WHERE 
        m."player1Name" = $1 AND
        m."breaksPlayer1" IS NOT NULL
    UNION ALL
    SELECT 
        m."player2Name", unnest(m."breaksPlayer2")
    FROM 
        "Match" m
    WHERE 
        m."player2Name" = $1 AND
        m."breaksPlayer2" IS NOT NULL
  ), ranked_breaks AS (
    SELECT 
        name, 
        highBreak,
        row_number() OVER (PARTITION BY name ORDER BY highBreak DESC) AS rn
    FROM 
        player_breaks
  )
  SELECT 
      name, 
      array_agg(highBreak ORDER BY highBreak DESC) AS highBreaks
  FROM 
      ranked_breaks
  WHERE
      rn <= $2
  GROUP BY 
      name
  ORDER BY 
      highBreaks DESC;
  `;

  return await prisma.$queryRawUnsafe(query, playerName, breaksPerPlayer);
}

async function fetchBreaksByYear(year: number, breaksPerPlayer = 25) {
  const query = `
  WITH player_breaks AS (
    SELECT 
        m."player1Name" AS name, unnest(m."breaksPlayer1") AS highBreak
    FROM 
        "Match" m
    WHERE 
        EXTRACT(YEAR FROM m."createdAt") = $1
        AND m."breaksPlayer1" IS NOT NULL
        AND m."player1Name" <> 'Spieler A'
        AND m."player1Name" <> 'Spieler B'
        AND m."player1Name" <> '1'
        AND m."player1Name" <> '2'
        AND m."player1Name" NOT LIKE '@Neuer Spieler%'
    UNION ALL
    SELECT 
        m."player2Name" AS name, unnest(m."breaksPlayer2") AS highBreak
    FROM 
        "Match" m
    WHERE 
        EXTRACT(YEAR FROM m."createdAt") = $1
        AND m."breaksPlayer2" IS NOT NULL
        AND m."player2Name" <> 'Spieler A'
        AND m."player2Name" <> 'Spieler B'
        AND m."player2Name" <> '1'
        AND m."player2Name" <> '2'
        AND m."player2Name" NOT LIKE '@Neuer Spieler%'
  ), ranked_breaks AS (
    SELECT 
        name, 
        highBreak,
        row_number() OVER (PARTITION BY name ORDER BY highBreak DESC) AS rn
    FROM 
        player_breaks
  )
  SELECT 
      name, 
      array_agg(highBreak ORDER BY highBreak DESC) AS highBreaks
  FROM 
      ranked_breaks
  WHERE
      rn <= $2
  GROUP BY 
      name
  ORDER BY 
      highBreaks DESC;
  `;

  return await prisma.$queryRawUnsafe(query, year, breaksPerPlayer);
}
