import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Environment validation
const requiredEnvVars = [
  'DATABASE_URL',
  'JWT_SECRET',
  'GOOGLE_SHEET_ID',
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.warn(`Warning: ${envVar} is not set in environment variables`);
  }
}

export const env = {
  // Application
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '5000', 10),
  apiPrefix: process.env.API_PREFIX || '/api/v1',

  // Timezone & Sync
  timezone: process.env.TZ || 'Asia/Kolkata',
  syncCronSchedule: process.env.SYNC_CRON_SCHEDULE || '0 20 * * *',
  syncEnabled: process.env.SYNC_ENABLED === 'true',

  // Database
  databaseUrl: process.env.DATABASE_URL || '',

  // JWT
  jwtSecret: process.env.JWT_SECRET || 'default-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',

  // Google Sheets
  googleServiceAccountPath: process.env.GOOGLE_SERVICE_ACCOUNT_PATH || './config/service-account.json',
  googleSheetId: process.env.GOOGLE_SHEET_ID || '',
  googleSheetTabs: (process.env.GOOGLE_SHEET_TABS || 'Raigad,Ratnagiri,Sindhudurg,Palghar,Thane').split(','),

  // CORS
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',

  // Logging
  logLevel: process.env.LOG_LEVEL || 'info',
  logFilePath: process.env.LOG_FILE_PATH || './logs',

  // Rate Limiting
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
  rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),

  // Security
  bcryptSaltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10),

  // Helpers
  isDevelopment: process.env.NODE_ENV === 'development',
  isProduction: process.env.NODE_ENV === 'production',
} as const;

export type Env = typeof env;
