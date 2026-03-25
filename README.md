<div align="center">

# NetBIPI
### Network & Infrastructure Business Intelligence Platform

**Hub operacional centralizado para equipes de Suporte Técnico N1/N2**

![React](https://img.shields.io/badge/React-18-61DAFB?style=flat&logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat&logo=typescript&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-20-339933?style=flat&logo=node.js&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=flat&logo=postgresql&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=flat&logo=docker&logoColor=white)
![Zabbix](https://img.shields.io/badge/Zabbix-7.0-FF0000?style=flat&logo=zabbix&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-green?style=flat)

</div>

---

## Sobre o Projeto

O NetBIPI nasceu de uma necessidade real do dia a dia de suporte técnico: **analistas N1/N2 precisam operar entre múltiplas ferramentas ao mesmo tempo** — Zabbix em uma aba, GLPI em outra, logs no terminal, e ainda fazer diagnósticos de rede.

Esta plataforma centraliza tudo isso em um único painel operacional, reduzindo o tempo de resposta a incidentes e facilitando a gestão de chamados e ativos.

---

## Funcionalidades

### Monitoramento em Tempo Real
- Recebe alertas do **Zabbix** via API e webhook
- Notificações via **WebSocket** — alerta aparece na tela sem recarregar
- Reconhecimento e resolução de alertas com sincronização ao Zabbix
- Escalada automática de alertas críticos sem reconhecimento após 10 minutos

### Service Desk
- Integração bidirecional com **GLPI** (criação, atualização e encerramento de chamados)
- Abertura automática de chamado para alertas de severidade alta/disaster
- Comentários, histórico e timeline completa de cada incidente
- Dashboard por turno com passagem de plantão estruturada

### Infraestrutura e Ativos
- Inventário de servidores Linux, Windows Server e dispositivos de rede
- Mapa visual de infraestrutura com status em tempo real
- Painel Cloud com status de instâncias **AWS** e **Azure**

### Diagnóstico de Rede
- Ping, DNS Lookup, verificação de porta TCP e Traceroute
- Histórico de diagnósticos por analista
- Executado diretamente do browser, sem precisar de terminal

### Base de Conhecimento
- Artigos de runbook vinculados a triggers do Zabbix
- Busca por palavra-chave, categoria e tags
- N1 consulta o procedimento padrão antes de escalar

### Relatórios
- Exportação em **PDF** e **Excel** com resumo de incidentes por período
- MTTR, SLA por analista e top hosts incidentados
- Heatmap e gráficos de tendência

### Outros
- Modo Quiosque **NOC** para TV da sala de operações
- Instalável como **PWA** no celular
- Auditoria completa de todas as ações do sistema

---

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 18 + TypeScript + Tailwind CSS + Vite |
| Backend | Node.js 20 + Express + TypeScript |
| Banco de dados | PostgreSQL 16 |
| Tempo real | Socket.io (WebSocket) |
| Autenticação | JWT + bcrypt |
| Monitoramento | Zabbix 7.0 (API JSON-RPC) |
| ITSM | GLPI REST API |
| Relatórios | PDFKit + ExcelJS |
| Agendamento | node-cron |
| Containerização | Docker + Docker Compose |

---

## Arquitetura

```
┌─────────────────────────────────────────────────────────┐
│                      INFRAESTRUTURA                      │
│        Servidores · Switches · VMs · Containers         │
└──────────────┬───────────────────────┬──────────────────┘
               │ Agente/SNMP           │ Alertas manuais
┌──────────────▼──────────┐  ┌─────────▼──────────────────┐
│   ZABBIX  (porta 8080)  │  │   GLPI  (porta 8081)       │
│   Monitoramento ativo   │  │   Service Desk / ITSM      │
└──────────────┬──────────┘  └─────────┬──────────────────┘
               │ Webhook/API            │ REST API
┌──────────────▼────────────────────────▼──────────────────┐
│              NetBIPI Backend  (porta 3001)                │
│   Alertas · Chamados · Ativos · Logs · Diagnóstico       │
│   WebSocket · Escalada automática · Relatórios           │
└──────────────────────────┬────────────────────────────────┘
                           │
┌──────────────────────────▼────────────────────────────────┐
│              NetBIPI Frontend  (porta 80)                 │
│   Dashboard · NOC Kiosk · Mapa · Base de Conhecimento    │
└───────────────────────────────────────────────────────────┘
```

---

## Início Rápido

### Pré-requisitos
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) instalado e rodando

### 1. Clonar e subir

```bash
git clone https://github.com/seu-usuario/netbipi.git
cd netbipi
docker-compose up -d
```

Aguarde ~60 segundos e acesse **http://localhost**

### 2. Credenciais padrão

| Usuário | E-mail | Senha |
|---------|--------|-------|
| Administrador | `admin@netbipi.local` | `admin123` |
| Analista N1 | `n1@netbipi.local` | `analyst123` |
| Analista N2 | `n2@netbipi.local` | `analyst123` |

> ⚠️ Altere as senhas após o primeiro acesso em produção.

---

## Perfis Docker Compose

O projeto usa perfis para ativar integrações opcionais:

```bash
# Somente NetBIPI (mock — padrão para testes)
docker-compose up -d

# NetBIPI + Zabbix
docker-compose --profile monitoring up -d

# NetBIPI + GLPI
docker-compose --profile itsm up -d

# Tudo (NetBIPI + Zabbix + GLPI)
docker-compose --profile full up -d
```

### Serviços disponíveis

| Serviço | URL | Credenciais padrão |
|---------|-----|--------------------|
| NetBIPI | http://localhost | admin@netbipi.local / admin123 |
| NetBIPI API | http://localhost:3001 | — |
| Zabbix | http://localhost:8080 | Admin / zabbix |
| GLPI | http://localhost:8081 | glpi / glpi |

---

## Configuração das Integrações

Após subir com `--profile full`:

```bash
# Configura Zabbix e GLPI automaticamente
bash scripts/setup-integrations.sh

# Ativar integrações reais no .env:
MOCK_INTEGRATIONS=false
```

Consulte [INTEGRACAO.md](INTEGRACAO.md) para o guia completo.

---

## Desenvolvimento sem Docker

```bash
# Backend
cd backend
cp ../.env.example .env   # ajustar DATABASE_URL
npm install
npm run dev               # http://localhost:3001

# Frontend (outro terminal)
cd frontend
npm install
npm run dev               # http://localhost:5173
```

---

## Variáveis de Ambiente

Copie `.env.example` para `.env` e ajuste:

| Variável | Descrição | Padrão |
|----------|-----------|--------|
| `DATABASE_URL` | Connection string PostgreSQL | `postgresql://netbipi:netbipi123@...` |
| `JWT_SECRET` | Chave secreta JWT (mín. 32 chars) | — |
| `MOCK_INTEGRATIONS` | Usar dados mock (`true`/`false`) | `true` |
| `ZABBIX_URL` | URL da API Zabbix | `http://zabbix-web:8080/...` |
| `ZABBIX_PASSWORD` | Senha do usuário Zabbix | `zabbix` |
| `GLPI_URL` | URL da API GLPI | `http://glpi/apirest.php` |
| `GLPI_APP_TOKEN` | App token do GLPI | — |
| `GLPI_USER_TOKEN` | User token do GLPI | — |

---

## Estrutura do Projeto

```
netbipi/
├── backend/                  # API REST + WebSocket
│   └── src/
│       ├── config/           # Banco de dados e variáveis
│       ├── controllers/      # Lógica de negócio
│       ├── integrations/     # Zabbix e GLPI
│       ├── middlewares/      # Auth, error handler
│       ├── routes/           # Endpoints da API
│       ├── services/         # Escalada automática, auditoria
│       └── socket/           # WebSocket (Socket.io)
├── frontend/                 # Interface React
│   └── src/
│       ├── components/       # Componentes reutilizáveis
│       ├── hooks/            # useSocket, etc.
│       ├── pages/            # Páginas da aplicação
│       ├── services/         # Chamadas à API
│       └── store/            # Estado global (Zustand)
├── database/
│   ├── init.sql              # Schema + dados mock
│   └── migrations/           # Migrações adicionais
├── zabbix/
│   ├── alertscripts/         # Scripts de alerta
│   └── setup/                # Configuração automática
├── glpi/setup/               # Configuração da API GLPI
├── scripts/                  # Scripts utilitários
├── docker-compose.yml        # Orquestração dos containers
├── .env.example              # Template de variáveis
├── INTEGRACAO.md             # Guia de integração
└── netbipi.bat               # Gerenciador Windows
```

---

## API — Principais Endpoints

```
POST   /api/auth/login              Autenticação
GET    /api/alerts                  Listar alertas
POST   /api/alerts/sync-zabbix      Sincronizar com Zabbix
PUT    /api/alerts/:id/acknowledge  Reconhecer alerta
GET    /api/tickets                 Listar chamados
POST   /api/tickets                 Criar chamado
POST   /api/tickets/from-alert/:id  Criar chamado a partir de alerta
GET    /api/assets                  Inventário de ativos
GET    /api/logs                    Logs com filtros
POST   /api/network/ping            Executar ping
POST   /api/network/dns             DNS lookup
POST   /api/network/port            Verificar porta TCP
GET    /api/knowledge               Base de conhecimento
GET    /api/reports/pdf             Exportar relatório PDF
GET    /api/reports/excel           Exportar relatório Excel
GET    /api/dashboard               Métricas do dashboard
GET    /api/shift/summary           Resumo do turno atual
GET    /api/cloud/status            Status AWS + Azure
POST   /webhooks/zabbix             Receber alertas do Zabbix
```

---

## Roadmap

- [x] Dashboard operacional com métricas em tempo real
- [x] Integração Zabbix (API + webhook)
- [x] Integração GLPI (REST API)
- [x] Inventário de ativos com mapa visual
- [x] Diagnóstico de rede (ping, DNS, porta, traceroute)
- [x] Base de conhecimento com runbooks
- [x] Relatórios PDF e Excel
- [x] Modo Quiosque NOC
- [x] PWA instalável
- [x] Escalada automática de incidentes
- [x] Dashboard por turno / passagem de plantão
- [ ] Notificação por WhatsApp / Telegram
- [ ] Envio de e-mail automático para alertas críticos
- [ ] Execução remota de scripts (Runbook Automation)
- [ ] Janelas de manutenção programada
- [ ] Monitor de uptime independente
- [ ] Autenticação via Active Directory (LDAP)
- [ ] Multi-empresa / Multi-tenant
- [ ] Análise de tendência e predição de falhas

---

## Contribuindo

1. Faça um fork do projeto
2. Crie uma branch para sua feature: `git checkout -b feature/minha-feature`
3. Commit suas mudanças: `git commit -m 'feat: adiciona minha feature'`
4. Push para a branch: `git push origin feature/minha-feature`
5. Abra um Pull Request

---

## Licença

Distribuído sob a licença MIT. Veja [LICENSE](LICENSE) para mais informações.

---

<div align="center">
Feito com ❤️ para equipes de suporte técnico e infraestrutura
</div>
