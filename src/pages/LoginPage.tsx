import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Server, Key, Lock, Loader2, AlertCircle } from 'lucide-react';

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

    const result = await login({
      apiUrl: apiUrl.trim(),
      apiKey: apiKey.trim(),
      apiSecret: apiSecret.trim(),
    });

    if (!result.success) {
      setError(result.error || 'Authentication failed');
    }
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-2 border-foreground shadow-md">
        <CardHeader className="space-y-4 text-center pb-2">
          <div className="mx-auto w-16 h-16 border-2 border-foreground flex items-center justify-center bg-primary">
            <Server className="w-8 h-8 text-primary-foreground" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold tracking-tight">
              KOMO.DO
            </CardTitle>
            <CardDescription className="text-muted-foreground font-mono text-sm mt-1">
              Server Management Console
            </CardDescription>
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
            
            <div className="space-y-2">
              <Label htmlFor="apiUrl" className="font-mono text-sm uppercase tracking-wider">
                API URL
              </Label>
              <div className="relative">
                <Server className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="apiUrl"
                  type="url"
                  placeholder="https://your-komodo.example.com"
                  value={apiUrl}
                  onChange={(e) => setApiUrl(e.target.value)}
                  className="pl-10 font-mono text-sm border-2"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="apiKey" className="font-mono text-sm uppercase tracking-wider">
                API Key
              </Label>
              <div className="relative">
                <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="apiKey"
                  type="text"
                  placeholder="your-api-key"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="pl-10 font-mono text-sm border-2"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="apiSecret" className="font-mono text-sm uppercase tracking-wider">
                API Secret
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="apiSecret"
                  type="password"
                  placeholder="your-api-secret"
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
    </div>
  );
}
