import { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { Cpu, MemoryStick, HardDrive } from 'lucide-react';

interface StatsDataPoint {
  time: string;
  timestamp: number;
  cpu: number;
  memory: number;
  disk: number;
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

function getStorageKey(serverId: string) {
  return `${STORAGE_KEY_PREFIX}${serverId}`;
}

function loadHistory(serverId: string): StatsDataPoint[] {
  try {
    const stored = localStorage.getItem(getStorageKey(serverId));
    if (stored) {
      const data = JSON.parse(stored) as StatsDataPoint[];
      // Filter to last 24 hours
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
    // Keep only last 24 hours
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    const filtered = data.filter((d) => d.timestamp > cutoff).slice(-MAX_DATA_POINTS);
    localStorage.setItem(getStorageKey(serverId), JSON.stringify(filtered));
  } catch {
    // ignore storage errors
  }
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Add new data point when stats update
  useEffect(() => {
    if (!isVisible) return;

    const addDataPoint = () => {
      const now = Date.now();
      const newPoint: StatsDataPoint = {
        time: formatTime(now),
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

  // Get display data (last 100 points for chart readability)
  const displayData = history.slice(-100);

  // Calculate averages for the summary
  const avgCpu = history.length > 0 ? history.reduce((a, b) => a + b.cpu, 0) / history.length : 0;
  const avgMem = history.length > 0 ? history.reduce((a, b) => a + b.memory, 0) / history.length : 0;
  const avgDisk = history.length > 0 ? history.reduce((a, b) => a + b.disk, 0) / history.length : 0;

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-popover border-2 border-foreground p-2 font-mono text-xs shadow-md">
          <p className="font-bold mb-1">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }}>
              {entry.name}: {entry.value.toFixed(1)}%
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="border-2 border-foreground mt-4">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-mono text-sm font-bold">24h Stats History</h4>
          <div className="flex gap-2">
            <Badge variant="outline" className="font-mono text-xs">
              <Cpu className="w-3 h-3 mr-1" />
              Avg: {avgCpu.toFixed(1)}%
            </Badge>
            <Badge variant="outline" className="font-mono text-xs">
              <MemoryStick className="w-3 h-3 mr-1" />
              Avg: {avgMem.toFixed(1)}%
            </Badge>
            <Badge variant="outline" className="font-mono text-xs">
              <HardDrive className="w-3 h-3 mr-1" />
              Avg: {avgDisk.toFixed(1)}%
            </Badge>
          </div>
        </div>

        {displayData.length < 2 ? (
          <div className="h-48 flex items-center justify-center border-2 border-dashed border-muted-foreground">
            <p className="font-mono text-sm text-muted-foreground">
              Collecting data... ({displayData.length} points)
            </p>
          </div>
        ) : (
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={displayData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  className="stroke-muted"
                  vertical={false}
                />
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 10 }}
                  className="font-mono fill-muted-foreground"
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 10 }}
                  className="font-mono fill-muted-foreground"
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `${value}%`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  iconType="line"
                  wrapperStyle={{ fontSize: '10px', fontFamily: 'monospace' }}
                />
                <Line
                  type="monotone"
                  dataKey="cpu"
                  name="CPU"
                  stroke="hsl(var(--chart-1))"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="memory"
                  name="Memory"
                  stroke="hsl(var(--chart-2))"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="disk"
                  name="Disk"
                  stroke="hsl(var(--chart-4))"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className="mt-2 flex justify-between items-center text-xs text-muted-foreground font-mono">
          <span>{history.length} data points</span>
          <span>Updates every 3s</span>
        </div>
      </CardContent>
    </Card>
  );
}
