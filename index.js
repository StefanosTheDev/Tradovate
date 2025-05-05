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
// ------------------------------
// File: src/index.ts
// ------------------------------
const dotenv = __importStar(require("dotenv"));
const dataProcessor_1 = require("./dataProcessor");
dotenv.config();
// ==== CONFIG =====
const API_KEY = process.env.DATABENTO_API_KEY ?? '';
const SYMBOL = 'MESM5'; // contract
const DATASET = 'GLBX.MDP3'; // CME Globex MDP‑3.0
const SCHEMA = 'trades'; // trade prints
// first 10 minutes of 2025‑05‑02 regular session (PDT)
const START_TIME = '2025-05-02T06:30:00-07:00';
const END_TIME = '2025-05-02T06:40:00-07:00';
if (!API_KEY) {
    console.error('❌  Missing DATABENTO_API_KEY');
    process.exit(1);
}
const START_UTC = new Date(START_TIME).toISOString();
const END_UTC = new Date(END_TIME).toISOString();
function fmtPDT(d) {
    return d.toLocaleString('en-US', {
        timeZone: 'America/Los_Angeles',
        hour12: true,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });
}
async function run() {
    console.log(`Streaming ${SYMBOL} 1k‑trade bars… (${START_TIME} → ${END_TIME} PDT)`);
    let n = 0;
    for await (const bar of (0, dataProcessor_1.stream1000TickBars)(API_KEY, DATASET, SCHEMA, START_UTC, END_UTC, SYMBOL)) {
        console.log(`Bar #${++n}`.padEnd(8) +
            `${fmtPDT(new Date(bar.timestamp))}  ` +
            `O:${bar.open.toFixed(2)} H:${bar.high.toFixed(2)} ` +
            `L:${bar.low.toFixed(2)} C:${bar.close.toFixed(2)}  ` +
            `Vol:${bar.volume}  CVD:${bar.cvd} (${bar.cvdColor})`);
    }
    console.log(`✔ Finished — ${n} bars`);
}
run();
