import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.warn('[Server] SUPABASE_SERVICE_ROLE_KEY missing. Auth reset will be disabled.');
}

export const supabase = createClient(supabaseUrl, supabaseServiceKey);
