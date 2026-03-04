export interface KLine {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface MACDResult {
  dif: number;
  dea: number;
  hist: number;
  emaFast: number;
  emaSlow: number;
}

export interface ChartData extends KLine {
  macd?: MACDResult;
  isSimulated?: boolean;
}

export interface MACDConfig {
  fast: number;
  slow: number;
  signal: number;
}
