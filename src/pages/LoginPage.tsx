import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Server,
  Key,
  Lock,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import komodoLogo from '@/assets/komodo-logo.png';

export default function LoginPage() {
  const { login } = useAuth();

  const [apiUrl, setApiUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const url = new URL(apiUrl.trim());

      const credentials = {
        protocol: url.protocol.replace(':', '') as 'http' | 'https',
        host: url.hostname,
        port: url.port
          ? Number(url.port)
          : url.protocol === 'https:'
          ? 443
          : 80,
        apiKey: apiKey.trim(),
        apiSecret: apiSecret.trim(),
      };

      const result = await login(credentials);

      if (!result.success) {
        setError(result.error ?? 'Authentication failed');
      }
    } catch {
      setError('Invalid API URL. Example: http://192.168.1.57:9120');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBypass = () => {
    localStorage.setItem('komodo_bypass', 'true');
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <Card className="w-full max-w-md border-2 border-foreground shadow-md">
        <CardHeader className="space-y-4 text-center pb-2">
          <div className="mx-auto w-20 h-20 flex items-center justify-center">
            <img src={komodoLogo} alt="Komodo" className="w-20 h-20 object-contain" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold tracking-tight">
              KOMODO
            </CardTitle>
            <CardDescription className="text-muted-foreground font-mono text-sm mt-1">
              Server Management Console
            </CardDescription>
            <p className="text-xs text-muted-foreground mt-2 font-mono">
              API by Komodo Team • App by Morpheuslord
            </p>
          </div>
        </CardHeader>

        <CardContent className="pt-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 p-3 border-2 border-destructive bg-destructive/10 text-destructive text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span className="font-mono">{error}</span>
              </div>
            )}

            {/* API URL */}
            <div className="space-y-2">
              <Label
                htmlFor="apiUrl"
                className="font-mono text-sm uppercase tracking-wider"
              >
                API URL
              </Label>
              <div className="relative">
                <Server className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="apiUrl"
                  type="url"
                  placeholder="http://192.168.1.57:9120"
                  value={apiUrl}
                  onChange={(e) => setApiUrl(e.target.value)}
                  className="pl-10 font-mono text-sm border-2"
                  required
                />
              </div>
            </div>

            {/* API Key */}
            <div className="space-y-2">
              <Label
                htmlFor="apiKey"
                className="font-mono text-sm uppercase tracking-wider"
              >
                API Key
              </Label>
              <div className="relative">
                <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="apiKey"
                  type="text"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="pl-10 font-mono text-sm border-2"
                  required
                />
              </div>
            </div>

            {/* API Secret */}
            <div className="space-y-2">
              <Label
                htmlFor="apiSecret"
                className="font-mono text-sm uppercase tracking-wider"
              >
                API Secret
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="apiSecret"
                  type="password"
                  value={apiSecret}
                  onChange={(e) => setApiSecret(e.target.value)}
                  className="pl-10 font-mono text-sm border-2"
                  required
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full font-mono uppercase tracking-wider border-2"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Connecting...
                </>
              ) : (
                'Connect'
              )}
            </Button>

            <p className="text-xs text-muted-foreground text-center font-mono">
              Credentials are encrypted and stored locally on your device
            </p>
          </form>
        </CardContent>
      </Card>

      <Button
        variant="ghost"
        size="sm"
        onClick={handleBypass}
        className="mt-8 text-muted-foreground/50 hover:text-muted-foreground font-mono text-xs"
      >
        Bypass (Dev Mode)
      </Button>
    </div>
  );
}
