#!/bin/bash
# ============================================================
# NetBIPI - Script de Configuração Completa das Integrações
# ============================================================
# Configura Zabbix e GLPI para integração com o NetBIPI.
# Execute APÓS o docker-compose estar rodando com os perfis.
#
# Uso:
#   bash scripts/setup-integrations.sh
#
# Pré-requisitos:
#   docker-compose --profile full up -d
# ============================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║          NetBIPI - Setup de Integrações                  ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# Check docker-compose is running
check_service() {
    local service=$1
    local container=$2
    if docker ps --filter "name=${container}" --filter "status=running" | grep -q "${container}"; then
        echo "  ✅ ${service} está rodando"
        return 0
    else
        echo "  ❌ ${service} NÃO está rodando"
        return 1
    fi
}

echo "📋 Verificando serviços..."
MISSING=0

check_service "NetBIPI Backend" "netbipi-backend"  || MISSING=$((MISSING+1))
check_service "Zabbix Web"      "netbipi-zabbix-web" || MISSING=$((MISSING+1))
check_service "GLPI"            "netbipi-glpi"      || MISSING=$((MISSING+1))

if [ $MISSING -gt 0 ]; then
    echo ""
    echo "⚠️  Alguns serviços não estão rodando."
    echo "   Execute primeiro:"
    echo ""
    echo "   docker-compose --profile full up -d"
    echo ""
    echo "   Aguarde ~2 minutos para os serviços iniciarem e tente novamente."
    exit 1
fi

echo ""

# ============================================================
# Configure Zabbix
# ============================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📡 [1/2] Configurando Zabbix..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if command -v python3 &>/dev/null; then
    pip3 install requests --quiet 2>/dev/null || true
    python3 "${PROJECT_DIR}/zabbix/setup/configure_zabbix.py" \
        --url "http://localhost:8080/api_jsonrpc.php" \
        --netbipi-url "http://backend:3001" \
        --secret "netbipi-webhook-secret-2024"
else
    echo "⚠️  Python3 não encontrado. Configure o Zabbix manualmente:"
    echo "   1. Acesse http://localhost:8080 (Admin/zabbix)"
    echo "   2. Vá em Administration > Media types"
    echo "   3. Crie um Webhook apontando para http://backend:3001/webhooks/zabbix"
fi

echo ""

# ============================================================
# Configure GLPI
# ============================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎫 [2/2] Configurando GLPI..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

docker exec -e GLPI_DB_HOST=glpi-mariadb \
           -e GLPI_DB_PORT=3306 \
           -e GLPI_DB_USER=glpi \
           -e GLPI_DB_PASSWORD=glpi_pass \
           -e GLPI_DB_NAME=glpi \
           netbipi-glpi-mariadb bash -c "
    which mysql && \
    mysql -h localhost -u glpi -pglpi_pass glpi <<SQL
UPDATE glpi_configs SET value = '1' WHERE context = 'core' AND name = 'enable_api';
UPDATE glpi_configs SET value = '1' WHERE context = 'core' AND name = 'enable_api_login_credentials';
UPDATE glpi_configs SET value = '1' WHERE context = 'core' AND name = 'enable_api_login_external_token';
DELETE FROM glpi_apiclient WHERE name = 'NetBIPI Integration';
INSERT INTO glpi_apiclient (entities_id, name, app_token, app_token_date, ipv4_range_start, ipv4_range_end, is_active, comment, date_creation, date_mod)
VALUES (0, 'NetBIPI Integration', 'netbipi-glpi-app-token', NOW(), 0, 4294967295, 1, 'NetBIPI Hub', NOW(), NOW());
UPDATE glpi_users SET api_token = 'netbipi-glpi-user-token', api_token_date = NOW() WHERE name IN ('glpi','admin') LIMIT 1;
SQL
" 2>/dev/null || bash "${PROJECT_DIR}/glpi/setup/configure_glpi.sh"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║         ✅ CONFIGURAÇÃO CONCLUÍDA!                       ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
echo "  🌐 Acesso aos serviços:"
echo "     NetBIPI       → http://localhost"
echo "     NetBIPI API   → http://localhost:3001/health"
echo "     Zabbix        → http://localhost:8080  (Admin / zabbix)"
echo "     GLPI          → http://localhost:8081  (glpi / glpi)"
echo ""
echo "  🔑 Credenciais NetBIPI:"
echo "     Admin         → admin@netbipi.local / admin123"
echo "     Analista N1   → n1@netbipi.local    / analyst123"
echo ""
echo "  📝 Próximos passos:"
echo "     1. Acesse o NetBIPI e verifique os alertas sincronizados"
echo "     2. Altere as senhas padrão do Zabbix e GLPI"
echo "     3. Mantenha MOCK_INTEGRATIONS=false no .env para usar"
echo "        as integrações reais"
echo ""
echo "  ⚙️  Para ativar integrações reais, edite o .env:"
echo "     MOCK_INTEGRATIONS=false"
echo "     GLPI_APP_TOKEN=netbipi-glpi-app-token"
echo "     GLPI_USER_TOKEN=netbipi-glpi-user-token"
echo ""
echo "  🧪 Use MOCK_INTEGRATIONS=true apenas para demonstração local."
echo ""
