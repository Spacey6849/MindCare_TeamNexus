import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase URL/key missing. Check your .env (VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY).');
}
// Temporary debug: print the effective client keys to the browser console (remove after debugging)
try {
  // avoid printing the full anon key in shared logs, only show first/last 8 chars
  const shortKey = supabaseAnonKey ? `${supabaseAnonKey.slice(0,8)}...${supabaseAnonKey.slice(-8)}` : '(missing)';
  console.info('Supabase client:', { supabaseUrl, supabaseAnonKey: shortKey });
} catch (e) {
  // ignore
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  },
});
