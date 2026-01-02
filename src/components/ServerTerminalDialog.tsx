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

interface ServerTerminalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  server: {
    id: string;
    name: string;
  };
}

export function ServerTerminalDialog({
  open,
  onOpenChange,
  server,
}: ServerTerminalDialogProps) {
  const { client } = useAuth();
  const [output, setOutput] = useState<string[]>([]);
  const [command, setCommand] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const outputEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && server.id) {
      setOutput([
        `Connected to server: ${server.name}`,
        'Type commands below and press Enter to execute.',
        'Using ExecuteTerminalBody API endpoint.',
        ''
      ]);
    }
  }, [open, server.id]);

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
      // Use ExecuteTerminalBody API endpoint (from docs: Execute a terminal command on the given server)
      const execRes = await client.execute<any>("ExecuteTerminalBody", {
        server: server.id,
        command: cmd,
      });

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
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to execute command';
      setError(errorMsg);
      setOutput(prev => [...prev, `Error: ${errorMsg}`]);
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
    setOutput([`Connected to server: ${server.name}`, 'Type commands below and press Enter to execute.', '']);
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
                  Terminal - {server.name}
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
          <p className="font-mono text-[10px] text-muted-foreground mt-2">
            Using ExecuteTerminalBody API endpoint. Press Enter to execute command.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

