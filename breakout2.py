#!/usr/bin/env python3
import os
import sys
import json
import requests
from datetime import datetime, timezone, timedelta

PAGE_MS = 5 * 60 * 1000  # 5-minute pages

def stream_trades_paged(key, dataset, schema, start_utc, end_utc, symbol):
    cur_start = int(datetime.fromisoformat(start_utc).timestamp() * 1000)
    end_ms   = int(datetime.fromisoformat(end_utc).timestamp()   * 1000)
    while cur_start < end_ms:
        cur_end = min(cur_start + PAGE_MS, end_ms)
        resp = requests.get(
            'https://hist.databento.com/v0/timeseries.get_range',
            params={
              'dataset':  dataset,
              'schema':   schema,
              'symbols':  symbol,
              'start':    datetime.fromtimestamp(cur_start/1000, timezone.utc).isoformat(),
              'end':      datetime.fromtimestamp(cur_end/1000,   timezone.utc).isoformat(),
              'encoding': 'json',
            },
            auth=(key, ''),
            stream=True
        )
        resp.raise_for_status()
        last_ts = cur_start
        for line in resp.iter_lines():
            if not line: continue
            trade = json.loads(line)
            ts_ms = int(int(trade['hd']['ts_event']) // 1_000_000)
            last_ts = ts_ms
            yield {
              'px':   float(trade['price']) / 1e9,
              'size': trade['size'],
              'side': trade['side'],
              'ts_ms': ts_ms
            }
        cur_start = last_ts + 1

def get_cvd_color(close, open_, prev_high, prev_low, strong):
    if not strong:
        if close > open_:   return 'green'
        if close < open_:   return 'red'
        return 'gray'
    if prev_high is None or prev_low is None:
        if close > open_:   return 'green'
        if close < open_:   return 'red'
        return 'gray'
    if close > prev_high: return 'green'
    if close < prev_low:  return 'red'
    return 'gray'

def stream_one_minute_bars(key, dataset, schema, start_utc, end_utc, symbol, strong_updown=True):
    current   = None
    running_cvd = 0
    prev_high = prev_low = None

    for t in stream_trades_paged(key, dataset, schema, start_utc, end_utc, symbol):
        px, size, side, ts_ms = t['px'], t['size'], t['side'], t['ts_ms']
        dt = datetime.fromtimestamp(ts_ms/1000, timezone.utc).replace(second=0, microsecond=0)
        iso = dt.isoformat()

        delta = size if side == 'B' else -size
        running_cvd += delta

        if current is None or current['timestamp'] != iso:
            if current:
                current['cvd']       = current['cvd_running']
                current['cvd_color'] = get_cvd_color(
                    current['close'], current['open'],
                    prev_high, prev_low,
                    strong_updown
                )
                yield current
                prev_high = current['high']
                prev_low  = current['low']

            current = {
              'timestamp':   iso,
              'open':        px,
              'high':        px,
              'low':         px,
              'close':       px,
              'volume':      size,
              'delta':       delta,
              'cvd_running': running_cvd,
            }
        else:
            current['high']      = max(current['high'], px)
            current['low']       = min(current['low'], px)
            current['close']     = px
            current['volume']   += size
            current['delta']    += delta
            current['cvd_running'] = running_cvd

    if current:
        current['cvd']       = current['cvd_running']
        current['cvd_color'] = get_cvd_color(
            current['close'], current['open'],
            prev_high, prev_low,
            strong_updown
        )
        yield current

def fmt_pdt(iso_str):
    dt = datetime.fromisoformat(iso_str)
    pdt = dt.astimezone(tz=timezone(timedelta(hours=-7)))
    return pdt.strftime('%I:%M:%S %p')

def main():
    key = "db-HhbTYsRc4EdgKYWgHpRL5qSnw8qEC"
    if not key:
        print("❌ Please set DATABENTO_API_KEY", file=sys.stderr)
        sys.exit(1)

    # — — config to match your TS version — —
    dataset = 'GLBX.MDP3'
    schema  = 'trades'
    symbol  = 'MESM5'
    start   = '2025-05-02T06:30:00-07:00'
    end     = '2025-05-02T07:30:00-07:00'

    print("📊 Streaming 1-min MESM5 bars with CVD")
    i = 0
    for bar in stream_one_minute_bars(key, dataset, schema, start, end, symbol, True):
        i += 1
        print(
            f"#{i:<3} {fmt_pdt(bar['timestamp'])} | "
            f"O:{bar['open']:.2f} H:{bar['high']:.2f} "
            f"L:{bar['low']:.2f} C:{bar['close']:.2f} "
            f"Vol:{bar['volume']} CVD:{bar['cvd']} "
            f"Color:{bar['cvd_color']}"
        )

if __name__ == '__main__':
    main()
