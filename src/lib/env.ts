import 'dotenv/config';

/**
 * Validated environment configuration.
 * Throws at startup if any required variable is missing.
 * Import this module once at application entry to fail fast.
 */

function requireEnv(key: string): string {
  const value = process.env[key];
  if (value === undefined || value === '') {
    throw new Error(
      `Missing required environment variable: ${key}\n` +
        `Copy .env.example to .env and fill in all required values.`,
    );
  }
  return value;
}

function optionalEnv(key: string, defaultValue: string): string {
  return process.env[key] ?? defaultValue;
}

export const env = {
  NODE_ENV: optionalEnv('NODE_ENV', 'development'),
  PORT: parseInt(optionalEnv('PORT', '3000'), 10),
  LOG_LEVEL: optionalEnv('LOG_LEVEL', 'info'),

  ANTHROPIC_API_KEY: requireEnv('ANTHROPIC_API_KEY'),

  SUPABASE_URL: requireEnv('SUPABASE_URL'),
  SUPABASE_SERVICE_ROLE_KEY: requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
  SUPABASE_ANON_KEY: optionalEnv('SUPABASE_ANON_KEY', ''),
  DATABASE_URL: optionalEnv('DATABASE_URL', ''),

  FFIEC_GEOCODE_API_URL: optionalEnv(
    'FFIEC_GEOCODE_API_URL',
    'https://geomap.ffiec.gov/FFIECGeocMap/GeocodeMap1.aspx',
  ),
  FFIEC_API_KEY: optionalEnv('FFIEC_API_KEY', ''),
  FFIEC_API_TIMEOUT_MS: parseInt(optionalEnv('FFIEC_API_TIMEOUT_MS', '5000'), 10),

  AWS_REGION: optionalEnv('AWS_REGION', 'us-east-1'),
  AWS_S3_BUCKET: optionalEnv('AWS_S3_BUCKET', ''),

  JWT_SECRET: requireEnv('JWT_SECRET'),
  JWT_EXPIRY: optionalEnv('JWT_EXPIRY', '8h'),

  CRA_FRAMEWORK: optionalEnv('CRA_FRAMEWORK', '1995_legacy') as '1995_legacy' | '2023_modern',

  RATE_LIMIT_MAX: parseInt(optionalEnv('RATE_LIMIT_MAX', '100'), 10),
  RATE_LIMIT_WINDOW_MS: parseInt(optionalEnv('RATE_LIMIT_WINDOW_MS', '60000'), 10),

  get isProduction(): boolean {
    return this.NODE_ENV === 'production';
  },

  get isDevelopment(): boolean {
    return this.NODE_ENV === 'development';
  },

  get isTest(): boolean {
    return this.NODE_ENV === 'test';
  },
} as const;
