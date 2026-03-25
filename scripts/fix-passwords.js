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
  connectionString: process.env.DATABASE_URL || 'postgresql://netbipi:netbipi123@postgres:5432/netbipi',
});

async function fixPasswords() {
  console.log('\n NetBIPI - Correcao de Senhas\n');

  try {
    const adminHash    = await bcrypt.hash('admin123',    10);
    const analystHash  = await bcrypt.hash('analyst123',  10);

    await pool.query(
      'UPDATE users SET password_hash = $1 WHERE email = $2',
      [adminHash, 'admin@netbipi.local']
    );
    console.log(' [OK] admin@netbipi.local    -> admin123');

    await pool.query(
      'UPDATE users SET password_hash = $1 WHERE email IN ($2, $3)',
      [analystHash, 'n1@netbipi.local', 'n2@netbipi.local']
    );
    console.log(' [OK] n1@netbipi.local       -> analyst123');
    console.log(' [OK] n2@netbipi.local       -> analyst123');

    console.log('\n Senhas corrigidas! Acesse http://localhost\n');
  } catch (err) {
    console.error('\n [ERRO]', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

fixPasswords();
