# Web Crypto MACD Reverser

一个基于 React + TypeScript + D3 的加密行情可视化工具，用于：
- 拉取 Binance 周线 K 线数据（默认 `ETHUSDT`，起始时间为 2025-01-01）。
- 计算 MACD（DIF / DEA / Histogram）。
- 通过“目标 Histogram”反推最后一根 K 线收盘价（MACD Reverse）。
- 在图表中对比真实值与模拟值。

## 功能特性

- 交易对搜索（如 `BTCUSDT`、`ETHUSDT`）。
- MACD 参数实时调整（Fast / Slow / Signal）。
- 模拟滑块调整目标 Histogram，并展示反推收盘价。
- 参数合法性校验，避免 `Infinity/NaN` 计算异常（如 `fast === slow`、`signal <= 1`）。
- D3 蜡烛图 + MACD 柱线/双线联动展示。

## 技术栈

- 前端：React 19、TypeScript、Vite
- 图表：D3
- 样式：Tailwind CSS v4
- 测试：Node.js 内置 `node:test` + `tsx`

## 本地开发

### 环境要求

- Node.js 22+（建议）
- npm 10+

### 启动步骤

```bash
npm install
npm run dev
```

启动后访问：`http://localhost:3000`

## Docker Compose 启动

项目已提供 `docker-compose.yml`，可直接运行：

```bash
docker compose up --build
```

默认映射端口：`3000:3000`

## 常用命令

```bash
# 开发模式
npm run dev

# 类型检查
npm run lint

# 单元测试
npm test

# 生产构建
npm run build

# 本地预览构建产物
npm run preview
```

## 目录结构

```text
src/
  App.tsx                      # 页面状态与交互逻辑
  components/CandlestickChart.tsx
  utils/indicators.ts          # EMA / MACD / reverseMACD
  types.ts                     # 类型定义
tests/
  indicators.test.ts           # 计算逻辑回归测试
docker-compose.yml
```

## 注意事项

- 数据来源为 Binance 公共接口，仅用于分析和模拟演示，不构成投资建议。
- 若网络环境无法访问 Binance，页面会提示请求失败。
