"use strict";
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
exports.stream1000TickBars = stream1000TickBars;
const axios_1 = __importDefault(require("axios"));
const readline = __importStar(require("node:readline"));
const DATASET = 'GLBX.MDP3';
const SCHEMA = 'trades';
/** Stream raw trades (prints) from Databento */
async function* streamTrades(apiKey, start, end, symbol) {
    const resp = await axios_1.default.get('https://hist.databento.com/v0/timeseries.get_range', {
        params: {
            dataset: DATASET,
            schema: SCHEMA,
            symbols: symbol,
            stype_in: 'raw_symbol', // ensure raw symbol mapping
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
/** Aggregate every 1 000 trades into one TickBar */
async function* stream1000TickBars(apiKey, start, end, symbol) {
    let currentBar = null;
    let tickCount = 0;
    let cumDelta = 0;
    for await (const trade of streamTrades(apiKey, start, end, symbol)) {
        const ms = Number(BigInt(trade.hd.ts_event) / 1000000n);
        const price = Number(trade.price) / 1_000_000_000; // nano → dollars
        const delta = trade.side === 'B' ? trade.size : -trade.size;
        cumDelta += delta;
        if (!currentBar) {
            currentBar = {
                timestamp: new Date(ms).toISOString(),
                open: price,
                high: price,
                low: price,
                close: price,
                volume: 0,
                cvd: 0,
                cvdColor: 'gray',
            };
        }
        currentBar.high = Math.max(currentBar.high, price);
        currentBar.low = Math.min(currentBar.low, price);
        currentBar.close = price;
        currentBar.volume += 1;
        currentBar.cvd = cumDelta;
        tickCount++;
        if (tickCount >= 1000) {
            currentBar.cvdColor =
                cumDelta > 0 ? 'green' : cumDelta < 0 ? 'red' : 'gray';
            yield currentBar;
            currentBar = null;
            tickCount = 0;
            cumDelta = 0;
        }
    }
    // Flush any final partial bar
    if (currentBar && tickCount > 0) {
        currentBar.cvdColor =
            cumDelta > 0 ? 'green' : cumDelta < 0 ? 'red' : 'gray';
        yield currentBar;
    }
}
