/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Search, Settings, TrendingUp, Info, AlertCircle, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ChartData, KLine, MACDConfig } from './types';
import { calculateMACD, reverseMACD } from './utils/indicators';
import CandlestickChart from './components/CandlestickChart';

const DEFAULT_SYMBOL = 'ETHUSDT';
const START_TIME = 1735689600000; // 2025-01-01

const INTERVALS = [
  { label: '15m', value: '15m', ms: 15 * 60 * 1000,          limit: 96  },  // 1天
  { label: '30m', value: '30m', ms: 30 * 60 * 1000,          limit: 96  },  // 2天
  { label: '1H',  value: '1h',  ms: 60 * 60 * 1000,          limit: 120 },  // 5天
  { label: '4H',  value: '4h',  ms: 4 * 60 * 60 * 1000,      limit: 120 },  // 20天
  { label: '1D',  value: '1d',  ms: 24 * 60 * 60 * 1000,     limit: 120 },  // 4个月
  { label: '1W',  value: '1w',  ms: 7 * 24 * 60 * 60 * 1000, limit: 60  },  // 约1年
  { label: '1M',  value: '1M',  ms: 30 * 24 * 60 * 60 * 1000,limit: 100 },
];

function validateMacdConfig(config: MACDConfig): string | null {
  const { fast, slow, signal } = config;
  if (!Number.isInteger(fast) || fast <= 0) return 'Fast period must be a positive integer.';
  if (!Number.isInteger(slow) || slow <= 0) return 'Slow period must be a positive integer.';
  if (!Number.isInteger(signal) || signal <= 1) return 'Signal period must be an integer greater than 1.';
  if (fast === slow) return 'Fast and Slow periods must be different.';
  return null;
}

export default function App() {
  const [symbol, setSymbol] = useState(DEFAULT_SYMBOL);
  const [inputSymbol, setInputSymbol] = useState(DEFAULT_SYMBOL);
  const [interval, setInterval] = useState(INTERVALS[5]); // 默认 1W
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rawKlines, setRawKlines] = useState<KLine[]>([]);
  
  const [macdConfig, setMacdConfig] = useState<MACDConfig>({
    fast: 12,
    slow: 26,
    signal: 9
  });

  const [simulatedPercent, setSimulatedPercent] = useState(0);
  const [nextSimulatedPercent, setNextSimulatedPercent] = useState(0);
  const [evolutionSimulatedPercent, setEvolutionSimulatedPercent] = useState(0);
  const configError = useMemo(() => validateMacdConfig(macdConfig), [macdConfig]);

  // Fetch data
  const fetchData = async (targetSymbol: string, targetInterval = interval) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `https://api.binance.com/api/v3/klines?symbol=${targetSymbol.toUpperCase()}&interval=${targetInterval.value}&limit=${targetInterval.limit}`
      );
      if (!response.ok) throw new Error('Failed to fetch data from Binance');
      
      const data = await response.json();
      const formatted: KLine[] = data.map((d: any) => ({
        time: d[0],
        open: parseFloat(d[1]),
        high: parseFloat(d[2]),
        low: parseFloat(d[3]),
        close: parseFloat(d[4]),
        volume: parseFloat(d[5]),
      }));
      
      setRawKlines(formatted);
      setSymbol(targetSymbol.toUpperCase());
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(DEFAULT_SYMBOL);
  }, []);

  useEffect(() => {
    fetchData(symbol, interval);
  }, [interval]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputSymbol) fetchData(inputSymbol);
  };

  // Calculate the "real" base MACD histogram for the latest candle
  const baseHist = useMemo(() => {
    if (rawKlines.length === 0 || configError) return 0;
    const prices = rawKlines.map(d => d.close);
    const macdResults = calculateMACD(prices, macdConfig);
    return macdResults[macdResults.length - 1]?.hist || 0;
  }, [rawKlines, macdConfig, configError]);

  // Reset simulation when symbol or config changes
  useEffect(() => {
    setSimulatedPercent(0);
    setNextSimulatedPercent(0);
    setEvolutionSimulatedPercent(0);
  }, [baseHist]);

  // Process data with MACD
  const chartData = useMemo(() => {
    if (rawKlines.length === 0 || configError) return [];

    let dataToProcess = [...rawKlines];
    const lastIdx = dataToProcess.length - 1;
    const lastReal = dataToProcess[lastIdx];

    // Calculate target histogram based on percentage
    // We use a scale to ensure even if baseHist is 0, the slider has an effect
    const scale = Math.abs(baseHist) || (lastReal.close * 0.0005) || 0.1;
    const targetHist = baseHist + (scale * simulatedPercent / 100);

    if (lastIdx > 0) {
      // First calculate MACD for all candles up to the second to last
      const pricesUpToPrev = dataToProcess.slice(0, lastIdx).map(d => d.close);
      const macdResults = calculateMACD(pricesUpToPrev, macdConfig);
      const prevMacd = macdResults[macdResults.length - 1];

      // Reverse calculate the close price for the last candle
      const simulatedClose = reverseMACD(
        targetHist,
        prevMacd.emaFast,
        prevMacd.emaSlow,
        prevMacd.dea,
        macdConfig
      );

      // Update the last candle with simulated values
      dataToProcess[lastIdx] = {
        ...lastReal,
        close: simulatedClose,
        high: Math.max(lastReal.high, simulatedClose),
        low: Math.min(lastReal.low, simulatedClose),
        isSimulated: simulatedPercent !== 0
      };
    }

    const prices = dataToProcess.map(d => d.close);
    const macdResults = calculateMACD(prices, macdConfig);

    const result: ChartData[] = dataToProcess.map((d, i) => ({
      ...d,
      macd: macdResults[i]
    }));

    // 预测下一根 K 线
    const lastMacd = macdResults[macdResults.length - 1];
    const lastCandle = dataToProcess[dataToProcess.length - 1];
    if (lastMacd && lastCandle) {
      try {
        const nextScale = Math.abs(lastMacd.hist) || (lastCandle.close * 0.0005) || 0.1;
        const nextTargetHist = lastMacd.hist + (nextScale * nextSimulatedPercent / 100);
        const nextClose = reverseMACD(
          nextTargetHist,
          lastMacd.emaFast,
          lastMacd.emaSlow,
          lastMacd.dea,
          macdConfig
        );
        const alphaF = 2 / (macdConfig.fast + 1);
        const alphaS = 2 / (macdConfig.slow + 1);
        const alphaSig = 2 / (macdConfig.signal + 1);
        const nextEmaFast = nextClose * alphaF + lastMacd.emaFast * (1 - alphaF);
        const nextEmaSlow = nextClose * alphaS + lastMacd.emaSlow * (1 - alphaS);
        const nextDif = nextEmaFast - nextEmaSlow;
        const nextDea = nextDif * alphaSig + lastMacd.dea * (1 - alphaSig);
        const nextHist = (nextDif - nextDea) * 2;
        const nextCandle = {
          time: lastCandle.time + interval.ms,
          open: lastCandle.close,
          high: Math.max(lastCandle.close, nextClose),
          low: Math.min(lastCandle.close, nextClose),
          close: nextClose,
          volume: 0,
          isNext: true,
          macd: { dif: nextDif, dea: nextDea, hist: nextHist, emaFast: nextEmaFast, emaSlow: nextEmaSlow }
        };
        result.push(nextCandle);

        // 演化K：基于预测K的 MACD 再推一根
        try {
          const evoScale = Math.abs(nextHist) || (nextClose * 0.0005) || 0.1;
          const evoTargetHist = nextHist + (evoScale * evolutionSimulatedPercent / 100);
          const evoClose = reverseMACD(evoTargetHist, nextEmaFast, nextEmaSlow, nextDea, macdConfig);
          const evoEmaFast = evoClose * alphaF + nextEmaFast * (1 - alphaF);
          const evoEmaSlow = evoClose * alphaS + nextEmaSlow * (1 - alphaS);
          const evoDif = evoEmaFast - evoEmaSlow;
          const evoDea = evoDif * alphaSig + nextDea * (1 - alphaSig);
          const evoHist = (evoDif - evoDea) * 2;
          result.push({
            time: lastCandle.time + interval.ms * 2,
            open: nextClose,
            high: Math.max(nextClose, evoClose),
            low: Math.min(nextClose, evoClose),
            close: evoClose,
            volume: 0,
            isEvolution: true,
            macd: { dif: evoDif, dea: evoDea, hist: evoHist, emaFast: evoEmaFast, emaSlow: evoEmaSlow }
          });
        } catch (_) {}
      } catch (_) {
        // 反推失败时不添加预测 K 线
      }
    }

    return result;
  }, [rawKlines, macdConfig, simulatedPercent, nextSimulatedPercent, evolutionSimulatedPercent, baseHist, configError]);

  const lastReal = chartData.findLast(d => !d.isNext && !d.isEvolution);
  const nextCandle = chartData.findLast(d => d.isNext);
  const evoCandle = chartData.findLast(d => d.isEvolution);
  const currentClose = lastReal?.close ?? 0;
  const currentMacdHist = lastReal?.macd?.hist ?? 0;
  const nextClose = nextCandle?.close ?? 0;
  const evoClose = evoCandle?.close ?? 0;
  const displayError = error || configError;

  return (
    <div className="min-h-screen flex flex-col p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-emerald-500/10 rounded-xl">
            <TrendingUp className="w-6 h-6 text-emerald-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">MACD Reverser</h1>
            <p className="text-sm text-[#848e9c]">Weekly Analysis since 2025</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* 周期切换 */}
          <div className="flex items-center bg-[#1e2329] border border-[#2b2f36] rounded-xl overflow-hidden">
            {INTERVALS.map(iv => (
              <button
                key={iv.value}
                onClick={() => setInterval(iv)}
                className={`px-3 py-2 text-xs font-medium transition-colors ${
                  interval.value === iv.value
                    ? 'bg-emerald-500 text-white'
                    : 'text-[#848e9c] hover:text-white'
                }`}
              >
                {iv.label}
              </button>
            ))}
          </div>

          {/* 交易对搜索 */}
          <form onSubmit={handleSearch} className="relative group">
            <input
              type="text"
              value={inputSymbol}
              onChange={(e) => setInputSymbol(e.target.value)}
              placeholder="Search Symbol (e.g. BTCUSDT)"
              className="w-full md:w-64 bg-[#1e2329] border border-[#2b2f36] rounded-xl py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#848e9c] group-focus-within:text-emerald-500 transition-colors" />
          </form>
        </div>
      </header>

      {/* Main Content */}
      <main className="grid grid-cols-1 lg:grid-cols-4 gap-6 flex-grow">
        {/* Left Panel: Controls */}
        <div className="lg:col-span-1 space-y-6">
          {/* MACD Config */}
          <section className="bg-[#161a1e] border border-[#2b2f36] rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Settings className="w-3.5 h-3.5 text-[#848e9c]" />
              <span className="text-xs font-semibold uppercase tracking-wider text-[#848e9c]">MACD</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Fast', key: 'fast', min: 1 },
                { label: 'Slow', key: 'slow', min: 1 },
                { label: 'Signal', key: 'signal', min: 2 }
              ].map((item) => (
                <div key={item.key} className="space-y-1">
                  <label className="text-[10px] text-[#848e9c]">{item.label}</label>
                  <input
                    type="number"
                    min={item.min}
                    step={1}
                    value={macdConfig[item.key as keyof MACDConfig]}
                    onChange={(e) => {
                      const parsed = parseInt(e.target.value, 10);
                      if (Number.isNaN(parsed)) return;
                      const clamped = Math.max(item.min, parsed);
                      setMacdConfig({ ...macdConfig, [item.key]: clamped });
                    }}
                    className="w-full bg-[#1e2329] border border-[#2b2f36] rounded-lg py-1.5 px-2 text-xs text-center focus:outline-none focus:border-emerald-500"
                  />
                </div>
              ))}
            </div>
          </section>

          {/* Simulation Slider */}
          <section className="bg-[#161a1e] border border-[#2b2f36] rounded-2xl p-5 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-[#848e9c] flex items-center">
                <TrendingUp className="w-4 h-4 mr-2" />
                Simulation
              </h2>
              <button
                onClick={() => { setSimulatedPercent(0); setNextSimulatedPercent(0); setEvolutionSimulatedPercent(0); }}
                className="text-xs text-emerald-500 hover:underline"
              >
                Reset
              </button>
            </div>

            <div className="space-y-4">
              {/* 当前 K 线滑条 */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-[#848e9c]">当前 K · Hist 变化</span>
                  <span className={simulatedPercent >= 0 ? 'text-emerald-500' : 'text-red-500'}>
                    {simulatedPercent > 0 ? '+' : ''}{simulatedPercent}%
                  </span>
                </div>
                <input
                  type="range"
                  min="-100"
                  max="100"
                  step="1"
                  value={simulatedPercent}
                  onChange={(e) => setSimulatedPercent(parseInt(e.target.value))}
                  className="w-full accent-emerald-500 cursor-pointer"
                />
                <div className="flex justify-between items-center text-xs">
                  <span className="text-[#848e9c]">Implied Close</span>
                  <span className="font-mono font-bold text-white">
                    {currentClose.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              <div className="border-t border-[#2b2f36]" />

              {/* 预测 K 线滑条 */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-[#848e9c]">预测 K · Hist 变化</span>
                  <span className={nextSimulatedPercent >= 0 ? 'text-emerald-500' : 'text-red-500'}>
                    {nextSimulatedPercent > 0 ? '+' : ''}{nextSimulatedPercent}%
                  </span>
                </div>
                <input
                  type="range"
                  min="-100"
                  max="100"
                  step="1"
                  value={nextSimulatedPercent}
                  onChange={(e) => setNextSimulatedPercent(parseInt(e.target.value))}
                  className="w-full accent-sky-400 cursor-pointer"
                />
                <div className="flex justify-between items-center text-xs">
                  <span className="text-[#848e9c]">Implied Close</span>
                  <span className="font-mono font-bold text-sky-400">
                    {nextClose > 0 ? nextClose.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '--'}
                  </span>
                </div>
              </div>

              <div className="border-t border-[#2b2f36]" />

              {/* 演化 K 滑条 */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-[#848e9c]">演化 K · Hist 变化</span>
                  <span className={evolutionSimulatedPercent >= 0 ? 'text-violet-400' : 'text-red-500'}>
                    {evolutionSimulatedPercent > 0 ? '+' : ''}{evolutionSimulatedPercent}%
                  </span>
                </div>
                <input
                  type="range"
                  min="-100"
                  max="100"
                  step="1"
                  value={evolutionSimulatedPercent}
                  onChange={(e) => setEvolutionSimulatedPercent(parseInt(e.target.value))}
                  className="w-full accent-violet-400 cursor-pointer"
                />
                <div className="flex justify-between items-center text-xs">
                  <span className="text-[#848e9c]">Implied Close</span>
                  <span className="font-mono font-bold text-violet-400">
                    {evoClose > 0 ? evoClose.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '--'}
                  </span>
                </div>
              </div>

              <div className="p-3 bg-emerald-500/5 rounded-xl border border-emerald-500/10 flex items-start space-x-2">
                <Info className="w-4 h-4 text-emerald-500 mt-0.5" />
                <p className="text-[11px] text-[#848e9c] leading-relaxed">
                  0% = 维持当前 Hist 不变。正值伸长，负值缩短。
                </p>
              </div>
            </div>
          </section>
        </div>

        {/* Right Panel: Chart */}
        <div className="lg:col-span-3 min-h-[500px] flex flex-col space-y-4">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center space-x-4">
              <span className="text-lg font-bold">{symbol}</span>
              <span className="text-xs px-2 py-0.5 bg-[#2b2f36] rounded text-[#848e9c]">{interval.label}</span>
            </div>
            {loading && <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />}
          </div>

          <div className="flex-grow relative">
            {displayError ? (
              <div className="absolute inset-0 flex items-center justify-center bg-[#161a1e] rounded-2xl border border-red-500/20">
                <div className="text-center space-y-2">
                  <AlertCircle className="w-8 h-8 text-red-500 mx-auto" />
                  <p className="text-sm text-red-500">{displayError}</p>
                  {error && (
                    <button onClick={() => fetchData(symbol)} className="text-xs text-white bg-red-500 px-4 py-2 rounded-lg">Retry</button>
                  )}
                </div>
              </div>
            ) : (
              <div className="w-full h-full min-h-[600px]">
                <CandlestickChart data={chartData} width={900} height={600} />
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center py-4 text-[10px] text-[#848e9c] border-t border-[#2b2f36]">
        Data provided by Binance Public API. Calculations are for simulation purposes only.
      </footer>
    </div>
  );
}
