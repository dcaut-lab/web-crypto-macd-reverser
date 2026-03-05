import { KLine, MACDConfig, MACDResult } from "../types";

function assertPositiveInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${label} period must be a positive integer`);
  }
}

function assertPriceSeries(data: number[]): void {
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error("Price series must contain at least one value");
  }
  if (!data.every((v) => Number.isFinite(v))) {
    throw new Error("Price series must contain only finite numbers");
  }
}

export function calculateEMA(data: number[], period: number): number[] {
  assertPriceSeries(data);
  assertPositiveInteger(period, "EMA");

  const k = 2 / (period + 1);
  const ema: number[] = [];
  let prevEma = data[0];
  ema.push(prevEma);

  for (let i = 1; i < data.length; i++) {
    const currentEma = data[i] * k + prevEma * (1 - k);
    ema.push(currentEma);
    prevEma = currentEma;
  }
  return ema;
}

export function calculateMACD(
  prices: number[],
  config: MACDConfig
): MACDResult[] {
  const { fast, slow, signal } = config;
  assertPositiveInteger(fast, "fast");
  assertPositiveInteger(slow, "slow");
  assertPositiveInteger(signal, "signal");

  const emaFast = calculateEMA(prices, fast);
  const emaSlow = calculateEMA(prices, slow);

  const dif = emaFast.map((f, i) => f - emaSlow[i]);
  const dea = calculateEMA(dif, signal);

  return dif.map((d, i) => ({
    dif: d,
    dea: dea[i],
    hist: (d - dea[i]) * 2,
    emaFast: emaFast[i],
    emaSlow: emaSlow[i],
  }));
}

/**
 * Reverses the MACD histogram value to find the required closing price.
 * 
 * Hist_t = 2 * (DIF_t - DEA_t)
 * DEA_t = DIF_t * alpha_sig + DEA_{t-1} * (1 - alpha_sig)
 * DIF_t = EMA_fast_t - EMA_slow_t
 * EMA_t = Price_t * alpha + EMA_{t-1} * (1 - alpha)
 */
export function calculateATR(klines: { high: number; low: number; close: number }[], period = 14): number[] {
  const tr: number[] = [];
  for (let i = 0; i < klines.length; i++) {
    const { high, low } = klines[i];
    const prevClose = i === 0 ? klines[i].close : klines[i - 1].close;
    tr.push(Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose)));
  }
  const atr: number[] = [];
  let sum = tr.slice(0, period).reduce((a, b) => a + b, 0);
  atr.push(...new Array(period - 1).fill(NaN));
  atr.push(sum / period);
  for (let i = period; i < tr.length; i++) {
    const val = (atr[atr.length - 1] * (period - 1) + tr[i]) / period;
    atr.push(val);
  }
  return atr;
}

export function reverseMACD(
  targetHist: number,
  prevEmaFast: number,
  prevEmaSlow: number,
  prevDea: number,
  config: MACDConfig
): number {
  const { fast, slow, signal } = config;
  assertPositiveInteger(fast, "fast");
  assertPositiveInteger(slow, "slow");
  assertPositiveInteger(signal, "signal");
  if (fast === slow) {
    throw new Error("fast and slow periods must be different for reverse MACD");
  }
  if (signal <= 1) {
    throw new Error("signal period must be greater than 1 for reverse MACD");
  }

  if (![targetHist, prevEmaFast, prevEmaSlow, prevDea].every((v) => Number.isFinite(v))) {
    throw new Error("reverseMACD inputs must be finite numbers");
  }

  const alphaF = 2 / (fast + 1);
  const alphaS = 2 / (slow + 1);
  const alphaSig = 2 / (signal + 1);

  // Hist = 2 * (DIF - DEA)
  // Hist / 2 = DIF - (DIF * alphaSig + prevDea * (1 - alphaSig))
  // Hist / 2 = DIF * (1 - alphaSig) - prevDea * (1 - alphaSig)
  // DIF * (1 - alphaSig) = Hist / 2 + prevDea * (1 - alphaSig)
  // DIF = (Hist / 2) / (1 - alphaSig) + prevDea
  
  const targetDif = (targetHist / 2) / (1 - alphaSig) + prevDea;

  // DIF = EMA_f - EMA_s
  // DIF = (Price * alphaF + prevEmaF * (1 - alphaF)) - (Price * alphaS + prevEmaS * (1 - alphaS))
  // DIF = Price * (alphaF - alphaS) + prevEmaF * (1 - alphaF) - prevEmaS * (1 - alphaS)
  // Price * (alphaF - alphaS) = DIF - prevEmaF * (1 - alphaF) + prevEmaS * (1 - alphaS)
  
  const denominator = alphaF - alphaS;
  if (denominator === 0) {
    throw new Error("fast and slow periods must produce different EMA factors");
  }

  const price = (targetDif - prevEmaFast * (1 - alphaF) + prevEmaSlow * (1 - alphaS)) / denominator;
  if (!Number.isFinite(price)) {
    throw new Error("reverseMACD produced a non-finite close price");
  }

  return price;
}
