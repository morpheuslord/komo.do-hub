import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Server,
  Cpu,
  MemoryStick,
  HardDrive,
  Wifi,
  Loader2,
  Activity,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface ServerResourcesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  server: {
    id: string;
    name: string;
  };
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

export function ServerResourcesDialog({
  open,
  onOpenChange,
  server,
}: ServerResourcesDialogProps) {
  const { client } = useAuth();
  const [resources, setResources] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && server.id) {
      fetchResources();
      // Refresh every 5 seconds while open
      const interval = setInterval(fetchResources, 5000);
      return () => clearInterval(interval);
    }
  }, [open, server.id]);

  const fetchResources = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Try GetServerResources first
      let resourcesRes = await client.read<any>("GetServerResources", {
        server: server.id,
      });
      
      if (!resourcesRes?.success || !resourcesRes.data) {
        // Fallback to GetSystemStats
        resourcesRes = await client.read<any>("GetSystemStats", {
          server: server.id,
        });
      }

      if (resourcesRes?.success && resourcesRes.data) {
        setResources(resourcesRes.data);
      } else {
        setError('Failed to fetch resources');
      }
    } catch (err) {
      console.warn('[ServerResourcesDialog] Failed to fetch resources:', err);
      setError('Failed to fetch resource information');
    } finally {
      setIsLoading(false);
    }
  };

  const cpuPercent = resources?.cpu_perc ?? resources?.cpu ?? resources?.cpu_percent ?? 0;
  const memUsed = resources?.mem_used_gb ?? (resources?.mem_used ? resources.mem_used / 1024 / 1024 / 1024 : 0);
  const memTotal = resources?.mem_total_gb ?? (resources?.mem_total ? resources.mem_total / 1024 / 1024 / 1024 : 1);
  const memPercent = memTotal > 0 ? (memUsed / memTotal) * 100 : 0;
  const diskUsed = resources?.disk_used_gb ?? 0;
  const diskTotal = resources?.disk_total_gb ?? 1;
  const diskPercent = diskTotal > 0 ? (diskUsed / diskTotal) * 100 : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] border-2 border-foreground p-0 gap-0">
        <DialogHeader className="border-b-2 border-foreground pb-3 px-6 pt-6">
          <div className="flex items-center gap-3">
            <div className="p-2 border-2 border-foreground bg-secondary rounded-sm">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="font-mono font-bold text-lg">
                Server Resources - {server.name}
              </DialogTitle>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          <div className="px-6 py-4">
            {isLoading && !resources ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : error ? (
              <div className="flex items-center justify-center py-12">
                <p className="font-mono text-sm text-destructive">{error}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* CPU Usage */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Cpu className="w-4 h-4 text-chart-1" />
                      <span className="font-mono text-sm font-medium">CPU Usage</span>
                    </div>
                    <span className="font-mono text-sm font-bold">{cpuPercent.toFixed(1)}%</span>
                  </div>
                  <Progress value={cpuPercent} className="h-3" />
                </div>

                {/* Memory Usage */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MemoryStick className="w-4 h-4 text-chart-2" />
                      <span className="font-mono text-sm font-medium">Memory</span>
                    </div>
                    <span className="font-mono text-sm font-bold">
                      {memUsed.toFixed(2)} / {memTotal.toFixed(2)} GB ({memPercent.toFixed(1)}%)
                    </span>
                  </div>
                  <Progress value={memPercent} className="h-3" />
                </div>

                {/* Disk Usage */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <HardDrive className="w-4 h-4 text-chart-4" />
                      <span className="font-mono text-sm font-medium">Disk Usage</span>
                    </div>
                    <span className="font-mono text-sm font-bold">
                      {diskUsed.toFixed(2)} / {diskTotal.toFixed(2)} GB ({diskPercent.toFixed(1)}%)
                    </span>
                  </div>
                  <Progress value={diskPercent} className="h-3" />
                </div>

                {/* Network Stats */}
                {(resources?.network_ingress_bytes !== undefined || resources?.network_egress_bytes !== undefined) && (
                  <div className="flex items-center justify-between p-3 border-2 border-foreground bg-background rounded-sm">
                    <div className="flex items-center gap-2">
                      <Wifi className="w-4 h-4 text-chart-3" />
                      <span className="font-mono text-sm font-medium">Network</span>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="font-mono text-xs text-muted-foreground">
                        ↓ {formatBytes(resources.network_ingress_bytes || 0)} / ↑ {formatBytes(resources.network_egress_bytes || 0)}
                      </span>
                    </div>
                  </div>
                )}

                {/* Additional Details */}
                <div className="space-y-2 pt-2 border-t-2 border-foreground">
                  <h4 className="font-mono text-sm font-bold flex items-center gap-2">
                    <Activity className="w-4 h-4" />
                    Additional Information
                  </h4>
                  {resources?.uptime && (
                    <div className="flex items-center justify-between p-2 border border-foreground bg-background rounded-sm">
                      <span className="font-mono text-xs">Uptime</span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {resources.uptime}
                      </span>
                    </div>
                  )}
                  {resources?.load_average && (
                    <div className="flex items-center justify-between p-2 border border-foreground bg-background rounded-sm">
                      <span className="font-mono text-xs">Load Average</span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {Array.isArray(resources.load_average) 
                          ? resources.load_average.join(', ')
                          : resources.load_average}
                      </span>
                    </div>
                  )}
                  {resources?.processes && (
                    <div className="flex items-center justify-between p-2 border border-foreground bg-background rounded-sm">
                      <span className="font-mono text-xs">Processes</span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {resources.processes}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

