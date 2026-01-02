import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Network,
  Loader2,
  Copy,
  Check,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface ContainerPortsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  container: {
    id: string;
    name: string;
    serverId?: string;
  };
}

export function ContainerPortsDialog({
  open,
  onOpenChange,
  container,
}: ContainerPortsDialogProps) {
  const { client } = useAuth();
  const [ports, setPorts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedPort, setCopiedPort] = useState<string | null>(null);
  const [serverAddress, setServerAddress] = useState<string | null>(null);

  useEffect(() => {
    if (open && container.id) {
      // Fetch server address and ports in parallel
      fetchServerAddress();
      fetchPorts();
    } else {
      // Reset state when dialog closes
      setPorts([]);
      setServerAddress(null);
      setError(null);
    }
  }, [open, container.id]);

  // Re-fetch ports when server address changes (if ports are already loaded)
  useEffect(() => {
    if (open && container.id && serverAddress && ports.length > 0) {
      // Server address was fetched, ports will re-render with new address
      // No need to re-fetch ports, just trigger a re-render
    }
  }, [serverAddress]);

  const fetchServerAddress = async (): Promise<void> => {
    if (!container.serverId) {
      setServerAddress(null);
      return;
    }
    
    try {
      // Try GetServerInfo first
      let serverRes = await client.read<any>("GetServerInfo", {
        server: container.serverId,
      });
      
      // If that fails, try ListServers and find the matching server
      if (!serverRes?.success || !serverRes.data) {
        const serversRes = await client.read<any[]>("ListServers", {});
        if (serversRes?.success && Array.isArray(serversRes.data)) {
          const server = serversRes.data.find((s: any) => s.id === container.serverId);
          if (server) {
            serverRes = { success: true, data: server };
          }
        }
      }
      
      if (serverRes?.success && serverRes.data) {
        const address = serverRes.data.address || 
                       serverRes.data.hostname || 
                       serverRes.data.ip ||
                       null;
        setServerAddress(address);
        console.log('[ContainerPortsDialog] Server address fetched:', address);
      } else {
        setServerAddress(null);
      }
    } catch (err) {
      console.warn('[ContainerPortsDialog] Failed to fetch server address:', err);
      setServerAddress(null);
    }
  };

  const fetchPorts = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Wait for server address if it's being fetched
      let currentServerAddress = serverAddress;
      if (!currentServerAddress && container.serverId) {
        // If server address is not set yet, fetch it first
        await fetchServerAddress();
        // Get the server address from state after a brief delay to allow state update
        // Actually, we'll use the serverAddress state in the render, so we don't need to wait here
      }
      
      // Try InspectDockerContainer first (this should have port information)
      let infoRes = await client.read<any>("InspectDockerContainer", {
        container: container.id,
        ...(container.serverId && { server: container.serverId }),
      });
      
      // If that fails, try GetContainerInfo
      if (!infoRes?.success) {
        infoRes = await client.read<any>("GetContainerInfo", {
          container: container.id,
        });
      }
      
      if (infoRes?.success && infoRes.data) {
        const info = infoRes.data;
        // Extract ports from various possible locations in the response
        let extractedPorts = 
          info.NetworkSettings?.Ports || 
          info.networkSettings?.Ports || 
          info.NetworkSettings?.ports ||
          info.networkSettings?.ports ||
          info.Ports ||
          info.ports ||
          info.HostConfig?.PortBindings ||
          info.hostConfig?.PortBindings ||
          null;
        
        if (extractedPorts && typeof extractedPorts === 'object') {
          // Convert port mapping object to array
          const portArray: any[] = [];
          Object.entries(extractedPorts).forEach(([containerPort, hostPorts]: [string, any]) => {
            if (!hostPorts) return;
            
            // Handle array of port bindings
            if (Array.isArray(hostPorts)) {
              hostPorts.forEach((hp: any) => {
                if (hp) {
                  // HostIp is the IP address, HostPort is the port number - don't mix them
                  const hostIp = hp.HostIp || hp.hostIp || null;
                  const hostPort = hp.HostPort || hp.hostPort || '';
                  portArray.push({
                    container: containerPort.split('/')[0],
                    host: hostIp, // Store only the IP address (or null if not available)
                    hostPort: hostPort,
                    protocol: containerPort.split('/')[1] || 'tcp',
                    fullContainerPort: containerPort,
                  });
                }
              });
            } 
            // Handle single port binding object
            else if (typeof hostPorts === 'object') {
              // HostIp is the IP address, HostPort is the port number - don't mix them
              const hostIp = hostPorts.HostIp || hostPorts.hostIp || null;
              const hostPort = hostPorts.HostPort || hostPorts.hostPort || '';
              portArray.push({
                container: containerPort.split('/')[0],
                host: hostIp, // Store only the IP address (or null if not available)
                hostPort: hostPort,
                protocol: containerPort.split('/')[1] || 'tcp',
                fullContainerPort: containerPort,
              });
            }
            // Handle string format
            else if (typeof hostPorts === 'string') {
              portArray.push({
                container: containerPort.split('/')[0],
                host: hostPorts,
                protocol: containerPort.split('/')[1] || 'tcp',
                fullContainerPort: containerPort,
              });
            }
          });
          
          if (portArray.length > 0) {
            setPorts(portArray);
          } else {
            setPorts([]);
            setError('No exposed ports found in container configuration');
          }
        } else {
          // Try GetContainerPorts as last resort
          const portsRes = await client.read<any>("GetContainerPorts", {
            container: container.id,
          });
          
          if (portsRes?.success && portsRes.data) {
            const portsData = portsRes.data;
            if (Array.isArray(portsData)) {
              setPorts(portsData);
            } else if (portsData.ports) {
              setPorts(Array.isArray(portsData.ports) ? portsData.ports : [portsData.ports]);
            } else if (portsData.Ports) {
              setPorts(Array.isArray(portsData.Ports) ? portsData.Ports : [portsData.Ports]);
            } else {
              setPorts([]);
              setError('No exposed ports found');
            }
          } else {
            setPorts([]);
            setError('No exposed ports found');
          }
        }
      } else {
        setPorts([]);
        setError('Failed to fetch container information');
      }
    } catch (err) {
      console.warn('[ContainerPortsDialog] Failed to fetch ports:', err);
      setError('Failed to fetch port information');
      setPorts([]);
    } finally {
      setIsLoading(false);
    }
  };

  const copyPort = (port: string) => {
    navigator.clipboard.writeText(port);
    setCopiedPort(port);
    setTimeout(() => setCopiedPort(null), 2000);
  };

  const formatPort = (port: any): string => {
    if (typeof port === 'string') return port;
    if (port.host && port.container) {
      return `${port.host}:${port.container.split('/')[0]}`;
    }
    if (port.HostPort && port.ContainerPort) {
      return `${port.HostPort}:${port.ContainerPort}`;
    }
    return JSON.stringify(port);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] border-2 border-foreground p-0 gap-0">
        <DialogHeader className="border-b-2 border-foreground pb-3 px-6 pt-6">
          <div className="flex items-center gap-3">
            <div className="p-2 border-2 border-foreground bg-secondary rounded-sm">
              <Network className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="font-mono font-bold text-lg">
                Exposed Ports - {container.name}
              </DialogTitle>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          <div className="px-6 py-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : error ? (
              <div className="flex items-center justify-center py-12">
                <p className="font-mono text-sm text-destructive">{error}</p>
              </div>
            ) : ports.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <p className="font-mono text-sm text-muted-foreground">
                  No exposed ports found
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {ports.map((port, index) => {
                  const protocol = port.protocol || port.Protocol || (port.fullContainerPort ? port.fullContainerPort.split('/')[1] : 'tcp') || 'tcp';
                  const containerPort = port.container || port.ContainerPort || port.containerPort || (port.fullContainerPort ? port.fullContainerPort.split('/')[0] : 'N/A');
                  const hostPort = port.hostPort || port.HostPort || (typeof port.host === 'string' && port.host.includes(':') ? port.host.split(':')[1] : null) || 'N/A';
                  
                  // Determine host IP: prioritize serverAddress, then port.host (if it's an IP), otherwise 0.0.0.0
                  let hostIp = '0.0.0.0';
                  if (serverAddress) {
                    hostIp = serverAddress;
                  } else if (port.host && typeof port.host === 'string') {
                    // Check if port.host is an IP address (not a port number)
                    const isIpAddress = /^(\d{1,3}\.){3}\d{1,3}$/.test(port.host) || port.host.includes(':');
                    if (isIpAddress && port.host !== '0.0.0.0' && !port.host.match(/^\d+$/)) {
                      // Extract IP if it's in format "IP:PORT"
                      hostIp = port.host.includes(':') ? port.host.split(':')[0] : port.host;
                    }
                  }
                  
                  const portStr = `${hostIp}:${hostPort} → ${containerPort}/${protocol}`;
                  
                  return (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 border-2 border-foreground bg-background rounded-sm"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <Network className="w-4 h-4 text-chart-1 flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-sm font-medium">
                              {hostPort !== 'N/A' ? `${hostIp}:${hostPort}` : 'N/A'} → {containerPort}
                            </span>
                            <Badge variant="outline" className="font-mono text-[10px]">
                              {protocol.toUpperCase()}
                            </Badge>
                          </div>
                          <p className="font-mono text-xs text-muted-foreground mt-1">
                            Host: {hostIp}:{hostPort} | Container: {containerPort}/{protocol}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => copyPort(portStr)}
                        className="ml-2 p-2 hover:bg-secondary rounded-sm transition-colors"
                        title="Copy port mapping"
                      >
                        {copiedPort === portStr ? (
                          <Check className="h-4 w-4 text-chart-2" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

