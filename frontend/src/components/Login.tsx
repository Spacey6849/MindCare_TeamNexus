
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Shield, Users } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "@/hooks/use-toast";

const Login = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [mode, setMode] = useState<'user' | 'admin'>('user');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const passwordEl = (document.getElementById('password') as HTMLInputElement);
    const pwd = passwordEl?.value ?? '';
    try {
      if (mode === 'admin') {
        const usernameEl = (document.getElementById('admin-username') as HTMLInputElement);
        const { data, error } = await supabase.rpc('verify_admin_login', { p_username: usernameEl.value, p_password: pwd });
        if (error) throw error;
        if (!data || data.length === 0) {
          toast({ title: 'Invalid admin credentials', description: 'Please check your username and password.', variant: 'destructive' });
          return;
        }
        const row = data[0] as { id: string; username: string; email: string; full_name: string | null; role: string };
        login({ id: row.id, email: row.email, fullName: row.full_name ?? row.username ?? 'Admin', role: 'admin' });
        navigate('/admin');
      } else {
        const emailEl = (document.getElementById('email') as HTMLInputElement);
        const nodeUrl = (import.meta.env.VITE_NODE_BACKEND_URL as string) || 'http://localhost:3001';
        const base = (nodeUrl).replace(/\/$/, '');
        const resp = await fetch(`${base}/student/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: emailEl.value, password: pwd })
        });
        if (!resp.ok) {
          let description = 'Invalid credentials';
          try {
            const j = await resp.json();
            description = j?.details || j?.error || description;
          } catch {
            const t = await resp.text();
            if (t) description = t;
          }
          toast({ title: 'Login failed', description, variant: 'destructive' });
          return;
        }
        const data = await resp.json();
        const u = data.user;
        login({ id: u.id, email: u.email, fullName: u.fullName, role: u.role });
        navigate('/ai-chat');
      }
    } catch (err: unknown) {
      console.error(err);
      const message = (typeof err === 'object' && err !== null && 'message' in err)
        ? String((err as { message?: string }).message ?? 'Login error')
        : 'Login error';
      toast({ title: 'Login error', description: message, variant: 'destructive' });
    }
  };

  // Demo login handlers
  const handleStudentLogin = () => {
    login({ id: 'demo-student', email: 'student@example.com', fullName: 'Demo Student', role: 'student' });
    navigate('/ai-chat');
  };

  const handleAdminLogin = () => {
    login({ id: 'demo-admin', email: 'admin@example.com', fullName: 'Demo Admin', role: 'admin' });
    navigate('/admin');
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-muted/30">
      <div className="w-full max-w-md">
        <Card className="shadow-soft border-border/50">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Welcome Back</CardTitle>
            <CardDescription>Sign in to access your mental health resources.</CardDescription>
          </CardHeader>
          <form onSubmit={handleLogin}>
            <CardContent className="space-y-4">
              {/* Mode toggle */}
              <div className="flex gap-2">
                <button type="button" className={cn("flex-1 py-2 rounded border", mode==='user' ? 'bg-primary text-primary-foreground' : 'bg-muted')} onClick={() => setMode('user')}>Student</button>
                <button type="button" className={cn("flex-1 py-2 rounded border", mode==='admin' ? 'bg-primary text-primary-foreground' : 'bg-muted')} onClick={() => setMode('admin')}>Admin</button>
              </div>

              <div className="space-y-2">
                {mode === 'user' ? (
                  <>
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" placeholder="m@example.com" required />
                  </>
                ) : (
                  <>
                    <Label htmlFor="admin-username">Admin Username</Label>
                    <Input id="admin-username" type="text" placeholder="admin" required />
                  </>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" required />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col space-y-4">
              <Button type="submit" className="w-full">Sign In</Button>
              <div className="text-center text-sm text-muted-foreground">
                Don't have an account?{" "}
                <Link to="/signup" className="font-medium text-primary hover:underline">
                  Sign up
                </Link>
              </div>
            </CardFooter>
          </form>
        </Card>

    {/* ...existing code... */}
      </div>
    </div>
  );
};

export default Login;
