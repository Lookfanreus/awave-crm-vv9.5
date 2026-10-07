import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { admin } from '@/server/supabase'


export function clienteSemIsolamento(): SupabaseClient {
  return admin()
}
