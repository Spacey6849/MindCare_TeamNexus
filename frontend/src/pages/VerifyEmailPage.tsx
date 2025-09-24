import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';

const API_BASE = import.meta.env.VITE_NODE_BACKEND_URL || 'http://localhost:3001';

export default function VerifyEmailPage() {
  const [params] = useSearchParams();
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState<string>('');

  useEffect(() => {
    const email = params.get('email');
    const token = params.get('token');
    if (!email || !token) {
      setStatus('error');
      setMessage('Missing verification details.');
      return;
    }
    setStatus('loading');
    fetch(`${API_BASE}/student/verify-email?email=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.error || 'Verification failed');
        }
        return res.json();
      })
      .then(() => {
        setStatus('success');
        setMessage('Your email has been verified. You can now log in.');
      })
      .catch((err) => {
        setStatus('error');
        setMessage(String(err?.message || 'Verification failed'));
      });
  }, [params]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="max-w-md w-full rounded-lg border p-6 space-y-4">
        <h1 className="text-2xl font-semibold">Email Verification</h1>
        {status === 'loading' && <p>Verifying your email, please wait…</p>}
        {status === 'success' && (
          <div className="space-y-2">
            <p className="text-green-600">{message}</p>
            <Link to="/login" className="text-primary underline">Go to login</Link>
          </div>
        )}
        {status === 'error' && (
          <div className="space-y-2">
            <p className="text-red-600">{message}</p>
            <Link to="/" className="text-primary underline">Back to home</Link>
          </div>
        )}
      </div>
    </div>
  );
}
