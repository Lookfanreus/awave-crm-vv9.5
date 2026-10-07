import 'server-only'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { urlSupabase } from '@/server/config-supabase'


export function admin(): SupabaseClient {
  return createClient(urlSupabase(), (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim(), {
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
