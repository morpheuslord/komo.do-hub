import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/components/ThemeProvider';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Server,
  Layers,
  Box,
  Hammer,
  GitBranch,
  LogOut,
  RefreshCw,
  Play,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Square
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
import { ServerDetailPanel } from '@/components/ServerDetailPanel';
import { ContainerDetailPanel } from '@/components/ContainerDetailPanel';
import { StackDetailCard } from '@/components/StackDetailCard';
import { SettingsSheet } from '@/components/SettingsSheet';

type ResourceType = 'stacks' | 'deployments' | 'servers' | 'builds' | 'repos';

interface ExtendedStackItem extends StackListItem {
  containers?: Array<{ id: string; name: string; state?: string }>;
  serverName?: string;
}

interface ContainerItem {
  id: string;
  name: string;
  state?: string;
  serverName?: string;
  serverId?: string;
  stats?: string;
  image?: string;
  deploymentId?: string;
}

interface ResourceState {
  stacks: ExtendedStackItem[];
  deployments: ContainerItem[];
  servers: ServerListItem[];
  builds: BuildListItem[];
  repos: RepoListItem[];
  containersByServer: Record<string, ContainerItem[]>;
  deploymentMap: Record<string, string>; // container name -> deployment id
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
  const { isDark, setTheme } = useTheme();
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
    containersByServer: {},
    deploymentMap: {},
  });

  // Dummy data for bypass/dev mode
  const dummyData: ResourceState = {
    stacks: [
      { id: 'stack-1', name: 'production-web', state: 'running', tags: ['v1.2.3', 'stable'], containers: [{ id: 'c1', name: 'nginx', state: 'running' }, { id: 'c2', name: 'api', state: 'running' }], serverName: 'prod-node-01' },
      { id: 'stack-2', name: 'staging-api', state: 'running', tags: ['v2.0.0-beta'], containers: [{ id: 'c3', name: 'redis', state: 'running' }], serverName: 'staging-node-01' },
      { id: 'stack-3', name: 'dev-microservices', state: 'stopped', tags: ['dev'], containers: [], serverName: 'staging-node-01' },
    ],
    deployments: [
      { id: 'deploy-1', name: 'nginx-proxy', state: 'running', serverName: 'prod-node-01', stats: 'Up 3 days', image: 'nginx:latest', deploymentId: 'deploy-1' },
      { id: 'deploy-2', name: 'postgres-db', state: 'running', serverName: 'prod-node-01', stats: 'Up 3 days', image: 'postgres:15', deploymentId: 'deploy-2' },
      { id: 'deploy-3', name: 'redis-cache', state: 'running', serverName: 'prod-node-02', stats: 'Up 1 day', image: 'redis:alpine', deploymentId: 'deploy-3' },
      { id: 'deploy-4', name: 'api-gateway', state: 'pending', serverName: 'staging-node-01', stats: 'Starting...', image: 'api:v2', deploymentId: 'deploy-4' },
      { id: 'deploy-5', name: 'worker-queue', state: 'stopped', serverName: 'staging-node-01', stats: 'Exited (0)', image: 'worker:latest', deploymentId: 'deploy-5' },
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
    containersByServer: {
      'server-1': [
        { id: 'c1', name: 'nginx-proxy', state: 'running', serverName: 'prod-node-01' },
        { id: 'c2', name: 'postgres-db', state: 'running', serverName: 'prod-node-01' },
      ],
      'server-2': [
        { id: 'c3', name: 'redis-cache', state: 'running', serverName: 'prod-node-02' },
      ],
      'server-3': [
        { id: 'c4', name: 'api-gateway', state: 'pending', serverName: 'staging-node-01' },
        { id: 'c5', name: 'worker-queue', state: 'stopped', serverName: 'staging-node-01' },
      ],
    },
    deploymentMap: {},
  };

  const isBypassMode = localStorage.getItem('komodo_bypass') === 'true';

  const fetchResources = useCallback(async (showRefresh = false) => {
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
      const deploymentsList: DeploymentListItem[] = deploymentsRes.data ?? [];
      
      // Create deployment name -> id mapping
      const deploymentMap: Record<string, string> = {};
      deploymentsList.forEach((d) => {
        if (d.name && d.id) {
          deploymentMap[d.name.toLowerCase()] = d.id;
        }
      });

      // 2) For each server, fetch runtime state and docker containers
      const containersByServer: Record<string, ContainerItem[]> = {};
      
      const perServerPromises = serversList.map(async (srv) => {
        let runtimeState: string | undefined = srv.state ?? srv.status;
        let containers: ContainerItem[] = [];

        try {
          const stateRes = await client.read<any>('GetServerState', { server: srv.id }).catch(() =>
            client.read<any>('GetServer', { server: srv.id }).catch(() => ({ success: false, data: undefined }))
          );

          if (stateRes?.success && 'data' in stateRes && stateRes.data) {
            runtimeState =
              stateRes.data?.health ?? stateRes.data?.status ?? stateRes.data?.state ?? runtimeState;
          }
        } catch {
          // ignore
        }

        // Fetch system stats
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
        } catch {
          // ignore
        }

        try {
          const listContainersRes = await client.read<any[]>('ListDockerContainers', {
            server: srv.id,
          }).catch(() => ({ success: false, data: undefined }));

          const containerItems = ('data' in listContainersRes && listContainersRes.data) ? listContainersRes.data : [];

          containers = (containerItems || []).map((c: any) => {
            const id = c?.Id ?? c?.id ?? c?.container_id ?? '';
            let rawName =
              (Array.isArray(c?.Names) && c.Names[0]) ||
              c?.Name ||
              c?.name ||
              c?.Names?.[0] ||
              '';
            const name = rawName.replace(/^\//, '') || c?.Image?.split(':')[0] || id.slice(0, 12);
            const state = c?.State ?? c?.Status ?? c?.state ?? 'unknown';
            const stats = c?.Status ?? c?.status ?? '';
            const image = c?.Image ?? c?.image ?? '';
            
            // Find matching deployment ID by name
            const deploymentId = deploymentMap[name.toLowerCase()];
            
            return { 
              id, 
              name, 
              state, 
              serverName: srv.name, 
              serverId: srv.id, 
              stats,
              image,
              deploymentId 
            };
          });
          
          containersByServer[srv.id] = containers;
        } catch {
          // ignore
        }

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

      const updatedServers = perServerResults.map((r) => r.server);
      const allContainersFlat = perServerResults.flatMap((r) =>
        (r.containers || []).map((c) => ({
          ...c,
        }))
      );

      // Create server name lookup
      const serverNameById: Record<string, string> = {};
      updatedServers.forEach((s) => {
        serverNameById[s.id] = s.name;
      });

      // Enhance stacks with container info and server name
      const stacksList = stacksRes.data || [];
      const enhancedStacks: ExtendedStackItem[] = stacksList.map((stack) => {
        // Find containers that might belong to this stack (by name prefix matching)
        const stackContainers = allContainersFlat.filter((c) => 
          c.name.toLowerCase().includes(stack.name.toLowerCase().replace(/-/g, '_')) ||
          c.name.toLowerCase().includes(stack.name.toLowerCase())
        );
        
        const serverName = stack.server_id ? serverNameById[stack.server_id] : 
          (stackContainers.length > 0 ? stackContainers[0].serverName : undefined);
        
        return {
          ...stack,
          containers: stackContainers.map((c) => ({ id: c.id, name: c.name, state: c.state })),
          serverName,
        };
      });

      setResources({
        stacks: enhancedStacks,
        deployments: allContainersFlat.length > 0
          ? allContainersFlat
          : (deploymentsList as unknown as ContainerItem[]),
        servers: updatedServers,
        builds: buildsRes.data || [],
        repos: reposRes.data || [],
        containersByServer,
        deploymentMap,
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
  }, [client, isBypassMode, toast]);

  useEffect(() => {
    fetchResources();
  }, [fetchResources]);

  const handleAction = async (action: string, resourceType: string, resourceId: string, resourceName: string) => {
    if (!client) return;

    setActionLoading(`${action}-${resourceId}`);

    try {
      let result;
      
      // For container actions, we need to use deployment parameter
      const isContainerAction = ['start', 'stop', 'restart'].includes(action) && 
        (resourceType === 'deployments' || resourceType.toLowerCase().includes('container'));
      
      const params = isContainerAction 
        ? { deployment: resourceId }
        : { [resourceType.toLowerCase().replace(/s$/, '')]: resourceId };

      switch (action) {
        case 'deploy':
          result = await client.execute('DeployStack', { stack: resourceId });
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

  const handleContainerAction = async (action: string, containerId: string, containerName: string) => {
    if (!client) return;

    const container = resources.deployments.find((c) => c.id === containerId);
    const serverId = container?.serverId;
    const dockerContainerName = container?.name || containerName;

    if (!serverId) {
      toast({
        title: 'Action Failed',
        description: 'Missing server id for this container. Refresh and try again.',
        variant: 'destructive',
      });
      return;
    }

    setActionLoading(`${action}-${containerId}`);

    try {
      let result;
      const params = { server: serverId, container: dockerContainerName };

      switch (action) {
        case 'start':
          result = await client.execute('StartContainer', params);
          break;
        case 'stop':
          result = await client.execute('StopContainer', params);
          break;
        case 'restart':
          result = await client.execute('RestartContainer', params);
          break;
        default:
          return;
      }

      const serverError = (result as any)?.data?.error;

      if (result?.success && !serverError) {
        toast({
          title: 'Action Started',
          description: `${action} on ${dockerContainerName} initiated`,
        });
        setTimeout(() => fetchResources(true), 1500);
      } else {
        toast({
          title: 'Action Failed',
          description: serverError || result?.error || 'Unknown error',
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

  const handleRefreshServer = useCallback((serverId: string) => {
    // In a real implementation, this would fetch just that server's data
    // For now, we trigger a full refresh
    fetchResources(true);
  }, [fetchResources]);

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
      actions: [],
    },
    servers: {
      icon: <Server className="w-4 h-4" />,
      label: 'Servers',
      resourceIcon: <Server className="w-5 h-5" />,
      actions: [],
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
            <SettingsSheet
              isDarkMode={isDark}
              onThemeChange={(dark) => setTheme(dark ? 'dark' : 'light')}
            />
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
      <main className="flex-1 p-4 flex flex-col min-h-0">
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as ResourceType)}
          className="flex flex-col flex-1 min-h-0"
        >
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

          {/* Stacks Tab */}
          <TabsContent value="stacks" className="mt-4 flex-1 min-h-0">
            <ScrollArea className="h-full">
              <div className="space-y-3 pr-2">
                {resources.stacks.length === 0 ? (
                  <Card className="border-2 border-dashed border-muted-foreground">
                    <CardContent className="p-8 text-center">
                      <div className="mx-auto w-12 h-12 border-2 border-muted-foreground flex items-center justify-center mb-4">
                        <Layers className="w-5 h-5" />
                      </div>
                      <p className="font-mono text-sm text-muted-foreground">
                        No stacks found
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  resources.stacks.map((stack) => (
                    <StackDetailCard
                      key={stack.id}
                      stack={stack}
                      serverName={stack.serverName}
                      containers={stack.containers || []}
                      onAction={(action, id, name) => handleAction(action, 'stacks', id, name)}
                      actionLoading={actionLoading}
                    />
                  ))
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Containers Tab */}
          <TabsContent value="deployments" className="mt-4 flex-1 min-h-0">
            <ScrollArea className="h-full">
              <div className="space-y-3 pr-2">
                {resources.deployments.length === 0 ? (
                  <Card className="border-2 border-dashed border-muted-foreground">
                    <CardContent className="p-8 text-center">
                      <div className="mx-auto w-12 h-12 border-2 border-muted-foreground flex items-center justify-center mb-4">
                        <Box className="w-5 h-5" />
                      </div>
                      <p className="font-mono text-sm text-muted-foreground">
                        No containers found
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  resources.deployments.map((container) => (
                    <ContainerDetailPanel
                      key={container.id}
                      container={container}
                      onAction={handleContainerAction}
                      actionLoading={actionLoading}
                    />
                  ))
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Servers Tab */}
          <TabsContent value="servers" className="mt-4 flex-1 min-h-0">
            <ScrollArea className="h-full">
              <div className="space-y-3 pr-2">
                {resources.servers.length === 0 ? (
                  <Card className="border-2 border-dashed border-muted-foreground">
                    <CardContent className="p-8 text-center">
                      <div className="mx-auto w-12 h-12 border-2 border-muted-foreground flex items-center justify-center mb-4">
                        <Server className="w-5 h-5" />
                      </div>
                      <p className="font-mono text-sm text-muted-foreground">
                        No servers found
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  resources.servers.map((server) => (
                    <ServerDetailPanel
                      key={server.id}
                      server={server}
                      containers={resources.containersByServer[server.id] || []}
                      onAction={(action, id, name) => handleAction(action, 'servers', id, name)}
                      actionLoading={actionLoading}
                      onRefreshServer={handleRefreshServer}
                    />
                  ))
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Builds Tab */}
          <TabsContent value="builds" className="mt-4 flex-1 min-h-0">
            <ScrollArea className="h-full">
              <div className="space-y-3 pr-2">
                {resources.builds.length === 0 ? (
                  <Card className="border-2 border-dashed border-muted-foreground">
                    <CardContent className="p-8 text-center">
                      <div className="mx-auto w-12 h-12 border-2 border-muted-foreground flex items-center justify-center mb-4">
                        <Hammer className="w-5 h-5" />
                      </div>
                      <p className="font-mono text-sm text-muted-foreground">
                        No builds found
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  resources.builds.map((build) =>
                    renderResourceCard(
                      build,
                      'builds',
                      tabConfig.builds.resourceIcon,
                      tabConfig.builds.actions
                    )
                  )
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Repos Tab */}
          <TabsContent value="repos" className="mt-4 flex-1 min-h-0">
            <ScrollArea className="h-full">
              <div className="space-y-3 pr-2">
                {resources.repos.length === 0 ? (
                  <Card className="border-2 border-dashed border-muted-foreground">
                    <CardContent className="p-8 text-center">
                      <div className="mx-auto w-12 h-12 border-2 border-muted-foreground flex items-center justify-center mb-4">
                        <GitBranch className="w-5 h-5" />
                      </div>
                      <p className="font-mono text-sm text-muted-foreground">
                        No repos found
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  resources.repos.map((repo) =>
                    renderResourceCard(
                      repo,
                      'repos',
                      tabConfig.repos.resourceIcon,
                      tabConfig.repos.actions
                    )
                  )
                )}
              </div>
            </ScrollArea>
          </TabsContent>
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
        </div>
      </footer>
    </div>
  );
}
