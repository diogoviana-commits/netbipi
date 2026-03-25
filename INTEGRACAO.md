# NetBIPI — Guia de Integração

## Visão Geral da Arquitetura

```
┌─────────────────────────────────────────────────────────┐
│                     INFRAESTRUTURA                       │
│  Servidores Linux · Windows Server · Roteadores · VMs   │
└──────────────┬────────────────────────┬─────────────────┘
               │ agente/SNMP            │ alertas manuais
┌──────────────▼──────────┐  ┌──────────▼──────────────┐
│   ZABBIX (porta 8080)   │  │   GLPI (porta 8081)     │
│   Monitoramento ativo   │  │   Service Desk / ITSM   │
└──────────────┬──────────┘  └──────────┬──────────────┘
               │ webhook POST            │ REST API
               │ /webhooks/zabbix        │ /api/tickets
┌──────────────▼─────────────────────────▼──────────────┐
│          NetBIPI Backend (porta 3001)                  │
│  Correlaciona alertas → chamados → ativos → logs       │
└─────────────────────────────────────────────────────────┘
```

---

## Início Rápido

### Opção 1 — Somente NetBIPI (ambiente local)
```bash
docker-compose up -d
# Acesse: http://localhost
```

### Opção 2 — NetBIPI + Zabbix
```bash
docker-compose --profile monitoring up -d
# Aguarde 2 minutos e configure:
python3 zabbix/setup/configure_zabbix.py
```

### Opção 3 — NetBIPI + GLPI
```bash
docker-compose --profile itsm up -d
# Aguarde o GLPI instalar (3-5 min) e configure:
bash glpi/setup/configure_glpi.sh
```

### Opção 4 — Tudo (recomendado para produção)
```bash
docker-compose --profile full up -d
# Configure tudo de uma vez:
bash scripts/setup-integrations.sh
```

---

## Configuração do Zabbix

### Acesso
- **URL:** http://localhost:8080
- **Usuário:** `Admin`
- **Senha:** `zabbix`

### Configuração Automática (recomendado)
```bash
# Instale a dependência
pip3 install requests

# Execute o script
python3 zabbix/setup/configure_zabbix.py

# Para Zabbix em outro host:
python3 zabbix/setup/configure_zabbix.py \
  --url http://meu-zabbix.empresa.com/api_jsonrpc.php \
  --netbipi-url http://meu-netbipi.empresa.com:3001
```

### Configuração Manual
1. Acesse **Administration → Media types**
2. Clique em **Create media type**
3. Configure:
   - **Name:** `NetBIPI Webhook`
   - **Type:** `Webhook`
   - **Parameters:**
     | Nome | Valor |
     |------|-------|
     | `netbipi_url` | `http://backend:3001` |
     | `webhook_secret` | `netbipi-webhook-secret-2024` |
     | `eventid` | `{EVENT.ID}` |
     | `hostname` | `{HOST.NAME}` |
     | `trigger_name` | `{TRIGGER.NAME}` |
     | `severity` | `{TRIGGER.NSEVERITY}` |
     | `status` | `{TRIGGER.STATUS}` |
     | `message` | `{TRIGGER.DESCRIPTION}` |

4. Script JavaScript:
```javascript
var params = JSON.parse(value);
var req = new HttpRequest();
req.addHeader('Content-Type: application/json');
req.addHeader('X-Webhook-Secret: ' + params.webhook_secret);
var payload = JSON.stringify({
    eventid: params.eventid, hostname: params.hostname,
    trigger_name: params.trigger_name, severity: params.severity,
    status: params.status, message: params.message
});
var resp = req.post(params.netbipi_url + '/webhooks/zabbix', payload);
if (req.getStatus() < 200 || req.getStatus() >= 300) {
    throw 'HTTP ' + req.getStatus();
}
return resp;
```

### Adicionar Hosts ao Zabbix
1. Acesse **Configuration → Hosts → Create host**
2. Preencha hostname, IP e grupo
3. Aplique templates: `Linux by Zabbix agent` ou `Windows by Zabbix agent`
4. O agente Zabbix precisa estar instalado no host monitorado

---

## Configuração do GLPI

### Acesso
- **URL:** http://localhost:8081
- **Usuário:** `glpi`
- **Senha:** `glpi`

> **Atenção:** Na primeira execução, acesse http://localhost:8081 e siga o wizard de instalação antes de executar o script de configuração.

### Configuração Automática
```bash
bash glpi/setup/configure_glpi.sh
```

### Configuração Manual da API
1. Acesse **Setup → General → API**
2. Habilite a API REST
3. Crie um **API Client**:
   - Nome: `NetBIPI Integration`
   - App Token: (copie o valor gerado)
4. Vá em seu perfil de usuário e gere um **User API Token**
5. Adicione ao `.env`:
```env
GLPI_APP_TOKEN=seu-app-token-aqui
GLPI_USER_TOKEN=seu-user-token-aqui
MOCK_INTEGRATIONS=false
```

---

## Ativar Integrações Reais

O modo real é o padrão do projeto. Use `MOCK_INTEGRATIONS=true` apenas para
ambientes de laboratório sem Zabbix e GLPI.

Após configurar Zabbix e GLPI, edite o `docker-compose.yml` ou `.env`:

```env
MOCK_INTEGRATIONS=false
GLPI_APP_TOKEN=netbipi-glpi-app-token
GLPI_USER_TOKEN=netbipi-glpi-user-token
```

Reinicie o backend:
```bash
docker-compose restart backend
```

---

## Verificar Status das Integrações

```bash
# Health check geral
curl http://localhost:3001/health

# Teste webhook Zabbix
curl -X POST http://localhost:3001/webhooks/zabbix \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: netbipi-webhook-secret-2024" \
  -d '{
    "eventid": "test-001",
    "hostname": "test-server",
    "trigger_name": "Teste de integração NetBIPI",
    "severity": "3",
    "status": "PROBLEM",
    "message": "Teste manual do webhook"
  }'
```

---

## Troubleshooting

### Zabbix não envia alertas
1. Verifique se o Media Type está habilitado
2. Verifique se a Action está habilitada
3. Teste via **Administration → Media types → NetBIPI Webhook → Test**
4. Verifique logs: `docker logs netbipi-zabbix-server`

### GLPI API retorna 401
1. Verifique se a API está habilitada em Setup → General → API
2. Execute novamente: `bash glpi/setup/configure_glpi.sh`
3. Verifique os tokens no `.env`

### Backend não conecta ao Zabbix/GLPI
1. Verifique se `MOCK_INTEGRATIONS=false`
2. Verifique se os containers estão rodando: `docker ps`
3. Dentro do Docker, use os nomes dos containers como hostname
   - Zabbix: `http://zabbix-web:8080`
   - GLPI: `http://glpi:80`

### Alertas não aparecem no NetBIPI
1. Verifique o webhook: `docker logs netbipi-backend | grep Webhook`
2. Sincronize manualmente na aba Alertas → "Sincronizar Zabbix"
3. Verifique se o host existe no inventário de Ativos

---

## Portas

| Serviço | Porta | Descrição |
|---------|-------|-----------|
| NetBIPI Frontend | 80 | Interface web |
| NetBIPI Backend | 3001 | API REST |
| PostgreSQL | 5432 | Banco do NetBIPI |
| Zabbix Web | 8080 | Interface Zabbix |
| Zabbix Server | 10051 | Trapper (para agentes) |
| Zabbix Agent | 10050 | Agente local |
| GLPI | 8081 | Interface GLPI |

---

## Segurança em Produção

- Altere todas as senhas padrão (Zabbix `zabbix`, GLPI `glpi`)
- Gere um `JWT_SECRET` forte (mínimo 32 caracteres aleatórios)
- Use HTTPS com certificado SSL
- Restrinja as portas no firewall (exponha apenas 80/443)
- Rotacione os tokens de API periodicamente
- Habilite 2FA no Zabbix e GLPI
