import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { ChartData } from '../types';

interface Props {
  data: ChartData[];
  width: number;
  height: number;
}

const CandlestickChart: React.FC<Props> = ({ data, width, height }) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || data.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const margin = { top: 20, right: 60, bottom: 150, left: 60 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Scales
    const x = d3.scaleBand()
      .domain(data.map(d => d.time.toString()))
      .range([0, innerWidth])
      .padding(0.3);

    const yPrice = d3.scaleLinear()
      .domain([
        d3.min(data, (d: ChartData) => d.low) || 0,
        d3.max(data, (d: ChartData) => d.high) || 0
      ])
      .range([innerHeight * 0.6, 0])
      .nice();

    const yMacd = d3.scaleLinear()
      .domain([
        d3.min(data, (d: ChartData) => Math.min(d.macd?.dif || 0, d.macd?.dea || 0, d.macd?.hist || 0)) || 0,
        d3.max(data, (d: ChartData) => Math.max(d.macd?.dif || 0, d.macd?.dea || 0, d.macd?.hist || 0)) || 0
      ])
      .range([innerHeight, innerHeight * 0.7])
      .nice();

    // Axes
    const xAxis = d3.axisBottom(x)
      .tickValues(x.domain().filter((_, i) => i % 5 === 0))
      .tickFormat(d => {
        const date = new Date(parseInt(d));
        return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
      });

    g.append('g')
      .attr('transform', `translate(${innerWidth},0)`)
      .call(d3.axisRight(yPrice).ticks(5).tickSize(-innerWidth))
      .call(g => g.select('.domain').remove())
      .call(g => g.selectAll('.tick line').attr('stroke', '#2b2f36').attr('stroke-dasharray', '2,2'))
      .call(g => g.selectAll('.tick text').attr('x', 5).attr('fill', '#848e9c'));

    g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(xAxis)
      .call(g => g.selectAll('text').attr('fill', '#848e9c'));

    g.append('g')
      .attr('transform', `translate(${innerWidth},0)`)
      .call(d3.axisRight(yMacd).ticks(3).tickSize(-innerWidth))
      .call(g => g.select('.domain').remove())
      .call(g => g.selectAll('.tick line').attr('stroke', '#2b2f36').attr('stroke-dasharray', '2,2'))
      .call(g => g.selectAll('.tick text').attr('x', 5).attr('fill', '#848e9c'));

    // Candlesticks
    const candles = g.selectAll<SVGGElement, ChartData>('.candle')
      .data(data)
      .enter().append('g')
      .attr('class', (d: ChartData) => `candle ${d.close >= d.open ? 'up' : 'down'}`);

    candles.append('line')
      .attr('x1', (d: ChartData) => (x(d.time.toString()) || 0) + x.bandwidth() / 2)
      .attr('x2', (d: ChartData) => (x(d.time.toString()) || 0) + x.bandwidth() / 2)
      .attr('y1', (d: ChartData) => yPrice(d.high))
      .attr('y2', (d: ChartData) => yPrice(d.low))
      .attr('stroke', (d: ChartData) => d.close >= d.open ? '#00b07b' : '#ff3b30');

    candles.append('rect')
      .attr('x', (d: ChartData) => x(d.time.toString()) || 0)
      .attr('y', (d: ChartData) => yPrice(Math.max(d.open, d.close)))
      .attr('width', x.bandwidth())
      .attr('height', (d: ChartData) => Math.max(1, Math.abs(yPrice(d.open) - yPrice(d.close))))
      .attr('fill', (d: ChartData) => d.isNext ? 'none' : (d.close >= d.open ? '#00b07b' : '#ff3b30'))
      .attr('stroke', (d: ChartData) => d.isNext ? (d.close >= d.open ? '#00b07b' : '#ff3b30') : 'none')
      .attr('stroke-width', (d: ChartData) => d.isNext ? 1.5 : 0)
      .attr('stroke-dasharray', (d: ChartData) => d.isNext ? '4,2' : 'none')
      .attr('opacity', (d: ChartData) => d.isNext ? 0.5 : (d.isSimulated ? 0.6 : 1));

    // MACD Histogram
    g.selectAll<SVGRectElement, ChartData>('.macd-bar')
      .data(data)
      .enter().append('rect')
      .attr('class', 'macd-bar')
      .attr('x', (d: ChartData) => x(d.time.toString()) || 0)
      .attr('y', (d: ChartData) => d.macd ? (d.macd.hist >= 0 ? yMacd(d.macd.hist) : yMacd(0)) : 0)
      .attr('width', x.bandwidth())
      .attr('height', (d: ChartData) => d.macd ? Math.abs(yMacd(d.macd.hist) - yMacd(0)) : 0)
      .attr('fill', (d: ChartData, i: number) => {
        if (!d.macd) return '#848e9c';
        const prev = data[i - 1]?.macd;
        const shrinking = prev ? Math.abs(d.macd.hist) < Math.abs(prev.hist) : false;
        if (d.macd.hist >= 0) return shrinking ? '#00b07b55' : '#00b07b';
        else return shrinking ? '#ff3b3055' : '#ff3b30';
      })
      .attr('opacity', 1);

    // MACD Lines
    const lineDif = d3.line<ChartData>()
      .x(d => (x(d.time.toString()) || 0) + x.bandwidth() / 2)
      .y(d => yMacd(d.macd?.dif || 0));

    const lineDea = d3.line<ChartData>()
      .x(d => (x(d.time.toString()) || 0) + x.bandwidth() / 2)
      .y(d => yMacd(d.macd?.dea || 0));

    g.append('path')
      .datum(data)
      .attr('class', 'macd-dif')
      .attr('d', lineDif)
      .attr('stroke', '#2962ff')
      .attr('fill', 'none');

    g.append('path')
      .datum(data)
      .attr('class', 'macd-dea')
      .attr('d', lineDea)
      .attr('stroke', '#ff9800')
      .attr('fill', 'none');

    // Crosshair and Tooltip
    const crosshair = g.append('g').style('display', 'none');
    
    const vLine = crosshair.append('line')
      .attr('stroke', '#848e9c')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '3,3')
      .attr('y1', 0)
      .attr('y2', innerHeight);

    const hLine = crosshair.append('line')
      .attr('stroke', '#848e9c')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '3,3')
      .attr('x1', 0)
      .attr('x2', innerWidth);

    const tooltip = d3.select('body').append('div')
      .attr('class', 'chart-tooltip')
      .style('position', 'absolute')
      .style('display', 'none')
      .style('background', '#1e2329')
      .style('border', '1px solid #2b2f36')
      .style('padding', '10px')
      .style('border-radius', '8px')
      .style('font-family', 'var(--font-mono)')
      .style('font-size', '11px')
      .style('color', '#eaecef')
      .style('pointer-events', 'none')
      .style('z-index', '100')
      .style('box-shadow', '0 4px 12px rgba(0,0,0,0.3)');

    const overlay = g.append('rect')
      .attr('width', innerWidth)
      .attr('height', innerHeight)
      .attr('fill', 'transparent')
      .style('cursor', 'crosshair');

    overlay.on('mousemove', (event) => {
      const [mx, my] = d3.pointer(event);
      
      // Find nearest data point
      const eachBand = x.step();
      const index = Math.floor(mx / eachBand);
      const d = data[index];

      if (d) {
        const cx = (x(d.time.toString()) || 0) + x.bandwidth() / 2;
        
        crosshair.style('display', null);
        vLine.attr('x1', cx).attr('x2', cx);
        hLine.attr('y1', my).attr('y2', my);

        const date = new Date(d.time);
        const dateStr = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
        
        let tooltipHtml = `
          <div style="color: #848e9c; margin-bottom: 4px;">${dateStr}${d.isNext ? ' <span style="color:#f0b90b">[预测]</span>' : ''}</div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
            <div>O: <span style="color: #fff">${d.open.toFixed(2)}</span></div>
            <div>H: <span style="color: #fff">${d.high.toFixed(2)}</span></div>
            <div>L: <span style="color: #fff">${d.low.toFixed(2)}</span></div>
            <div>C: <span style="color: #fff">${d.close.toFixed(2)}</span></div>
          </div>
          <div style="margin-top: 4px;">V: <span style="color: #fff">${d.volume.toFixed(2)}</span></div>
        `;

        if (d.macd) {
          tooltipHtml += `
            <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #2b2f36;">
              <div>MACD Hist: <span style="color: ${d.macd.hist >= 0 ? '#00b07b' : '#ff3b30'}">${d.macd.hist.toFixed(4)}</span></div>
              <div style="color: #2962ff">DIF: ${d.macd.dif.toFixed(4)}</div>
              <div style="color: #ff9800">DEA: ${d.macd.dea.toFixed(4)}</div>
            </div>
          `;
        }

        tooltip
          .style('display', 'block')
          .html(tooltipHtml)
          .style('left', `${event.pageX + 15}px`)
          .style('top', `${event.pageY + 15}px`);
      }
    });

    overlay.on('mouseleave', () => {
      crosshair.style('display', 'none');
      tooltip.style('display', 'none');
    });

    return () => {
      tooltip.remove();
    };

  }, [data, width, height]);

  return (
    <div className="chart-container w-full h-full bg-[#161a1e] rounded-lg overflow-hidden border border-[#2b2f36]">
      <svg ref={svgRef} width={width} height={height} />
    </div>
  );
};

export default CandlestickChart;
