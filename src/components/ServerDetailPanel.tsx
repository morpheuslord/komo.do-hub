import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Progress } from '@/components/ui/progress';
import {
  Server,
  ChevronDown,
  ChevronUp,
  Cpu,
  HardDrive,
  MemoryStick,
  Activity,
  Wifi,
  Clock,
  Box,
  Play,
  Square,
  RotateCcw,
  Trash2,
  Loader2,
  RefreshCw
} from 'lucide-react';
import type { ServerListItem } from '@/lib/komodo-api';
import { ServerStatsChart } from './ServerStatsChart';

interface StatsDataPoint {
  time: string;
  timestamp: number;
  cpu: number;
  memory: number;
  disk: number;
}

interface ServerDetailPanelProps {
  server: ServerListItem;
  containers: Array<{ id: string; name: string; state?: string; stats?: string }>;
  onAction: (action: string, resourceId: string, resourceName: string) => void;
  actionLoading: string | null;
  onRefreshServer?: (serverId: string) => void;
  statsHistory?: StatsDataPoint[];
}

function getStatusIcon(state?: string) {
  const stateStr = state?.toLowerCase() || '';
  if (['running', 'ok', 'healthy', 'up'].some(s => stateStr.includes(s))) {
    return <div className="w-2 h-2 rounded-full bg-chart-2" />;
  }
  if (['error', 'failed', 'unhealthy', 'dead'].some(s => stateStr.includes(s))) {
    return <div className="w-2 h-2 rounded-full bg-destructive" />;
  }
  if (['stopped', 'exited'].some(s => stateStr.includes(s))) {
    return <div className="w-2 h-2 rounded-full bg-muted-foreground" />;
  }
  return <div className="w-2 h-2 rounded-full bg-chart-4" />;
}

function getStatusVariant(state?: string): "default" | "secondary" | "destructive" | "outline" {
  const stateStr = state?.toLowerCase() || '';
  if (['running', 'ok', 'healthy', 'up'].some(s => stateStr.includes(s))) return 'default';
  if (['error', 'failed', 'unhealthy', 'dead'].some(s => stateStr.includes(s))) return 'destructive';
  return 'secondary';
}

function formatTimeShort(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

export function ServerDetailPanel({ server, containers, onAction, actionLoading, onRefreshServer, statsHistory: externalStatsHistory }: ServerDetailPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  // Prevent rapid toggling
  const handleOpenChange = useCallback((open: boolean) => {
    setIsOpen(open);
  }, []);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [internalStatsHistory, setInternalStatsHistory] = useState<StatsDataPoint[]>([]);
  const lastStatsRef = useRef({ cpu: 0, mem: 0, disk: 0 });
  
  // Prevent state updates during rapid changes
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const statsHistory = externalStatsHistory || internalStatsHistory;

  const cpuPercent = server.cpu_perc ?? 0;
  const memUsed = server.mem_used_gb ?? 0;
  const memTotal = server.mem_total_gb ?? 1;
  const diskUsed = server.disk_used_gb ?? 0;
  const diskTotal = server.disk_total_gb ?? 1;
  const memPercent = memTotal > 0 ? (memUsed / memTotal) * 100 : 0;
  const diskPercent = diskTotal > 0 ? (diskUsed / diskTotal) * 100 : 0;

  // Collect stats when panel is open and values change (debounced)
  useEffect(() => {
    if (!isOpen) return;

    // Clear any pending updates
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }

    // Only add point if values have changed
    const hasChanged = 
      Math.abs(lastStatsRef.current.cpu - cpuPercent) > 0.1 ||
      Math.abs(lastStatsRef.current.mem - memPercent) > 0.1 ||
      Math.abs(lastStatsRef.current.disk - diskPercent) > 0.1;

    if (hasChanged) {
      // Debounce updates to prevent UI freezing
      updateTimeoutRef.current = setTimeout(() => {
        const now = Date.now();
        const newPoint: StatsDataPoint = {
          time: formatTimeShort(now),
          timestamp: now,
          cpu: Number(cpuPercent.toFixed(1)),
          memory: Number(memPercent.toFixed(1)),
          disk: Number(diskPercent.toFixed(1)),
        };

        lastStatsRef.current = { cpu: cpuPercent, mem: memPercent, disk: diskPercent };
        setLastUpdate(new Date());

        setInternalStatsHistory(prev => {
          // Keep last 24h of data (at 3s intervals, that's ~28800 points max)
          const cutoff = Date.now() - 24 * 60 * 60 * 1000;
          const filtered = prev.filter(p => p.timestamp > cutoff);
          return [...filtered, newPoint].slice(-28800);
        });
      }, 100);
    }

    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, [isOpen, cpuPercent, memPercent, diskPercent]);

  const serverContainers = containers.filter(c => c.id);
  const runningContainers = serverContainers.filter(c => 
    c.state?.toLowerCase().includes('running') || c.state?.toLowerCase().includes('up')
  );

  const serverActions = [
    { label: 'Start All', action: 'startAll', icon: <Play className="h-3 w-3" /> },
    { label: 'Stop All', action: 'stopAll', icon: <Square className="h-3 w-3" /> },
    { label: 'Restart All', action: 'restartAll', icon: <RotateCcw className="h-3 w-3" /> },
    { label: 'Prune', action: 'pruneSystem', icon: <Trash2 className="h-3 w-3" /> },
  ];

  return (
    <Collapsible open={isOpen} onOpenChange={handleOpenChange}>
      <Card className="border-2 border-foreground shadow-xs hover:shadow-sm transition-shadow">
        <CollapsibleTrigger asChild>
          <CardContent className="p-4 cursor-pointer">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="p-2 border-2 border-foreground bg-secondary flex-shrink-0">
                  <Server className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-mono font-bold text-sm truncate">{server.name}</h3>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {getStatusIcon(server.state)}
                    <Badge variant={getStatusVariant(server.state)} className="font-mono text-xs uppercase">
                      {server.state || 'unknown'}
                    </Badge>
                    <Badge variant="outline" className="font-mono text-xs">
                      <Box className="w-3 h-3 mr-1" />
                      {runningContainers.length}/{serverContainers.length}
                    </Badge>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {isOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </div>
            </div>

            {/* Quick Stats Bar */}
            <div className="mt-3 grid grid-cols-3 gap-2">
              <div className="flex items-center gap-1">
                <Cpu className="w-3 h-3 text-muted-foreground" />
                <span className="font-mono text-xs">{cpuPercent.toFixed(0)}%</span>
              </div>
              <div className="flex items-center gap-1">
                <MemoryStick className="w-3 h-3 text-muted-foreground" />
                <span className="font-mono text-xs">{memPercent.toFixed(0)}%</span>
              </div>
              <div className="flex items-center gap-1">
                <HardDrive className="w-3 h-3 text-muted-foreground" />
                <span className="font-mono text-xs">{diskPercent.toFixed(0)}%</span>
              </div>
            </div>
          </CardContent>
        </CollapsibleTrigger>

        <CollapsibleContent className="transition-all duration-300 ease-in-out overflow-hidden">
          <div className="border-t-2 border-foreground p-4 bg-secondary/50 max-h-[80vh] overflow-y-auto">
            {/* Last Update Indicator */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Activity className="w-4 h-4" />
                <span className="font-mono text-xs">Live Stats</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-3 h-3 text-muted-foreground" />
                <span className="font-mono text-xs text-muted-foreground">
                  Updated: {lastUpdate.toLocaleTimeString()}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRefreshServer?.(server.id);
                    setLastUpdate(new Date());
                  }}
                >
                  <RefreshCw className="h-3 w-3" />
                </Button>
              </div>
            </div>

            {/* Disk & Network Stats */}
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center justify-between p-2 border border-foreground bg-background">
                <div className="flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-chart-4" />
                  <span className="font-mono text-sm">Disk Usage</span>
                </div>
                <div className="flex flex-col items-end">
                  <span className="font-mono text-sm font-bold">{diskPercent.toFixed(1)}%</span>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {diskUsed.toFixed(1)} / {diskTotal.toFixed(1)} GB
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between p-2 border border-foreground bg-background">
                <div className="flex items-center gap-2">
                  <Wifi className="w-4 h-4 text-chart-3" />
                  <span className="font-mono text-sm">Network</span>
                </div>
                <div className="flex flex-col items-end">
                  {server.network_ingress_bytes !== undefined || server.network_egress_bytes !== undefined ? (
                    <>
                      <span className="font-mono text-xs text-muted-foreground">
                        ↓ {formatBytes(server.network_ingress_bytes || 0)} / ↑ {formatBytes(server.network_egress_bytes || 0)}
                      </span>
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {server.address || 'N/A'}
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="font-mono text-xs text-muted-foreground truncate max-w-[100px]">
                        {server.address || 'N/A'}
                      </span>
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {server.address ? 'Connected' : 'N/A'}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {/* CPU */}
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-chart-1" />
                    <span className="font-mono text-sm font-medium">CPU Usage</span>
                  </div>
                  <span className="font-mono text-sm font-bold">{cpuPercent.toFixed(1)}%</span>
                </div>
                <Progress value={cpuPercent} className="h-3" />
              </div>

              {/* Memory */}
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <MemoryStick className="w-4 h-4 text-chart-2" />
                    <span className="font-mono text-sm font-medium">Memory</span>
                  </div>
                  <span className="font-mono text-sm font-bold">
                    {memUsed.toFixed(1)} / {memTotal.toFixed(1)} GB
                  </span>
                </div>
                <Progress value={memPercent} className="h-3" />
              </div>
            </div>

            {/* Containers on this Server */}
            {serverContainers.length > 0 && (
              <div className="mt-4">
                <h4 className="font-mono text-sm font-bold mb-2 flex items-center gap-2">
                  <Box className="w-4 h-4" />
                  Containers ({serverContainers.length})
                </h4>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {serverContainers.map((container) => (
                    <div
                      key={container.id}
                      className="flex items-center justify-between p-2 border border-foreground bg-background text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        {getStatusIcon(container.state)}
                        <span className="font-mono truncate">{container.name}</span>
                      </div>
                      <Badge variant={getStatusVariant(container.state)} className="font-mono text-[10px]">
                        {container.state || 'unknown'}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 24h Stats Chart */}
            <ServerStatsChart
              serverId={server.id}
              serverName={server.name}
              currentCpu={cpuPercent}
              currentMemPercent={memPercent}
              currentDiskPercent={diskPercent}
              isVisible={isOpen}
              statsHistory={statsHistory}
            />

            {/* Action Buttons */}
            <div className="mt-4 flex flex-wrap gap-2">
              {serverActions.map((act) => (
                <Button
                  key={act.action}
                  variant="outline"
                  size="sm"
                  className="border-2 font-mono text-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAction(act.action, server.id, server.name);
                  }}
                  disabled={actionLoading === `${act.action}-${server.id}`}
                >
                  {actionLoading === `${act.action}-${server.id}` ? (
                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  ) : (
                    <span className="mr-1">{act.icon}</span>
                  )}
                  {act.label}
                </Button>
              ))}
            </div>
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
