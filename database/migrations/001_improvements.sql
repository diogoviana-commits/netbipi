-- NetBIPI Improvements Migration 001
-- Run this after the initial init.sql

-- Knowledge Base
CREATE TABLE IF NOT EXISTS knowledge_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  category VARCHAR(100) NOT NULL DEFAULT 'Geral',
  tags TEXT[] DEFAULT '{}',
  trigger_pattern VARCHAR(255),
  author_id UUID REFERENCES users(id),
  view_count INTEGER DEFAULT 0,
  is_published BOOLEAN DEFAULT true,
  is_deleted BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  type VARCHAR(50) DEFAULT 'info',
  entity_type VARCHAR(50),
  entity_id VARCHAR(100),
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Escalations
CREATE TABLE IF NOT EXISTS escalations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id UUID REFERENCES alerts(id),
  ticket_id UUID REFERENCES tickets(id),
  reason TEXT NOT NULL,
  escalated_to UUID REFERENCES users(id),
  resolved_at TIMESTAMPTZ,
  escalated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Escalation Rules
CREATE TABLE IF NOT EXISTS escalation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  condition_type VARCHAR(50) NOT NULL,
  condition_value VARCHAR(255) NOT NULL,
  action VARCHAR(100) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_knowledge_category ON knowledge_articles(category);
CREATE INDEX IF NOT EXISTS idx_knowledge_trigger ON knowledge_articles(trigger_pattern);
CREATE INDEX IF NOT EXISTS idx_knowledge_deleted ON knowledge_articles(is_deleted);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_escalations_alert ON escalations(alert_id);
CREATE INDEX IF NOT EXISTS idx_escalations_resolved ON escalations(resolved_at);

-- Mock knowledge articles
INSERT INTO knowledge_articles (title, content, category, tags, trigger_pattern, is_published)
SELECT
  'Nginx parou de responder — Procedimento de Recuperação',
  E'## Sintomas\n- Alerta Zabbix: "Nginx is down"\n- Site inacessível (timeout/connection refused)\n- Porta 80/443 fechada\n\n## Diagnóstico\n1. Verificar status do serviço:\n```bash\nsystemctl status nginx\n```\n2. Verificar logs de erro:\n```bash\ntail -100 /var/log/nginx/error.log\n```\n3. Testar configuração:\n```bash\nnginx -t\n```\n\n## Solução\n1. Se configuração OK:\n```bash\nsystemctl restart nginx\n```\n2. Se erro de configuração — corrigir e reiniciar\n3. Se porta em uso por outro processo:\n```bash\nfuser -k 80/tcp && systemctl start nginx\n```\n\n## Escalada para N2\n- Se reinicialização não resolver\n- Se erro persistir nos logs após 3 tentativas',
  'Nginx',
  ARRAY['nginx', 'web', 'http', 'porta 80'],
  'nginx',
  true
WHERE NOT EXISTS (SELECT 1 FROM knowledge_articles WHERE title = 'Nginx parou de responder — Procedimento de Recuperação');

INSERT INTO knowledge_articles (title, content, category, tags, trigger_pattern, is_published)
SELECT
  'Disco cheio — Liberação de Espaço em Linux',
  E'## Verificação\n```bash\ndf -h\ndu -sh /* 2>/dev/null | sort -rh | head -20\n```\n\n## Causas Comuns\n1. Logs crescendo sem rotação\n2. Arquivos temporários acumulados\n3. Backups não removidos\n\n## Limpeza Segura\n```bash\n# Logs antigos\njournalctl --vacuum-time=7d\n\n# Arquivos temporários\nrm -rf /tmp/* /var/tmp/*\n\n# Logs do Docker\ndocker system prune -f\n```\n\n## Não Fazer\n- Não apague arquivos em /var/lib sem verificar aplicação',
  'Linux',
  ARRAY['disco', 'storage', 'df', 'espaço'],
  'disk',
  true
WHERE NOT EXISTS (SELECT 1 FROM knowledge_articles WHERE title = 'Disco cheio — Liberação de Espaço em Linux');

INSERT INTO knowledge_articles (title, content, category, tags, trigger_pattern, is_published)
SELECT
  'VPN Tunnel caiu — Diagnóstico e Recuperação',
  E'## Verificação Inicial\n1. Confirmar no Zabbix qual túnel específico\n2. Checar conectividade com o peer remoto:\n```bash\nping -c 4 <IP_PEER_REMOTO>\n```\n\n## Diagnóstico\n```bash\n# OpenVPN\njournalctl -u openvpn -n 50\n\n# IPSec\nipsec status\nipsec statusall\n```\n\n## Reiniciar VPN\n```bash\n# OpenVPN\nsystemctl restart openvpn@<config>\n\n# StrongSwan\nipsec restart\n```\n\n## Escalada\n- Se problema for no peer remoto → contato com provedor/filial\n- Se certificado expirado → N2 obrigatório',
  'VPN',
  ARRAY['vpn', 'tunnel', 'ipsec', 'openvpn'],
  'vpn',
  true
WHERE NOT EXISTS (SELECT 1 FROM knowledge_articles WHERE title = 'VPN Tunnel caiu — Diagnóstico e Recuperação');

INSERT INTO knowledge_articles (title, content, category, tags, trigger_pattern, is_published)
SELECT
  'Active Directory — Conta Bloqueada ou Sem Acesso',
  E'## Verificar Status da Conta (N2+)\n```powershell\nGet-ADUser -Identity <usuario> -Properties LockedOut,BadLogonCount\n```\n\n## Desbloquear Conta\n```powershell\nUnlock-ADAccount -Identity <usuario>\n```\n\n## Redefinir Senha\n```powershell\nSet-ADAccountPassword -Identity <usuario> -Reset\n```\n\n## Verificar Grupos e Permissões\n```powershell\nGet-ADPrincipalGroupMembership <usuario>\n```',
  'Active Directory',
  ARRAY['ad', 'active directory', 'conta', 'senha', 'bloqueio'],
  NULL,
  true
WHERE NOT EXISTS (SELECT 1 FROM knowledge_articles WHERE title = 'Active Directory — Conta Bloqueada ou Sem Acesso');

INSERT INTO knowledge_articles (title, content, category, tags, trigger_pattern, is_published)
SELECT
  'Alta CPU em Servidor Linux — Investigação',
  E'## Identificar Processo\n```bash\ntop -bn1 | head -20\nps aux --sort=-%cpu | head -10\n```\n\n## Análise Detalhada\n```bash\n# Ver threads\nhtop\n\n# Histórico de CPU\nsar -u 1 10\n```\n\n## Ações\n1. Processo legítimo com pico → aguardar e monitorar\n2. Processo desconhecido → verificar com N2 antes de matar\n3. Processo travado:\n```bash\nkill -9 <PID>\n```',
  'Linux',
  ARRAY['cpu', 'performance', 'processo', 'top'],
  'cpu',
  true
WHERE NOT EXISTS (SELECT 1 FROM knowledge_articles WHERE title = 'Alta CPU em Servidor Linux — Investigação');
