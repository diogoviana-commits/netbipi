# Changelog

All notable changes to NetBIPI will be documented in this file.

## [1.0.0] - 2026-03-25

### Added

- First public open source release of NetBIPI.
- Unified operational dashboard for alerts, tickets, assets, logs, reports and network diagnostics.
- Zabbix integration with webhook support.
- GLPI integration for service desk workflows.
- Windows launcher, setup scripts and screenshot automation.
- Docker Compose profiles for core, monitoring, ITSM and full stacks.
- GitHub Actions validation for backend and frontend builds.

### Changed

- Sensitive defaults were replaced with environment placeholders.
- Demo credentials and tokens were moved to local-only seeds or generated setup flows.
- Public documentation was reorganized for a cleaner launch flow.

### Notes

- This release is ready for laboratory or controlled environments.
- Before using it in production, define real credentials in `.env`, configure the integrations and review the demo seed in `database/init.sql`.
