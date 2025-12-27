import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Server,
  Layers,
  Box,
  Hammer,
  GitBranch,
  Settings,
  LogOut,
  RefreshCw,
  Play,
  Square,
  RotateCcw,
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  Cpu,
  HardDrive,
  Trash2,
  Pause
} from 'lucide-react';
import type {
  StackListItem,
  DeploymentListItem,
  ServerListItem,
  BuildListItem,
  RepoListItem
} from '@/lib/komodo-api';
import { useToast } from '@/hooks/use-toast';
import komodoLogo from '@/assets/komodo-logo.png';

type ResourceType = 'stacks' | 'deployments' | 'servers' | 'builds' | 'repos';

interface ResourceState {
  stacks: StackListItem[];
  deployments: DeploymentListItem[]; // we'll use this to show containers (runtime) as well
  servers: ServerListItem[];
  builds: BuildListItem[];
  repos: RepoListItem[];
}

function getStatusIcon(state?: string) {
  switch (state?.toLowerCase()) {
    case 'running':
    case 'ok':
    case 'healthy':
      return <CheckCircle2 className="w-4 h-4 text-chart-2" />;
    case 'stopped':
    case 'exited':
      return <Square className="w-4 h-4 text-muted-foreground" />;
    case 'error':
    case 'failed':
    case 'unhealthy':
      return <AlertCircle className="w-4 h-4 text-destructive" />;
    case 'pending':
    case 'building':
    case 'deploying':
      return <Clock className="w-4 h-4 text-chart-4" />;
    default:
      return <Clock className="w-4 h-4 text-muted-foreground" />;
  }
}

function getStatusVariant(state?: string): "default" | "secondary" | "destructive" | "outline" {
  switch (state?.toLowerCase()) {
    case 'running':
    case 'ok':
    case 'healthy':
      return 'default';
    case 'error':
    case 'failed':
    case 'unhealthy':
      return 'destructive';
    default:
      return 'secondary';
  }
}

export default function Dashboard() {
  const { client, credentials, logout } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<ResourceType>('stacks');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [resources, setResources] = useState<ResourceState>({
    stacks: [],
    deployments: [],
    servers: [],
    builds: [],
    repos: [],
  });

  // Extended container type with server affiliation and stats
  interface ContainerItem {
    id: string;
    name: string;
    state?: string;
    serverName?: string;
    serverId?: string;
    stats?: string; // e.g. "Up 2 hours" or CPU/memory
  }

  // Dummy data for bypass/dev mode
  const dummyData: ResourceState = {
    stacks: [
      { id: 'stack-1', name: 'production-web', state: 'running', tags: ['v1.2.3', 'stable'] },
      { id: 'stack-2', name: 'staging-api', state: 'running', tags: ['v2.0.0-beta'] },
      { id: 'stack-3', name: 'dev-microservices', state: 'stopped', tags: ['dev'] },
    ],
    deployments: [
      { id: 'deploy-1', name: 'nginx-proxy', state: 'running', serverName: 'prod-node-01', stats: 'Up 3 days' },
      { id: 'deploy-2', name: 'postgres-db', state: 'running', serverName: 'prod-node-01', stats: 'Up 3 days' },
      { id: 'deploy-3', name: 'redis-cache', state: 'running', serverName: 'prod-node-02', stats: 'Up 1 day' },
      { id: 'deploy-4', name: 'api-gateway', state: 'pending', serverName: 'staging-node-01', stats: 'Starting...' },
      { id: 'deploy-5', name: 'worker-queue', state: 'stopped', serverName: 'staging-node-01', stats: 'Exited (0)' },
    ],
    servers: [
      { id: 'server-1', name: 'prod-node-01', state: 'healthy', address: '192.168.1.10', cpu_perc: 45.2, mem_used_gb: 12.4, mem_total_gb: 32, disk_used_gb: 180, disk_total_gb: 500 },
      { id: 'server-2', name: 'prod-node-02', state: 'healthy', address: '192.168.1.11', cpu_perc: 28.7, mem_used_gb: 8.2, mem_total_gb: 32, disk_used_gb: 95, disk_total_gb: 500 },
      { id: 'server-3', name: 'staging-node-01', state: 'unhealthy', address: '192.168.1.20', cpu_perc: 92.1, mem_used_gb: 30.8, mem_total_gb: 32, disk_used_gb: 480, disk_total_gb: 500 },
    ],
    builds: [
      { id: 'build-1', name: 'frontend-app', state: 'ok' },
      { id: 'build-2', name: 'backend-api', state: 'building' },
      { id: 'build-3', name: 'worker-service', state: 'failed' },
    ],
    repos: [
      { id: 'repo-1', name: 'main-monorepo', state: 'ok' },
      { id: 'repo-2', name: 'infra-config', state: 'ok' },
    ],
  };

  const isBypassMode = localStorage.getItem('komodo_bypass') === 'true';

  /**
   * fetchResources:
   * - ListServers
   * - For each server: call GetServerState (or GetServer) to retrieve health state
   * - For each server: call ListDockerContainers to list running containers; combine into deployments array
   *
   * Notes:
   * - `ListDockerContainers` and `GetServerState` are read operations present in the Komodo client API (docs).
   * - We convert container objects to a minimal shape that the UI expects: { id, name, state }.
   *
   * See Komodo client docs for available read types: GetServerState / ListDockerContainers. :contentReference[oaicite:1]{index=1}
   */
  const fetchResources = async (showRefresh = false) => {
    if (isBypassMode) {
      if (showRefresh) setIsRefreshing(true);
      else setIsLoading(true);

      setTimeout(() => {
        setResources(dummyData);
        setIsLoading(false);
        setIsRefreshing(false);
      }, 500);
      return;
    }

    if (!client) return;
    if (showRefresh) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      // 1) List stacks, deployments (definitions), servers, builds, repos
      const [stacksRes, deploymentsRes, serversRes, buildsRes, reposRes] = await Promise.all([
        client.read<StackListItem[]>('ListStacks', {}),
        client.read<DeploymentListItem[]>('ListDeployments', {}),
        client.read<ServerListItem[]>('ListServers', {}),
        client.read<BuildListItem[]>('ListBuilds', {}),
        client.read<RepoListItem[]>('ListRepos', {}),
      ]);

      const serversList: ServerListItem[] = serversRes.data ?? [];

      // 2) For each server, fetch runtime state and docker containers.
      //    We parallelize but keep it bounded if you have many servers (here simple Promise.all).
      const perServerPromises = serversList.map(async (srv) => {
        // default values
        let runtimeState: string | undefined = srv.state ?? srv.status;
        let containers: ContainerItem[] = [];

        try {
          // Get server state (GetServerState / GetServer)
          // some komodo versions may return `GetServer` or `GetServerState` — both are listed in docs.
          const stateRes = await client.read<any>('GetServerState', { server: srv.id }).catch(() =>
            client.read<any>('GetServer', { server: srv.id }).catch(() => ({ success: false, data: undefined }))
          );

          if (stateRes?.success && 'data' in stateRes && stateRes.data) {
            // pick common fields if present
            runtimeState =
              stateRes.data?.health ?? stateRes.data?.status ?? stateRes.data?.state ?? runtimeState;
          }
        } catch (err) {
          // ignore and leave runtimeState as-is
        }

        // Fetch system stats (CPU, memory, disk)
        let cpu_perc: number | undefined;
        let mem_used_gb: number | undefined;
        let mem_total_gb: number | undefined;
        let disk_used_gb: number | undefined;
        let disk_total_gb: number | undefined;

        try {
          const statsRes = await client.read<any>('GetSystemStats', { server: srv.id }).catch(() => ({ success: false, data: undefined }));
          if (statsRes?.success && 'data' in statsRes && statsRes.data) {
            const stats = statsRes.data;
            cpu_perc = stats.cpu_perc ?? stats.cpu ?? stats.cpu_percent;
            mem_used_gb = stats.mem_used_gb ?? (stats.mem_used ? stats.mem_used / 1024 / 1024 / 1024 : undefined);
            mem_total_gb = stats.mem_total_gb ?? (stats.mem_total ? stats.mem_total / 1024 / 1024 / 1024 : undefined);
            disk_used_gb = stats.disk_used_gb ?? (stats.disk_used ? stats.disk_used / 1024 / 1024 / 1024 : undefined);
            disk_total_gb = stats.disk_total_gb ?? (stats.disk_total ? stats.disk_total / 1024 / 1024 / 1024 : undefined);
          }
        } catch (err) {
          // ignore stats fetch failure
        }

        try {
          // List running docker containers on that server
          // ListDockerContainers is a documented read op in the Komodo client API.
          const listContainersRes = await client.read<any[]>('ListDockerContainers', {
            server: srv.id,
          }).catch(() => ({ success: false, data: undefined }));

          const containerItems = ('data' in listContainersRes && listContainersRes.data) ? listContainersRes.data : [];

          containers = (containerItems || []).map((c: any) => {
            // c shape can vary; tolerate different keys:
            const id = c?.Id ?? c?.id ?? c?.container_id ?? '';
            // Extract clean container name (remove leading slash if present)
            let rawName =
              (Array.isArray(c?.Names) && c.Names[0]) ||
              c?.Name ||
              c?.name ||
              c?.Names?.[0] ||
              '';
            // Docker names often start with "/" - strip it
            const name = rawName.replace(/^\//, '') || c?.Image?.split(':')[0] || id.slice(0, 12);
            const state = c?.State ?? c?.Status ?? c?.state ?? 'unknown';
            // Extract uptime/stats from Status field (e.g., "Up 3 hours")
            const stats = c?.Status ?? c?.status ?? '';
            return { id, name, state, serverName: srv.name, serverId: srv.id, stats };
          });
        } catch (err) {
          // ignore per-server container failures
        }

        // return augmented server info + containers + stats
        return {
          server: {
            ...srv,
            state: runtimeState,
            cpu_perc,
            mem_used_gb,
            mem_total_gb,
            disk_used_gb,
            disk_total_gb,
          },
          containers,
        };
      });

      const perServerResults = await Promise.all(perServerPromises);

      // Compose final arrays:
      const updatedServers = perServerResults.map((r) => r.server);
      // Flatten containers from all servers into deployments (so the "Containers" tab shows them)
      const allContainersFlat = perServerResults.flatMap((r) =>
        (r.containers || []).map((c) => ({
          id: c.id,
          name: c.name,
          state: c.state,
          serverName: c.serverName,
          serverId: c.serverId,
          stats: c.stats,
        }))
      );

      setResources({
        stacks: stacksRes.data || [],
        // keep deployment definitions (ListDeployments) AND also show runtime containers in the "deployments" tab
        // You can combine both or prefer runtime containers; here we show containers if any exist, otherwise the definitions.
        deployments: allContainersFlat.length > 0
          ? (allContainersFlat as unknown as DeploymentListItem[])
          : (deploymentsRes.data || []),
        servers: updatedServers,
        builds: buildsRes.data || [],
        repos: reposRes.data || [],
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to fetch resources',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchResources();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client]);

  const handleAction = async (action: string, resourceType: string, resourceId: string, resourceName: string) => {
    if (!client) return;

    setActionLoading(`${action}-${resourceId}`);

    try {
      let result;
      const params = { [resourceType.toLowerCase().replace(/s$/, '')]: resourceId };

      switch (action) {
        case 'deploy':
          result = await client.execute('DeployStack', params);
          break;
        case 'start':
          result = await client.execute('StartDeployment', params);
          break;
        case 'stop':
          result = await client.execute('StopDeployment', params);
          break;
        case 'restart':
          result = await client.execute('RestartDeployment', params);
          break;
        case 'build':
          result = await client.execute('RunBuild', params);
          break;
        case 'clone':
          result = await client.execute('CloneRepo', params);
          break;
        case 'pull':
          result = await client.execute('PullRepo', params);
          break;
        // Server management actions
        case 'startAll':
          result = await client.execute('StartAllContainers', { server: resourceId });
          break;
        case 'stopAll':
          result = await client.execute('StopAllContainers', { server: resourceId });
          break;
        case 'restartAll':
          result = await client.execute('RestartAllContainers', { server: resourceId });
          break;
        case 'pauseAll':
          result = await client.execute('PauseAllContainers', { server: resourceId });
          break;
        case 'pruneSystem':
          result = await client.execute('PruneSystem', { server: resourceId });
          break;
        default:
          return;
      }

      if (result?.success) {
        toast({
          title: 'Action Started',
          description: `${action} on ${resourceName} initiated`,
        });
        setTimeout(() => fetchResources(true), 2000);
      } else {
        toast({
          title: 'Action Failed',
          description: result?.error || 'Unknown error',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to execute action',
        variant: 'destructive',
      });
    } finally {
      setActionLoading(null);
    }
  };

  // Render container card with: Primary=name, Secondary=stats, Tertiary=server
  const renderContainerCard = (
    container: { id: string; name: string; state?: string; serverName?: string; stats?: string },
    actions: { label: string; action: string; icon: React.ReactNode }[]
  ) => (
    <Card key={container.id} className="border-2 border-foreground shadow-xs hover:shadow-sm transition-shadow">
      <CardContent className="p-4">
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
          <div className="flex gap-1 flex-shrink-0">
            {actions.map((act) => (
              <Button
                key={act.action}
                variant="outline"
                size="icon"
                className="h-8 w-8 border-2"
                onClick={() => handleAction(act.action, 'deployments', container.id, container.name)}
                disabled={actionLoading === `${act.action}-${container.id}`}
                title={act.label}
              >
                {actionLoading === `${act.action}-${container.id}` ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  act.icon
                )}
              </Button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  // Render stack card with tags displayed
  const renderStackCard = (
    stack: { id: string; name: string; state?: string; tags?: string[] },
    actions: { label: string; action: string; icon: React.ReactNode }[]
  ) => (
    <Card key={stack.id} className="border-2 border-foreground shadow-xs hover:shadow-sm transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="p-2 border-2 border-foreground bg-secondary flex-shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-mono font-bold text-sm truncate">{stack.name}</h3>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {getStatusIcon(stack.state)}
                <Badge variant={getStatusVariant(stack.state)} className="font-mono text-xs uppercase">
                  {stack.state || 'unknown'}
                </Badge>
                {stack.tags && stack.tags.length > 0 && stack.tags.map((tag, idx) => (
                  <Badge key={idx} variant="outline" className="font-mono text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
          <div className="flex gap-1 flex-shrink-0">
            {actions.map((act) => (
              <Button
                key={act.action}
                variant="outline"
                size="icon"
                className="h-8 w-8 border-2"
                onClick={() => handleAction(act.action, 'stacks', stack.id, stack.name)}
                disabled={actionLoading === `${act.action}-${stack.id}`}
                title={act.label}
              >
                {actionLoading === `${act.action}-${stack.id}` ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  act.icon
                )}
              </Button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const renderResourceCard = (
    resource: { id: string; name: string; state?: string; status?: string },
    type: ResourceType,
    icon: React.ReactNode,
    actions: { label: string; action: string; icon: React.ReactNode }[]
  ) => (
    <Card key={resource.id} className="border-2 border-foreground shadow-xs hover:shadow-sm transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="p-2 border-2 border-foreground bg-secondary flex-shrink-0">
              {icon}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-mono font-bold text-sm truncate">{resource.name}</h3>
              <div className="flex items-center gap-2 mt-1">
                {getStatusIcon(resource.state || resource.status)}
                <Badge variant={getStatusVariant(resource.state || resource.status)} className="font-mono text-xs uppercase">
                  {resource.state || resource.status || 'unknown'}
                </Badge>
              </div>
            </div>
          </div>
          <div className="flex gap-1 flex-shrink-0">
            {actions.map((act) => (
              <Button
                key={act.action}
                variant="outline"
                size="icon"
                className="h-8 w-8 border-2"
                onClick={() => handleAction(act.action, type, resource.id, resource.name)}
                disabled={actionLoading === `${act.action}-${resource.id}`}
                title={act.label}
              >
                {actionLoading === `${act.action}-${resource.id}` ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  act.icon
                )}
              </Button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  // Render server card with stats and management controls
  const renderServerCard = (
    server: ServerListItem,
    actions: { label: string; action: string; icon: React.ReactNode }[]
  ) => {
    const cpuPercent = server.cpu_perc ?? 0;
    const memUsed = server.mem_used_gb ?? 0;
    const memTotal = server.mem_total_gb ?? 1;
    const diskUsed = server.disk_used_gb ?? 0;
    const diskTotal = server.disk_total_gb ?? 1;
    const memPercent = memTotal > 0 ? (memUsed / memTotal) * 100 : 0;
    const diskPercent = diskTotal > 0 ? (diskUsed / diskTotal) * 100 : 0;

    return (
      <Card key={server.id} className="border-2 border-foreground shadow-xs hover:shadow-sm transition-shadow">
        <CardContent className="p-4">
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
                <div className="flex items-center gap-2 mt-1">
                  {getStatusIcon(server.state)}
                  <Badge variant={getStatusVariant(server.state)} className="font-mono text-xs uppercase">
                    {server.state || 'unknown'}
                  </Badge>
                </div>
              </div>
            </div>
            <div className="flex gap-1 flex-shrink-0">
              {actions.map((act) => (
                <Button
                  key={act.action}
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 border-2"
                  onClick={() => handleAction(act.action, 'servers', server.id, server.name)}
                  disabled={actionLoading === `${act.action}-${server.id}`}
                  title={act.label}
                >
                  {actionLoading === `${act.action}-${server.id}` ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    act.icon
                  )}
                </Button>
              ))}
            </div>
          </div>
          
          {/* Stats Section */}
          <div className="mt-4 space-y-2">
            {/* CPU */}
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <div className="flex-1">
                <div className="flex justify-between text-xs font-mono mb-1">
                  <span>CPU</span>
                  <span>{cpuPercent.toFixed(1)}%</span>
                </div>
                <div className="h-2 bg-secondary border border-foreground">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${Math.min(cpuPercent, 100)}%` }}
                  />
                </div>
              </div>
            </div>
            
            {/* Memory */}
            <div className="flex items-center gap-2">
              <Box className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <div className="flex-1">
                <div className="flex justify-between text-xs font-mono mb-1">
                  <span>RAM</span>
                  <span>{memUsed.toFixed(1)} / {memTotal.toFixed(1)} GB</span>
                </div>
                <div className="h-2 bg-secondary border border-foreground">
                  <div
                    className="h-full bg-chart-2 transition-all"
                    style={{ width: `${Math.min(memPercent, 100)}%` }}
                  />
                </div>
              </div>
            </div>
            
            {/* Disk */}
            <div className="flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <div className="flex-1">
                <div className="flex justify-between text-xs font-mono mb-1">
                  <span>Disk</span>
                  <span>{diskUsed.toFixed(1)} / {diskTotal.toFixed(1)} GB</span>
                </div>
                <div className="h-2 bg-secondary border border-foreground">
                  <div
                    className="h-full bg-chart-4 transition-all"
                    style={{ width: `${Math.min(diskPercent, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const tabConfig = {
    stacks: {
      icon: <Layers className="w-4 h-4" />,
      label: 'Stacks',
      resourceIcon: <Layers className="w-5 h-5" />,
      actions: [{ label: 'Deploy', action: 'deploy', icon: <Play className="h-4 w-4" /> }],
    },
    deployments: {
      icon: <Box className="w-4 h-4" />,
      label: 'Containers',
      resourceIcon: <Box className="w-5 h-5" />,
      actions: [
        { label: 'Start', action: 'start', icon: <Play className="h-4 w-4" /> },
        { label: 'Stop', action: 'stop', icon: <Square className="h-4 w-4" /> },
        { label: 'Restart', action: 'restart', icon: <RotateCcw className="h-4 w-4" /> },
      ],
    },
    servers: {
      icon: <Server className="w-4 h-4" />,
      label: 'Servers',
      resourceIcon: <Server className="w-5 h-5" />,
      actions: [
        { label: 'Start All', action: 'startAll', icon: <Play className="h-4 w-4" /> },
        { label: 'Stop All', action: 'stopAll', icon: <Square className="h-4 w-4" /> },
        { label: 'Restart All', action: 'restartAll', icon: <RotateCcw className="h-4 w-4" /> },
        { label: 'Prune', action: 'pruneSystem', icon: <Trash2 className="h-4 w-4" /> },
      ],
    },
    builds: {
      icon: <Hammer className="w-4 h-4" />,
      label: 'Builds',
      resourceIcon: <Hammer className="w-5 h-5" />,
      actions: [{ label: 'Build', action: 'build', icon: <Play className="h-4 w-4" /> }],
    },
    repos: {
      icon: <GitBranch className="w-4 h-4" />,
      label: 'Repos',
      resourceIcon: <GitBranch className="w-5 h-5" />,
      actions: [
        { label: 'Clone', action: 'clone', icon: <Play className="h-4 w-4" /> },
        { label: 'Pull', action: 'pull', icon: <RefreshCw className="h-4 w-4" /> },
      ],
    },
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin" />
          <p className="font-mono text-sm">Loading resources...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b-2 border-foreground bg-card sticky top-0 z-10">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <img src={komodoLogo} alt="Komodo" className="w-10 h-10 object-contain" />
            <div>
              <h1 className="font-bold text-lg tracking-tight">KOMODO</h1>
              <p className="font-mono text-xs text-muted-foreground truncate max-w-[200px]">
                {(credentials as any)?.apiUrl ?? `${(credentials as any)?.protocol}://${(credentials as any)?.host}:${(credentials as any)?.port}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="border-2"
              onClick={() => fetchResources(true)}
              disabled={isRefreshing}
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="border-2"
              onClick={logout}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-4">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ResourceType)}>
          <TabsList className="w-full grid grid-cols-5 border-2 border-foreground h-auto p-0 bg-secondary">
            {(Object.keys(tabConfig) as ResourceType[]).map((key) => (
              <TabsTrigger
                    key={key}
                    value={key}
                    className="
                      group
                      flex flex-col items-center gap-1 py-3 font-mono text-xs
                      border-r-2 border-foreground last:border-r-0
                      data-[state=active]:bg-primary
                      data-[state=active]:text-primary-foreground
                    "
                  >
                {tabConfig[key].icon}
                <span className="hidden sm:inline">{tabConfig[key].label}</span>
                <Badge
                className="
                  text-[10px] px-1 py-0
                  border-foreground
                  group-data-[state=active]:bg-primary-foreground
                  group-data-[state=active]:text-primary
                  group-data-[state=active]:border-primary-foreground
                "
                variant="outline"
              >
                {resources[key].length}
              </Badge>
              </TabsTrigger>
            ))}
          </TabsList>

          {(Object.keys(tabConfig) as ResourceType[]).map((key) => (
            <TabsContent key={key} value={key} className="mt-4">
              <ScrollArea className="h-[calc(100vh-220px)]">
                <div className="space-y-3 pr-2">
                  {resources[key].length === 0 ? (
                    <Card className="border-2 border-dashed border-muted-foreground">
                      <CardContent className="p-8 text-center">
                        <div className="mx-auto w-12 h-12 border-2 border-muted-foreground flex items-center justify-center mb-4">
                          {tabConfig[key].resourceIcon}
                        </div>
                        <p className="font-mono text-sm text-muted-foreground">
                          No {tabConfig[key].label.toLowerCase()} found
                        </p>
                      </CardContent>
                    </Card>
                  ) : (
                    resources[key].map((resource: any) => {
                      if (key === 'stacks') {
                        return renderStackCard(resource, tabConfig[key].actions);
                      }
                      if (key === 'deployments') {
                        return renderContainerCard(resource, tabConfig[key].actions);
                      }
                      if (key === 'servers') {
                        return renderServerCard(resource, tabConfig[key].actions);
                      }
                      return renderResourceCard(
                        resource,
                        key,
                        tabConfig[key].resourceIcon,
                        tabConfig[key].actions
                      );
                    })
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          ))}
        </Tabs>
      </main>

      {/* Footer Stats */}
      <footer className="border-t-2 border-foreground bg-card p-3">
        <div className="flex justify-between items-center">
          <div className="flex gap-4 font-mono text-xs text-muted-foreground">
            <span>{resources.servers.length} servers</span>
            <span>{resources.stacks.length} stacks</span>
            <span>{resources.deployments.length} containers</span>
          </div>
          <Settings className="w-4 h-4 text-muted-foreground" />
        </div>
      </footer>
    </div>
  );
}
