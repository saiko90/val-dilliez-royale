import { createClient } from '@supabase/supabase-js';

// Configuration avec les clés en dur pour éviter les erreurs Vercel
const supabaseUrl = 'https://zazgmlbdkvyleqfpdyzb.supabase.co';
const supabaseAnonKey = 'sb_publishable_tVLb5w07h_BM9ZZOZ8rlOw_GcECSr4k';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);