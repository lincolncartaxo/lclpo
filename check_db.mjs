import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_PUBLISHABLE_KEY);

async function check() {
  const { data, error } = await supabase.from('empresas').select('*').limit(1);
  console.log("Empresas:", data, error);
  
  const { data: pData, error: pError } = await supabase.from('profiles').select('*').limit(1);
  console.log("Profiles:", pData, pError);
}

check();
