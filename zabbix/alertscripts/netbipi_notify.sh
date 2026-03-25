#!/bin/bash
# Este diretório é montado em /usr/lib/zabbix/alertscripts no container Zabbix.
# O NetBIPI usa o tipo de mídia "Webhook" nativo do Zabbix (JavaScript),
# não scripts shell. Este arquivo existe apenas para criar o diretório.
#
# Para configurar o webhook, execute:
#   python3 zabbix/setup/configure_zabbix.py
echo "NetBIPI alertscripts directory - use Webhook media type in Zabbix"
