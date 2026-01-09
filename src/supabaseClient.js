import { createClient } from '@supabase/supabase-client';

// On met les clés en dur pour être certain que Vercel les lise correctement
const supabaseUrl = 'https://zazgmlbdkvyleqfpdyzb.supabase.co';
const supabaseAnonKey = 'sb_publishable_tVLb5w07h_BM9ZZOZ8rlOw_GcECSr4k';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);