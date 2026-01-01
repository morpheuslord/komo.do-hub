import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Layers,
  ChevronDown,
  ChevronUp,
  Server,
  Box,
  Play,
  Loader2,
  Activity
} from 'lucide-react';

interface StackContainer {
  id: string;
  name: string;
  state?: string;
}

interface StackDetailCardProps {
  stack: {
    id: string;
    name: string;
    state?: string;
    status?: string;
    server_id?: string;
    tags?: string[];
  };
  serverName?: string;
  containers: StackContainer[];
  onAction: (action: string, resourceId: string, resourceName: string) => void;
  actionLoading: string | null;
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
  if (['pending', 'building', 'deploying'].some(s => stateStr.includes(s))) {
    return <div className="w-2 h-2 rounded-full bg-chart-4 animate-pulse" />;
  }
  return <div className="w-2 h-2 rounded-full bg-chart-4" />;
}

function getStatusVariant(state?: string): "default" | "secondary" | "destructive" | "outline" {
  const stateStr = state?.toLowerCase() || '';
  if (['running', 'ok', 'healthy', 'up'].some(s => stateStr.includes(s))) return 'default';
  if (['error', 'failed', 'unhealthy', 'dead'].some(s => stateStr.includes(s))) return 'destructive';
  return 'secondary';
}

// Compute derived state from containers if stack state is unknown
function computeStackState(stackState: string | undefined, containers: StackContainer[]): string {
  // If we have a valid state, use it
  if (stackState && stackState.toLowerCase() !== 'unknown') {
    return stackState;
  }
  
  // Derive state from containers
  if (containers.length === 0) {
    return 'No containers';
  }
  
  const runningCount = containers.filter(c => {
    const state = c.state?.toLowerCase() || '';
    return ['running', 'up'].some(s => state.includes(s));
  }).length;
  
  if (runningCount === containers.length) {
    return 'Running';
  }
  if (runningCount === 0) {
    return 'Stopped';
  }
  return 'Partial';
}

export function StackDetailCard({ stack, serverName, containers, onAction, actionLoading }: StackDetailCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  const derivedState = computeStackState(stack.state || stack.status, containers);
  const runningContainers = containers.filter(c => {
    const state = c.state?.toLowerCase() || '';
    return ['running', 'up'].some(s => state.includes(s));
  });

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="border-2 border-foreground shadow-xs hover:shadow-sm transition-shadow">
        <CollapsibleTrigger asChild>
          <CardContent className="p-4 cursor-pointer">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="p-2 border-2 border-foreground bg-secondary flex-shrink-0">
                  <Layers className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-mono font-bold text-sm truncate">{stack.name}</h3>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {getStatusIcon(derivedState)}
                    <Badge variant={getStatusVariant(derivedState)} className="font-mono text-xs uppercase">
                      {derivedState}
                    </Badge>
                    {containers.length > 0 && (
                      <Badge variant="outline" className="font-mono text-xs">
                        <Box className="w-3 h-3 mr-1" />
                        {runningContainers.length}/{containers.length}
                      </Badge>
                    )}
                    {serverName && (
                      <Badge variant="outline" className="font-mono text-xs">
                        <Server className="w-3 h-3 mr-1" />
                        {serverName}
                      </Badge>
                    )}
                  </div>
                  {stack.tags && stack.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {stack.tags.map((tag, idx) => (
                        <Badge key={idx} variant="secondary" className="font-mono text-[10px]">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 border-2"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAction('deploy', stack.id, stack.name);
                  }}
                  disabled={actionLoading === `deploy-${stack.id}`}
                  title="Deploy"
                >
                  {actionLoading === `deploy-${stack.id}` ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                </Button>
                {isOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </div>
            </div>
          </CardContent>
        </CollapsibleTrigger>

        <CollapsibleContent className="transition-all duration-300 ease-in-out">
          <div className="border-t-2 border-foreground p-4 bg-secondary/50">
            {/* Stack Info */}
            <div className="space-y-3">
              {/* Server */}
              {serverName && (
                <div className="flex items-center justify-between p-2 border border-foreground bg-background">
                  <div className="flex items-center gap-2">
                    <Server className="w-4 h-4 text-chart-1" />
                    <span className="font-mono text-sm">Deployed On</span>
                  </div>
                  <span className="font-mono text-sm font-medium">{serverName}</span>
                </div>
              )}

              {/* Status */}
              <div className="flex items-center justify-between p-2 border border-foreground bg-background">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-chart-2" />
                  <span className="font-mono text-sm">Status</span>
                </div>
                <Badge variant={getStatusVariant(derivedState)} className="font-mono">
                  {derivedState}
                </Badge>
              </div>
            </div>

            {/* Containers */}
            {containers.length > 0 && (
              <div className="mt-4">
                <h4 className="font-mono text-sm font-bold mb-2 flex items-center gap-2">
                  <Box className="w-4 h-4" />
                  Containers ({containers.length})
                </h4>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {containers.map((container) => (
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

            {containers.length === 0 && (
              <div className="mt-4 p-4 border border-dashed border-muted-foreground text-center">
                <p className="font-mono text-sm text-muted-foreground">
                  No containers found for this stack
                </p>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
