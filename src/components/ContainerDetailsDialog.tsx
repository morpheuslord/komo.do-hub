import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Box,
  Server,
  Clock,
  Play,
  Square,
  RotateCcw,
  Loader2,
  Activity,
  Layers,
  Copy,
  Check,
  Network,
  FileText,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ContainerPortsDialog } from '@/components/ContainerPortsDialog';
import { ContainerLogsDialog } from '@/components/ContainerLogsDialog';

interface ContainerDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  container: {
    id: string;
    name: string;
    state?: string;
    serverName?: string;
    serverId?: string;
  };
  onAction?: (action: string, resourceId: string, resourceName: string) => void;
  actionLoading?: string | null;
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

export function ContainerDetailsDialog({
  open,
  onOpenChange,
  container,
  onAction,
  actionLoading,
}: ContainerDetailsDialogProps) {
  const { client } = useAuth();
  const [containerDetails, setContainerDetails] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [portsDialogOpen, setPortsDialogOpen] = useState(false);
  const [logsDialogOpen, setLogsDialogOpen] = useState(false);

  useEffect(() => {
    if (open && container.id) {
      fetchContainerDetails();
    }
  }, [open, container.id]);

  const fetchContainerDetails = async () => {
    setIsLoading(true);
    try {
      // Try to get container info from GetContainerInfo
      const containerRes = await client.read<any>("GetContainerInfo", {
        container: container.id,
      });
      
      if (containerRes?.success && containerRes.data) {
        setContainerDetails(containerRes.data);
      } else {
        // Fallback: try GetContainerStats
        const statsRes = await client.read<any>("GetContainerStats", {
          container: container.id,
        });
        if (statsRes?.success && statsRes.data) {
          setContainerDetails(statsRes.data);
        }
      }
    } catch (error) {
      console.warn('[ContainerDetailsDialog] Failed to fetch container details:', error);
      // Set minimal details from props
      setContainerDetails({
        id: container.id,
        name: container.name,
        state: container.state,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const copyContainerId = () => {
    navigator.clipboard.writeText(container.id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const containerInfo = containerDetails || {
    id: container.id,
    name: container.name,
    state: container.state,
  };

  const imageName = containerInfo.image?.split('/').pop()?.split(':')[0] || containerInfo.image || 'Unknown';
  const imageTag = containerInfo.image?.split(':')[1] || 'latest';

  const containerActions = [
    { label: 'Start', action: 'start', icon: <Play className="h-3 w-3" /> },
    { label: 'Stop', action: 'stop', icon: <Square className="h-3 w-3" /> },
    { label: 'Restart', action: 'restart', icon: <RotateCcw className="h-3 w-3" /> },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] border-2 border-foreground p-0 gap-0">
        <DialogHeader className="border-b-2 border-foreground pb-3 px-6 pt-6">
          <div className="flex items-center gap-3">
            <div className="p-2 border-2 border-foreground bg-secondary rounded-sm">
              <Box className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="font-mono font-bold text-lg">
                {container.name}
              </DialogTitle>
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
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          <div className="px-6 py-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-3">
              {/* Status */}
              <div className="flex items-center justify-between p-3 border-2 border-foreground bg-background rounded-sm">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-chart-2" />
                  <span className="font-mono text-sm font-medium">Status</span>
                </div>
                <Badge variant={getStatusVariant(containerInfo.state)} className="font-mono">
                  {containerInfo.state || containerInfo.State || containerInfo.status || 'Unknown'}
                </Badge>
              </div>

              {/* Server */}
              {container.serverName && (
                <div className="flex items-center justify-between p-3 border-2 border-foreground bg-background rounded-sm">
                  <div className="flex items-center gap-2">
                    <Server className="w-4 h-4 text-chart-1" />
                    <span className="font-mono text-sm font-medium">Server</span>
                  </div>
                  <span className="font-mono text-sm text-muted-foreground">
                    {container.serverName}
                  </span>
                </div>
              )}

              {/* Uptime */}
              {(containerInfo.stats || containerInfo.status || containerInfo.uptime) && (
                <div className="flex items-center justify-between p-3 border-2 border-foreground bg-background rounded-sm">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-chart-4" />
                    <span className="font-mono text-sm font-medium">Uptime</span>
                  </div>
                  <span className="font-mono text-sm text-muted-foreground">
                    {containerInfo.stats || containerInfo.status || containerInfo.uptime || 'N/A'}
                  </span>
                </div>
              )}

              {/* Image */}
              {containerInfo.image && (
                <div className="flex items-center justify-between p-3 border-2 border-foreground bg-background rounded-sm">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-chart-3" />
                    <span className="font-mono text-sm font-medium">Image</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm text-muted-foreground truncate max-w-[200px]">
                      {imageName}
                    </span>
                    <Badge variant="outline" className="font-mono text-[10px]">
                      {imageTag}
                    </Badge>
                  </div>
                </div>
              )}

              {/* Network Stats */}
              {(containerInfo.networkIngress !== undefined || containerInfo.networkEgress !== undefined) && (
                <div className="flex items-center justify-between p-3 border-2 border-foreground bg-background rounded-sm">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-chart-3" />
                    <span className="font-mono text-sm font-medium">Network</span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="font-mono text-xs text-muted-foreground">
                      ↓ {formatBytes(containerInfo.networkIngress || 0)} / ↑ {formatBytes(containerInfo.networkEgress || 0)}
                    </span>
                  </div>
                </div>
              )}

              {/* Ports */}
              {containerInfo.ports && (
                <div className="flex items-start justify-between p-3 border-2 border-foreground bg-background rounded-sm">
                  <div className="flex items-center gap-2">
                    <Network className="w-4 h-4 text-chart-1 mt-0.5" />
                    <span className="font-mono text-sm font-medium">Ports</span>
                  </div>
                  <span className="font-mono text-xs text-muted-foreground text-right">
                    {containerInfo.ports}
                  </span>
                </div>
              )}

              {/* Container ID */}
              <div className="flex items-center justify-between p-3 border-2 border-foreground bg-background rounded-sm">
                <div className="flex items-center gap-2">
                  <Box className="w-4 h-4 text-muted-foreground" />
                  <span className="font-mono text-sm font-medium">Container ID</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-muted-foreground">
                    {container.id.slice(0, 12)}...
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={copyContainerId}
                    title="Copy full ID"
                  >
                    {copiedId ? (
                      <Check className="h-3 w-3 text-chart-2" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Created Date */}
              {containerInfo.created && (
                <div className="flex items-center justify-between p-3 border-2 border-foreground bg-background rounded-sm">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <span className="font-mono text-sm font-medium">Created</span>
                  </div>
                  <span className="font-mono text-xs text-muted-foreground">
                    {new Date(containerInfo.created).toLocaleString()}
                  </span>
                </div>
              )}
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Management Options */}
        <div className="px-6 pb-4 pt-4 border-t-2 border-foreground">
          <h4 className="font-mono text-sm font-bold mb-3">Management Options</h4>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              className="border-2 font-mono text-xs"
              onClick={() => setPortsDialogOpen(true)}
            >
              <Network className="h-3 w-3 mr-1" />
              Ports
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="border-2 font-mono text-xs"
              onClick={() => setLogsDialogOpen(true)}
            >
              <FileText className="h-3 w-3 mr-1" />
              Logs
            </Button>
          </div>
        </div>

        {/* Action Buttons */}
        {onAction && (
          <div className="px-6 pb-6 pt-4 border-t-2 border-foreground flex flex-wrap gap-2">
            {containerActions.map((act) => (
              <Button
                key={act.action}
                variant="outline"
                size="sm"
                className="border-2 font-mono text-xs"
                onClick={() => {
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
        )}
      </DialogContent>

      {/* Management Dialogs */}
      <ContainerPortsDialog
        open={portsDialogOpen}
        onOpenChange={setPortsDialogOpen}
        container={{
          ...container,
          serverId: container.serverId,
        }}
      />
      <ContainerLogsDialog
        open={logsDialogOpen}
        onOpenChange={setLogsDialogOpen}
        container={{
          ...container,
          serverId: container.serverId,
          serverName: container.serverName,
        }}
      />
    </Dialog>
  );
}

