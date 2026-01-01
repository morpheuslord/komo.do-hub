import { useState, useEffect, useRef, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Area,
  ComposedChart,
} from 'recharts';
import { Cpu, MemoryStick, HardDrive, TrendingUp, Clock } from 'lucide-react';

interface StatsDataPoint {
  time: string;
  timestamp: number;
  cpu: number;
  memory: number;
  disk: number;
}

interface DownsampledPoint {
  time: string;
  timestamp: number;
  cpu: number;
  memory: number;
  disk: number;
  cpuMin?: number;
  cpuMax?: number;
  memoryMin?: number;
  memoryMax?: number;
}

interface ServerStatsChartProps {
  serverId: string;
  serverName: string;
  currentCpu?: number;
  currentMemPercent?: number;
  currentDiskPercent?: number;
  isVisible: boolean;
}

const STORAGE_KEY_PREFIX = 'komodo_server_stats_';
const MAX_DATA_POINTS = 28800; // 24 hours at 3s intervals
const UPDATE_INTERVAL = 3000; // 3 seconds
const BUCKET_SIZE_MS = 5 * 60 * 1000; // 5 minute buckets for 24h view

function getStorageKey(serverId: string) {
  return `${STORAGE_KEY_PREFIX}${serverId}`;
}

function loadHistory(serverId: string): StatsDataPoint[] {
  // Use session storage or internal state instead of localStorage to avoid stale data between sessions
  // but keep it for the current session to show the 24h view accurately
  try {
    const stored = sessionStorage.getItem(getStorageKey(serverId));
    if (stored) {
      const data = JSON.parse(stored) as StatsDataPoint[];
      const cutoff = Date.now() - 24 * 60 * 60 * 1000;
      return data.filter((d) => d.timestamp > cutoff);
    }
  } catch {
    // ignore
  }
  return [];
}

function saveHistory(serverId: string, data: StatsDataPoint[]) {
  try {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    const filtered = data.filter((d) => d.timestamp > cutoff).slice(-MAX_DATA_POINTS);
    sessionStorage.setItem(getStorageKey(serverId), JSON.stringify(filtered));
  } catch {
    // ignore storage errors
  }
}

function formatTimeShort(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatTimeWithDate(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  
  if (isToday) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleString([], { 
    month: 'short', 
    day: 'numeric', 
    hour: '2-digit', 
    minute: '2-digit' 
  });
}

// Downsample data into 5-minute buckets for 24h view
function downsampleData(data: StatsDataPoint[]): DownsampledPoint[] {
  if (data.length === 0) return [];
  
  const buckets = new Map<number, StatsDataPoint[]>();
  
  data.forEach((point) => {
    const bucketKey = Math.floor(point.timestamp / BUCKET_SIZE_MS) * BUCKET_SIZE_MS;
    if (!buckets.has(bucketKey)) {
      buckets.set(bucketKey, []);
    }
    buckets.get(bucketKey)!.push(point);
  });
  
  const result: DownsampledPoint[] = [];
  const sortedKeys = Array.from(buckets.keys()).sort((a, b) => a - b);
  
  sortedKeys.forEach((bucketKey) => {
    const points = buckets.get(bucketKey)!;
    const avgCpu = points.reduce((sum, p) => sum + p.cpu, 0) / points.length;
    const avgMem = points.reduce((sum, p) => sum + p.memory, 0) / points.length;
    const avgDisk = points.reduce((sum, p) => sum + p.disk, 0) / points.length;
    
    result.push({
      time: formatTimeWithDate(bucketKey),
      timestamp: bucketKey,
      cpu: Number(avgCpu.toFixed(1)),
      memory: Number(avgMem.toFixed(1)),
      disk: Number(avgDisk.toFixed(1)),
      cpuMin: Math.min(...points.map(p => p.cpu)),
      cpuMax: Math.max(...points.map(p => p.cpu)),
      memoryMin: Math.min(...points.map(p => p.memory)),
      memoryMax: Math.max(...points.map(p => p.memory)),
    });
  });
  
  return result;
}

export function ServerStatsChart({
  serverId,
  serverName,
  currentCpu = 0,
  currentMemPercent = 0,
  currentDiskPercent = 0,
  isVisible,
}: ServerStatsChartProps) {
  const [history, setHistory] = useState<StatsDataPoint[]>(() => loadHistory(serverId));
  const [viewMode, setViewMode] = useState<'live' | '24h'>('live');
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Add new data point when stats update
  useEffect(() => {
    if (!isVisible) return;

    const addDataPoint = () => {
      const now = Date.now();
      const newPoint: StatsDataPoint = {
        time: formatTimeShort(now),
        timestamp: now,
        cpu: Number(currentCpu.toFixed(1)),
        memory: Number(currentMemPercent.toFixed(1)),
        disk: Number(currentDiskPercent.toFixed(1)),
      };

      setHistory((prev) => {
        const updated = [...prev, newPoint];
        saveHistory(serverId, updated);
        return updated;
      });
    };

    // Add initial point
    addDataPoint();

    // Update every 3 seconds
    intervalRef.current = setInterval(addDataPoint, UPDATE_INTERVAL);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isVisible, serverId, currentCpu, currentMemPercent, currentDiskPercent]);

  // Compute display data based on view mode
  const displayData = useMemo(() => {
    if (viewMode === 'live') {
      // Last 100 points for live view (~5 min at 3s intervals)
      return history.slice(-100);
    } else {
      // Full 24h downsampled
      return downsampleData(history);
    }
  }, [history, viewMode]);

  // Calculate stats
  const stats = useMemo(() => {
    if (history.length === 0) return { avgCpu: 0, avgMem: 0, avgDisk: 0, maxCpu: 0, maxMem: 0 };
    
    const avgCpu = history.reduce((a, b) => a + b.cpu, 0) / history.length;
    const avgMem = history.reduce((a, b) => a + b.memory, 0) / history.length;
    const avgDisk = history.reduce((a, b) => a + b.disk, 0) / history.length;
    const maxCpu = Math.max(...history.map(h => h.cpu));
    const maxMem = Math.max(...history.map(h => h.memory));
    
    return { avgCpu, avgMem, avgDisk, maxCpu, maxMem };
  }, [history]);

  // Time range display
  const timeRange = useMemo(() => {
    if (history.length < 2) return 'Collecting...';
    const oldest = new Date(history[0].timestamp);
    const newest = new Date(history[history.length - 1].timestamp);
    const diffMs = newest.getTime() - oldest.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    
    if (diffHours >= 1) {
      return `${diffHours}h ${diffMins % 60}m of data`;
    }
    return `${diffMins}m of data`;
  }, [history]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-popover border-2 border-foreground p-3 font-mono text-xs shadow-lg rounded-none">
          <p className="font-bold mb-2 text-foreground border-b border-foreground pb-1">{label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center justify-between gap-4 py-0.5">
              <span style={{ color: entry.color }} className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                {entry.name}
              </span>
              <span className="font-bold" style={{ color: entry.color }}>
                {entry.value.toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="border-2 border-foreground mt-4">
      <CardContent className="p-4">
        {/* Header with controls */}
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            <h4 className="font-mono text-sm font-bold">Server Metrics</h4>
          </div>
          
          <div className="flex items-center gap-2">
            {/* View mode toggle */}
            <div className="flex border-2 border-foreground">
              <Button
                variant={viewMode === 'live' ? 'default' : 'ghost'}
                size="sm"
                className="rounded-none font-mono text-xs h-7 px-2"
                onClick={() => setViewMode('live')}
              >
                Live
              </Button>
              <Button
                variant={viewMode === '24h' ? 'default' : 'ghost'}
                size="sm"
                className="rounded-none font-mono text-xs h-7 px-2 border-l-2 border-foreground"
                onClick={() => setViewMode('24h')}
              >
                24h
              </Button>
            </div>
          </div>
        </div>

        {/* Stats summary */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="p-2 border border-foreground bg-secondary/50">
            <div className="flex items-center gap-1 text-muted-foreground mb-1">
              <Cpu className="w-3 h-3" />
              <span className="font-mono text-[10px] uppercase">CPU</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="font-mono text-lg font-bold text-chart-1">{currentCpu.toFixed(0)}%</span>
              <span className="font-mono text-[10px] text-muted-foreground">avg {stats.avgCpu.toFixed(0)}%</span>
            </div>
          </div>
          <div className="p-2 border border-foreground bg-secondary/50">
            <div className="flex items-center gap-1 text-muted-foreground mb-1">
              <MemoryStick className="w-3 h-3" />
              <span className="font-mono text-[10px] uppercase">Memory</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="font-mono text-lg font-bold text-chart-2">{currentMemPercent.toFixed(0)}%</span>
              <span className="font-mono text-[10px] text-muted-foreground">avg {stats.avgMem.toFixed(0)}%</span>
            </div>
          </div>
          <div className="p-2 border border-foreground bg-secondary/50">
            <div className="flex items-center gap-1 text-muted-foreground mb-1">
              <HardDrive className="w-3 h-3" />
              <span className="font-mono text-[10px] uppercase">Disk</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="font-mono text-lg font-bold text-chart-4">{currentDiskPercent.toFixed(0)}%</span>
              <span className="font-mono text-[10px] text-muted-foreground">avg {stats.avgDisk.toFixed(0)}%</span>
            </div>
          </div>
        </div>

        {/* Chart */}
        {displayData.length < 2 ? (
          <div className="h-52 flex items-center justify-center border-2 border-dashed border-muted-foreground bg-secondary/20">
            <div className="text-center">
              <Clock className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
              <p className="font-mono text-sm text-muted-foreground">
                Collecting data...
              </p>
              <p className="font-mono text-xs text-muted-foreground mt-1">
                {displayData.length} point{displayData.length !== 1 ? 's' : ''} recorded
              </p>
            </div>
          </div>
        ) : (
          <div className="h-52 -mx-2">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={displayData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <defs>
                  <linearGradient id={`cpuGradient-${serverId}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id={`memGradient-${serverId}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="2 2"
                  className="stroke-muted/50"
                  vertical={false}
                />
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 9 }}
                  className="font-mono fill-muted-foreground"
                  tickLine={false}
                  axisLine={{ className: 'stroke-muted' }}
                  interval="preserveStartEnd"
                  minTickGap={50}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 9 }}
                  className="font-mono fill-muted-foreground"
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `${value}%`}
                  ticks={[0, 25, 50, 75, 100]}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ 
                    fontSize: '10px', 
                    fontFamily: 'monospace',
                    paddingTop: '8px'
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="cpu"
                  name="CPU"
                  stroke="hsl(var(--chart-1))"
                  fill={`url(#cpuGradient-${serverId})`}
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="memory"
                  name="Memory"
                  stroke="hsl(var(--chart-2))"
                  fill={`url(#memGradient-${serverId})`}
                  strokeWidth={2}
                />
                <Line
                  type="monotone"
                  dataKey="disk"
                  name="Disk"
                  stroke="hsl(var(--chart-4))"
                  strokeWidth={2}
                  dot={false}
                  strokeDasharray="4 2"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Footer */}
        <div className="mt-3 pt-3 border-t border-foreground/20 flex justify-between items-center text-xs text-muted-foreground font-mono">
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>{timeRange}</span>
          </div>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-chart-2 animate-pulse" />
            Live • 3s interval
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
