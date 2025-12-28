import { useState, useEffect } from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Settings, Moon, Sun, Server, Save, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface SettingsSheetProps {
  onThemeChange: (isDark: boolean) => void;
  isDarkMode: boolean;
}

export function SettingsSheet({ onThemeChange, isDarkMode }: SettingsSheetProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [endpoint, setEndpoint] = useState('');

  useEffect(() => {
    // Load saved endpoint from localStorage
    const savedCredentials = localStorage.getItem('komodo_credentials');
    if (savedCredentials) {
      try {
        const creds = JSON.parse(savedCredentials);
        const url = `${creds.protocol}://${creds.host}:${creds.port}`;
        setEndpoint(url);
      } catch {
        setEndpoint('');
      }
    }
  }, [open]);

  const handleSaveEndpoint = () => {
    try {
      const url = new URL(endpoint);
      const savedCredentials = localStorage.getItem('komodo_credentials');
      if (savedCredentials) {
        const creds = JSON.parse(savedCredentials);
        creds.protocol = url.protocol.replace(':', '');
        creds.host = url.hostname;
        creds.port = url.port || (url.protocol === 'https:' ? '443' : '80');
        localStorage.setItem('komodo_credentials', JSON.stringify(creds));
        toast({
          title: 'Endpoint Updated',
          description: 'Reload the app to apply changes.',
        });
      }
    } catch {
      toast({
        title: 'Invalid URL',
        description: 'Please enter a valid URL (e.g., https://komodo.example.com:443)',
        variant: 'destructive',
      });
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="icon" className="border-2">
          <Settings className="h-4 w-4" />
        </Button>
      </SheetTrigger>
      <SheetContent className="border-l-2 border-foreground bg-background">
        <SheetHeader>
          <SheetTitle className="font-mono font-bold">Settings</SheetTitle>
          <SheetDescription className="font-mono text-sm">
            Configure your Komodo Manager preferences
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Theme Toggle */}
          <div className="space-y-3">
            <Label className="font-mono font-bold text-sm">Appearance</Label>
            <div className="flex items-center justify-between p-3 border-2 border-foreground bg-secondary">
              <div className="flex items-center gap-3">
                {isDarkMode ? (
                  <Moon className="h-5 w-5" />
                ) : (
                  <Sun className="h-5 w-5" />
                )}
                <div>
                  <p className="font-mono text-sm font-medium">
                    {isDarkMode ? 'Dark Mode' : 'Light Mode'}
                  </p>
                  <p className="font-mono text-xs text-muted-foreground">
                    Toggle between light and dark theme
                  </p>
                </div>
              </div>
              <Switch
                checked={isDarkMode}
                onCheckedChange={onThemeChange}
              />
            </div>
          </div>

          <Separator className="border-foreground" />

          {/* Endpoint Configuration */}
          <div className="space-y-3">
            <Label className="font-mono font-bold text-sm">API Endpoint</Label>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Server className="h-4 w-4 text-muted-foreground" />
                <span className="font-mono text-xs text-muted-foreground">
                  Current Komodo API endpoint
                </span>
              </div>
              <Input
                value={endpoint}
                onChange={(e) => setEndpoint(e.target.value)}
                placeholder="https://komodo.example.com:443"
                className="font-mono text-sm border-2"
              />
              <Button
                onClick={handleSaveEndpoint}
                className="w-full border-2"
                variant="outline"
              >
                <Save className="h-4 w-4 mr-2" />
                Save Endpoint
              </Button>
            </div>
          </div>

          <Separator className="border-foreground" />

          {/* About Section */}
          <div className="space-y-3">
            <Label className="font-mono font-bold text-sm">About</Label>
            <div className="p-3 border-2 border-foreground bg-secondary space-y-2">
              <p className="font-mono text-sm font-bold">Komodo Manager</p>
              <p className="font-mono text-xs text-muted-foreground">
                API by Komodo Team
              </p>
              <p className="font-mono text-xs text-muted-foreground">
                App by Morpheuslord
              </p>
              <a
                href="https://github.com/mbecker20/komodo"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-mono text-xs text-primary hover:underline"
              >
                <ExternalLink className="h-3 w-3" />
                Komodo on GitHub
              </a>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
