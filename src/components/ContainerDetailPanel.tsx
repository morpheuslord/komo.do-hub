import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Box,
  ChevronDown,
  ChevronUp,
  Server,
  Clock,
  Play,
  Square,
  RotateCcw,
  Loader2,
  Activity,
  Terminal,
  Layers,
  Network,
  FileText,
} from 'lucide-react';
import { ContainerPortsDialog } from '@/components/ContainerPortsDialog';
import { ContainerLogsDialog } from '@/components/ContainerLogsDialog';

interface ContainerDetailPanelProps {
  container: {
    id: string;
    name: string;
    state?: string;
    serverName?: string;
    serverId?: string;
    stats?: string;
    image?: string;
    ports?: string;
    created?: string;
  };
  onAction: (action: string, resourceId: string, resourceName: string) => void;
  actionLoading: string | null;
}

function getStatusIcon(state?: string) {
  const stateStr = state?.toLowerCase() || '';
  if (['running', 'ok', 'healthy', 'up'].some((s) => stateStr.includes(s))) {
    return <div className="w-2 h-2 rounded-full bg-chart-2" />;
  }
  if (['error', 'failed', 'unhealthy', 'dead'].some((s) => stateStr.includes(s))) {
    return <div className="w-2 h-2 rounded-full bg-destructive" />;
  }
  if (['stopped', 'exited'].some((s) => stateStr.includes(s))) {
    return <div className="w-2 h-2 rounded-full bg-muted-foreground" />;
  }
  return <div className="w-2 h-2 rounded-full bg-chart-4" />;
}

function getStatusVariant(state?: string): "default" | "secondary" | "destructive" | "outline" {
  const stateStr = state?.toLowerCase() || '';
  if (['running', 'ok', 'healthy', 'up'].some((s) => stateStr.includes(s))) return 'default';
  if (['error', 'failed', 'unhealthy', 'dead'].some((s) => stateStr.includes(s))) return 'destructive';
  return 'secondary';
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

export function ContainerDetailPanel({ container, onAction, actionLoading }: ContainerDetailPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [uptime, setUptime] = useState(container.stats || '');
  const [portsDialogOpen, setPortsDialogOpen] = useState(false);
  const [logsDialogOpen, setLogsDialogOpen] = useState(false);
  
  // Prevent rapid toggling
  const handleOpenChange = useCallback((open: boolean) => {
    setIsOpen(open);
  }, []);

  useEffect(() => {
    if (container.stats) setUptime(container.stats);
  }, [container.stats]);

  const containerActions = [
    { label: 'Start', action: 'start', icon: <Play className="h-3 w-3" /> },
    { label: 'Stop', action: 'stop', icon: <Square className="h-3 w-3" /> },
    { label: 'Restart', action: 'restart', icon: <RotateCcw className="h-3 w-3" /> },
  ];


  // Extract image name from full image path
  const imageName = container.image?.split('/').pop()?.split(':')[0] || container.image || 'Unknown';
  const imageTag = container.image?.split(':')[1] || 'latest';

  return (
    <Collapsible open={isOpen} onOpenChange={handleOpenChange}>
      <Card className="border-2 border-foreground shadow-xs hover:shadow-sm transition-shadow">
        <CollapsibleTrigger asChild>
          <CardContent className="p-4 cursor-pointer">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="p-2 border-2 border-foreground bg-secondary flex-shrink-0">
                  <Box className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-mono font-bold text-sm truncate">{container.name}</h3>
                  {container.stats && (
                    <p className="font-mono text-xs text-muted-foreground truncate">{container.stats}</p>
                  )}
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {getStatusIcon(container.state)}
                    <Badge variant={getStatusVariant(container.state)} className="font-mono text-xs uppercase">
                      {container.state || 'unknown'}
                    </Badge>
                    {container.serverName && (
                      <Badge variant="outline" className="font-mono text-xs">
                        <Server className="w-3 h-3 mr-1" />
                        {container.serverName}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {isOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </div>
            </div>
          </CardContent>
        </CollapsibleTrigger>

        <CollapsibleContent className="transition-all duration-300 ease-in-out overflow-hidden">
          <div className="border-t-2 border-foreground p-4 bg-secondary/50 max-h-[80vh] overflow-y-auto">
            {/* Container Details */}
            <div className="space-y-3">
              {/* Status */}
              <div className="flex items-center justify-between p-2 border border-foreground bg-background">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-chart-2" />
                  <span className="font-mono text-sm">Status</span>
                </div>
                <Badge variant={getStatusVariant(container.state)} className="font-mono">
                  {container.state || 'Unknown'}
                </Badge>
              </div>

              {/* Server */}
              <div className="flex items-center justify-between p-2 border border-foreground bg-background">
                <div className="flex items-center gap-2">
                  <Server className="w-4 h-4 text-chart-1" />
                  <span className="font-mono text-sm">Server</span>
                </div>
                <span className="font-mono text-sm text-muted-foreground">
                  {container.serverName || 'Unknown'}
                </span>
              </div>

              {/* Uptime */}
              <div className="flex items-center justify-between p-2 border border-foreground bg-background">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-chart-4" />
                  <span className="font-mono text-sm">Uptime</span>
                </div>
                <span className="font-mono text-sm text-muted-foreground">
                  {uptime || 'N/A'}
                </span>
              </div>

              {/* Network Stats (if available) */}
              {(container as any).networkIngress !== undefined || (container as any).networkEgress !== undefined ? (
                <div className="flex items-center justify-between p-2 border border-foreground bg-background">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-chart-3" />
                    <span className="font-mono text-sm">Network</span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="font-mono text-xs text-muted-foreground">
                      ↓ {formatBytes((container as any).networkIngress || 0)} / ↑ {formatBytes((container as any).networkEgress || 0)}
                    </span>
                  </div>
                </div>
              ) : null}

              {/* Image */}
              {container.image && (
                <div className="flex items-center justify-between p-2 border border-foreground bg-background">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-chart-3" />
                    <span className="font-mono text-sm">Image</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="font-mono text-sm text-muted-foreground truncate max-w-[150px]">
                      {imageName}
                    </span>
                    <Badge variant="outline" className="font-mono text-[10px]">
                      {imageTag}
                    </Badge>
                  </div>
                </div>
              )}

              {/* Container ID */}
              <div className="flex items-center justify-between p-2 border border-foreground bg-background">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-muted-foreground" />
                  <span className="font-mono text-sm">Container ID</span>
                </div>
                <span className="font-mono text-xs text-muted-foreground">
                  {container.id.slice(0, 12)}...
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="mt-4 flex flex-wrap gap-2">
              {containerActions.map((act) => (
                <Button
                  key={act.action}
                  variant="outline"
                  size="sm"
                  className="border-2 font-mono text-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAction(act.action, container.id, container.name);
                  }}
                  disabled={actionLoading === `${act.action}-${container.id}`}
                >
                  {actionLoading === `${act.action}-${container.id}` ? (
                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  ) : (
                    <span className="mr-1">{act.icon}</span>
                  )}
                  {act.label}
                </Button>
              ))}
            </div>

            {/* Management Options */}
            <div className="mt-4 pt-4 border-t-2 border-foreground">
              <h4 className="font-mono text-xs font-bold mb-2 uppercase">Management Options</h4>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-2 font-mono text-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPortsDialogOpen(true);
                  }}
                >
                  <Network className="h-3 w-3 mr-1" />
                  Ports
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-2 font-mono text-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    setLogsDialogOpen(true);
                  }}
                >
                  <FileText className="h-3 w-3 mr-1" />
                  Logs
                </Button>
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </Card>

      {/* Ports Dialog */}
      <ContainerPortsDialog
        open={portsDialogOpen}
        onOpenChange={setPortsDialogOpen}
        container={{
          id: container.id,
          name: container.name,
          serverId: container.serverId,
        }}
      />

      {/* Logs Dialog */}
      <ContainerLogsDialog
        open={logsDialogOpen}
        onOpenChange={setLogsDialogOpen}
        container={{
          id: container.id,
          name: container.name,
          serverId: container.serverId,
          serverName: container.serverName,
        }}
      />
    </Collapsible>
  );
}
