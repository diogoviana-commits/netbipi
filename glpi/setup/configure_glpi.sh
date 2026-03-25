#!/bin/bash
# ============================================================
# NetBIPI - Script de Configuração da API do GLPI
# ============================================================
# Este script configura o GLPI para integração com o NetBIPI:
#   1. Habilita a API REST do GLPI
#   2. Cria um cliente API (App Token)
#   3. Define o token de usuário do admin GLPI
#
# Uso:
#   bash glpi/setup/configure_glpi.sh
#
# Variáveis de ambiente (opcionais):
#   GLPI_DB_HOST     - host do MariaDB (padrão: localhost)
#   GLPI_DB_PORT     - porta do MariaDB (padrão: 3306)
#   GLPI_DB_USER     - usuário (padrão: glpi)
#   GLPI_DB_PASSWORD - senha (padrão: glpi_pass)
#   GLPI_DB_NAME     - database (padrão: glpi)
# ============================================================

set -e

GLPI_DB_HOST="${GLPI_DB_HOST:-localhost}"
GLPI_DB_PORT="${GLPI_DB_PORT:-3306}"
GLPI_DB_USER="${GLPI_DB_USER:-glpi}"
GLPI_DB_PASSWORD="${GLPI_DB_PASSWORD:-glpi_pass}"
GLPI_DB_NAME="${GLPI_DB_NAME:-glpi}"

APP_TOKEN="netbipi-glpi-app-token-$(date +%s)"
USER_TOKEN="netbipi-glpi-user-token-$(date +%s)"

MYSQL_CMD="mysql -h ${GLPI_DB_HOST} -P ${GLPI_DB_PORT} -u ${GLPI_DB_USER} -p${GLPI_DB_PASSWORD} ${GLPI_DB_NAME}"

echo ""
echo "============================================================"
echo "  NetBIPI - Configuração GLPI"
echo "============================================================"
echo "  Host DB : ${GLPI_DB_HOST}:${GLPI_DB_PORT}"
echo "  Database: ${GLPI_DB_NAME}"
echo ""

# Wait for MariaDB
echo "⏳ Aguardando MariaDB..."
MAX_TRIES=30
COUNT=0
until $MYSQL_CMD -e "SELECT 1" &>/dev/null; do
    COUNT=$((COUNT + 1))
    if [ $COUNT -ge $MAX_TRIES ]; then
        echo "❌ MariaDB não ficou disponível após ${MAX_TRIES} tentativas"
        exit 1
    fi
    echo "   Tentativa ${COUNT}/${MAX_TRIES}..."
    sleep 5
done
echo "✅ MariaDB disponível!"

# Wait for GLPI tables to exist
echo "⏳ Aguardando tabelas GLPI..."
COUNT=0
until $MYSQL_CMD -e "SELECT COUNT(*) FROM glpi_configs LIMIT 1" &>/dev/null; do
    COUNT=$((COUNT + 1))
    if [ $COUNT -ge $MAX_TRIES ]; then
        echo "❌ Tabelas GLPI não encontradas. O GLPI foi instalado corretamente?"
        echo "   Acesse http://localhost:8081 para completar a instalação via web."
        exit 1
    fi
    echo "   Aguardando instalação do GLPI... tentativa ${COUNT}/${MAX_TRIES}"
    sleep 10
done
echo "✅ GLPI disponível!"

echo ""
echo "🔧 Configurando API REST..."

$MYSQL_CMD <<SQL
-- Habilitar API REST
UPDATE glpi_configs SET value = '1' WHERE context = 'core' AND name = 'enable_api';
UPDATE glpi_configs SET value = '1' WHERE context = 'core' AND name = 'enable_api_login_credentials';
UPDATE glpi_configs SET value = '1' WHERE context = 'core' AND name = 'enable_api_login_external_token';
UPDATE glpi_configs SET value = '1' WHERE context = 'core' AND name = 'enable_api_legacy_endpoint';

-- Remover cliente antigo do NetBIPI se existir
DELETE FROM glpi_apiclient WHERE name = 'NetBIPI Integration';

-- Criar novo cliente API (App Token)
INSERT INTO glpi_apiclient (
    entities_id, name, app_token, app_token_date,
    ipv4_range_start, ipv4_range_end,
    is_active, comment, date_creation, date_mod
) VALUES (
    0, 'NetBIPI Integration', '${APP_TOKEN}', NOW(),
    0, 4294967295,
    1, 'Token de integração NetBIPI Hub Operacional', NOW(), NOW()
);

-- Definir token de usuário para o admin do GLPI (usuário 'glpi' ou 'admin')
UPDATE glpi_users
SET api_token = '${USER_TOKEN}', api_token_date = NOW()
WHERE name IN ('glpi', 'admin')
ORDER BY id ASC
LIMIT 1;

SELECT 'Configuração concluída' AS status;
SQL

echo ""
echo "============================================================"
echo "✅ GLPI CONFIGURADO COM SUCESSO!"
echo "============================================================"
echo "  App Token  : ${APP_TOKEN}"
echo "  User Token : ${USER_TOKEN}"
echo "  GLPI URL   : http://localhost:8081"
echo ""
echo "  Credenciais padrão do GLPI:"
echo "  Usuário : glpi"
echo "  Senha   : glpi"
echo ""
echo "  📋 Adicione ao seu .env ou docker-compose.yml:"
echo ""
echo "  GLPI_APP_TOKEN=${APP_TOKEN}"
echo "  GLPI_USER_TOKEN=${USER_TOKEN}"
echo "  MOCK_INTEGRATIONS=false"
echo ""
echo "  ⚠️  IMPORTANTE: Altere a senha padrão do GLPI após o primeiro acesso!"
echo "============================================================"
echo ""

# Save tokens to a file for reference
cat > ./glpi/setup/.tokens <<EOF
# Gerado em: $(date)
GLPI_APP_TOKEN=${APP_TOKEN}
GLPI_USER_TOKEN=${USER_TOKEN}
EOF

echo "  Tokens salvos em glpi/setup/.tokens"
echo ""
