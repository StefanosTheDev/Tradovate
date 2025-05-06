// File: src/server.ts
import express, { Request, Response } from 'express';
import os from 'os';
import { Run1MinChart, Run22EMAChart } from './index';

const app = express();
const port: number = Number(process.env.PORT) || 3000;

app.use(express.json());

// Helper: list your LAN IPs
function listLocalIPs(): string[] {
  const addrs: string[] = [];
  for (const iface of Object.values(os.networkInterfaces())) {
    if (!iface) continue;
    for (const addr of iface) {
      if (addr.family === 'IPv4' && !addr.internal) {
        addrs.push(addr.address);
      }
    }
  }
  return addrs;
}

// Stream bars → browser in plain text
app.get('/1Min', async (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  try {
    await Run1MinChart((msg) => res.write(msg + '\n'));
    res.end();
  } catch (err) {
    console.error(err);
    res.write('❌ Error streaming 1-Min Chart\n');
    res.end();
  }
});

// Stream EMA → browser in plain text
app.get('/22EMA', async (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  try {
    await Run22EMAChart((msg) => res.write(msg + '\n'));
    res.end();
  } catch (err) {
    console.error(err);
    res.write('❌ Error streaming 22-EMA\n');
    res.end();
  }
});

app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 Server listening on port ${port}`);
  const ips = listLocalIPs();
  if (ips.length) {
    console.log('→ Accessible on your network at:');
    ips.forEach((ip) => console.log(`   http://${ip}:${port}`));
  } else {
    console.log('⚠️  No non-internal IPv4 address found.');
  }
});
