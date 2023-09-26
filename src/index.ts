import bodyParser from "body-parser";
import cors from "cors";
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
