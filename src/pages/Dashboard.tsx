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
  Loader2
} from 'lucide-react';
import type { 
  StackListItem, 
  DeploymentListItem, 
  ServerListItem, 
  BuildListItem,
  RepoListItem 
} from '@/lib/komodo-api';
import { useToast } from '@/hooks/use-toast';

type ResourceType = 'stacks' | 'deployments' | 'servers' | 'builds' | 'repos';

interface ResourceState {
  stacks: StackListItem[];
  deployments: DeploymentListItem[];
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

  const fetchResources = async (showRefresh = false) => {
    if (!client) return;
    
    if (showRefresh) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      const [stacksRes, deploymentsRes, serversRes, buildsRes, reposRes] = await Promise.all([
        client.read<StackListItem[]>('ListStacks', {}),
        client.read<DeploymentListItem[]>('ListDeployments', {}),
        client.read<ServerListItem[]>('ListServers', {}),
        client.read<BuildListItem[]>('ListBuilds', {}),
        client.read<RepoListItem[]>('ListRepos', {}),
      ]);

      setResources({
        stacks: stacksRes.data || [],
        deployments: deploymentsRes.data || [],
        servers: serversRes.data || [],
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
        default:
          return;
      }
      
      if (result.success) {
        toast({
          title: 'Action Started',
          description: `${action} on ${resourceName} initiated`,
        });
        setTimeout(() => fetchResources(true), 2000);
      } else {
        toast({
          title: 'Action Failed',
          description: result.error || 'Unknown error',
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
            <div className="p-2 border-2 border-foreground bg-primary">
              <Server className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-bold text-lg tracking-tight">KOMO.DO</h1>
              <p className="font-mono text-xs text-muted-foreground truncate max-w-[200px]">
                {credentials?.apiUrl}
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
                className="flex flex-col items-center gap-1 py-3 font-mono text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground border-r-2 border-foreground last:border-r-0"
              >
                {tabConfig[key].icon}
                <span className="hidden sm:inline">{tabConfig[key].label}</span>
                <Badge variant="outline" className="text-[10px] px-1 py-0">
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
                    resources[key].map((resource) =>
                      renderResourceCard(
                        resource,
                        key,
                        tabConfig[key].resourceIcon,
                        tabConfig[key].actions
                      )
                    )
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
