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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rawKlines, setRawKlines] = useState<KLine[]>([]);
  
  const [macdConfig, setMacdConfig] = useState<MACDConfig>({
    fast: 12,
    slow: 26,
    signal: 9
  });

  const [simulatedPercent, setSimulatedPercent] = useState(0);
  const configError = useMemo(() => validateMacdConfig(macdConfig), [macdConfig]);

  // Fetch data
  const fetchData = async (targetSymbol: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `https://api.binance.com/api/v3/klines?symbol=${targetSymbol.toUpperCase()}&interval=1w&startTime=${START_TIME}`
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

    return dataToProcess.map((d, i) => ({
      ...d,
      macd: macdResults[i]
    }));
  }, [rawKlines, macdConfig, simulatedPercent, baseHist, configError]);

  const currentClose = chartData.length > 0 ? chartData[chartData.length - 1].close : 0;
  const currentMacdHist = chartData.length > 0 ? chartData[chartData.length - 1].macd?.hist || 0 : 0;
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
      </header>

      {/* Main Content */}
      <main className="grid grid-cols-1 lg:grid-cols-4 gap-6 flex-grow">
        {/* Left Panel: Controls */}
        <div className="lg:col-span-1 space-y-6">
          {/* MACD Config */}
          <section className="bg-[#161a1e] border border-[#2b2f36] rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-[#848e9c] flex items-center">
                <Settings className="w-4 h-4 mr-2" />
                MACD Config
              </h2>
            </div>
            <div className="space-y-4">
              {[
                { label: 'Fast Period', key: 'fast', min: 1 },
                { label: 'Slow Period', key: 'slow', min: 1 },
                { label: 'Signal Period', key: 'signal', min: 2 }
              ].map((item) => (
                <div key={item.key} className="space-y-1.5">
                  <label className="text-xs text-[#848e9c]">{item.label}</label>
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
                    className="w-full bg-[#1e2329] border border-[#2b2f36] rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-emerald-500"
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
                onClick={() => setSimulatedPercent(0)}
                className="text-xs text-emerald-500 hover:underline"
              >
                Reset
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-[#848e9c]">Target Change</span>
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
              
              <div className="pt-4 border-t border-[#2b2f36] space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-[#848e9c]">Target MACD Hist</span>
                  <span className="font-mono text-white">{currentMacdHist.toFixed(4)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-[#848e9c]">Implied Close</span>
                  <span className="text-lg font-bold font-mono text-white">
                    {currentClose.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="p-3 bg-emerald-500/5 rounded-xl border border-emerald-500/10 flex items-start space-x-2">
                  <Info className="w-4 h-4 text-emerald-500 mt-0.5" />
                  <p className="text-[11px] text-[#848e9c] leading-relaxed">
                    Adjust the slider to change the MACD histogram. 0% represents the current real value.
                  </p>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Right Panel: Chart */}
        <div className="lg:col-span-3 min-h-[500px] flex flex-col space-y-4">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center space-x-4">
              <span className="text-lg font-bold">{symbol}</span>
              <span className="text-xs px-2 py-0.5 bg-[#2b2f36] rounded text-[#848e9c]">1W</span>
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
