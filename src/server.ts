// File: src/server.ts
import express from 'express';
import os from 'os';
import { Run1MinChart, Run22EMAChart, RunBreakouts } from './index';

const app = express();
const port = Number(process.env.PORT) || 3000;
app.use(express.json());

['1Min', '22EMA', 'breakouts'].forEach((ep) => {
  app.get(`/${ep}`, async (_req, res) => {
    res.setHeader('Content-Type', 'text/plain');
    const runner =
      ep === '1Min'
        ? Run1MinChart
        : ep === '22EMA'
        ? Run22EMAChart
        : RunBreakouts;
    await runner((msg) => res.write(msg + '\n'));
    res.end();
  });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Server listening on port ${port}`);
  console.log(`Endpoints:`);
  console.log(` http://localhost:${port}/1Min`);
  console.log(` http://localhost:${port}/22EMA`);
  console.log(` http://localhost:${port}/breakouts`);
});
