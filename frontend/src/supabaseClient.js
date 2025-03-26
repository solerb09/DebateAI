import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Optional connection test
(async () => {
  try {
    const { data, error } = await supabase.from('users').select('*').limit(1);
    if (error) {
      console.error('Supabase connection failed:', error.message);
    } else {
      console.log('Supabase connected successfully!');
    }
  } catch (err) {
    console.error('Error testing Supabase connection:', err);
  }
})();
