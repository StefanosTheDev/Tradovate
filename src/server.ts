// File: src/server.ts
import express, { Request, Response } from 'express';
import os from 'os';
import { Run1MinChart, Run22EMAChart, RunBreakouts } from './index';

const app = express();
const port: number = Number(process.env.PORT) || 3000;
app.use(express.json());

function listLocalIPs(): string[] {
  const addrs: string[] = [];
  for (const iface of Object.values(os.networkInterfaces())) {
    if (!iface) continue;
    for (const a of iface) {
      if (a.family === 'IPv4' && !a.internal) addrs.push(a.address);
    }
  }
  return addrs;
}

app.get('/1Min', async (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  try {
    await Run1MinChart((msg) => res.write(msg + '\n'));
    res.end();
  } catch {
    res.status(500).write('❌ Error streaming 1-min chart\n');
  }
});

app.get('/22EMA', async (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  try {
    await Run22EMAChart((msg) => res.write(msg + '\n'));
    res.end();
  } catch {
    res.status(500).write('❌ Error streaming 22-EMA\n');
  }
});

app.get('/breakouts', async (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  try {
    await RunBreakouts((msg) => res.write(msg + '\n'));
    res.end();
  } catch {
    res.status(500).write('❌ Error running breakouts detection\n');
  }
});

app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 Server listening on port ${port}`);
  const ips = listLocalIPs();
  console.log('Endpoints:');
  console.log(`  http://localhost:${port}/1Min`);
  console.log(`  http://localhost:${port}/22EMA`);
  console.log(`  http://localhost:${port}/breakouts`);
  ips.forEach((ip) => console.log(`  http://${ip}:${port}/1Min`));
  ips.forEach((ip) => console.log(`  http://${ip}:${port}/22EMA`));
  ips.forEach((ip) => console.log(`  http://${ip}:${port}/breakouts`));
});
