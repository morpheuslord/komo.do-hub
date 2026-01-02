import { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Terminal,
  Loader2,
  Send,
  Square,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface ContainerTerminalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  container: {
    id: string;
    name: string;
  };
}

export function ContainerTerminalDialog({
  open,
  onOpenChange,
  container,
}: ContainerTerminalDialogProps) {
  const { client } = useAuth();
  const [output, setOutput] = useState<string[]>([]);
  const [command, setCommand] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const outputEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && container.id) {
      setOutput([
        `Connected to container: ${container.name}`,
        'Type commands below and press Enter to execute.',
        '',
        '⚠️ Note: Full terminal access requires WebSocket support.',
        'Attempting to use RunAction as a workaround (may not work for arbitrary commands).',
        ''
      ]);
    }
  }, [open, container.id]);

  useEffect(() => {
    if (outputEndRef.current) {
      outputEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [output]);

  const executeCommand = async () => {
    if (!command.trim() || isExecuting) return;

    const cmd = command.trim();
    setCommand('');
    setOutput(prev => [...prev, `$ ${cmd}`]);
    setIsExecuting(true);
    setError(null);

    try {
      // Note: ExecuteContainerExecBody is a body type, not an endpoint name.
      // Terminal execution requires WebSocket support (ConnectContainerExecQuery).
      // For now, we'll try RunAction as a workaround, though it's for predefined actions.
      
      // First, get container info to determine the type
      const containerInfo = await client.read<any>("GetContainerInfo", {
        container: container.id,
      });
      
      let execRes;
      
      // Try RunAction with the command as the action name
      // This may not work for arbitrary commands, but it's the only REST API option
      if (containerInfo?.success && containerInfo.data) {
        const info = containerInfo.data;
        const deploymentId = info.deployment || info.deployment_id || info.Deployment || info.DeploymentId;
        
        // Try RunAction for deployments
        if (deploymentId) {
          execRes = await client.execute<any>("RunAction", {
            action: cmd,
            deployment: deploymentId,
          });
        }
      }
      
      // If that didn't work, try RunAction with container
      if (!execRes?.success) {
        execRes = await client.execute<any>("RunAction", {
          action: cmd,
          container: container.id,
        });
      }

      if (execRes?.success && execRes.data) {
        const result = execRes.data;
        let outputText = '';
        
        if (typeof result === 'string') {
          outputText = result;
        } else if (result.output) {
          outputText = result.output;
        } else if (result.Output) {
          outputText = result.Output;
        } else if (result.stdout) {
          outputText = result.stdout;
        } else if (result.stderr) {
          outputText = `STDERR: ${result.stderr}`;
          if (result.stdout) {
            outputText = `STDOUT: ${result.stdout}\n${outputText}`;
          }
        } else {
          outputText = JSON.stringify(result, null, 2);
        }

        setOutput(prev => [...prev, outputText || '(no output)']);
      } else {
        const errorMsg = execRes?.error || 'Command execution failed';
        setError(errorMsg);
        setOutput(prev => [...prev, `Error: ${errorMsg}`]);
        setOutput(prev => [...prev, '']);
        setOutput(prev => [...prev, '⚠️ Terminal execution is not available through the REST API.']);
        setOutput(prev => [...prev, 'RunAction only works for predefined actions, not arbitrary shell commands.']);
        setOutput(prev => [...prev, '']);
        setOutput(prev => [...prev, 'For interactive terminal access, you need:']);
        setOutput(prev => [...prev, '  • WebSocket support (ConnectContainerExecQuery)']);
        setOutput(prev => [...prev, '  • This is not available in the current REST API client']);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to execute command';
      setError(errorMsg);
      setOutput(prev => [...prev, `Error: ${errorMsg}`]);
      setOutput(prev => [...prev, '']);
      setOutput(prev => [...prev, '⚠️ Terminal execution is not available through the REST API.']);
      setOutput(prev => [...prev, 'For interactive terminal access, WebSocket support is required.']);
    } finally {
      setIsExecuting(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      executeCommand();
    }
  };

  const clearOutput = () => {
    setOutput([`Connected to container: ${container.name}`, 'Type commands below and press Enter to execute.', '']);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] border-2 border-foreground p-0 gap-0 flex flex-col">
        <DialogHeader className="border-b-2 border-foreground pb-3 px-6 pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 border-2 border-foreground bg-secondary rounded-sm">
                <Terminal className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="font-mono font-bold text-lg">
                  Terminal - {container.name}
                </DialogTitle>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-8 font-mono text-xs"
              onClick={clearOutput}
            >
              <Square className="h-3 w-3 mr-1" />
              Clear
            </Button>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 max-h-[50vh]">
          <div className="px-6 py-4">
            {error && (
              <div className="mb-2 p-2 bg-destructive/10 border border-destructive rounded font-mono text-xs text-destructive">
                {error}
              </div>
            )}
            <div className="font-mono text-xs bg-background p-4 rounded border border-foreground min-h-[200px]">
              {output.map((line, index) => (
                <div key={index} className="mb-1 whitespace-pre-wrap break-words">
                  {line}
                </div>
              ))}
              {isExecuting && (
                <div className="flex items-center gap-2 mt-2">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>Executing...</span>
                </div>
              )}
              <div ref={outputEndRef} />
            </div>
          </div>
        </ScrollArea>

        <div className="px-6 pb-6 pt-4 border-t-2 border-foreground">
          <div className="flex items-center gap-2">
            <Input
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Enter command..."
              className="font-mono text-xs"
              disabled={isExecuting}
            />
            <Button
              onClick={executeCommand}
              disabled={!command.trim() || isExecuting}
              size="sm"
              className="font-mono text-xs"
            >
              {isExecuting ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Send className="h-3 w-3" />
              )}
            </Button>
          </div>
          <div className="mt-2 p-2 bg-muted/50 border border-foreground/20 rounded-sm">
            <p className="font-mono text-[10px] text-muted-foreground">
              ⚠️ <strong>Limited functionality:</strong> RunAction only works for predefined actions, not shell commands.
            </p>
            <p className="font-mono text-[10px] text-muted-foreground mt-1">
              Full terminal access requires WebSocket support (ConnectContainerExecQuery), which is not available in the REST API.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

