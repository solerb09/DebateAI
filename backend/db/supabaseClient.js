/**
 * Supabase client configuration
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Load environment variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables must be set.');
  process.exit(1);
}

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseKey);

// Test the connection
async function testConnection() {
  try {
    console.log('Testing Supabase connection...');
    const { data, error } = await supabase.from('debate_rooms').select('id').limit(1);
    
    if (error) {
      console.error('Error connecting to Supabase:', error.message);
    } else {
      console.log('Supabase connection successful!');
    }
  } catch (err) {
    console.error('Failed to test Supabase connection:', err.message);
  }
}

// Export the client
module.exports = { 
  supabase,
  testConnection
}; 