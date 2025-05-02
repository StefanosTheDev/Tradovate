// prototype.ts

import WebSocket from 'ws';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const API_BASE = 'https://demo.tradovateapi.com/v1';
const REPLAY_WS_URL = 'wss://replay-demo.tradovateapi.com/v1/websocket';
const SYMBOL = 'ESM4';

////////////////////////////////////////////////////////////////////////////////
// 1) Utility: simple heartbeat
///////////////////////////////////////////////// ///////////////////////////////
function startHeartbeat(ws: WebSocket, label = 'WS') {
  const id = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send('[]');
      console.log(`💓 [${label}] heartbeat`);
    }
  }, 2500);

  const cleanup = () => {
    clearInterval(id);
    console.log(`🛑 [${label}] stopped heartbeat`);
  };
  ws.on('close', cleanup);
  ws.on('error', cleanup);
}

////////////////////////////////////////////////////////////////////////////////
// 2) Fetch Tradovate access tokens
////////////////////////////////////////////////////////////////////////////////
async function fetchTokens() {
  const res = await fetch(`${API_BASE}/auth/accesstokenrequest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: process.env.TRADOVATE_USERNAME,
      password: process.env.TRADOVATE_PASSWORD,
      appId: 'DevKey',
      appVersion: '0.0.1',
      deviceId: 'my-device-id',
      cid: '6037',
      sec: process.env.TRADOVATE_SECRET,
    }),
  });

  if (!res.ok) throw new Error('token fetch failed: ' + res.statusText);
  const { accessToken } = (await res.json()) as { accessToken: string };
  console.log('✅ got accessToken');
  return accessToken;
}

////////////////////////////////////////////////////////////////////////////////
// 3) Replay WS handshake + clock init + chart subscription
////////////////////////////////////////////////////////////////////////////////
async function runReplayPrototype() {
  const token = await fetchTokens();

  return new Promise<number>((resolve, reject) => {
    const ws = new WebSocket(REPLAY_WS_URL);

    ws.on('open', () => {
      // a) always send one immediate heartbeat:
      ws.send('[]');
      startHeartbeat(ws, 'Replay');

      // b) delay auth slightly so server is ready
      setTimeout(() => {
        ws.send(JSON.stringify({ e: 'md:auth', d: { token } }));
        console.log('📤 sent md:auth');
      }, 50);
    });

    ws.on('message', (raw) => {
      const msg = raw.toString();
      console.log('📩', msg);

      if (!msg.startsWith('{')) return;
      const { e, d } = JSON.parse(msg);

      if (e === 'md:authenticated') {
        console.log('✅ authenticated');
        // initialize clock for replay
        ws.send(
          JSON.stringify({
            e: 'replay:initializeClock',
            d: {
              startTimestamp: new Date().toISOString(),
              speed: 100,
              initialBalance: 50_000,
            },
          })
        );
      }

      if (e === 'replay:clockInitialized') {
        console.log('🎯 clockInitialized, sessionId=', d.sessionId);
        ws.close(); // stops heartbeat
        resolve(d.sessionId);
      }

      if (e === 'md:error' || e === 'replay:error') {
        reject(new Error('WS error: ' + msg));
      }
    });

    ws.on('error', reject);
    ws.on('close', (code, reason) => {
      console.log(`❌ closed ${code} ${reason}`);
    });
  });
}

////////////////////////////////////////////////////////////////////////////////
// 4) Kick off prototype
////////////////////////////////////////////////////////////////////////////////
(async () => {
  try {
    const sessionId = await runReplayPrototype();
    console.log('👉 Prototype complete, sessionId:', sessionId);
  } catch (err) {
    console.error('💥 Prototype failed:', err);
  }
})();
