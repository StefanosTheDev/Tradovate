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
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv = __importStar(require("dotenv"));
const dataProcessor_1 = require("./dataProcessor");
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
function formatPDT(date) {
    return date.toLocaleString('en-US', {
        timeZone: 'America/Los_Angeles',
        hour12: true,
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
    });
}
async function run() {
    console.log(`Streaming ${SYMBOL} 1000-trade bars from ${START_TIME} to ${END_TIME} (PDT)…`);
    try {
        let barCount = 0;
        for await (const bar of (0, dataProcessor_1.stream1000TickBars)(API_KEY, START_UTC, END_UTC, SYMBOL)) {
            const barMs = new Date(bar.timestamp).getTime();
            if (barMs < START_MS || barMs > END_MS)
                continue;
            if (bar.open == null ||
                bar.high == null ||
                bar.low == null ||
                bar.close == null ||
                bar.volume == null ||
                bar.cvd == null ||
                bar.cvdColor == null) {
                console.warn(`Skipping invalid bar at ${bar.timestamp}: ${JSON.stringify(bar)}`);
                continue;
            }
            barCount++;
            console.log(`Bar #${barCount} | ` +
                `Time: ${formatPDT(new Date(bar.timestamp))} | ` +
                `Open: ${bar.open.toFixed(2)} | ` +
                `High: ${bar.high.toFixed(2)} | ` +
                `Low: ${bar.low.toFixed(2)} | ` +
                `Close: ${bar.close.toFixed(2)} | ` +
                `Volume: ${bar.volume} | ` +
                `CVD: ${bar.cvd.toFixed(2)} | ` +
                `Color: ${bar.cvdColor}`);
        }
        console.log(`\n✔ Done — printed ${barCount} 1000-trade bars for ${SYMBOL} between ${START_TIME} and ${END_TIME}.`);
    }
    catch (error) {
        console.error(error);
    }
}
run();
