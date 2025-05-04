import * as net from 'net';
import * as crypto from 'crypto';
import { StockHelper } from '../../stock/stock.helper';
import { StringHelper } from '../../misc/string.helper';
import { DateHelper2 } from '../../misc/date.helper.2';
import {
  B_ERROR,
  B_MAPPING,
  B_OHLCV_1M,
  B_OHLCV_1S,
  B_SYSTEM,
  BENTO_KEY,
  BentoBar,
  BentoBase,
  BentoError,
  BentoHeartBeat,
  BentoOHLCV,
  BentoSymbolMapping,
} from './bento.model';
import { isM2 } from '../../gw/gw.helper';
import { Globals } from '../../data/globals';
import { ApLogHelper } from '../../stock/tradovate/ap.log.helper';
import { WorldCandle } from '../world.candle';
import { WatchFeed } from '../watch.feed';

const HOST_FUT = 'glbx-mdp3.lsg.databento.com';
const HOST_OPRA = 'opra-pillar.lsg.databento.com';

const DATASET_FUT = 'GLBX.MDP3';
const DATASET_OPRA = 'OPRA.PILLAR';

const PORT = 13000;

export function fromBentoPrice(p: string): number {
  //'5780750000000'
  return p ? +p.substring(0, p.length - 7) / 100 : undefined;
}

// https://databento.com/docs/api-reference-live/message-flows/authentication#example?historical=python&live=raw&reference=python
export class BentoConnect {
  client: net.Socket;
  version: string;
  connected = false;
  authenticated = false;
  buf: string = '';

  instrumentMap: {
    [id: number]: string;
  } = {};

  host: string;
  dataset: string;
  isFut: boolean;

  processing = false;

  constructor(private symbols?: string[]) {
    const me = this;
    if (symbols) {
      me.isFut = true;
      me.host = HOST_FUT;
      me.dataset = DATASET_FUT;
    } else {
      me.isFut = false;
      me.host = HOST_OPRA;
      me.dataset = DATASET_OPRA;
      me.symbols = ['VIX.OPT'];
    }

    me.connect();
  }

  private cramResponse(cram: string) {
    const sanitizedCram = StringHelper.keepAfter(cram, '=');
    const hash = crypto
      .createHash('sha256')
      .update(`${sanitizedCram}|${BENTO_KEY}`)
      .digest('hex');
    const resp = `${hash}-${BENTO_KEY.slice(-5)}`;
    // compression=zstd
    // https://databento.com/docs/api-reference-live/client-control-messages/authentication-request/fields?historical=python&live=raw&reference=python
    return `auth=${resp}|dataset=${this.dataset}|encoding=json|ts_out=1`;
  }

  reconnectTimer: any;

  connect() {
    console.log('DataBento');
    const me = this;
    me.client = new net.Socket();

    function doConnect() {
      if (!me.connected) {
        me.authenticated = false;
        me.buf = '';
        console.log('DataBento connecting...');
        me.client.connect(PORT, me.host, () => {
          // Globals.discord._err('DB: Connected to DataBento');
          me.connected = true;
        });
      }
    }

    // Error handling
    me.client.on('error', (err) => {
      // connect ETIMEDOUT 209.127.153.128:13000
      Globals.discord._err2('DB: Connection error:', err.message);
    });

    me.client.on('data', (raw) => {
      let nd = raw.toString();
      me.buf += nd;
      // console.log('*** DataBento data ' + nd.length + ' / ' + me.buf.length);

      while (true) {
        try {
          let pos = me.buf.indexOf('\n');
          // console.log(pos);
          if (pos === -1) break;
          let data = me.buf.substring(0, pos);
          me.buf = me.buf.substring(pos + 1);
          // console.log('dl', data.length, me.buf.length);
          if (me.authenticated) {
            try {
              me.processData(JSON.parse(data));
            } catch (error) {
              console.error(error);
              console.log('data', data);
            }
          } else {
            // deal with authentication
            if (data.startsWith('lsg_version')) {
              me.version = StringHelper.keepAfter(data, '=');
              console.log('DataBento version:', data);
              continue;
            }

            if (data.startsWith('cram')) {
              //authenticate
              const response = me.cramResponse(data);
              me.client.write(response + '\n');
              continue;
            }

            // error=
            // session_id=
            // success=
            if (data.includes('success=1')) {
              me.authenticated = true;
              console.log('DataBento Authentication succeeded');
              // me.client.write('schema=ohlcv-1s|stype_in=parent|symbols=${symbol}\n');
              // https://databento.com/docs/standards-and-conventions/symbology#supported-symbology-combinations?historical=python&live=python&reference=python
              if (me.dataset === DATASET_OPRA) {
                // me.client.write(
                //   //VIX.OPT
                //   `schema=ohlcv-1m|stype_in=parent|symbols=${me.symbol}\n`,
                // );
              } else {
                if (isM2()) {
                  for (let symbol of me.symbols) {
                    me.client.write(
                      //B_OHLCV_1S and B_OHLCV_1M
                      `schema=ohlcv-1s|stype_in=raw_symbol|symbols=${symbol}\n` +
                        `schema=ohlcv-1m|stype_in=raw_symbol|symbols=${symbol}\n`
                      // `schema=trades|stype_in=raw_symbol|symbols=${symbol}\n`,
                    );
                  }
                }
                // me.client.write(
                //   //B_OHLCV_1M
                //   `schema=ohlcv-1m|stype_in=raw_symbol|symbols=${symbol}\n`,
                // );
              }
              me.client.write('start_session=1\n');
            } else if (data.includes('success=0')) {
              me.authenticated = false;
              console.error('DataBento Authentication failed', data);
              me.client.destroy();
            }
          }
        } catch (error) {
          Globals.discord._err2('DataBento error:', error?.message);
        }
      }
    });

    // Handle connection close
    me.client.on('close', () => {
      // Globals.discord._err('DataBento Connection closed');
      me.connected = false;
    });

    // Trap exit signals to close the connection properly
    process.on('exit', () => {
      me.close();
    });

    doConnect();
    me.reconnectTimer = setInterval(() => {
      doConnect();
    }, 60000);
  }

  close() {
    const me = this;
    clearInterval(me.reconnectTimer); // so we do not reconnect
    // me.client.resetAndDestroy();
    me.client.end();
  }

  // https://databento.com/docs/schemas-and-data-formats/trades#fields-trades?historical=python&live=raw&reference=python
  processData(x: BentoBase) {
    const me = this;
    // if (!me.isFut) {
    //   console.log(x);
    // }
    let sym = me.instrumentMap[x.hd.instrument_id];
    let wc = WorldCandle.getWorldCandle(sym, false);
    // console.log('bento', sym);

    // if (x.hd.rtype === B_MBP_0) {
    //   // t = DateHelper2.fromUnixEpochNano(x.hd.ts_event)
    //   let trade: BentoTrade = x as BentoTrade;
    //   if (trade.action === 'T') {
    //     let price = fromBentoPrice(trade.price);
    //     // console.log('price', price);
    //     if (me.isES) {
    //       StockHelper.tradovateService.onEsPrice(price);
    //     }
    //   }
    // }
    if (x.hd.rtype === B_SYSTEM) {
      let sys: BentoHeartBeat = x as BentoHeartBeat;
      if (sys.msg !== 'Heartbeat') {
        console.log('Unknown Bento System Message', sys);
      }
    } else if (x.hd.rtype === B_OHLCV_1S) {
      // 1s candles
      if (!me.processing) {
        me.processing = true;
        try {
          let candle: BentoOHLCV = x as BentoOHLCV;
          let { t, dt, timestamp } = DateHelper2.getTimeFromUnixEpochNano(
            x.hd.ts_event
          );
          const bar: BentoBar = {
            o: fromBentoPrice(candle.open),
            h: fromBentoPrice(candle.high),
            l: fromBentoPrice(candle.low),
            c: fromBentoPrice(candle.close),
            v: +candle.volume,
            timestamp,
            dt,
            t,
            sec: +dt.slice(-2),
          };

          // 1 second candle bars
          wc.onBentoBar1s(bar);
        } catch (error) {
          ApLogHelper.err('DataBento', error);
        } finally {
          me.processing = false;
        }
      } else {
        ApLogHelper.err('DataBento processing not keeping up');
      }
    } else if (x.hd.rtype === B_OHLCV_1M) {
      // 1m candles
      WatchFeed.aliveDb();
      let candle: BentoOHLCV = x as BentoOHLCV;
      // calculate the AlphaZone
      let { t, dt, timestamp } = DateHelper2.getTimeFromUnixEpochNano(
        x.hd.ts_event
      );
      let h = fromBentoPrice(candle.high);
      let l = fromBentoPrice(candle.low);
      let c = fromBentoPrice(candle.close);
      const bar: BentoBar = {
        t,
        dt,
        timestamp,
        sec: 0,
        o: fromBentoPrice(candle.open),
        h,
        l,
        c,
        v: +candle.volume,
      };
      wc.onBentoBar1mLive(bar);

      // AzTrader.onBentoCandle1m(sym, t, bar);
      // console.log(t, bar);
    } else if (x.hd.rtype === B_MAPPING) {
      let mapping: BentoSymbolMapping = x as BentoSymbolMapping;
      // console.log('mapping', mapping);
      let symbol = mapping.stype_out_symbol; //ESZ4
      let id = mapping.hd.instrument_id;
      if (id) {
        me.instrumentMap[id] = symbol;
      }
    } else if (x.hd.rtype === B_ERROR) {
      let err: BentoError = x as BentoError;
      console.log('err', err);
    } else {
      console.log('Unknown Bento Message', x);
    }
  }
}
