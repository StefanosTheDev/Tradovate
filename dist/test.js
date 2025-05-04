"use strict";
// mes_15min_closes.ts
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
const readline = __importStar(require("node:readline"));
/** Format a Date in America/Los_Angeles */
function formatPST(date) {
    return date.toLocaleString('en-US', {
        timeZone: 'America/Los_Angeles',
        hour12: false,
        month: '2-digit',
        day: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });
}
/** Stream OHLCV candles from Databento */
async function* streamCandles(apiKey, start, end, symbol) {
    const resp = await axios_1.default.get('https://hist.databento.com/v0/timeseries.get_range', {
        params: {
            dataset: 'GLBX.MDP3',
            schema: 'ohlcv-1',
            symbols: symbol,
            start,
            end,
            encoding: 'json',
        },
        auth: { username: apiKey, password: '' },
        responseType: 'stream',
    });
    const rl = readline.createInterface({ input: resp.data });
    for await (const line of rl) {
        if (!line.trim())
            continue;
        yield JSON.parse(line);
    }
}
/** Main function */
async function run() {
    const apiKey = 'db-Lx5jVsQr9uMVTE7nertd3xr56SdDG';
    const symbol = 'MESM5';
    const pstStart = '2024-04-30T06:30:00-07:00';
    const pstEnd = '2024-04-30T16:15:00-07:00';
    const startUtc = new Date(pstStart).toISOString();
    const endUtc = new Date(pstEnd).toISOString();
    console.log(`Getting 15-min candle closes for ${symbol} on ${pstStart.split('T')[0]}...\n`);
    let count = 0;
    for await (const candle of streamCandles(apiKey, startUtc, endUtc, symbol)) {
        const closeTime = new Date(Number(BigInt(candle.hd.ts_event) / 1000000n));
        const minutes = closeTime.getMinutes();
        if (minutes % 15 === 0) {
            count++;
            console.log(`Candle ${count} closes at ${formatPST(closeTime)} | Close Price: ${candle.close.toFixed(2)}`);
        }
    }
    console.log(`\n✔ Done — processed ${count} candles.`);
}
run().catch(console.error);
