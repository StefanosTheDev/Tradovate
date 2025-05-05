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
// File: src/dataProcessor.ts  (1 000 **contracts** per bar, exact split + running CVD)
// ------------------------------
const axios_1 = __importDefault(require("axios"));
const readline = __importStar(require("node:readline"));
const PAGE_MS = 5 * 60 * 1000; // 5‑minute paging window
async function* streamTradesPaged(key, dataset, schema, startUtc, endUtc, symbol) {
    let curStart = Date.parse(startUtc);
    const end = Date.parse(endUtc);
    while (curStart < end) {
        const curEnd = Math.min(curStart + PAGE_MS, end);
        const resp = await axios_1.default.get('https://hist.databento.com/v0/timeseries.get_range', {
            params: {
                dataset,
                schema,
                symbols: symbol,
                start: new Date(curStart).toISOString(),
                end: new Date(curEnd).toISOString(),
                encoding: 'json',
            },
            auth: { username: key, password: '' },
            responseType: 'stream',
        });
        const rl = readline.createInterface({ input: resp.data });
        let lastTs = curStart;
        for await (const line of rl) {
            if (!line.trim())
                continue;
            const trade = JSON.parse(line);
            yield trade;
            lastTs = Number(BigInt(trade.hd.ts_event) / 1000000n);
        }
        curStart = lastTs + 1;
    }
}
/**
 * Build bars of **exactly 1 000 contracts**. If a trade overfills the
 * bar, we split it: part goes to complete current bar, remainder starts
 * the next. `cvd` is *running* cumulative delta across the session while
 * `delta` holds the bar’s own buy‑minus‑sell.
 */
async function* stream1000TickBars(key, dataset, schema, startUtc, endUtc, symbol) {
    let bar = null;
    let barContracts = 0; // contracts in current bar
    let barDelta = 0; // net delta in current bar
    let runningCVD = 0; // cumulative delta over the day
    for await (let t of streamTradesPaged(key, dataset, schema, startUtc, endUtc, symbol)) {
        let remaining = t.size; // contracts still to allocate
        const sign = t.side === 'B' ? 1 : -1; // +buy  ‑sell
        const px = +t.price / 1_000_000_000;
        const tsMs = Number(BigInt(t.hd.ts_event) / 1000000n);
        while (remaining > 0) {
            // start new bar if none exists
            if (!bar) {
                bar = {
                    timestamp: new Date(tsMs).toISOString(),
                    open: px,
                    high: px,
                    low: px,
                    close: px,
                    volume: 0,
                    cvd: 0,
                    delta: 0,
                    cvdColor: 'gray',
                };
                barContracts = 0;
                barDelta = 0;
            }
            // contracts we can still fit into this bar
            const space = 1_000 - barContracts;
            const fill = Math.min(space, remaining);
            // update OHLVC with the *trade price* once (price doesn’t change within split)
            bar.high = Math.max(bar.high, px);
            bar.low = Math.min(bar.low, px);
            bar.close = px;
            bar.volume += fill;
            barDelta += sign * fill;
            runningCVD += sign * fill;
            bar.cvd = runningCVD; // running value for each split
            barContracts += fill;
            remaining -= fill;
            // if bar filled exactly, emit and reset
            if (barContracts === 1_000) {
                bar.cvdColor = barDelta > 0 ? 'green' : barDelta < 0 ? 'red' : 'gray';
                yield bar;
                bar = null;
            }
        }
    }
    // discard unfinished bar (<1 000 contracts)
}
