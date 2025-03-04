import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://qyxqfaykmmvaycxpincf.supabase.co/';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF5eHFmYXlrbW12YXljeHBpbmNmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzM4OTM0ODcsImV4cCI6MjA0OTQ2OTQ4N30.hsRBp8xSijqTbWEjiWmDOsLwj78_Z7ygu--Kl3AFaeg';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Test connection
(async () => {
  const { data, error } = await supabase.from('users').select('*').limit(1);
  if (error) {
    console.error('Supabase connection failed:', error.message);
  } else {
    console.log('Supabase connected successfully!', data);
  }
})();
