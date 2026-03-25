/**
 * NetBIPI - Correcao de Senhas
 * Gera hashes bcrypt corretos e atualiza no banco de dados.
 *
 * Executado dentro do container backend:
 *   docker exec netbipi-backend node /app/fix-passwords.js
 */

const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    'postgresql://netbipi:CHANGE_ME_POSTGRES_PASSWORD@postgres:5432/netbipi',
});

async function fixPasswords() {
  console.log('\n NetBIPI - Correcao de Senhas\n');

  try {
    const demoPassword = process.env.NETBIPI_DEMO_PASSWORD || 'NetBIPI@Demo2026';
    const adminHash = await bcrypt.hash(demoPassword, 10);
    const analystHash = await bcrypt.hash(demoPassword, 10);

    await pool.query(
      'UPDATE users SET password_hash = $1 WHERE email = $2',
      [adminHash, 'admin@netbipi.local']
    );

    await pool.query(
      'UPDATE users SET password_hash = $1 WHERE email IN ($2, $3)',
      [analystHash, 'n1@netbipi.local', 'n2@netbipi.local']
    );

    console.log(' [OK] Contas demo atualizadas');
    console.log('\n Senhas corrigidas! Acesse http://localhost\n');
  } catch (err) {
    console.error('\n [ERRO]', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

fixPasswords();
