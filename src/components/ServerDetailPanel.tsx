import { useState, useEffect } from 'react';
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

interface ServerDetailPanelProps {
  server: ServerListItem;
  containers: Array<{ id: string; name: string; state?: string; stats?: string }>;
  onAction: (action: string, resourceId: string, resourceName: string) => void;
  actionLoading: string | null;
  onRefreshServer?: (serverId: string) => void;
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

export function ServerDetailPanel({ server, containers, onAction, actionLoading, onRefreshServer }: ServerDetailPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  // Auto-refresh when panel is open - every 3 seconds for charts
  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => {
      setLastUpdate(new Date());
      onRefreshServer?.(server.id);
    }, 3000); // Update every 3 seconds
    return () => clearInterval(interval);
  }, [isOpen, server.id, onRefreshServer]);

  const cpuPercent = server.cpu_perc ?? 0;
  const memUsed = server.mem_used_gb ?? 0;
  const memTotal = server.mem_total_gb ?? 1;
  const diskUsed = server.disk_used_gb ?? 0;
  const diskTotal = server.disk_total_gb ?? 1;
  const memPercent = memTotal > 0 ? (memUsed / memTotal) * 100 : 0;
  const diskPercent = diskTotal > 0 ? (diskUsed / diskTotal) * 100 : 0;

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
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
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
                  {server.address && (
                    <p className="font-mono text-xs text-muted-foreground truncate">{server.address}</p>
                  )}
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

        <CollapsibleContent className="transition-all duration-300 ease-in-out">
          <div className="border-t-2 border-foreground p-4 bg-secondary/50">
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
                <span className="font-mono text-sm font-bold">{diskPercent.toFixed(1)}%</span>
              </div>
              <div className="flex items-center justify-between p-2 border border-foreground bg-background">
                <div className="flex items-center gap-2">
                  <Wifi className="w-4 h-4 text-chart-3" />
                  <span className="font-mono text-sm">Network</span>
                </div>
                <span className="font-mono text-sm text-muted-foreground truncate max-w-[80px]">
                  {server.address || 'N/A'}
                </span>
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
