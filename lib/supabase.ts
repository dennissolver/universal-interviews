// lib/supabase.ts
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// Singleton pattern - prevents multiple GoTrueClient instances
let client: ReturnType<typeof createSupabaseClient> | null = null;

export function createClient() {
  if (client) return client;
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) throw new Error('Missing Supabase environment variables');
  
  client = createSupabaseClient(supabaseUrl, supabaseKey);
  return client;
}
