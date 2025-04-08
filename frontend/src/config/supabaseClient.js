import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://qyxqfaykmmvaycxpincf.supabase.co/'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF5eHFmYXlrbW12YXljeHBpbmNmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzM4OTM0ODcsImV4cCI6MjA0OTQ2OTQ4N30.hsRBp8xSijqTbWEjiWmDOsLwj78_Z7ygu--Kl3AFaeg'

export const supabase = createClient(supabaseUrl, supabaseAnonKey) 