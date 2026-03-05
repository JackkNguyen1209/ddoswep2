'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  BarChart3, Brain, Zap, LineChart,
  Activity, Cpu, MemoryStick, HardDrive, Network, Clock, Server, Bot,
  ChevronDown, ChevronRight, AlertTriangle,
} from 'lucide-react'
import { vi } from '@/lib/vi'
import { api, type SystemMetrics, type SlowRequest, type EndpointStat } from '@/lib/api'

const features = [
  { icon: BarChart3, title: vi.datasetManagement,  description: vi.datasetDesc },
  { icon: Zap,       title: vi.smartPreprocessing, description: vi.preprocessingDesc },
  { icon: Brain,     title: vi.mlAlgorithms,       description: vi.algorithmsDesc },
  { icon: LineChart, title: vi.modelEvaluation,    description: vi.evaluationDesc },
]

// ── tiny helpers ──────────────────────────────────────────────────────────────

function Bar({ value, max = 100, warn = 60, danger = 85 }: {
  value: number; max?: number; warn?: number; danger?: number
}) {
  const pct = Math.min(100, (value / max) * 100)
  const cls = value >= danger ? 'bg-destructive' : value >= warn ? 'bg-yellow-500' : 'bg-primary'
  return (
    <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
      <div className={`h-full rounded-full transition-all duration-500 ${cls}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

function Row({ label, value, hi = false }: { label: string; value: string | number; hi?: boolean }) {
  return (
    <div className="flex justify-between items-center text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-semibold tabular-nums ${hi ? 'text-destructive' : ''}`}>{value}</span>
    </div>
  )
}

function SectionLabel({ icon: Icon, label, badge }: {
  icon: React.ElementType; label: string; badge?: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1.5 mt-3 first:mt-0">
      <Icon className="w-3 h-3 shrink-0" />{label}{badge}
    </div>
  )
}

function n(v: number | null | undefined, dec = 1, suffix = ''): string {
  if (v == null) return '—'
  return v.toFixed(dec) + suffix
}

function tsToTime(ts: number) {
  return new Date(ts * 1000).toLocaleTimeString('vi-VN', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

function isoToLocal(iso: string | null | undefined) {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleString('vi-VN') } catch { return iso }
}

// ── Sparkline (SVG) ───────────────────────────────────────────────────────────

function Sparkline({ data, w = 80, h = 20 }: { data: number[]; w?: number; h?: number }) {
  if (data.length < 2) return <span className="text-muted-foreground text-[10px]">…</span>
  const min = Math.min(...data), max = Math.max(...data), range = max - min || 1
  const pts = data.map((v, i) =>
    `${((i / (data.length - 1)) * w).toFixed(1)},${(h - ((v - min) / range) * (h - 3) - 1).toFixed(1)}`
  ).join(' ')
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="inline-block">
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="1.5"
        className="text-primary" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

// ── Collapsible ───────────────────────────────────────────────────────────────

function Expand({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="mt-1.5">
      <button onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground w-full text-left">
        {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}{label}
      </button>
      {open && <div className="mt-1">{children}</div>}
    </div>
  )
}

// ── Dashboard (3 cards) ───────────────────────────────────────────────────────

const HIST = 60

function RealtimeDashboard() {
  const [m, setM]            = useState<SystemMetrics | null>(null)
  const [connected, setCon]  = useState(false)
  const [failCount, setFail] = useState(0)
  const rpsHist  = useRef<number[]>([])
  const latHist  = useRef<number[]>([])
  const timer    = useRef<ReturnType<typeof setTimeout> | null>(null)

  const poll = useCallback(async () => {
    const ac  = new AbortController()
    const tid = setTimeout(() => ac.abort(), 1500)
    try {
      const data = await api.getMetrics(ac.signal)
      clearTimeout(tid)
      setM(data); setCon(true); setFail(0)
      rpsHist.current = [...rpsHist.current, data.http?.rps?.['1m'] ?? data.rps_1m].slice(-HIST)
      latHist.current = [...latHist.current, data.http?.latency_ms?.p95 ?? data.latency_ms.p95].slice(-HIST)
    } catch {
      clearTimeout(tid)
      setFail(c => {
        const next = c + 1
        if (next >= 3) setCon(false)
        return next
      })
    } finally {
      timer.current = setTimeout(poll, 2000)
    }
  }, []) // eslint-disable-line

  useEffect(() => {
    poll()
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [poll])

  // Alerts
  const alert5xx  = (m?.http?.status?.['5xx'] ?? 0) > 0
  const alertSlow = (m?.http?.latency_ms?.p95 ?? 0) > 500
  const alertMem  = (m?.system?.memory?.percent ?? 0) > 85

  const LiveDot = () => (
    <span className={`w-2 h-2 rounded-full inline-block shrink-0 ${
      connected ? 'bg-green-500 animate-pulse' : 'bg-destructive'
    }`} />
  )

  const CardHead = ({ title, icon: Icon, extra }: {
    title: string; icon: React.ElementType; extra?: React.ReactNode
  }) => (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-primary" /><span className="font-semibold text-sm">{title}</span>
      </div>
      <div className="flex items-center gap-1">{extra}</div>
    </div>
  )

  if (!m) return (
    <Card className="bg-card border-border p-5 col-span-3">
      <div className="flex items-center gap-2 mb-2">
        <Activity className="w-4 h-4 text-primary" />
        <span className="font-semibold text-sm">Hiệu năng Realtime</span>
        <LiveDot />
        <span className="text-xs text-muted-foreground">{connected ? 'Live' : failCount >= 3 ? 'Offline' : 'Đang kết nối…'}</span>
      </div>
      <p className="text-xs text-muted-foreground py-6 text-center">
        {failCount >= 3 ? 'API không phản hồi sau 3 lần thử.' : 'Đang kết nối tới API…'}
      </p>
    </Card>
  )

  const sys  = m.system
  const http = m.http
  const ml   = m.ml
  const winLabel = `${Math.round((http.window_sec ?? 900) / 60)}m`

  // ── Card 1: System ────────────────────────────────────────────────────────
  const card1 = (
    <Card className="bg-card border-border p-5">
      <CardHead title="System" icon={Server} extra={
        <>
          <LiveDot />
          <span className="text-xs text-muted-foreground">{connected ? 'Live' : failCount >= 3 ? 'Offline' : '…'}</span>
          {alertMem && <Badge variant="destructive" className="text-[10px] px-1.5 py-0 ml-1">RAM!</Badge>}
        </>
      } />

      <SectionLabel icon={Cpu} label="CPU" />
      <div className="flex justify-between text-xs mb-1">
        <span className="text-muted-foreground">Total</span>
        <span className="font-bold tabular-nums">{n(sys.cpu.percent)}%</span>
      </div>
      <Bar value={sys.cpu.percent} warn={50} danger={80} />
      {sys.cpu.per_core.length > 0 && (
        <div className="flex gap-0.5 mt-1.5">
          {sys.cpu.per_core.slice(0, 8).map((v, i) => (
            <div key={i} className="flex-1">
              <div className="h-5 bg-muted rounded-sm overflow-hidden relative">
                <div className="absolute bottom-0 w-full bg-primary/50 transition-all duration-500"
                  style={{ height: `${Math.min(100, v)}%` }} />
              </div>
              <p className="text-[9px] text-muted-foreground text-center">{i}</p>
            </div>
          ))}
        </div>
      )}
      {sys.cpu.load1 !== null && (
        <div className="grid grid-cols-3 gap-1 mt-1.5">
          <Row label="L 1m"  value={n(sys.cpu.load1,  2)} />
          <Row label="L 5m"  value={n(sys.cpu.load5,  2)} />
          <Row label="L 15m" value={n(sys.cpu.load15, 2)} />
        </div>
      )}

      <SectionLabel icon={MemoryStick} label="Memory" />
      <div className="flex justify-between text-xs mb-1">
        <span className="text-muted-foreground">{n(sys.memory.used_mb, 0)} / {n(sys.memory.used_mb + sys.memory.available_mb, 0)} MB</span>
        <span className={`font-bold tabular-nums ${alertMem ? 'text-destructive' : ''}`}>{n(sys.memory.percent)}%</span>
      </div>
      <Bar value={sys.memory.percent} warn={70} danger={85} />
      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 mt-1.5">
        {sys.memory.cached_mb    !== null && <Row label="Cached"   value={`${n(sys.memory.cached_mb, 0)} MB`} />}
        {sys.memory.swap_used_mb !== null && <Row label="Swap"     value={`${n(sys.memory.swap_used_mb, 0)} MB`} />}
        {sys.memory.swap_in_mb_s  !== null && <Row label="Swap in/s"  value={`${n(sys.memory.swap_in_mb_s,  3)} MB`} />}
        {sys.memory.swap_out_mb_s !== null && <Row label="Swap out/s" value={`${n(sys.memory.swap_out_mb_s, 3)} MB`} />}
      </div>

      <SectionLabel icon={HardDrive} label="Disk / Net" />
      <div className="space-y-0.5">
        {sys.disk.disk_percent     !== null && <Row label="Disk%" value={n(sys.disk.disk_percent) + '%'} hi={(sys.disk.disk_percent ?? 0) > 90} />}
        {sys.disk.inode_percent    !== null && <Row label="Inode%" value={n(sys.disk.inode_percent) + '%'} />}
        {sys.disk.data_dir_free_gb !== null && <Row label="Free" value={`${n(sys.disk.data_dir_free_gb, 1)} GB`} />}
        {sys.disk.read_mb_s        !== null && <Row label="Disk R/W MB/s" value={`${n(sys.disk.read_mb_s, 2)} / ${n(sys.disk.write_mb_s, 2)}`} />}
        {sys.net.rx_mb_s           !== null && <Row label="Net rx/tx MB/s" value={`${n(sys.net.rx_mb_s, 3)} / ${n(sys.net.tx_mb_s, 3)}`} />}
      </div>

      <SectionLabel icon={Activity} label="Process" />
      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
        <Row label="RSS"  value={`${n(sys.process.rss_mb, 0)} MB`} />
        {sys.process.cpu_percent !== null && <Row label="CPU%" value={n(sys.process.cpu_percent)} />}
        {sys.process.threads     !== null && <Row label="Threads" value={sys.process.threads} />}
        {sys.process.open_fds    !== null && <Row label="FDs"  value={sys.process.open_fds} />}
      </div>

      <p className="text-xs text-muted-foreground mt-3 text-right">
        Uptime {Math.floor(m.uptime_sec / 3600)}h {Math.floor((m.uptime_sec % 3600) / 60)}m
      </p>
    </Card>
  )

  // ── Card 2: API HTTP ──────────────────────────────────────────────────────
  const errTotal = (http.errors?.by_type?.validation_422 ?? 0)
    + (http.errors?.by_type?.not_found_404 ?? 0)
    + (http.errors?.by_type?.server_5xx   ?? 0)
    + (http.errors?.by_type?.other_4xx    ?? 0)
  const errRate5xx = http.requests_total > 0
    ? ((http.status['5xx'] / http.requests_total) * 100).toFixed(2)
    : '0.00'
  const errRate4xx = http.requests_total > 0
    ? ((http.status['4xx'] / http.requests_total) * 100).toFixed(2)
    : '0.00'

  const card2 = (
    <Card className="bg-card border-border p-5 overflow-hidden">
      <CardHead title="API HTTP" icon={Network} extra={
        <>
          {alert5xx  && <Badge variant="destructive" className="text-[10px] px-1.5 py-0">5xx!</Badge>}
          {alertSlow && <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Slow</Badge>}
          <span className="text-[10px] text-muted-foreground ml-1">Window: {winLabel}</span>
        </>
      } />

      {/* Throughput */}
      <SectionLabel icon={Activity} label="Throughput" />
      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
        <Row label="Total reqs" value={http.requests_total.toLocaleString()} />
        <Row label="In-flight"  value={http.in_flight} />
      </div>
      <div className="grid grid-cols-3 gap-1 mt-1">
        <Row label="RPS 1m"  value={n(http.rps['1m'],  2)} />
        <Row label="RPS 5m"  value={n(http.rps['5m'],  2)} />
        <Row label="RPS 15m" value={n(http.rps['15m'], 2)} />
      </div>
      <div className="flex items-center gap-2 mt-1">
        <span className="text-[10px] text-muted-foreground">RPS trend</span>
        <Sparkline data={rpsHist.current} w={80} h={18} />
      </div>

      {/* Status codes */}
      <SectionLabel icon={Clock} label="Status codes" />
      <div className="grid grid-cols-3 gap-1">
        {[
          { l: '2xx', v: http.status['2xx'], c: 'text-green-500' },
          { l: '4xx', v: http.status['4xx'], c: http.status['4xx'] > 0 ? 'text-yellow-500' : '' },
          { l: '5xx', v: http.status['5xx'], c: http.status['5xx'] > 0 ? 'text-destructive' : '' },
        ].map(({ l, v, c }) => (
          <div key={l} className="text-center">
            <p className="text-xs text-muted-foreground">{l}</p>
            <p className={`text-sm font-bold tabular-nums ${c}`}>{v}</p>
          </div>
        ))}
      </div>

      {/* Latency */}
      <SectionLabel icon={Clock} label={`Latency (ms) — ${winLabel} window`} />
      <div className="grid grid-cols-4 gap-1">
        <Row label="p50" value={http.latency_ms.p50} />
        <Row label="p95" value={http.latency_ms.p95} hi={alertSlow} />
        <Row label="p99" value={http.latency_ms.p99} />
        <Row label="avg" value={http.latency_ms.avg} />
      </div>
      <div className="flex items-center gap-2 mt-1">
        <span className="text-[10px] text-muted-foreground">p95 trend</span>
        <Sparkline data={latHist.current} w={80} h={18} />
      </div>

      {/* Errors section */}
      {errTotal > 0 && (
        <>
          <SectionLabel icon={AlertTriangle} label="Errors" badge={
            <Badge variant="destructive" className="text-[10px] px-1.5 py-0 ml-1">{errTotal}</Badge>
          } />
          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
            <Row label="5xx rate" value={`${errRate5xx}%`} hi={http.status['5xx'] > 0} />
            <Row label="4xx rate" value={`${errRate4xx}%`} />
            {(http.errors?.by_type?.validation_422 ?? 0) > 0 &&
              <Row label="422 valid." value={http.errors.by_type.validation_422} hi />}
            {(http.errors?.by_type?.not_found_404 ?? 0) > 0 &&
              <Row label="404 not found" value={http.errors.by_type.not_found_404} />}
            {(http.errors?.by_type?.server_5xx ?? 0) > 0 &&
              <Row label="5xx server" value={http.errors.by_type.server_5xx} hi />}
            {(http.errors?.by_type?.other_4xx ?? 0) > 0 &&
              <Row label="Other 4xx" value={http.errors.by_type.other_4xx} />}
          </div>
          {(http.errors?.by_endpoint?.length ?? 0) > 0 && (
            <Expand label="Top error endpoints">
              <div className="space-y-0.5">
                {http.errors.by_endpoint.map((ep, i) => (
                  <div key={i} className="flex items-center gap-1 text-xs">
                    <span className="text-[10px] bg-muted rounded px-1">{ep.method}</span>
                    <span className="text-muted-foreground truncate max-w-[140px]" title={ep.path}>{ep.path}</span>
                    <span className="ml-auto font-semibold text-destructive">{ep.count}</span>
                  </div>
                ))}
              </div>
            </Expand>
          )}
          {(http.errors?.top_exceptions?.length ?? 0) > 0 && (
            <Expand label="Top exceptions">
              <div className="space-y-0.5">
                {http.errors.top_exceptions.map((ex, i) => (
                  <div key={i} className="flex justify-between text-xs">
                    <span className="text-muted-foreground font-mono">{ex.name}</span>
                    <span className="font-semibold">{ex.count}</span>
                  </div>
                ))}
              </div>
            </Expand>
          )}
        </>
      )}

      {/* Top endpoints */}
      {http.endpoints.length > 0 && (
        <>
          <SectionLabel icon={Server} label={`Top endpoints (p95, ${winLabel} window)`} />
          <div className="space-y-1">
            {http.endpoints.slice(0, 5).map((ep: EndpointStat, i) => (
              <div key={i} className="text-xs">
                <div className="flex items-center gap-1">
                  <span className="text-[10px] bg-muted rounded px-1 shrink-0">{ep.method}</span>
                  <span className="text-muted-foreground truncate max-w-[110px]" title={ep.path}>{ep.path}</span>
                  <span className="ml-auto tabular-nums text-muted-foreground">{ep.count}</span>
                  {ep.err_rate > 0 && <span className="text-destructive">{(ep.err_rate * 100).toFixed(0)}%</span>}
                  <span className="font-semibold tabular-nums">{ep.p95}ms</span>
                  <span className="text-muted-foreground tabular-nums">↑{ep.max}</span>
                  {ep.trend_p95_1m !== null && ep.trend_p95_1m !== 0 && (
                    <span className={`text-[10px] ${ep.trend_p95_1m > 0 ? 'text-yellow-500' : 'text-green-500'}`}>
                      {ep.trend_p95_1m > 0 ? '↑' : '↓'}{Math.abs(ep.trend_p95_1m)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Slow requests */}
      {(http.slow_requests?.length ?? 0) > 0 && (
        <>
          <SectionLabel icon={AlertTriangle} label={`Slow (>${SLOW_LABEL}ms) — ${http.slow_requests.length} entries`} />
          {/* always show last 5 */}
          <div className="space-y-0.5">
            {http.slow_requests.slice(-5).reverse().map((sr: SlowRequest, i) => (
              <div key={i} className={`flex items-center gap-1 text-xs ${sr.status >= 500 ? 'text-destructive' : sr.status >= 400 ? 'text-yellow-500' : ''}`}>
                <span className="tabular-nums text-muted-foreground">{tsToTime(sr.ts)}</span>
                <span className="truncate max-w-[110px]" title={sr.route_path}>
                  <span className="opacity-60">{sr.method} </span>{sr.route_path}
                </span>
                <span className="ml-auto tabular-nums">{sr.status}</span>
                <span className="font-semibold tabular-nums">{sr.latency_ms}ms</span>
              </div>
            ))}
          </div>
          {http.slow_requests.length > 5 && (
            <Expand label={`Show all ${http.slow_requests.length} slow requests`}>
              <div className="overflow-x-auto max-h-48 overflow-y-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="text-muted-foreground sticky top-0 bg-card">
                      <th className="text-left pb-1 pr-2 font-normal">Time</th>
                      <th className="text-left pb-1 pr-2 font-normal">Method/Path</th>
                      <th className="text-right pb-1 pr-1 font-normal">St</th>
                      <th className="text-right pb-1 pr-1 font-normal">ms</th>
                      <th className="text-right pb-1 font-normal">Err</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...http.slow_requests].reverse().map((sr: SlowRequest, i) => (
                      <tr key={i} className={`border-t border-border ${sr.status >= 500 ? 'text-destructive' : sr.status >= 400 ? 'text-yellow-500' : ''}`}>
                        <td className="py-0.5 pr-2 tabular-nums whitespace-nowrap">{tsToTime(sr.ts)}</td>
                        <td className="py-0.5 pr-2 truncate max-w-[120px]" title={sr.route_path}>
                          <span className="opacity-60">{sr.method} </span>{sr.route_path}
                        </td>
                        <td className="py-0.5 pr-1 text-right tabular-nums">{sr.status}</td>
                        <td className="py-0.5 pr-1 text-right tabular-nums font-semibold">{sr.latency_ms}</td>
                        <td className="py-0.5 text-right tabular-nums text-muted-foreground">
                          {sr.error_summary ?? '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Expand>
          )}
        </>
      )}
    </Card>
  )

  // ── Card 3: ML Engine ─────────────────────────────────────────────────────
  const card3 = (
    <Card className="bg-card border-border p-5">
      <CardHead title="ML Engine" icon={Bot} extra={
        (ml.train.in_flight ?? 0) > 0
          ? <Badge className="text-[10px] px-1.5 py-0 bg-yellow-500 text-black animate-pulse">Training…</Badge>
          : null
      } />

      {/* Predict */}
      <SectionLabel icon={Activity} label="Predict" badge={
        (ml.predict.validation_fail ?? 0) > 0
          ? <Badge variant="destructive" className="text-[10px] px-1.5 py-0 ml-1">{ml.predict.validation_fail} fail</Badge>
          : null
      } />
      <div className="grid grid-cols-3 gap-x-2 gap-y-0.5">
        <Row label="Calls"    value={ml.predict.count} />
        <Row label="errors"   value={ml.predict.error_count} hi={ml.predict.error_count > 0} />
        <Row label="last ms"  value={n(ml.predict.last_ms, 1)} />
        <Row label="avg ms"   value={n(ml.predict.avg_ms, 1)} />
        <Row label="p95 ms"   value={n(ml.predict.p95_ms, 1)} />
        <Row label="max ms"   value={n(ml.predict.max_ms, 1)} />
      </div>

      {/* Explain local */}
      <SectionLabel icon={Activity} label="Explain/local" badge={
        (ml.explain_local.validation_fail ?? 0) > 0
          ? <Badge variant="destructive" className="text-[10px] px-1.5 py-0 ml-1">{ml.explain_local.validation_fail} fail</Badge>
          : null
      } />
      <div className="grid grid-cols-3 gap-x-2 gap-y-0.5">
        <Row label="Calls"   value={ml.explain_local.count} />
        <Row label="errors"  value={ml.explain_local.error_count} hi={ml.explain_local.error_count > 0} />
        <Row label="last ms" value={n(ml.explain_local.last_ms, 1)} />
        <Row label="avg ms"  value={n(ml.explain_local.avg_ms, 1)} />
        <Row label="p95 ms"  value={n(ml.explain_local.p95_ms, 1)} />
        <Row label="max ms"  value={n(ml.explain_local.max_ms, 1)} />
      </div>

      {/* Explain global */}
      <SectionLabel icon={Brain} label="Explain/global" />
      <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
        <Row label="Calls"      value={ml.explain_global.count} />
        <Row label="In-flight"  value={ml.explain_global.in_flight ?? 0} />
        <Row label="Cache hit"  value={ml.explain_global.cache_hit ?? 0} />
        <Row label="Cache miss" value={ml.explain_global.cache_miss ?? 0} />
        <Row label="errors"     value={ml.explain_global.error_count} hi={ml.explain_global.error_count > 0} />
        <Row label="avg ms"     value={n(ml.explain_global.avg_ms, 1)} />
        <Row label="last ms"    value={n(ml.explain_global.last_ms, 1)} />
      </div>

      {/* Train */}
      <SectionLabel icon={Brain} label="Train" />
      <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
        <Row label="Runs"      value={ml.train.count} />
        <Row label="In-flight" value={ml.train.in_flight ?? 0} hi={(ml.train.in_flight ?? 0) > 0} />
        <Row label="errors"    value={ml.train.error_count} hi={ml.train.error_count > 0} />
        <Row label="last ms"   value={n(ml.train.last_ms, 0)} />
        <Row label="avg ms"    value={n(ml.train.avg_ms, 0)} />
        <Row label="p95 ms"    value={n(ml.train.p95_ms, 0)} />
      </div>

      {/* Last model */}
      <SectionLabel icon={Bot} label="Last model" />
      {ml.last_model.model_id ? (
        <div className="space-y-0.5">
          <Row label="ID"          value={ml.last_model.model_id.slice(-10)} />
          <Row label="Algorithm"   value={ml.last_model.algorithm ?? '—'} />
          <Row label="Features"    value={ml.last_model.final_feature_count ?? '—'} />
          <Row label="Trained at"  value={isoToLocal(ml.last_model.last_trained_at)} />
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Chưa có model nào được train.</p>
      )}

      <div className="mt-4 pt-3 border-t border-border">
        <Link href="/training">
          <Button variant="outline" size="sm" className="w-full text-xs">
            Huấn luyện model mới
          </Button>
        </Link>
      </div>
    </Card>
  )

  return <>{card1}{card2}{card3}</>
}

const SLOW_LABEL = 500

// ── Home Page ─────────────────────────────────────────────────────────────────

export default function Home() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <nav className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <Brain className="w-8 h-8 text-primary" />
            <span className="text-xl font-bold">Phòng thí nghiệm Phát hiện DDoS</span>
          </div>
          <Link href="/upload">
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">{vi.getStarted}</Button>
          </Link>
        </div>
      </nav>

      {/* Hero + dashboard */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <h1 className="text-5xl md:text-6xl font-bold leading-tight mb-4">
            {vi.homeTitle} <span className="text-primary">ML Nâng cao</span>
          </h1>
          <p className="text-lg text-muted-foreground mb-6 max-w-2xl">{vi.homeDescription}</p>
          <div className="flex gap-4 flex-col sm:flex-row">
            <Link href="/upload">
              <Button size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground w-full sm:w-auto">
                {vi.startBuilding}
              </Button>
            </Link>
            <Link href="/experiments">
              <Button size="lg" variant="outline" className="w-full sm:w-auto">{vi.viewExperiments}</Button>
            </Link>
          </div>
        </div>
        <div className="grid md:grid-cols-3 gap-4 items-start">
          <RealtimeDashboard />
        </div>
      </section>

      {/* Features */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 border-t border-border">
        <div className="mb-12">
          <h2 className="text-4xl font-bold mb-4">Các Tính năng Mạnh mẽ</h2>
          <p className="text-muted-foreground text-lg max-w-2xl">Mọi thứ bạn cần để thành thạo học máy cho an toàn mạng</p>
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          {features.map((f, i) => {
            const Icon = f.icon
            return (
              <Card key={i} className="bg-card/50 border-border p-6 hover:bg-card/80 transition-colors">
                <Icon className="w-12 h-12 text-primary mb-4" />
                <h3 className="text-xl font-bold mb-2">{f.title}</h3>
                <p className="text-muted-foreground">{f.description}</p>
              </Card>
            )
          })}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <Card className="bg-gradient-to-r from-primary/10 to-accent/10 border-primary/20 p-12 text-center">
          <h2 className="text-3xl font-bold mb-4">{vi.readyExplore}</h2>
          <p className="text-muted-foreground mb-8 max-w-2xl mx-auto">{vi.uploadDatasetDesc}</p>
          <Link href="/upload">
            <Button size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground">{vi.uploadDataset}</Button>
          </Link>
        </Card>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-card/30 mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center text-muted-foreground">
          <p>Phòng thí nghiệm Phát hiện DDoS ML &copy; 2025. Xây dựng cho mục đích giáo dục.</p>
        </div>
      </footer>
    </main>
  )
}
