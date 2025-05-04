import * as dotenv from 'dotenv';
import { stream1000TickBars, TickBar } from './dataProcessor';

// Load environment variables
dotenv.config();

// Databento API configuration
const API_KEY = process.env.DATABENTO_API_KEY || 'your_api_key_here';
const SYMBOL = 'MESM5';
const DATASET = 'GLBX.MDP3'; // Global CME MDP 3.0 historical feed
const SCHEMA = 'trades'; // Time-and-sales (tick) data

// Trading session: May 2, 2025, 6:30 AM to 6:40 PM PDT
const START_TIME = '2025-05-02T06:30:00-07:00';
const END_TIME = '2025-05-02T18:40:00-07:00';

// Convert to UTC
const START_UTC = new Date(START_TIME).toISOString();
const END_UTC = new Date(END_TIME).toISOString();

// Millisecond bounds for filtering
const START_MS = new Date(START_UTC).getTime();
const END_MS = new Date(END_UTC).getTime();

// Format timestamp in PDT as HH:MM:SS AM/PM
function formatPDT(date: Date): string {
  return date.toLocaleString('en-US', {
    timeZone: 'America/Los_Angeles',
    hour12: true,
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  });
}

async function run() {
  console.log(
    `Streaming ${SYMBOL} 1000-trade bars from ${START_TIME} to ${END_TIME} (PDT)…`
  );

  try {
    let barCount = 0;
    for await (const bar of stream1000TickBars(
      API_KEY,
      START_UTC,
      END_UTC,
      SYMBOL
    )) {
      const barMs = new Date(bar.timestamp).getTime();
      if (barMs < START_MS || barMs > END_MS) continue;

      if (
        bar.open == null ||
        bar.high == null ||
        bar.low == null ||
        bar.close == null ||
        bar.volume == null ||
        bar.cvd == null ||
        bar.cvdColor == null
      ) {
        console.warn(
          `Skipping invalid bar at ${bar.timestamp}: ${JSON.stringify(bar)}`
        );
        continue;
      }

      barCount++;
      console.log(
        `Bar #${barCount} | ` +
          `Time: ${formatPDT(new Date(bar.timestamp))} | ` +
          `Open: ${bar.open.toFixed(2)} | ` +
          `High: ${bar.high.toFixed(2)} | ` +
          `Low: ${bar.low.toFixed(2)} | ` +
          `Close: ${bar.close.toFixed(2)} | ` +
          `Volume: ${bar.volume} | ` +
          `CVD: ${bar.cvd.toFixed(2)} | ` +
          `Color: ${bar.cvdColor}`
      );
    }
    console.log(
      `\n✔ Done — printed ${barCount} 1000-trade bars for ${SYMBOL} between ${START_TIME} and ${END_TIME}.`
    );
  } catch (error) {
    console.error(error);
  }
}

run();
