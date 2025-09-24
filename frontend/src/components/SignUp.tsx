import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "react-router-dom";
import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

const SignUp = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);

            const handleSubmit = async (e: React.FormEvent) => {
            e.preventDefault();
            if (loading) return;
            const fullNameEl = document.getElementById('fullName') as HTMLInputElement;
            const rollEl = document.getElementById('rollNumber') as HTMLInputElement;
            const instEl = document.getElementById('instituteName') as HTMLInputElement;
            const emailEl = document.getElementById('email') as HTMLInputElement;
            const passEl = document.getElementById('password') as HTMLInputElement;
            const pass2El = document.getElementById('confirm-password') as HTMLInputElement;
                if (!emailEl.value || !passEl.value) {
                    toast({ title: 'Missing fields', description: 'Email and password are required.', variant: 'destructive' });
                    return;
                }
                if (passEl.value.length < 6) {
                    toast({ title: 'Weak password', description: 'Please use at least 6 characters.', variant: 'destructive' });
                    return;
                }
                if (passEl.value !== pass2El.value) {
                toast({ title: 'Passwords do not match', variant: 'destructive' });
                return;
            }
            setLoading(true);
                    try {
                        const nodeUrl = (import.meta.env.VITE_NODE_BACKEND_URL as string) || 'http://localhost:3001';
                        const base = (nodeUrl).replace(/\/$/, '');
                        const resp = await fetch(`${base}/student/signup`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                email: emailEl.value,
                                password: passEl.value,
                                full_name: fullNameEl.value,
                                roll_number: rollEl.value,
                                institute_name: instEl.value
                            })
                        });
                        if (!resp.ok) {
                            const body = await resp.text();
                            console.error('Signup error response:', resp.status, body);
                            toast({ title: 'Sign up error', description: body || 'Server error', variant: 'destructive' });
                            setLoading(false);
                            return;
                        }
                        const data = await resp.json();
                        toast({ title: 'Account created', description: 'Please check your email for verification instructions.' });
                        navigate('/login');
                    } catch (err: unknown) {
                        const message = (typeof err === 'object' && err !== null && 'message' in err) ? String((err as {message?: string}).message) : 'Sign up error';
                        toast({ title: 'Sign up error', description: message, variant: 'destructive' });
                    } finally {
                        setLoading(false);
                    }
        };
  return (
            <div className="min-h-screen flex items-center justify-center bg-background px-4">
                <Card className="w-full max-w-3xl shadow-soft border-border/50">
        <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold pt-6">Create an Account</CardTitle>
            <CardDescription>Join MindCare to access our support community and resources</CardDescription>
        </CardHeader>
                <form onSubmit={handleSubmit}>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="fullName">Full Name</Label>
                                <Input id="fullName" type="text" placeholder="Enter your full name" required />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="rollNumber">Roll Number</Label>
                                <Input id="rollNumber" type="text" placeholder="Enter your roll number" required />
                            </div>
                            <div className="space-y-2 md:col-span-2">
                                <Label htmlFor="instituteName">Institute Name</Label>
                                <Input id="instituteName" type="text" placeholder="Enter your institute name" required />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="email">Email</Label>
                                <Input id="email" type="email" placeholder="Enter your email" required />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="password">Password</Label>
                                <Input id="password" type="password" placeholder="Choose a password" required />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="confirm-password">Confirm Password</Label>
                                <Input id="confirm-password" type="password" placeholder="Confirm your password" required />
                            </div>
                        </div>
                    </CardContent>
                <CardFooter className="flex flex-col space-y-4">
                            <Button type="submit" disabled={loading} className="w-full bg-gradient-primary hover:opacity-90 transition-opacity">{loading ? 'Creating...' : 'Create Account'}</Button>
            <div className="text-center text-sm text-muted-foreground">
                Already have an account?{" "}
                <Link to="/login" className="text-primary hover:underline">
                    Login
                </Link>
            </div>
                </CardFooter>
                </form>
      </Card>
    </div>
  );
};

export default SignUp;
