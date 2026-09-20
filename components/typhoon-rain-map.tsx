/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useRef, useState } from "react";

interface Station { name: string; lat: number; lng: number; }

const STATIONS: Station[] = [
  { name: "三墩", lat: 30.324, lng: 120.079 },
  { name: "留下", lat: 30.246, lng: 120.055 },
  { name: "蒋村", lat: 30.29, lng: 120.06 },
  { name: "文新", lat: 30.29, lng: 120.1 },
  { name: "古荡", lat: 30.278, lng: 120.112 },
  { name: "灵隐", lat: 30.24, lng: 120.11 },
  { name: "西湖街道", lat: 30.251, lng: 120.129 },
  { name: "北山", lat: 30.273, lng: 120.143 },
  { name: "翠苑", lat: 30.29, lng: 120.13 },
  { name: "转塘", lat: 30.16, lng: 120.09 },
];

function rainLevel(mm: number): { color: string; label: string } {
  if (mm < 10) return { color: "#7CC87C", label: "小雨" };
  if (mm < 25) return { color: "#4A9FE0", label: "中雨" };
  if (mm < 50) return { color: "#F2C14E", label: "大雨" };
  if (mm < 100) return { color: "#E8873A", label: "暴雨" };
  return { color: "#D64541", label: "大暴雨" };
}

const LEGEND = [
  { color: "#7CC87C", label: "小雨 <10" },
  { color: "#4A9FE0", label: "中雨 10–25" },
  { color: "#F2C14E", label: "大雨 25–50" },
  { color: "#E8873A", label: "暴雨 50–100" },
  { color: "#D64541", label: "大暴雨 ≥100" },
];

function svgIcon(color: string, value: number) {
  const text = value >= 100 ? "99+" : String(Math.round(value * 10) / 10);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="46" height="46"><circle cx="23" cy="23" r="21" fill="${color}" stroke="#ffffff" stroke-width="2.5"/><text x="23" y="28" text-anchor="middle" font-size="13" font-weight="700" fill="#ffffff" font-family="Arial,sans-serif">${text}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function loadTMap(): Promise<any> {
  return new Promise((resolve, reject) => {
    const w = window as any;
    if (w.TMap) return resolve(w.TMap);
    const s = document.createElement("script");
    s.src = `https://map.qq.com/api/gljs?v=1.exp&key=${process.env.NEXT_PUBLIC_TMAP_KEY}`;
    s.onload = () => resolve(w.TMap);
    s.onerror = () => reject(new Error("腾讯地图 SDK 加载失败"));
    document.head.appendChild(s);
  });
}

export function TyphoonRainMap() {
  const key = process.env.NEXT_PUBLIC_TMAP_KEY;
  const mapRef = useRef<HTMLDivElement>(null);
  const markerRef = useRef<any>(null);
  const [rain, setRain] = useState<Record<string, number>>({});
  const [updatedAt, setUpdatedAt] = useState("");
  const [sourceError, setSourceError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function fetchRain() {
      try {
        const lats = STATIONS.map((s) => s.lat).join(",");
        const lngs = STATIONS.map((s) => s.lng).join(",");
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lngs}&current=precipitation&hourly=precipitation&timezone=Asia%2FShanghai&forecast_days=1`;
        const res = await fetch(url);
        const data = await res.json();
        if (cancelled || !Array.isArray(data)) return;
        const next: Record<string, number> = {};
        data.forEach((d: any, i: number) => {
          const hourly = d.hourly?.precipitation || [];
          next[STATIONS[i].name] = hourly.reduce((a: number, b: number) => a + b, 0);
        });
        setRain(next);
        setUpdatedAt(new Date().toLocaleString("zh-CN", { hour12: false }));
        setSourceError(false);
      } catch {
        if (!cancelled) setSourceError(true);
      }
    }
    fetchRain();
    const timer = setInterval(fetchRain, 15 * 60 * 1000);
    return () => { cancelled = true; clearInterval(timer); };
  }, []);

  useEffect(() => {
    if (!key || !mapRef.current) return;
    let disposed = false;
    let map: any;
    loadTMap().then((TMap) => {
      if (disposed) return;
      map = new TMap.Map(mapRef.current, { center: new TMap.LatLng(30.259, 120.13), zoom: 12 });
      markerRef.current = map;
    }).catch(() => {});
    return () => { disposed = true; if (map) map.destroy(); };
  }, [key]);

  useEffect(() => {
    if (!key || !markerRef.current) return;
    const map = markerRef.current;
    const w = window as any;
    if (!w.TMap) return;
    const styles: Record<string, any> = {};
    const geometries = STATIONS.map((s) => {
      const v = rain[s.name] ?? 0;
      styles[s.name] = new w.TMap.MarkerStyle({ width: 46, height: 46, anchor: { x: 23, y: 23 }, src: svgIcon(rainLevel(v).color, v) });
      return { id: s.name, styleId: s.name, position: new w.TMap.LatLng(s.lat, s.lng), properties: s };
    });
    if (markerRef.current._markers) markerRef.current._markers.setMap(null);
    const layer = new w.TMap.MultiMarker({ map, styles, geometries });
    markerRef.current._markers = layer;
  }, [key, rain]);

  return (
    <div>
      {key ? (
        <div className="typhoon-map" ref={mapRef} style={{ height: 360, width: "100%" }} />
      ) : (
        <SvgFallback rain={rain} />
      )}
      <div className="rain-legend">
        {LEGEND.map((l) => (
          <span className="rain-legend-item" key={l.color}>
            <span className="rain-dot" style={{ background: l.color }} />
            {l.label}
          </span>
        ))}
        <span className="rain-note">
          {sourceError ? "气象数据源暂不可用" : updatedAt ? `未来 24h 累计降水 · 更新于 ${updatedAt}` : "正在获取气象数据…"}
        </span>
      </div>
      {!key && <p className="rain-hint">示意底图 · 配置腾讯地图 key（NEXT_PUBLIC_TMAP_KEY）后显示真实杭州地图</p>}
    </div>
  );
}

function SvgFallback({ rain }: { rain: Record<string, number> }) {
  const longs = STATIONS.map((s) => s.lng);
  const lats = STATIONS.map((s) => s.lat);
  const minX = Math.min(...longs) - 0.02;
  const maxX = Math.max(...longs) + 0.02;
  const minY = Math.min(...lats) - 0.02;
  const maxY = Math.max(...lats) + 0.02;
  return (
    <div className="asset-map" aria-label="西湖区雨量监测点位">
      <div className="map-grid" />
      <svg className="lake-shape" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <ellipse cx="62" cy="46" rx="16" ry="10" fill="#cfe4ec" />
        <text x="62" y="47" textAnchor="middle" fontSize="6" fill="#7fa3b0">西湖</text>
      </svg>
      {STATIONS.map((s) => {
        const left = ((s.lng - minX) / (maxX - minX)) * 90 + 5;
        const top = (1 - (s.lat - minY) / (maxY - minY)) * 80 + 10;
        const v = rain[s.name] ?? 0;
        const lv = rainLevel(v);
        return (
          <span key={s.name} className="rain-station" style={{ left: `${left}%`, top: `${top}%`, background: lv.color }}>
            {Math.round(v * 10) / 10}
            <small>{s.name}</small>
          </span>
        );
      })}
    </div>
  );
}
