import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Database } from '../types/database';

function requireEnv(key: string): string {
  const value = process.env[key];
  if (value === undefined || value === '') {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

/**
 * Service-role Supabase client — bypasses RLS.
 * For server-side agent operations only. Never expose to client requests directly.
 * Bank isolation is enforced by setting app.current_bank_id before each query.
 */
export function createServiceClient(): SupabaseClient<Database> {
  return createClient<Database>(
    requireEnv('SUPABASE_URL'),
    requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      db: {
        schema: 'public',
      },
    },
  );
}

/**
 * Set the RLS bank context for the current Supabase session.
 * Must be called before any query that uses bank-scoped RLS policies.
 */
export async function setBankContext(
  client: SupabaseClient<Database>,
  bankId: string,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (client as any).rpc('set_app_context', {
    bank_id_value: bankId,
  });

  if (error !== null) {
    throw new Error(`Failed to set bank context: ${error.message}`);
  }
}

/**
 * Singleton service client for use across agent modules.
 * Initialized lazily on first access.
 */
let _serviceClient: SupabaseClient<Database> | null = null;

export function getServiceClient(): SupabaseClient<Database> {
  if (_serviceClient === null) {
    _serviceClient = createServiceClient();
  }
  return _serviceClient;
}
