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

app.use(cors(corsOptions)); // Use this after the variable declaration
const port = process.env.PORT || 8000;

app.listen(port, () => {
  console.log(`Server is running on port: ${port}`);
});

app.get("/health", (req: Request, res: Response) => {
  res.send("RRSB Scoreboard API");
});

app.post("/matches", bodyParser.json(), async (req: Request, res: Response) => {
  // receive raw JSON from scoreboard-fe containing game data
  console.log(JSON.stringify(req.body, null, 2));
  // extract game data and store in DB
  try {
    await prisma.match.create({
      data: {
        player1Name: req.body.players[0].name,
        player2Name: req.body.players[1].name,
        active: false,
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
        tableNumber: req.body.tableNumber,
      },
    });
  } catch (e) {
    console.log("Error while storing Match record in DB: " + e);
  }

  for (let i = 0; i < req.body.players.length; i++) {
    try {
      const player = await prisma.player.findUnique({
        where: { name: req.body.players[i].name },
      });

      const playerHighBreaks: number[] = player?.highBreaks ?? [];

      await prisma.player.upsert({
        where: { name: req.body.players[i].name },
        update: {
          totalMatchesWon:
            player?.totalMatchesWon || 0 + (req.body.players[i].winner ? 1 : 0),
          totalMatchesLost:
            player?.totalMatchesLost ||
            0 + (req.body.players[i].winner ? 0 : 1),
          totalFramesWon:
            player?.totalFramesWon || 0 + req.body.players[i].frames,
          totalFramesLost:
            player?.totalFramesLost ||
            0 + req.body.players[i == 0 ? 1 : 0].frames,
          highBreaks: {
            set: [...playerHighBreaks, ...req.body.players[i].highbreaks],
          },
        },
        create: {
          name: req.body.players[i].name,
          totalMatchesWon: req.body.players[i].winner ? 1 : 0,
          totalMatchesLost: req.body.players[i].winner ? 0 : 1,
          totalFramesWon: req.body.players[i].frames,
          totalFramesLost: req.body.players[i == 0 ? 1 : 0].frames,
          highBreaks: {
            set: req.body.players[i].highbreaks,
          },
        },
      });
    } catch (e) {
      console.log("Error while storing Player record in DB: " + e);
    }
  }

  res.send("Success");
});

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

async function fetchBreaksByDate(year: number, month: number, day: number) {
  const query = `
      SELECT 
          p."name",
          array_agg(hb ORDER BY hb DESC) FILTER (WHERE hb IS NOT NULL) AS highBreaks
      FROM 
          "Player" p
      JOIN 
          "Match" m ON p."name" = m."player1Name" OR p."name" = m."player2Name"
      CROSS JOIN LATERAL 
          unnest(ARRAY_CAT(m."breaksPlayer1", m."breaksPlayer2")) WITH ORDINALITY AS hb(hb, ord)
      WHERE 
          EXTRACT(YEAR FROM m."createdAt") = $1 AND EXTRACT(MONTH FROM m."createdAt") = $2 AND EXTRACT(DAY FROM m."createdAt") = $3
          AND ((ord <= array_length(m."breaksPlayer1", 1) AND p."name" = m."player1Name") OR (ord > array_length(m."breaksPlayer1", 1) AND p."name" = m."player2Name"))
      GROUP BY 
          p."name"
      ORDER BY 
          highBreaks DESC;
  `;

  return await prisma.$queryRawUnsafe(query, year, month, day);
}

async function fetchHighestBreaksPerPlayer(breaksPerPlayer = 25) {
  const query = `
  SELECT 
      p."name", 
      COALESCE(pb.sorted_highBreaks, '{}') AS highBreaks
  FROM 
      "Player" p
  LEFT JOIN (
      SELECT "playerId", array_agg(highBreak ORDER BY highBreak DESC) as sorted_highBreaks
      FROM (
      SELECT 
          "playerId", 
          highBreak,
          row_number() OVER (PARTITION BY "playerId" ORDER BY highBreak DESC) as rn
      FROM (
          SELECT "playerId", unnest("highBreaks") as highBreak
          FROM "Player"
      ) AS sub
    ) AS ranked_breaks
    WHERE rn <= $1
    GROUP BY "playerId"
  ) pb ON p."playerId" = pb."playerId"
  WHERE 
    array_length(pb.sorted_highBreaks, 1) > 0
  ORDER BY 
    pb.sorted_highBreaks DESC;
  `;

  return await prisma.$queryRawUnsafe(query, breaksPerPlayer);
}
