import dotenv from 'dotenv';
dotenv.config();

export const env = {
  PORT: parseInt(process.env.PORT || '3001'),
  NODE_ENV: process.env.NODE_ENV || 'development',
  DATABASE_URL:
    process.env.DATABASE_URL ||
    `postgresql://netbipi:${
      process.env.POSTGRES_PASSWORD || 'CHANGE_ME_POSTGRES_PASSWORD'
    }@localhost:5432/netbipi`,
  JWT_SECRET:
    process.env.JWT_SECRET || 'CHANGE_ME_TO_A_LONG_RANDOM_SECRET',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '24h',
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',

  // Zabbix
  ZABBIX_URL:
    process.env.ZABBIX_URL || 'http://localhost:8080/api_jsonrpc.php',
  ZABBIX_USER: process.env.ZABBIX_USER || 'Admin',
  ZABBIX_PASSWORD: process.env.ZABBIX_PASSWORD || 'CHANGE_ME_ZABBIX_PASSWORD',
  ZABBIX_WEBHOOK_SECRET:
    process.env.ZABBIX_WEBHOOK_SECRET || 'CHANGE_ME_ZABBIX_WEBHOOK_SECRET',

  // GLPI
  GLPI_URL: process.env.GLPI_URL || 'http://localhost:8081/apirest.php',
  GLPI_APP_TOKEN: process.env.GLPI_APP_TOKEN || 'CHANGE_ME_GLPI_APP_TOKEN',
  GLPI_USER_TOKEN: process.env.GLPI_USER_TOKEN || 'CHANGE_ME_GLPI_USER_TOKEN',

  // Demo mode only. Keep false in production and set true only for local sample data.
  MOCK_INTEGRATIONS: process.env.MOCK_INTEGRATIONS === 'true',
};
