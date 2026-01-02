import { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  FileText,
  Loader2,
  Download,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface ContainerLogsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  container: {
    id: string;
    name: string;
    serverId?: string;
    serverName?: string;
  };
}

export function ContainerLogsDialog({
  open,
  onOpenChange,
  container,
}: ContainerLogsDialogProps) {
  const { client } = useAuth();
  const [logs, setLogs] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [lines, setLines] = useState(100);

  useEffect(() => {
    if (open && container.id) {
      fetchLogs();
    }
  }, [open, container.id, lines]);

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const fetchLogs = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // First, try to get container info to determine if it's a deployment or direct container
      const containerInfo = await client.read<any>("GetContainerInfo", {
        container: container.id,
      });
      
      let logsRes;
      let containerIdToUse = container.id;
      let serverId = container.serverId;
      
      // Check if this container is part of a deployment
      if (containerInfo?.success && containerInfo.data) {
        const info = containerInfo.data;
        const deploymentId = info.deployment || info.deployment_id || info.Deployment || info.DeploymentId;
        
        // If it's a deployment, try GetDeploymentLog first
        if (deploymentId) {
          logsRes = await client.read<any>("GetDeploymentLog", {
            deployment: deploymentId,
            tail: lines,
          });
        }
        
        // Also try to get the actual Docker container ID if available
        const dockerContainerId = info.id || info.Id || info.container_id || info.containerId || info.ContainerId;
        if (dockerContainerId && dockerContainerId !== container.id) {
          containerIdToUse = dockerContainerId;
        }
        
        // Get server ID from container info if not provided
        if (!serverId) {
          serverId = info.server || info.server_id || info.Server || info.ServerId || info.serverId;
        }
      }
      
      // If deployment log didn't work, try GetContainerLog with the container ID
      // GetContainerLog requires a server parameter
      if (!logsRes?.success) {
        if (serverId) {
          logsRes = await client.read<any>("GetContainerLog", {
            container: containerIdToUse,
            server: serverId,
            tail: lines,
          });
          
          // If that fails, try without tail parameter
          if (!logsRes?.success) {
            logsRes = await client.read<any>("GetContainerLog", {
              container: containerIdToUse,
              server: serverId,
            });
          }
        } else {
          setError('Server ID is required for GetContainerLog but could not be determined. Please ensure the container has server information.');
          setLogs('');
          return;
        }
      }
      
      if (logsRes?.success && logsRes.data) {
        const logsData = logsRes.data;
        // Log response format: split by stdout/stderr
        let logText = '';
        
        if (typeof logsData === 'string') {
          logText = logsData;
        } else if (logsData.stdout && logsData.stderr) {
          // Combine stdout and stderr
          logText = `=== STDOUT ===\n${logsData.stdout}\n\n=== STDERR ===\n${logsData.stderr}`;
        } else if (logsData.stdout) {
          logText = logsData.stdout;
        } else if (logsData.stderr) {
          logText = logsData.stderr;
        } else if (logsData.logs) {
          logText = logsData.logs;
        } else if (logsData.Logs) {
          logText = logsData.Logs;
        } else if (Array.isArray(logsData)) {
          logText = logsData.join('\n');
        } else if (logsData.output) {
          logText = logsData.output;
        } else {
          logText = JSON.stringify(logsData, null, 2);
        }
        
        setLogs(logText);
      } else {
        setLogs('');
        setError(logsRes?.error || 'No logs available');
      }
    } catch (err) {
      console.warn('[ContainerLogsDialog] Failed to fetch logs:', err);
      const errorMsg = err instanceof Error ? err.message : 'Failed to fetch logs';
      setError(`Failed to fetch logs: ${errorMsg}`);
      setLogs('');
    } finally {
      setIsLoading(false);
    }
  };

  const downloadLogs = () => {
    const blob = new Blob([logs], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${container.name}-logs-${new Date().toISOString()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] border-2 border-foreground p-0 gap-0">
        <DialogHeader className="border-b-2 border-foreground pb-3 px-6 pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 border-2 border-foreground bg-secondary rounded-sm">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="font-mono font-bold text-lg">
                  Container Logs - {container.name}
                </DialogTitle>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={lines}
                onChange={(e) => setLines(Number(e.target.value))}
                className="font-mono text-xs border border-foreground bg-background px-2 py-1 rounded"
              >
                <option value={50}>50 lines</option>
                <option value={100}>100 lines</option>
                <option value={200}>200 lines</option>
                <option value={500}>500 lines</option>
              </select>
              <Button
                variant="outline"
                size="sm"
                className="h-8 font-mono text-xs"
                onClick={fetchLogs}
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <RefreshCw className="h-3 w-3" />
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 font-mono text-xs"
                onClick={downloadLogs}
                disabled={!logs}
              >
                <Download className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          <div className="px-6 py-4" ref={scrollRef}>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : error ? (
              <div className="space-y-3">
                <div className="p-4 bg-destructive/10 border border-destructive rounded-sm">
                  <p className="font-mono text-sm text-destructive font-bold mb-2">Error:</p>
                  <p className="font-mono text-xs text-destructive">{error}</p>
                </div>
                <div className="p-4 bg-muted/50 border border-foreground/20 rounded-sm">
                  <p className="font-mono text-xs text-muted-foreground">
                    Using <code className="bg-background px-1 rounded">GetContainerLog</code> API endpoint.
                    Logs are split by stdout/stderr as per API specification.
                  </p>
                </div>
              </div>
            ) : logs ? (
              <pre className="font-mono text-xs bg-background p-4 rounded border border-foreground whitespace-pre-wrap break-words">
                {logs}
              </pre>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-center py-8">
                  <p className="font-mono text-sm text-muted-foreground">
                    No logs available
                  </p>
                </div>
                <div className="p-4 bg-muted/50 border border-foreground/20 rounded-sm">
                  <p className="font-mono text-xs text-muted-foreground">
                    No logs available. The container may not have produced any output yet.
                  </p>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="px-6 pb-6 pt-4 border-t-2 border-foreground flex items-center justify-between">
          <label className="flex items-center gap-2 font-mono text-xs">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              className="rounded"
            />
            Auto-scroll
          </label>
          <p className="font-mono text-xs text-muted-foreground">
            {logs.split('\n').length} lines
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

