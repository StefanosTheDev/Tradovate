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
// File: src/dataProcessor.ts
const axios_1 = __importDefault(require("axios"));
const readline = __importStar(require("node:readline"));
/**
 * Stream raw trades from Databento.
 * Adds better error reporting (prints API error body on 4xx/5xx).
 */
async function* streamTrades(key, dataset, schema, start, end, symbol) {
    try {
        const resp = await axios_1.default.get('https://hist.databento.com/v0/timeseries.get_range', {
            params: {
                dataset,
                schema,
                symbols: symbol,
                start,
                end,
                encoding: 'json',
            },
            auth: { username: key, password: '' },
            responseType: 'stream',
        });
        const rl = readline.createInterface({ input: resp.data });
        for await (const line of rl) {
            if (!line.trim())
                continue;
            yield JSON.parse(line);
        }
    }
    catch (e) {
        if (e.response) {
            console.error('Databento API error', e.response.status, e.response.statusText);
            const body = await streamToString(e.response.data);
            console.error(body);
        }
        throw e;
    }
}
/** Convert a Node stream to string (for error bodies) */
function streamToString(stream) {
    const chunks = [];
    return new Promise((res, rej) => {
        stream.on('data', (c) => chunks.push(c));
        stream.on('end', () => res(Buffer.concat(chunks).toString('utf8')));
        stream.on('error', rej);
    });
}
/** Aggregate every 1 000 trades into a bar */
async function* stream1000TickBars(key, dataset, schema, start, end, symbol) {
    let current = null;
    let ticks = 0;
    let delta = 0;
    for await (const t of streamTrades(key, dataset, schema, start, end, symbol)) {
        const ms = Number(BigInt(t.hd.ts_event) / 1000000n);
        const price = +t.price / 1_000_000_000; // nano$ → $
        const d = t.side === 'B' ? t.size : -t.size;
        delta += d;
        if (!current) {
            current = {
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
        current.high = Math.max(current.high, price);
        current.low = Math.min(current.low, price);
        current.close = price;
        current.volume += 1;
        current.cvd = delta;
        if (++ticks >= 1000) {
            current.cvdColor = delta > 0 ? 'green' : delta < 0 ? 'red' : 'gray';
            yield current;
            current = null;
            ticks = 0;
            delta = 0;
        }
    }
    if (current && ticks) {
        current.cvdColor = delta > 0 ? 'green' : delta < 0 ? 'red' : 'gray';
        yield current;
    }
}
