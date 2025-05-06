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
exports.Run1MinChart = Run1MinChart;
exports.Run22EMAChart = Run22EMAChart;
exports.RunBreakouts = RunBreakouts;
// File: src/index.ts
const dotenv = __importStar(require("dotenv"));
const dataProcessor_1 = require("./dataProcessor");
const ema_1 = require("./ema");
const breakoutIndicator_1 = require("./breakoutIndicator");
dotenv.config();
const API_KEY = process.env.DATABENTO_API_KEY ?? '';
const SYMBOL = 'MESM5';
const DATASET = 'GLBX.MDP3';
const SCHEMA = 'trades';
// Example window: May 2, 2025, 06:30–07:30 PDT
const START_TIME = '2025-05-02T06:30:00-07:00';
const END_TIME = '2025-05-02T07:30:00-07:00';
if (!API_KEY) {
    console.error('❌ Missing DATABENTO_API_KEY');
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
/**
 * Stream raw 1-minute bars: O, H, L, C, Vol, CVD, color
 */
async function Run1MinChart(logger = console.log) {
    logger(`📊 Streaming ${SYMBOL} 1-min bars (${START_TIME} → ${END_TIME} PDT)`);
    let count = 0;
    for await (const bar of (0, dataProcessor_1.streamOneMinuteBars)(API_KEY, DATASET, SCHEMA, START_UTC, END_UTC, SYMBOL, true)) {
        logger(`#${++count}`.padEnd(4) +
            `${fmtPDT(new Date(bar.timestamp))} | ` +
            `O:${bar.open.toFixed(2)} H:${bar.high.toFixed(2)} ` +
            `L:${bar.low.toFixed(2)} C:${bar.close.toFixed(2)} | ` +
            `Vol:${bar.volume} | CVD:${bar.cvd} (${bar.cvdColor})`);
    }
    logger(`✔ Finished streaming ${count} bars.`);
}
/**
 * Stream 22-period EMA over 1-min closes
 */
async function Run22EMAChart(logger = console.log) {
    logger(`📈 Streaming 22-EMA (${START_TIME} → ${END_TIME} PDT)`);
    const emaCalc = new ema_1.Ema([22]);
    let count = 0;
    for await (const bar of (0, dataProcessor_1.streamOneMinuteBars)(API_KEY, DATASET, SCHEMA, START_UTC, END_UTC, SYMBOL, false)) {
        const [ema22] = emaCalc.add(bar.close);
        logger(`#${++count}`.padEnd(4) +
            `${fmtPDT(new Date(bar.timestamp))} | Close:${bar.close.toFixed(2)} | ` +
            `EMA-22:${ema22 !== null ? ema22.toFixed(2) : '---'}`);
    }
    logger(`✔ Finished EMA for ${count} bars.`);
}
/**
 * Run breakout detection using cumulative delta trendline
 */
async function RunBreakouts(logger = console.log, cfg = { windowSize: 5, offsetK: 0, threshold: 0, confirmBars: 1 }) {
    logger(`🔔 Breakout detection (window=${cfg.windowSize}, thresh=${cfg.threshold * 100}%, confirm=${cfg.confirmBars})`);
    const bi = new breakoutIndicator_1.BreakoutIndicator(cfg);
    let count = 0;
    for await (const bar of (0, dataProcessor_1.streamOneMinuteBars)(API_KEY, DATASET, SCHEMA, START_UTC, END_UTC, SYMBOL, false)) {
        const time = fmtPDT(new Date(bar.timestamp));
        const res = bi.update(time, bar.open, bar.close);
        if (!res) {
            logger(`#${++count}`.padEnd(4) +
                `${time} | Close:${bar.close.toFixed(2)} | waiting...`);
        }
        else {
            const { signal, level } = res;
            logger(`#${++count}`.padEnd(4) +
                `${time} | Close:${bar.close.toFixed(2)} ` +
                `Signal:${signal}` +
                (signal !== 'HOLD' ? `@${level.toFixed(2)}` : ''));
        }
    }
    logger(`✔ Breakout stream complete (${count} bars)`);
}
