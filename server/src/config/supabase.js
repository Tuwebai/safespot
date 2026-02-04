import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Validation - Skip if in test mode if vars are missing
if (!supabaseUrl || !supabaseAnonKey) {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('SUPABASE_URL y SUPABASE_ANON_KEY deben estar definidos en server/.env');
  }
}

// Crear cliente de Supabase (100% resiliente para tests)
// Si faltan las vars en test, usamos valores dummy para evitar crashes en el constructor
export const supabase = createClient(
  supabaseUrl || 'https://dummy.supabase.co',
  supabaseAnonKey || 'dummy-key',
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  }
);

// Cliente con service role key para operaciones de Storage (solo backend)
export const supabaseAdmin = supabaseServiceRoleKey
  ? createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
  : null;

export default supabase;

