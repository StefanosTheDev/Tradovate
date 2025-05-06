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
exports.streamOneMinuteBars = streamOneMinuteBars;
// File: src/dataProcessor.ts
const axios_1 = __importDefault(require("axios"));
const readline = __importStar(require("node:readline"));
const PAGE_MS = 5 * 60 * 1000; // 5-minute paging window
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
function getBarColor(close, open, prevHigh, prevLow, strongUpDown) {
    if (!strongUpDown) {
        if (close > open)
            return 'green';
        if (close < open)
            return 'red';
        return 'gray';
    }
    else {
        if (prevHigh === null || prevLow === null) {
            if (close > open)
                return 'green';
            if (close < open)
                return 'red';
            return 'gray';
        }
        if (close > prevHigh)
            return 'green';
        if (close < prevLow)
            return 'red';
        return 'gray';
    }
}
async function* streamOneMinuteBars(key, dataset, schema, startUtc, endUtc, symbol, strongUpDown = false) {
    let currentBar = null;
    let runningCVD = 0;
    let prevHigh = null;
    let prevLow = null;
    for await (const t of streamTradesPaged(key, dataset, schema, startUtc, endUtc, symbol)) {
        const px = +t.price / 1_000_000_000;
        const tsMs = Number(BigInt(t.hd.ts_event) / 1000000n);
        const minuteStart = new Date(tsMs);
        minuteStart.setSeconds(0, 0);
        const minuteIso = minuteStart.toISOString();
        const sign = t.side === 'B' ? 1 : -1;
        const delta = sign * t.size;
        if (!currentBar || currentBar.timestamp !== minuteIso) {
            if (currentBar) {
                currentBar.cvd = runningCVD;
                currentBar.cvdColor = getBarColor(currentBar.close, currentBar.open, prevHigh, prevLow, strongUpDown);
                yield currentBar;
                prevHigh = currentBar.high;
                prevLow = currentBar.low;
            }
            currentBar = {
                timestamp: minuteIso,
                open: px,
                high: px,
                low: px,
                close: px,
                volume: t.size,
                delta,
                cvd: runningCVD + delta,
                cvdColor: 'gray',
            };
        }
        else {
            currentBar.high = Math.max(currentBar.high, px);
            currentBar.low = Math.min(currentBar.low, px);
            currentBar.close = px;
            currentBar.volume += t.size;
            currentBar.delta += delta;
        }
        runningCVD += delta;
        if (currentBar)
            currentBar.cvd = runningCVD;
    }
    if (currentBar) {
        currentBar.cvdColor = getBarColor(currentBar.close, currentBar.open, prevHigh, prevLow, strongUpDown);
        yield currentBar;
    }
}
