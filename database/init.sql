-- NetBIPI Database Initialization
-- PostgreSQL 16

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'n1' CHECK (role IN ('n1', 'n2', 'admin')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hostname VARCHAR(255) UNIQUE NOT NULL,
  ip_address VARCHAR(50) NOT NULL,
  os_type VARCHAR(20) NOT NULL CHECK (os_type IN ('linux', 'windows', 'network')),
  os_version VARCHAR(100) NOT NULL DEFAULT '',
  environment VARCHAR(50) NOT NULL DEFAULT 'production',
  site VARCHAR(100) NOT NULL DEFAULT '',
  client VARCHAR(100) NOT NULL DEFAULT '',
  services TEXT[] NOT NULL DEFAULT '{}',
  zabbix_host_id VARCHAR(50),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zabbix_event_id VARCHAR(100) UNIQUE,
  asset_id UUID REFERENCES assets(id) ON DELETE SET NULL,
  trigger_name VARCHAR(500) NOT NULL,
  severity VARCHAR(20) NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'average', 'high', 'disaster')),
  status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'resolved')),
  message TEXT NOT NULL DEFAULT '',
  acknowledged_by UUID REFERENCES users(id) ON DELETE SET NULL,
  acknowledged_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  ticket_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  glpi_ticket_id INTEGER,
  title VARCHAR(500) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  priority VARCHAR(20) NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  category VARCHAR(100) NOT NULL DEFAULT 'incident',
  asset_id UUID REFERENCES assets(id) ON DELETE SET NULL,
  alert_id UUID REFERENCES alerts(id) ON DELETE SET NULL,
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE alerts ADD CONSTRAINT fk_alert_ticket
  FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE SET NULL
  NOT VALID;

CREATE TABLE IF NOT EXISTS ticket_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  content TEXT NOT NULL,
  is_internal BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS log_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID REFERENCES assets(id) ON DELETE SET NULL,
  source VARCHAR(100) NOT NULL,
  level VARCHAR(20) NOT NULL DEFAULT 'info' CHECK (level IN ('info', 'warning', 'error', 'critical')),
  message TEXT NOT NULL,
  raw_log TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS network_diagnostics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  executed_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  asset_id UUID REFERENCES assets(id) ON DELETE SET NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('ping', 'dns', 'port', 'traceroute')),
  target VARCHAR(255) NOT NULL,
  result TEXT NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('success', 'failed', 'timeout')),
  executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50),
  entity_id UUID,
  details JSONB,
  ip_address VARCHAR(50),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status);
CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alerts(severity);
CREATE INDEX IF NOT EXISTS idx_alerts_asset_id ON alerts(asset_id);
CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_priority ON tickets(priority);
CREATE INDEX IF NOT EXISTS idx_tickets_created_by ON tickets(created_by);
CREATE INDEX IF NOT EXISTS idx_tickets_assigned_to ON tickets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_log_entries_asset_id ON log_entries(asset_id);
CREATE INDEX IF NOT EXISTS idx_log_entries_level ON log_entries(level);
CREATE INDEX IF NOT EXISTS idx_log_entries_occurred_at ON log_entries(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);

-- ============================================================
-- DADOS INICIAIS
-- ============================================================

-- Users — hashes gerados via pgcrypto (crypt compativel com bcryptjs)
-- Credencial demo local: NetBIPI@Demo2026
INSERT INTO users (id, username, email, password_hash, full_name, role) VALUES
(
  '00000000-0000-0000-0000-000000000001',
  'admin',
  'admin@netbipi.local',
  crypt('NetBIPI@Demo2026', gen_salt('bf', 10)),
  'Administrador Sistema',
  'admin'
),
(
  '00000000-0000-0000-0000-000000000002',
  'analyst_n1',
  'n1@netbipi.local',
  crypt('NetBIPI@Demo2026', gen_salt('bf', 10)),
  'Carlos Silva N1',
  'n1'
),
(
  '00000000-0000-0000-0000-000000000003',
  'analyst_n2',
  'n2@netbipi.local',
  crypt('NetBIPI@Demo2026', gen_salt('bf', 10)),
  'Ana Rodrigues N2',
  'n2'
)
ON CONFLICT (username) DO NOTHING;

-- Assets
INSERT INTO assets (id, hostname, ip_address, os_type, os_version, environment, site, client, services, zabbix_host_id) VALUES
(
  '10000000-0000-0000-0000-000000000001',
  'web-server-01',
  '10.0.1.10',
  'linux',
  'Ubuntu 22.04 LTS',
  'production',
  'datacenter-sp',
  'ClienteABC',
  ARRAY['nginx', 'nodejs', 'redis'],
  'zbx-h-001'
),
(
  '10000000-0000-0000-0000-000000000002',
  'db-server-01',
  '10.0.1.20',
  'linux',
  'Debian 12',
  'production',
  'datacenter-sp',
  'ClienteABC',
  ARRAY['postgresql', 'pgbouncer'],
  'zbx-h-002'
),
(
  '10000000-0000-0000-0000-000000000003',
  'monitoring-01',
  '10.0.1.30',
  'linux',
  'Ubuntu 22.04 LTS',
  'production',
  'datacenter-sp',
  'Interno',
  ARRAY['zabbix-server', 'grafana', 'prometheus'],
  'zbx-h-003'
),
(
  '10000000-0000-0000-0000-000000000004',
  'vpn-gateway-01',
  '10.0.1.1',
  'linux',
  'pfSense 2.7',
  'production',
  'datacenter-sp',
  'ClienteABC',
  ARRAY['openvpn', 'ipsec', 'firewall'],
  'zbx-h-004'
),
(
  '10000000-0000-0000-0000-000000000005',
  'dc-01',
  '10.0.1.5',
  'windows',
  'Windows Server 2022',
  'production',
  'datacenter-sp',
  'ClienteXYZ',
  ARRAY['active-directory', 'dns', 'dhcp'],
  'zbx-h-005'
),
(
  '10000000-0000-0000-0000-000000000006',
  'fileserver-01',
  '10.0.2.10',
  'windows',
  'Windows Server 2019',
  'production',
  'filial-rj',
  'ClienteXYZ',
  ARRAY['smb', 'dfs'],
  'zbx-h-006'
),
(
  '10000000-0000-0000-0000-000000000007',
  'switch-core-01',
  '10.0.0.1',
  'network',
  'Cisco IOS 15.2',
  'production',
  'datacenter-sp',
  'Interno',
  ARRAY['snmp', 'ssh'],
  'zbx-h-007'
),
(
  '10000000-0000-0000-0000-000000000008',
  'app-server-02',
  '10.0.1.40',
  'linux',
  'CentOS 8 Stream',
  'staging',
  'datacenter-sp',
  'ClienteABC',
  ARRAY['java', 'tomcat', 'nginx'],
  'zbx-h-008'
)
ON CONFLICT (hostname) DO NOTHING;

-- Alerts
INSERT INTO alerts (id, zabbix_event_id, asset_id, trigger_name, severity, status, message, acknowledged_by, acknowledged_at, resolved_at) VALUES
(
  '20000000-0000-0000-0000-000000000001',
  'zbx-10001',
  '10000000-0000-0000-0000-000000000001',
  'Serviço nginx parou de responder em web-server-01',
  'disaster',
  'open',
  'O processo nginx não está respondendo. Porta 80/443 inacessível. Verificar processo e logs.',
  NULL, NULL, NULL
),
(
  '20000000-0000-0000-0000-000000000002',
  'zbx-10002',
  '10000000-0000-0000-0000-000000000002',
  'Uso de disco acima de 90% em /var/lib/postgresql',
  'high',
  'acknowledged',
  'Disco /var/lib/postgresql com 93% de uso. Limpeza de WAL necessária.',
  '00000000-0000-0000-0000-000000000002',
  NOW() - INTERVAL '2 hours', NULL
),
(
  '20000000-0000-0000-0000-000000000003',
  'zbx-10003',
  '10000000-0000-0000-0000-000000000005',
  'CPU acima de 95% por 5 minutos em dc-01',
  'high',
  'acknowledged',
  'Carga de CPU persistentemente alta. Possível travamento de processo AD.',
  '00000000-0000-0000-0000-000000000002',
  NOW() - INTERVAL '30 minutes', NULL
),
(
  '20000000-0000-0000-0000-000000000004',
  'zbx-10004',
  '10000000-0000-0000-0000-000000000004',
  'Túnel VPN para filial-SP está DOWN',
  'disaster',
  'open',
  'Túnel VPN IPSec para filial de São Paulo desconectado. Usuários remotos sem acesso.',
  NULL, NULL, NULL
),
(
  '20000000-0000-0000-0000-000000000005',
  'zbx-10005',
  '10000000-0000-0000-0000-000000000003',
  'Resolução DNS falhou para internal.company.com',
  'average',
  'open',
  'Falha na resolução de nomes internos. Possível problema no servidor DNS.',
  NULL, NULL, NULL
),
(
  '20000000-0000-0000-0000-000000000006',
  'zbx-10006',
  '10000000-0000-0000-0000-000000000002',
  'PostgreSQL: número de conexões acima de 80%',
  'warning',
  'open',
  'Pool de conexões PostgreSQL com 82% de capacidade. Máximo: 200, atual: 164.',
  NULL, NULL, NULL
),
(
  '20000000-0000-0000-0000-000000000007',
  'zbx-10007',
  '10000000-0000-0000-0000-000000000006',
  'Tempo de resposta SMB acima de 500ms em fileserver-01',
  'warning',
  'resolved',
  'Latência de acesso a compartilhamentos SMB elevada. Usuários reportando lentidão.',
  '00000000-0000-0000-0000-000000000003',
  NOW() - INTERVAL '4 hours',
  NOW() - INTERVAL '2 hours'
),
(
  '20000000-0000-0000-0000-000000000008',
  'zbx-10008',
  '10000000-0000-0000-0000-000000000007',
  'Interface GigabitEthernet0/1 DOWN em switch-core-01',
  'high',
  'open',
  'Interface de uplink Gi0/1 desconectada. Verificar cabo e equipamento adjacente.',
  NULL, NULL, NULL
),
(
  '20000000-0000-0000-0000-000000000009',
  'zbx-10009',
  '10000000-0000-0000-0000-000000000001',
  'Certificado SSL expira em 7 dias em web-server-01',
  'average',
  'open',
  'Certificado SSL do domínio app.clienteabc.com.br expira em 7 dias.',
  NULL, NULL, NULL
),
(
  '20000000-0000-0000-0000-000000000010',
  'zbx-10010',
  '10000000-0000-0000-0000-000000000008',
  'Serviço Tomcat reiniciado inesperadamente em app-server-02',
  'average',
  'acknowledged',
  'Tomcat reiniciado 3 vezes nas últimas 2 horas. Verificar OOMKiller e heap Java.',
  '00000000-0000-0000-0000-000000000002',
  NOW() - INTERVAL '1 hour', NULL
),
(
  '20000000-0000-0000-0000-000000000011',
  'zbx-10011',
  '10000000-0000-0000-0000-000000000005',
  'Replicação do Active Directory falhou',
  'disaster',
  'open',
  'Replicação AD entre DC-01 e DC-02 falhou. Risco de divergência de objetos.',
  NULL, NULL, NULL
),
(
  '20000000-0000-0000-0000-000000000012',
  NULL,
  '10000000-0000-0000-0000-000000000003',
  'Espaço em /var/lib/zabbix abaixo de 10%',
  'warning',
  'resolved',
  'Partição de dados do Zabbix com apenas 8% livre. Purge de dados antigos executado.',
  '00000000-0000-0000-0000-000000000003',
  NOW() - INTERVAL '6 hours',
  NOW() - INTERVAL '5 hours'
),
(
  '20000000-0000-0000-0000-000000000013',
  'zbx-10013',
  '10000000-0000-0000-0000-000000000004',
  'Largura de banda WAN acima de 90% em vpn-gateway-01',
  'high',
  'open',
  'Utilização do link WAN primário acima de 90Mbps (100Mbps contratados). Possível saturação.',
  NULL, NULL, NULL
),
(
  '20000000-0000-0000-0000-000000000014',
  'zbx-10014',
  '10000000-0000-0000-0000-000000000002',
  'Backup noturno falhou em db-server-01',
  'average',
  'open',
  'Script de backup pg_dump falhou às 02:00. Exit code 1. Verificar espaço e permissões.',
  NULL, NULL, NULL
),
(
  '20000000-0000-0000-0000-000000000015',
  NULL,
  '10000000-0000-0000-0000-000000000001',
  'Taxa de erro HTTP 5xx acima de 5% em web-server-01',
  'info',
  'resolved',
  'Aumento de erros 500/502/503 detectado. Relacionado à manutenção de banco das 03:00.',
  '00000000-0000-0000-0000-000000000001',
  NOW() - INTERVAL '12 hours',
  NOW() - INTERVAL '11 hours'
)
ON CONFLICT (id) DO NOTHING;

-- Tickets
INSERT INTO tickets (id, glpi_ticket_id, title, description, status, priority, category, asset_id, alert_id, assigned_to, created_by, resolved_at) VALUES
(
  '30000000-0000-0000-0000-000000000001',
  5001,
  '[ALERTA] Serviço nginx parou em web-server-01',
  'Chamado criado automaticamente a partir do alerta do Zabbix.\n\nAlerta: Serviço nginx parou de responder em web-server-01\nHost: web-server-01\nSeveridade: disaster\n\nAção inicial: Verificar processo nginx, logs em /var/log/nginx/ e reiniciar se necessário.',
  'in_progress',
  'critical',
  'incident',
  '10000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000002',
  NULL
),
(
  '30000000-0000-0000-0000-000000000002',
  5002,
  '[ALERTA] Túnel VPN para filial-SP DOWN',
  'VPN IPSec para filial de São Paulo desconectada. Usuários sem acesso aos sistemas internos.\n\nImpacto: ~50 usuários sem acesso.\nSLA: 4 horas para resolução (contrato premium).',
  'open',
  'critical',
  'incident',
  '10000000-0000-0000-0000-000000000004',
  '20000000-0000-0000-0000-000000000004',
  '00000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000002',
  NULL
),
(
  '30000000-0000-0000-0000-000000000003',
  5003,
  'Limpeza de disco no db-server-01',
  'Disco de dados do PostgreSQL com 93% de uso. Necessário:\n1. Arquivar WAL logs antigos\n2. Executar VACUUM FULL em tabelas grandes\n3. Avaliar expansão de storage',
  'in_progress',
  'high',
  'maintenance',
  '10000000-0000-0000-0000-000000000002',
  '20000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000002',
  NULL
),
(
  '30000000-0000-0000-0000-000000000004',
  5004,
  'Interface Gi0/1 DOWN no switch-core-01',
  'Interface de uplink do switch core está DOWN. Verificar:\n- Estado físico do cabo\n- Configuração da interface\n- Equipamento conectado na outra ponta',
  'open',
  'high',
  'incident',
  '10000000-0000-0000-0000-000000000007',
  '20000000-0000-0000-0000-000000000008',
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000001',
  NULL
),
(
  '30000000-0000-0000-0000-000000000005',
  4998,
  'Renovação de certificado SSL - app.clienteabc.com.br',
  'Certificado SSL expira em 7 dias. Providenciar renovação.\n\nDomínio: app.clienteabc.com.br\nCA: Let''s Encrypt\nExpira em: ' || (NOW() + INTERVAL '7 days')::date,
  'open',
  'medium',
  'change',
  '10000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000009',
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000001',
  NULL
),
(
  '30000000-0000-0000-0000-000000000006',
  4995,
  'Investigação de lentidão no fileserver-01',
  'Usuários da filial RJ reportando lentidão ao acessar compartilhamentos. Latência SMB acima de 500ms.',
  'resolved',
  'medium',
  'incident',
  '10000000-0000-0000-0000-000000000006',
  '20000000-0000-0000-0000-000000000007',
  '00000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000002',
  NOW() - INTERVAL '2 hours'
),
(
  '30000000-0000-0000-0000-000000000007',
  5000,
  'Falha de replicação Active Directory',
  'Replicação AD entre DC-01 e DC-02 apresentando erros. Objeto desatualizado pode causar problemas de autenticação.',
  'in_progress',
  'critical',
  'incident',
  '10000000-0000-0000-0000-000000000005',
  '20000000-0000-0000-0000-000000000011',
  '00000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000001',
  NULL
),
(
  '30000000-0000-0000-0000-000000000008',
  4990,
  'Upgrade de memória RAM - db-server-01',
  'Solicitação de upgrade de RAM de 32GB para 64GB no servidor de banco de dados para suportar crescimento da aplicação.',
  'open',
  'low',
  'change',
  '10000000-0000-0000-0000-000000000002',
  NULL,
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  NULL
),
(
  '30000000-0000-0000-0000-000000000009',
  4985,
  'Backup noturno falhando no db-server-01',
  'Script de backup agendado failing às 02:00 com exit code 1. Último backup bem-sucedido há 3 dias.',
  'open',
  'high',
  'incident',
  '10000000-0000-0000-0000-000000000002',
  '20000000-0000-0000-0000-000000000014',
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000002',
  NULL
),
(
  '30000000-0000-0000-0000-000000000010',
  4980,
  'Instabilidade no Tomcat - app-server-02',
  'Serviço Tomcat reiniciando inesperadamente múltiplas vezes. Possível vazamento de memória na aplicação Java.',
  'in_progress',
  'high',
  'incident',
  '10000000-0000-0000-0000-000000000008',
  '20000000-0000-0000-0000-000000000010',
  '00000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000002',
  NULL
)
ON CONFLICT (id) DO NOTHING;

-- Update alerts with ticket IDs
UPDATE alerts SET ticket_id = '30000000-0000-0000-0000-000000000001' WHERE id = '20000000-0000-0000-0000-000000000001';
UPDATE alerts SET ticket_id = '30000000-0000-0000-0000-000000000002' WHERE id = '20000000-0000-0000-0000-000000000004';
UPDATE alerts SET ticket_id = '30000000-0000-0000-0000-000000000003' WHERE id = '20000000-0000-0000-0000-000000000002';
UPDATE alerts SET ticket_id = '30000000-0000-0000-0000-000000000004' WHERE id = '20000000-0000-0000-0000-000000000008';
UPDATE alerts SET ticket_id = '30000000-0000-0000-0000-000000000005' WHERE id = '20000000-0000-0000-0000-000000000009';
UPDATE alerts SET ticket_id = '30000000-0000-0000-0000-000000000007' WHERE id = '20000000-0000-0000-0000-000000000011';

-- Ticket Comments
INSERT INTO ticket_comments (ticket_id, user_id, content, is_internal) VALUES
(
  '30000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002',
  'Alerta recebido. Iniciando diagnóstico. SSH no servidor efetuado com sucesso.',
  false
),
(
  '30000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000003',
  'Processo nginx não encontrado na listagem de processos. Logs mostram segfault às 14:32. Tentando restart do serviço.',
  false
),
(
  '30000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000003',
  'NOTA INTERNA: Parece ser o mesmo problema da semana passada. Possível memory leak. Precisamos escalar para o dev.',
  true
),
(
  '30000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000002',
  'Tentativa de reestablecimento do túnel VPN. Verificando logs do pfSense.',
  false
),
(
  '30000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000003',
  'Executado: pg_archivecleanup para remover WAL antigos. Recuperados 15GB de espaço. Disco agora em 78%.',
  false
),
(
  '30000000-0000-0000-0000-000000000006',
  '00000000-0000-0000-0000-000000000003',
  'Causa raiz identificada: processo de antivírus realizando scan full no servidor. Agendado para horário de baixo uso. Latência normalizada.',
  false
),
(
  '30000000-0000-0000-0000-000000000007',
  '00000000-0000-0000-0000-000000000003',
  'Executado repadmin /syncall /AdeP no DC-01. Replicação em progresso. Monitorando por 30min.',
  false
),
(
  '30000000-0000-0000-0000-000000000010',
  '00000000-0000-0000-0000-000000000003',
  'Heap dump coletado. Analisando com Eclipse MAT. Identificado vazamento em classe de conexão com banco.',
  true
)
ON CONFLICT DO NOTHING;

-- Log Entries
INSERT INTO log_entries (asset_id, source, level, message, raw_log, occurred_at) VALUES
(
  '10000000-0000-0000-0000-000000000001',
  'nginx',
  'error',
  'connect() failed (111: Connection refused) while connecting to upstream',
  '2024-01-15 14:32:01 [error] 1234#1234: *45678 connect() failed (111: Connection refused) while connecting to upstream, client: 192.168.1.100, server: app.clienteabc.com.br',
  NOW() - INTERVAL '2 hours'
),
(
  '10000000-0000-0000-0000-000000000001',
  'nginx',
  'critical',
  'worker process exited on signal 11 (Segmentation fault)',
  '2024-01-15 14:32:00 [alert] 1234#1234: worker process 5678 exited on signal 11',
  NOW() - INTERVAL '2 hours 1 minute'
),
(
  '10000000-0000-0000-0000-000000000002',
  'postgresql',
  'warning',
  'number of connection slots remaining for non-replication superuser connections',
  'LOG: 2024-01-15 12:00:00 UTC connection count 164/200 (82%)',
  NOW() - INTERVAL '3 hours'
),
(
  '10000000-0000-0000-0000-000000000002',
  'postgresql',
  'error',
  'pg_dump: error: query failed: ERROR: out of shared memory',
  '2024-01-15 02:00:15 UTC pg_dump[12345]: [archiver (db)] error message from server: ERROR:  out of shared memory',
  NOW() - INTERVAL '10 hours'
),
(
  '10000000-0000-0000-0000-000000000005',
  'system',
  'critical',
  'Active Directory replication failure: The replication operation failed because of a schema mismatch',
  'Event ID 1586 - Source: ActiveDirectory_DomainService - The replication operation failed',
  NOW() - INTERVAL '1 hour'
),
(
  '10000000-0000-0000-0000-000000000005',
  'security',
  'warning',
  'Multiple failed authentication attempts detected from 192.168.5.101',
  'Security Event 4625: Account failed to logon. Source: 192.168.5.101. Account: svc_backup. Attempts: 15',
  NOW() - INTERVAL '4 hours'
),
(
  '10000000-0000-0000-0000-000000000004',
  'ipsec',
  'error',
  'IKE SA deleted: received NO_PROPOSAL_CHOSEN notify',
  'Jan 15 14:30:00 vpn-gateway-01 charon: 10[IKE] IKE_SA deleted. Reason: received NO_PROPOSAL_CHOSEN',
  NOW() - INTERVAL '2 hours 30 minutes'
),
(
  '10000000-0000-0000-0000-000000000008',
  'tomcat',
  'error',
  'OutOfMemoryError: Java heap space in com.company.app.service.DataService',
  'SEVERE: Exception in thread "pool-1-thread-42" java.lang.OutOfMemoryError: Java heap space',
  NOW() - INTERVAL '90 minutes'
),
(
  '10000000-0000-0000-0000-000000000008',
  'tomcat',
  'warning',
  'GC overhead limit exceeded - consider increasing heap size',
  'WARNING: GC overhead limit exceeded. Current: Xmx=2048m. Consider increasing to 4096m.',
  NOW() - INTERVAL '2 hours'
),
(
  '10000000-0000-0000-0000-000000000003',
  'zabbix',
  'info',
  'Zabbix agent on monitoring-01 started',
  'zabbix_agentd [12345]: Zabbix Agent started. Zabbix 6.4.8 (revision 12345).',
  NOW() - INTERVAL '1 day'
),
(
  '10000000-0000-0000-0000-000000000006',
  'system',
  'warning',
  'Antivirus scan causing high I/O on fileserver-01: disk queue length 45',
  'Perfmon Alert: PhysicalDisk(_Total)\\Avg. Disk Queue Length = 45.23 (threshold: 5)',
  NOW() - INTERVAL '5 hours'
),
(
  '10000000-0000-0000-0000-000000000002',
  'system',
  'info',
  'Scheduled maintenance completed: WAL archive cleanup freed 15GB',
  'CRON[45678]: (postgres) WAL cleanup completed. Files removed: 1523. Space freed: 15.2 GB',
  NOW() - INTERVAL '1 hour'
),
(
  '10000000-0000-0000-0000-000000000001',
  'certbot',
  'warning',
  'Certificate for app.clienteabc.com.br expires in 7 days',
  'WARNING: Certificate will expire 2024-01-22 00:00:00 UTC (7 days from now)',
  NOW() - INTERVAL '30 minutes'
),
(
  '10000000-0000-0000-0000-000000000007',
  'syslog',
  'critical',
  'Interface GigabitEthernet0/1 changed state to down',
  '%LINK-3-UPDOWN: Interface GigabitEthernet0/1, changed state to down',
  NOW() - INTERVAL '3 hours'
),
(
  '10000000-0000-0000-0000-000000000007',
  'syslog',
  'info',
  'STP: port GigabitEthernet0/2 transitioned to Forwarding state',
  '%SPANNING_TREE-5-TOPOTRAP: Topology Change Trap from GigabitEthernet0/2',
  NOW() - INTERVAL '3 hours 5 minutes'
),
(
  '10000000-0000-0000-0000-000000000004',
  'firewall',
  'warning',
  'High bandwidth utilization: WAN interface at 91Mbps (91% of 100Mbps)',
  'filterlog: WAN bandwidth threshold exceeded. Current: 91.2Mbps. Max: 100Mbps',
  NOW() - INTERVAL '45 minutes'
),
(
  '10000000-0000-0000-0000-000000000005',
  'dns',
  'error',
  'DNS query timeout for internal.company.com from 10.0.1.30',
  'DNS-3-QUERY_TIMEOUT: timeout resolving internal.company.com/A from 10.0.1.30',
  NOW() - INTERVAL '3 hours'
),
(
  '10000000-0000-0000-0000-000000000001',
  'nginx',
  'info',
  'Server started successfully after restart - listening on :80 and :443',
  '2024-01-15 15:10:00 [notice] 6789#6789: nginx/1.24.0 started',
  NOW() - INTERVAL '1 hour'
),
(
  '10000000-0000-0000-0000-000000000003',
  'prometheus',
  'warning',
  'Scrape timeout for target monitoring-01:9100 - node_exporter may be down',
  'level=warn ts=2024-01-15T14:00:00Z msg="Error scraping target" target="monitoring-01:9100" err="context deadline exceeded"',
  NOW() - INTERVAL '6 hours'
),
(
  '10000000-0000-0000-0000-000000000002',
  'pgbouncer',
  'error',
  'connection limit exceeded for database: pooler_error=too many clients',
  'ERROR: pgbouncer C-0x5f12ab: db/app@127.0.0.1:5432 pooler error: too many clients',
  NOW() - INTERVAL '3 hours 30 minutes'
)
ON CONFLICT DO NOTHING;

-- Network Diagnostics History
INSERT INTO network_diagnostics (executed_by, asset_id, type, target, result, status, executed_at) VALUES
(
  '00000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000001',
  'ping',
  '10.0.1.10',
  'PING 10.0.1.10 56 bytes of data.\n64 bytes from 10.0.1.10: icmp_seq=1 ttl=64 time=0.412 ms\n64 bytes from 10.0.1.10: icmp_seq=2 ttl=64 time=0.387 ms\n--- 10.0.1.10 ping statistics ---\n4 packets transmitted, 4 received, 0% packet loss',
  'success',
  NOW() - INTERVAL '2 hours'
),
(
  '00000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000004',
  'ping',
  '10.0.1.1',
  'PING 10.0.1.1 56 bytes of data.\nRequest timeout for icmp_seq 0\nRequest timeout for icmp_seq 1\n--- 10.0.1.1 ping statistics ---\n4 packets transmitted, 0 received, 100% packet loss',
  'failed',
  NOW() - INTERVAL '1 hour 30 minutes'
),
(
  '00000000-0000-0000-0000-000000000003',
  '10000000-0000-0000-0000-000000000005',
  'port',
  '10.0.1.5:389',
  'Porta 389 em 10.0.1.5: ABERTA (latência: 2ms)',
  'success',
  NOW() - INTERVAL '45 minutes'
),
(
  '00000000-0000-0000-0000-000000000002',
  NULL,
  'dns',
  'internal.company.com',
  'Falha na resolução DNS para internal.company.com: SERVFAIL',
  'failed',
  NOW() - INTERVAL '3 hours'
),
(
  '00000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000002',
  'port',
  '10.0.1.20:5432',
  'Porta 5432 em 10.0.1.20: ABERTA (latência: 1ms)',
  'success',
  NOW() - INTERVAL '30 minutes'
)
ON CONFLICT DO NOTHING;

-- Initial audit log entries
INSERT INTO audit_log (user_id, action, entity_type, entity_id, details, ip_address) VALUES
(
  '00000000-0000-0000-0000-000000000001',
  'SYSTEM_INIT',
  'system',
  NULL,
  '{"message": "Sistema NetBIPI inicializado com dados iniciais"}',
  '127.0.0.1'
)
ON CONFLICT DO NOTHING;

-- Run improvements migration if not already applied
\i /docker-entrypoint-initdb.d/migrations/001_improvements.sql
