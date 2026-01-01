import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/components/ThemeProvider";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  Square,
} from "lucide-react";
import type {
  StackListItem,
  DeploymentListItem,
  ServerListItem,
  BuildListItem,
  RepoListItem,
} from "@/lib/komodo-api";
import { useToast } from "@/hooks/use-toast";
import komodoLogo from "@/assets/komodo-logo.png";
import { ServerDetailPanel } from "@/components/ServerDetailPanel";
import { ContainerDetailPanel } from "@/components/ContainerDetailPanel";
import { StackDetailCard } from "@/components/StackDetailCard";
import { SettingsSheet } from "@/components/SettingsSheet";

type ResourceType = "stacks" | "deployments" | "servers" | "builds" | "repos";

interface ExtendedStackItem extends StackListItem {
  containers?: Array<{ id: string; name: string; state?: string }>;
  serverName?: string;
  server_id?: string;
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
  labels?: Record<string, string>;
}

interface ResourceState {
  stacks: ExtendedStackItem[];
  deployments: ContainerItem[];
  servers: ServerListItem[];
  builds: BuildListItem[];
  repos: RepoListItem[];
  containersByServer: Record<string, ContainerItem[]>;
  deploymentMap: Record<string, string>;
}

function getStatusIcon(state?: string) {
  switch (state?.toLowerCase()) {
    case "running":
    case "ok":
    case "healthy":
      return <CheckCircle2 className="w-4 h-4 text-chart-2" />;
    case "stopped":
    case "exited":
      return <Square className="w-4 h-4 text-muted-foreground" />;
    case "error":
    case "failed":
    case "unhealthy":
      return <AlertCircle className="w-4 h-4 text-destructive" />;
    case "pending":
    case "building":
    case "deploying":
      return <Clock className="w-4 h-4 text-chart-4" />;
    default:
      return <Clock className="w-4 h-4 text-muted-foreground" />;
  }
}

function getStatusVariant(
  state?: string,
): "default" | "secondary" | "destructive" | "outline" {
  switch (state?.toLowerCase()) {
    case "running":
    case "ok":
    case "healthy":
      return "default";
    case "error":
    case "failed":
    case "unhealthy":
      return "destructive";
    default:
      return "secondary";
  }
}

export default function Dashboard() {
  const { client, credentials, logout } = useAuth();
  const { isDark, setTheme } = useTheme();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<ResourceType>("stacks");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const fetchingRef = useRef(false);
  const [resources, setResources] = useState<ResourceState>({
    stacks: [],
    deployments: [],
    servers: [],
    builds: [],
    repos: [],
    containersByServer: {},
    deploymentMap: {},
  });

  const isBypassMode = localStorage.getItem("komodo_bypass") === "true";

  const fetchResources = useCallback(
    async (showRefresh = false) => {
      // Prevent concurrent fetches
      if (fetchingRef.current) return;
      fetchingRef.current = true;

      if (isBypassMode) {
        if (showRefresh) setIsRefreshing(true);
        else setIsLoading(true);

        setTimeout(() => {
          setResources({
            stacks: [],
            deployments: [],
            servers: [],
            builds: [],
            repos: [],
            containersByServer: {},
            deploymentMap: {},
          });
          setIsLoading(false);
          setIsRefreshing(false);
          fetchingRef.current = false;
        }, 500);
        return;
      }

      if (!client) {
        fetchingRef.current = false;
        return;
      }

      if (showRefresh) setIsRefreshing(true);
      else setIsLoading(true);

      try {
        // 1) List stacks, deployments (definitions), servers, builds, repos
        const [stacksRes, deploymentsRes, serversRes, buildsRes, reposRes] =
          await Promise.all([
            client.read<StackListItem[]>("ListStacks", {}),
            client.read<DeploymentListItem[]>("ListDeployments", {}),
            client.read<ServerListItem[]>("ListServers", {}),
            client.read<BuildListItem[]>("ListBuilds", {}),
            client.read<RepoListItem[]>("ListRepos", {}),
          ]);

        const serversList: ServerListItem[] = serversRes.data ?? [];
        const deploymentsList: DeploymentListItem[] = deploymentsRes.data ?? [];
        const stacksList: StackListItem[] = stacksRes.data ?? [];

        // Create deployment name -> id mapping
        const deploymentMap: Record<string, string> = {};
        deploymentsList.forEach((d) => {
          if (d.name && d.id) {
            deploymentMap[d.name.toLowerCase()] = d.id;
          }
        });

        // Create server name lookup
        const serverNameById: Record<string, string> = {};
        serversList.forEach((s) => {
          serverNameById[s.id] = s.name;
        });

        // 2) For each stack, get its full config to find server_id
        const stackDetailsPromises = stacksList.map(async (stack) => {
          try {
            const stackRes = await client.read<any>("GetStack", {
              stack: stack.id,
            });
            if (stackRes?.success && stackRes.data) {
              const config = stackRes.data?.config || stackRes.data;
              return {
                ...stack,
                server_id: config?.server_id || stack.server_id,
              };
            }
          } catch {
            // ignore
          }
          return stack;
        });

        const stacksWithDetails = await Promise.all(stackDetailsPromises);

        // 3) For each server, fetch runtime state and docker containers
        const containersByServer: Record<string, ContainerItem[]> = {};

        const perServerPromises = serversList.map(async (srv) => {
          let runtimeState: string | undefined = srv.state ?? srv.status;
          let containers: ContainerItem[] = [];

          // Fetch system stats
          let cpu_perc: number | undefined;
          let mem_used_gb: number | undefined;
          let mem_total_gb: number | undefined;
          let disk_used_gb: number | undefined;
          let disk_total_gb: number | undefined;

          try {
            const statsRes = await client.read<any>("GetSystemStats", {
              server: srv.id,
            });
            if (statsRes?.success && statsRes.data) {
              const stats = statsRes.data;
              // Handle various API response formats
              cpu_perc =
                stats.cpu_perc ??
                stats.cpu ??
                stats.cpu_percent ??
                stats.cpu_usage;

              // Memory - can be in GB or bytes
              if (stats.mem_used_gb !== undefined) {
                mem_used_gb = stats.mem_used_gb;
              } else if (stats.mem_used !== undefined) {
                mem_used_gb = stats.mem_used / 1024 / 1024 / 1024;
              } else if (stats.memory_used !== undefined) {
                mem_used_gb = stats.memory_used / 1024 / 1024 / 1024;
              }

              if (stats.mem_total_gb !== undefined) {
                mem_total_gb = stats.mem_total_gb;
              } else if (stats.mem_total !== undefined) {
                mem_total_gb = stats.mem_total / 1024 / 1024 / 1024;
              } else if (stats.memory_total !== undefined) {
                mem_total_gb = stats.memory_total / 1024 / 1024 / 1024;
              }

              // Disk - handle various formats
              if (stats.disk_used_gb !== undefined) {
                disk_used_gb = stats.disk_used_gb;
              } else if (stats.disk_used !== undefined) {
                disk_used_gb = stats.disk_used / 1024 / 1024 / 1024;
              } else if (
                stats.disks &&
                Array.isArray(stats.disks) &&
                stats.disks.length > 0
              ) {
                // Sum all disks
                disk_used_gb = stats.disks.reduce(
                  (sum: number, d: any) =>
                    sum + (d.used_gb || d.used / 1024 / 1024 / 1024 || 0),
                  0,
                );
                disk_total_gb = stats.disks.reduce(
                  (sum: number, d: any) =>
                    sum + (d.total_gb || d.total / 1024 / 1024 / 1024 || 0),
                  0,
                );
              }

              if (disk_total_gb === undefined) {
                if (stats.disk_total_gb !== undefined) {
                  disk_total_gb = stats.disk_total_gb;
                } else if (stats.disk_total !== undefined) {
                  disk_total_gb = stats.disk_total / 1024 / 1024 / 1024;
                }
              }

              // Also check for server state in stats
              if (stats.status || stats.state || stats.health) {
                runtimeState =
                  stats.health ?? stats.status ?? stats.state ?? runtimeState;
              }
            }
          } catch {
            // ignore
          }

          try {
            const listContainersRes = await client.read<any[]>(
              "ListDockerContainers",
              {
                server: srv.id,
              },
            );

            const containerItems = listContainersRes?.data ?? [];

            // Fetch individual container stats for better accuracy if needed
            const enhancedContainerPromises = (containerItems || []).map(
              async (c: any) => {
                const id = c?.Id ?? c?.id ?? c?.container_id ?? "";
                let rawName =
                  (Array.isArray(c?.Names) && c.Names[0]) ||
                  c?.Name ||
                  c?.name ||
                  c?.Names?.[0] ||
                  "";
                const name =
                  rawName.replace(/^\//, "") ||
                  c?.Image?.split(":")[0] ||
                  id.slice(0, 12);
                const state = c?.State ?? c?.Status ?? c?.state ?? "unknown";
                const stats = c?.Status ?? c?.status ?? "";
                const image = c?.Image ?? c?.image ?? "";
                const labels = c?.Labels ?? c?.labels ?? {};
                const deploymentId = deploymentMap[name.toLowerCase()];

                return {
                  id,
                  name,
                  state,
                  serverName: srv.name,
                  serverId: srv.id,
                  stats,
                  image,
                  deploymentId,
                  labels,
                };
              },
            );

            containers = await Promise.all(enhancedContainerPromises);

            containersByServer[srv.id] = containers;
          } catch {
            containersByServer[srv.id] = [];
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
        const allContainersFlat = perServerResults.flatMap(
          (r) => r.containers || [],
        );

        // 4) Enhance stacks with container info using server_id from GetStack
        const enhancedStacks: ExtendedStackItem[] = stacksWithDetails.map(
          (stack) => {
            const stackServerId = stack.server_id;
            const stackNameLower = stack.name.toLowerCase();
            const stackNameNormalized = stackNameLower
              .replace(/-/g, "_")
              .replace(/_/g, "");

            // Get containers from the stack's server
            const serverContainers = stackServerId
              ? containersByServer[stackServerId] || []
              : allContainersFlat;

            // Find containers by Docker labels OR name pattern
            const stackContainers = serverContainers.filter((c) => {
              const labels = c.labels || {};

              // Check Docker Compose / Swarm labels
              const composeProject = (
                labels["com.docker.compose.project"] || ""
              ).toLowerCase();
              const stackNameLabel = (
                labels["com.docker.stack.namespace"] || ""
              ).toLowerCase();
              const komodoStack = (labels["komodo.stack"] || "").toLowerCase();

              // Exact label match
              if (
                composeProject === stackNameLower ||
                composeProject === stackNameNormalized
              )
                return true;
              if (
                stackNameLabel === stackNameLower ||
                stackNameLabel === stackNameNormalized
              )
                return true;
              if (
                komodoStack === stackNameLower ||
                komodoStack === stackNameNormalized
              )
                return true;

              // Name pattern matching (for containers without labels)
              const containerNameLower = c.name.toLowerCase();
              return (
                containerNameLower === stackNameLower ||
                containerNameLower.startsWith(stackNameLower + "_") ||
                containerNameLower.startsWith(stackNameLower + "-") ||
                containerNameLower.startsWith(stackNameNormalized + "_") ||
                containerNameLower.startsWith(stackNameNormalized + "-")
              );
            });

            const serverName = stackServerId
              ? serverNameById[stackServerId]
              : stackContainers.length > 0
                ? stackContainers[0].serverName
                : undefined;

            // Determine stack state based on containers
            const runningCount = stackContainers.filter((c) => {
              const state = c.state?.toLowerCase() || "";
              return ["running", "up", "healthy"].some((s) =>
                state.includes(s),
              );
            }).length;

            let derivedState = "stopped";
            if (stackContainers.length > 0) {
              if (runningCount === stackContainers.length)
                derivedState = "running";
              else if (runningCount > 0) derivedState = "partial";
              else derivedState = "stopped";
            } else if (stack.state && stack.state !== "unknown") {
              derivedState = stack.state;
            }

            return {
              ...stack,
              state: derivedState,
              containers: stackContainers.map((c) => ({
                id: c.id,
                name: c.name,
                state: c.state,
              })),
              serverName,
            };
          },
        );

        // Update state atomically
        setResources({
          stacks: enhancedStacks,
          deployments: allContainersFlat,
          servers: updatedServers,
          builds: buildsRes.data || [],
          repos: reposRes.data || [],
          containersByServer,
          deploymentMap,
        });
      } catch (error) {
        console.error("[Dashboard] Fetch error:", error);
        toast({
          title: "Error",
          description: "Failed to fetch resources",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
        fetchingRef.current = false;
      }
    },
    [client, isBypassMode, toast],
  );

  useEffect(() => {
    fetchResources();
  }, [fetchResources]);

  // Auto-refresh every 3 seconds
  useEffect(() => {
    if (isBypassMode) return;

    const interval = setInterval(() => {
      fetchResources(true);
    }, 3000);

    return () => clearInterval(interval);
  }, [fetchResources, isBypassMode]);

  // Keep track of stats history for each server
  const [statsHistory, setStatsHistory] = useState<Record<string, any[]>>(() => {
    const saved = sessionStorage.getItem('komodo_stats_history');
    return saved ? JSON.parse(saved) : {};
  });

  useEffect(() => {
    if (resources.servers.length === 0) return;

    setStatsHistory(prev => {
      const next = { ...prev };
      let changed = false;
      const now = Date.now();
      const timeStr = new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const cutoff = now - 24 * 60 * 60 * 1000;

      resources.servers.forEach(srv => {
        const history = next[srv.id] || [];
        const cpu = srv.cpu_perc ?? 0;
        const mem = srv.mem_total_gb ? (srv.mem_used_gb! / srv.mem_total_gb) * 100 : 0;
        const disk = srv.disk_total_gb ? (srv.disk_used_gb! / srv.disk_total_gb) * 100 : 0;

        const newPoint = {
          time: timeStr,
          timestamp: now,
          cpu,
          memory: mem,
          disk
        };

        const updatedHistory = [...history.filter(p => p.timestamp > cutoff), newPoint].slice(-28800);
        next[srv.id] = updatedHistory;
        changed = true;
      });

      if (changed) {
        sessionStorage.setItem('komodo_stats_history', JSON.stringify(next));
      }
      return next;
    });
  }, [resources.servers]);

  const handleAction = async (
    action: string,
    resourceType: string,
    resourceId: string,
    resourceName: string,
  ) => {
    if (!client) return;

    setActionLoading(`${action}-${resourceId}`);

    try {
      let result;

      const isContainerAction =
        ["start", "stop", "restart"].includes(action) &&
        (resourceType === "deployments" ||
          resourceType.toLowerCase().includes("container"));

      const params = isContainerAction
        ? { deployment: resourceId }
        : { [resourceType.toLowerCase().replace(/s$/, "")]: resourceId };

      switch (action) {
        case "deploy":
          result = await client.execute("DeployStack", { stack: resourceId });
          break;
        case "start":
          result = await client.execute("StartDeployment", params);
          break;
        case "stop":
          result = await client.execute("StopDeployment", params);
          break;
        case "restart":
          result = await client.execute("RestartDeployment", params);
          break;
        case "build":
          result = await client.execute("RunBuild", params);
          break;
        case "clone":
          result = await client.execute("CloneRepo", params);
          break;
        case "pull":
          result = await client.execute("PullRepo", params);
          break;
        case "startAll":
          result = await client.execute("StartAllContainers", {
            server: resourceId,
          });
          break;
        case "stopAll":
          result = await client.execute("StopAllContainers", {
            server: resourceId,
          });
          break;
        case "restartAll":
          result = await client.execute("RestartAllContainers", {
            server: resourceId,
          });
          break;
        case "pauseAll":
          result = await client.execute("PauseAllContainers", {
            server: resourceId,
          });
          break;
        case "pruneSystem":
          result = await client.execute("PruneSystem", { server: resourceId });
          break;
        default:
          return;
      }

      if (result?.success) {
        toast({
          title: "Action Started",
          description: `${action} on ${resourceName} initiated`,
        });
        setTimeout(() => fetchResources(true), 2000);
      } else {
        toast({
          title: "Action Failed",
          description: result?.error || "Unknown error",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to execute action",
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleContainerAction = async (
    action: string,
    containerId: string,
    containerName: string,
  ) => {
    if (!client) return;

    const container = resources.deployments.find((c) => c.id === containerId);
    const serverId = container?.serverId;

    if (!serverId) {
      toast({
        title: "Action Failed",
        description: "Missing server id for this container.",
        variant: "destructive",
      });
      return;
    }

    setActionLoading(`${action}-${containerId}`);

    try {
      let result;
      const params = { server: serverId, container: containerId };

      console.log(`[Container Action] ${action}`, params);

      switch (action) {
        case "start":
          result = await client.execute("StartContainer", params);
          break;
        case "stop":
          result = await client.execute("StopContainer", params);
          break;
        case "restart":
          result = await client.execute("RestartContainer", params);
          break;
        default:
          return;
      }

      const serverError = (result as any)?.data?.error;

      if (result?.success && !serverError) {
        toast({
          title: "Action Started",
          description: `${action} on ${containerName} initiated`,
        });
        setTimeout(() => fetchResources(true), 1500);
      } else {
        toast({
          title: "Action Failed",
          description: serverError || result?.error || "Unknown error",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to execute action",
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleRefreshServer = useCallback(
    (serverId: string) => {
      fetchResources(true);
    },
    [fetchResources],
  );

  const renderResourceCard = (
    resource: { id: string; name: string; state?: string; status?: string },
    type: ResourceType,
    icon: React.ReactNode,
    actions: { label: string; action: string; icon: React.ReactNode }[],
  ) => (
    <Card
      key={resource.id}
      className="border-2 border-foreground shadow-xs hover:shadow-sm transition-shadow"
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="p-2 border-2 border-foreground bg-secondary flex-shrink-0">
              {icon}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-mono font-bold text-sm truncate">
                {resource.name}
              </h3>
              <div className="flex items-center gap-2 mt-1">
                {getStatusIcon(resource.state || resource.status)}
                <Badge
                  variant={getStatusVariant(resource.state || resource.status)}
                  className="font-mono text-xs uppercase"
                >
                  {resource.state || resource.status || "unknown"}
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
                onClick={() =>
                  handleAction(act.action, type, resource.id, resource.name)
                }
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
      label: "Stacks",
      resourceIcon: <Layers className="w-5 h-5" />,
      actions: [
        {
          label: "Deploy",
          action: "deploy",
          icon: <Play className="h-4 w-4" />,
        },
      ],
    },
    deployments: {
      icon: <Box className="w-4 h-4" />,
      label: "Containers",
      resourceIcon: <Box className="w-5 h-5" />,
      actions: [],
    },
    servers: {
      icon: <Server className="w-4 h-4" />,
      label: "Servers",
      resourceIcon: <Server className="w-5 h-5" />,
      actions: [],
    },
    builds: {
      icon: <Hammer className="w-4 h-4" />,
      label: "Builds",
      resourceIcon: <Hammer className="w-5 h-5" />,
      actions: [
        { label: "Build", action: "build", icon: <Play className="h-4 w-4" /> },
      ],
    },
    repos: {
      icon: <GitBranch className="w-4 h-4" />,
      label: "Repos",
      resourceIcon: <GitBranch className="w-5 h-5" />,
      actions: [
        { label: "Clone", action: "clone", icon: <Play className="h-4 w-4" /> },
        {
          label: "Pull",
          action: "pull",
          icon: <RefreshCw className="h-4 w-4" />,
        },
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
    <div className="min-h-screen bg-background flex flex-col overflow-hidden">
      {/* Header */}
      <header className="border-b-2 border-foreground bg-card flex-shrink-0">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <img
              src={komodoLogo}
              alt="Komodo"
              className="w-10 h-10 object-contain"
            />
            <div>
              <h1 className="font-bold text-lg tracking-tight">KOMODO</h1>
              <p className="font-mono text-xs text-muted-foreground truncate max-w-[200px]">
                {(credentials as any)?.apiUrl ??
                  `${(credentials as any)?.protocol}://${(credentials as any)?.host}:${(credentials as any)?.port}`}
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
              <RefreshCw
                className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
              />
            </Button>
            <SettingsSheet
              isDarkMode={isDark}
              onThemeChange={(dark) => setTheme(dark ? "dark" : "light")}
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
      <main className="flex-1 p-4 flex flex-col min-h-0 overflow-hidden">
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as ResourceType)}
          className="flex flex-col flex-1 min-h-0"
        >
          <TabsList className="w-full grid grid-cols-5 border-2 border-foreground h-auto p-0 bg-secondary flex-shrink-0">
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
          <TabsContent
            value="stacks"
            className="mt-4 flex-1 min-h-0 overflow-hidden"
          >
            <ScrollArea className="h-full">
              <div className="space-y-3 pr-2 pb-4">
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
                      onAction={(action, id, name) =>
                        handleAction(action, "stacks", id, name)
                      }
                      actionLoading={actionLoading}
                    />
                  ))
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Containers Tab */}
          <TabsContent
            value="deployments"
            className="mt-4 flex-1 min-h-0 overflow-hidden"
          >
            <ScrollArea className="h-full">
              <div className="space-y-3 pr-2 pb-4">
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
          <TabsContent
            value="servers"
            className="mt-4 flex-1 min-h-0 overflow-hidden"
          >
            <ScrollArea className="h-full">
              <div className="space-y-3 pr-2 pb-4">
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
                      onAction={(action, id, name) =>
                        handleAction(action, "servers", id, name)
                      }
                      actionLoading={actionLoading}
                      onRefreshServer={handleRefreshServer}
                    />
                  ))
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Builds Tab */}
          <TabsContent
            value="builds"
            className="mt-4 flex-1 min-h-0 overflow-hidden"
          >
            <ScrollArea className="h-full">
              <div className="space-y-3 pr-2 pb-4">
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
                      "builds",
                      tabConfig.builds.resourceIcon,
                      tabConfig.builds.actions,
                    ),
                  )
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Repos Tab */}
          <TabsContent
            value="repos"
            className="mt-4 flex-1 min-h-0 overflow-hidden"
          >
            <ScrollArea className="h-full">
              <div className="space-y-3 pr-2 pb-4">
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
                      "repos",
                      tabConfig.repos.resourceIcon,
                      tabConfig.repos.actions,
                    ),
                  )
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </main>

      {/* Footer Stats */}
      <footer className="border-t-2 border-foreground bg-card p-3 flex-shrink-0">
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
