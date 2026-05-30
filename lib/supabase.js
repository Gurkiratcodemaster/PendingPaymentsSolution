import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase URL or Anon Key is missing in environment variables.');
}

// Standard public client (for client-side or anonymous usage)
export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');

// Server-only Admin client using service role key (bypasses RLS for secure validation)
export const getSupabaseAdmin = () => {
  if (typeof window !== 'undefined') {
    throw new Error('getSupabaseAdmin can only be called on the server side!');
  }
  if (!supabaseServiceKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is missing in environment variables.');
  }
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
};
