import { supabaseAdmin } from './clients.js'

export async function validateConnection() {
  const { data, error } = await supabaseAdmin
    .from('connection_test')
    .select('test_value')
    .eq('id', 1)
    .single()

  if (error) {
    if (error.code === '42P01') {
      console.warn('⚠️  connection_test table missing — run admin migration SQL in Supabase')
      return
    }
    throw new Error(`Supabase connection failed: ${error.message}`)
  }

  if (data?.test_value !== 'admin-verified') {
    throw new Error('Supabase connection test returned unexpected value')
  }

  const requiredTables = ['users', 'admin_audit_log', 'security_events']
  for (const table of requiredTables) {
    const { error: tableError } = await supabaseAdmin.from(table).select('count').limit(1)
    if (tableError?.code === '42P01') {
      console.warn(`⚠️  Table missing: ${table}`)
    }
  }

  console.log('[admin] ✅ Connection validated')
}
