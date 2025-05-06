// File: src/server.ts
import express, { Request, Response } from 'express';
import { Run1MinChart, Run22EMAChart } from './index';

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

app.get('/1Min', async (_req: Request, res: Response) => {
  try {
    await Run1MinChart();
    res.send('✔ 1-Min Chart stream complete');
  } catch (err) {
    console.error(err);
    res.status(500).send('❌ Error streaming 1-Min Chart');
  }
});

app.get('/22EMA', async (_req: Request, res: Response) => {
  try {
    await Run22EMAChart();
    res.send('✔ 22-EMA stream complete');
  } catch (err) {
    console.error(err);
    res.status(500).send('❌ Error streaming 22-EMA');
  }
});

app.listen(port, () => {
  console.log(`🚀 Server listening on http://localhost:${port}`);
});
