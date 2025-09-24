import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, Clock, RefreshCw } from "lucide-react";
import { MindCareAIAPI } from "@/lib/api";

interface StatusData {
  status: string;
  message: string;
  version?: string;
}

const BackendStatusChecker = () => {
  const [status, setStatus] = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    try {
      setLoading(true);
      setError(null);
  const data = await MindCareAIAPI.getStatus();
      setStatus(data);
    } catch (err) {
      console.error('Error checking status:', err);
      setError('Failed to connect to backend server.');
      setStatus(null);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = () => {
    if (loading) return <Clock className="h-5 w-5 animate-spin" />;
    if (error) return <XCircle className="h-5 w-5 text-destructive" />;
    if (status?.status === 'running') return <CheckCircle className="h-5 w-5 text-green-500" />;
    return <XCircle className="h-5 w-5 text-destructive" />;
  };

  const getStatusBadge = () => {
    if (loading) return <Badge variant="secondary">Checking...</Badge>;
    if (error) return <Badge variant="destructive">Offline</Badge>;
    if (status?.status === 'running') return <Badge variant="default" className="bg-green-500 text-white">Online</Badge>;
    return <Badge variant="destructive">Unknown</Badge>;
  };

  return (
    <Card className="max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            {getStatusIcon()}
            Backend Status
          </span>
          <Button variant="outline" size="sm" onClick={checkStatus} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Server Status:</span>
            {getStatusBadge()}
          </div>
          
          {status && (
            <>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Message:</span>
                <span className="text-sm text-muted-foreground">{status.message}</span>
              </div>
              {status.version && (
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Version:</span>
                  <span className="text-sm text-muted-foreground">{status.version}</span>
                </div>
              )}
            </>
          )}

          {error && (
            <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
              {error}
            </div>
          )}

          <div className="text-xs text-muted-foreground">
            Server URL: http://127.0.0.1:8000
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default BackendStatusChecker;