#!/usr/bin/env python3
"""
NetBIPI - Script de Configuração Automática do Zabbix
======================================================
Este script configura o Zabbix para enviar alertas ao NetBIPI via webhook.

Pré-requisitos:
    pip install requests

Uso:
    python3 zabbix/setup/configure_zabbix.py [--url http://localhost:8080] [--netbipi-url http://localhost:3001]

O script realiza:
    1. Login via API Zabbix
    2. Criação do Media Type "NetBIPI Webhook"
    3. Vinculação do media type ao usuário Admin
    4. Criação da Action "Enviar alertas ao NetBIPI"
"""

import argparse
import json
import os
import sys
import time

try:
    import requests
except ImportError:
    print("❌ Módulo 'requests' não encontrado. Execute: pip install requests")
    sys.exit(1)


# ============================================================
# Configuration
# ============================================================
DEFAULT_ZABBIX_URL = "http://localhost:8080/api_jsonrpc.php"
DEFAULT_NETBIPI_URL = "http://backend:3001"
DEFAULT_WEBHOOK_SECRET = os.getenv("ZABBIX_WEBHOOK_SECRET", "CHANGE_ME_ZABBIX_WEBHOOK_SECRET")
ZABBIX_USER = os.getenv("ZABBIX_USER", "Admin")
ZABBIX_PASSWORD = os.getenv("ZABBIX_PASSWORD", "CHANGE_ME_ZABBIX_PASSWORD")

# ============================================================
# Webhook JavaScript for Zabbix Media Type
# This script runs inside Zabbix when an alert fires.
# ============================================================
WEBHOOK_SCRIPT = """
try {
    var params = JSON.parse(value);
    var req = new HttpRequest();

    req.addHeader('Content-Type: application/json');
    req.addHeader('X-Webhook-Secret: ' + params.webhook_secret);

    var payload = JSON.stringify({
        eventid:      params.eventid,
        hostname:     params.hostname,
        trigger_name: params.trigger_name,
        severity:     params.severity,
        status:       params.status,
        message:      params.message,
        item_value:   params.item_value,
        event_date:   params.event_date,
        event_time:   params.event_time
    });

    var url = params.netbipi_url + '/webhooks/zabbix';
    var response = req.post(url, payload);
    var httpCode = req.getStatus();

    if (httpCode < 200 || httpCode >= 300) {
        throw 'HTTP ' + httpCode + ': ' + response;
    }

    return 'NetBIPI notificado com sucesso (HTTP ' + httpCode + ')';

} catch (e) {
    throw 'NetBIPI Webhook falhou: ' + e;
}
"""

# ============================================================
# API helper
# ============================================================
class ZabbixAPI:
    def __init__(self, url: str):
        self.url = url
        self.auth_token = None
        self.request_id = 1

    def call(self, method: str, params: dict, require_auth: bool = True) -> dict:
        payload = {
            "jsonrpc": "2.0",
            "method": method,
            "params": params,
            "id": self.request_id,
        }
        if require_auth and self.auth_token:
            payload["auth"] = self.auth_token

        self.request_id += 1

        try:
            resp = requests.post(
                self.url, json=payload,
                headers={"Content-Type": "application/json"},
                timeout=15
            )
            resp.raise_for_status()
            data = resp.json()
        except requests.exceptions.ConnectionError:
            raise ConnectionError(f"Não foi possível conectar ao Zabbix em: {self.url}")
        except requests.exceptions.Timeout:
            raise TimeoutError("Timeout ao conectar ao Zabbix")

        if "error" in data:
            raise RuntimeError(
                f"Zabbix API Error [{data['error']['code']}]: "
                f"{data['error']['message']} — {data['error']['data']}"
            )
        return data["result"]

    def login(self, username: str, password: str) -> str:
        result = self.call("user.login", {"username": username, "password": password}, require_auth=False)
        self.auth_token = result
        return result

    def get_version(self) -> str:
        return self.call("apiinfo.version", {}, require_auth=False)


# ============================================================
# Wait for Zabbix
# ============================================================
def wait_for_zabbix(api: ZabbixAPI, max_attempts: int = 30) -> bool:
    print(f"⏳ Aguardando Zabbix ficar disponível em {api.url}...")
    for attempt in range(1, max_attempts + 1):
        try:
            version = api.get_version()
            print(f"✅ Zabbix {version} disponível!")
            return True
        except (ConnectionError, TimeoutError):
            print(f"   Tentativa {attempt}/{max_attempts} — aguardando...")
            time.sleep(10)
        except Exception as e:
            print(f"   Tentativa {attempt}/{max_attempts} — erro: {e}")
            time.sleep(10)
    return False


# ============================================================
# Main configuration
# ============================================================
def configure(zabbix_url: str, netbipi_url: str, webhook_secret: str):
    api = ZabbixAPI(zabbix_url)

    if not wait_for_zabbix(api):
        print("❌ Zabbix não ficou disponível. Verifique os containers.")
        sys.exit(1)

    if not ZABBIX_PASSWORD or ZABBIX_PASSWORD.startswith("CHANGE_ME_"):
        print("❌ Defina ZABBIX_PASSWORD com a senha real do Zabbix antes de executar este script.")
        sys.exit(1)

    # --- Login ---
    print("\n🔐 Autenticando no Zabbix...")
    try:
        api.login(ZABBIX_USER, ZABBIX_PASSWORD)
        print(f"   Autenticado como '{ZABBIX_USER}'")
    except Exception as e:
        print(f"❌ Falha no login: {e}")
        sys.exit(1)

    # --- Media Type parameters ---
    media_parameters = [
        {"name": "netbipi_url",    "value": netbipi_url},
        {"name": "webhook_secret", "value": webhook_secret},
        {"name": "eventid",        "value": "{EVENT.ID}"},
        {"name": "hostname",       "value": "{HOST.NAME}"},
        {"name": "trigger_name",   "value": "{TRIGGER.NAME}"},
        {"name": "severity",       "value": "{TRIGGER.NSEVERITY}"},
        {"name": "status",         "value": "{TRIGGER.STATUS}"},
        {"name": "message",        "value": "{TRIGGER.DESCRIPTION}"},
        {"name": "item_value",     "value": "{ITEM.VALUE}"},
        {"name": "event_date",     "value": "{EVENT.DATE}"},
        {"name": "event_time",     "value": "{EVENT.TIME}"},
    ]

    # --- Create or update Media Type ---
    print("\n📡 Configurando Media Type 'NetBIPI Webhook'...")
    existing_mt = api.call("mediatype.get", {"filter": {"name": "NetBIPI Webhook"}})

    if existing_mt:
        mt_id = existing_mt[0]["mediatypeid"]
        api.call("mediatype.update", {
            "mediatypeid": mt_id,
            "script": WEBHOOK_SCRIPT.strip(),
            "parameters": media_parameters,
            "status": "0",  # enabled
            "process_tags": "1",
            "show_event_menu": "1",
            "event_menu_url": netbipi_url,
            "event_menu_name": "Ver no NetBIPI",
            "description": "Envia alertas para o NetBIPI Hub Operacional",
        })
        print(f"   Media Type atualizado (ID: {mt_id})")
    else:
        result = api.call("mediatype.create", {
            "name": "NetBIPI Webhook",
            "type": "4",  # Webhook
            "script": WEBHOOK_SCRIPT.strip(),
            "parameters": media_parameters,
            "status": "0",
            "process_tags": "1",
            "show_event_menu": "1",
            "event_menu_url": netbipi_url,
            "event_menu_name": "Ver no NetBIPI",
            "description": "Envia alertas para o NetBIPI Hub Operacional",
        })
        mt_id = result["mediatypeids"][0]
        print(f"   Media Type criado (ID: {mt_id})")

    # --- Get Admin user ---
    print("\n👤 Configurando media para usuário Admin...")
    users = api.call("user.get", {
        "filter": {"username": ZABBIX_USER},
        "output": ["userid", "username"],
    })

    if not users:
        print("❌ Usuário 'Admin' não encontrado")
        sys.exit(1)

    admin_user_id = users[0]["userid"]

    # Add media to admin user
    try:
        api.call("user.update", {
            "userid": admin_user_id,
            "medias": [{
                "mediatypeid": mt_id,
                "sendto": netbipi_url,
                "active": "0",           # enabled
                "severity": "63",        # all severities (bitmask: 1+2+4+8+16+32)
                "period": "1-7,00:00-24:00",
            }],
        })
        print(f"   Media vinculada ao Admin (ID: {admin_user_id})")
    except Exception as e:
        print(f"   ⚠️  Aviso ao vincular media (pode já existir): {e}")

    # --- Create or skip Action ---
    print("\n⚡ Configurando Action 'Enviar alertas ao NetBIPI'...")
    existing_actions = api.call("action.get", {
        "filter": {"name": "Enviar alertas ao NetBIPI"},
    })

    if existing_actions:
        print("   Action já existe, pulando criação.")
    else:
        action_result = api.call("action.create", {
            "name": "Enviar alertas ao NetBIPI",
            "eventsource": "0",  # Trigger events
            "status": "0",       # Enabled
            "filter": {
                "evaltype": "0",  # AND
                "conditions": [
                    {
                        "conditiontype": "5",   # Trigger severity
                        "operator": "5",         # >= (greater or equal)
                        "value": "1",            # Information (captures all severities)
                    },
                ],
            },
            "operations": [
                {
                    "operationtype": "0",  # Send message
                    "esc_period": "0",
                    "esc_step_from": "1",
                    "esc_step_to": "1",
                    "opmessage": {
                        "default_msg": "0",
                        "mediatypeid": mt_id,
                        "subject": "PROBLEMA: {TRIGGER.NAME}",
                        "message": "",  # empty = use media type default
                    },
                    "opmessage_usr": [{"userid": admin_user_id}],
                },
            ],
            "recovery_operations": [
                {
                    "operationtype": "11",  # Notify all involved
                    "opmessage": {
                        "default_msg": "0",
                        "mediatypeid": mt_id,
                        "subject": "RESOLVIDO: {TRIGGER.NAME}",
                        "message": "",
                    },
                },
            ],
        })
        action_id = action_result["actionids"][0]
        print(f"   Action criada (ID: {action_id})")

    # --- Summary ---
    print("\n" + "="*60)
    print("✅ ZABBIX CONFIGURADO COM SUCESSO!")
    print("="*60)
    print(f"  Media Type : NetBIPI Webhook (ID: {mt_id})")
    print(f"  Destino    : {netbipi_url}/webhooks/zabbix")
    print(f"  Secret     : {webhook_secret}")
    print(f"  Zabbix UI  : {zabbix_url.replace('/api_jsonrpc.php', '')}")
    print("")
    print("  Credenciais do Zabbix:")
    print("  Usuário : definido em ZABBIX_USER")
    print("  Senha   : definida em ZABBIX_PASSWORD")
    print("")
    print("  ⚠️  IMPORTANTE: Altere a senha padrão do Zabbix após o primeiro acesso!")
    print("="*60)


# ============================================================
# CLI
# ============================================================
def main():
    parser = argparse.ArgumentParser(
        description="Configura o Zabbix para enviar alertas ao NetBIPI"
    )
    parser.add_argument(
        "--url", default=DEFAULT_ZABBIX_URL,
        help=f"URL da API Zabbix (padrão: {DEFAULT_ZABBIX_URL})"
    )
    parser.add_argument(
        "--netbipi-url", default=DEFAULT_NETBIPI_URL,
        help=f"URL base do NetBIPI (padrão: {DEFAULT_NETBIPI_URL})"
    )
    parser.add_argument(
        "--secret", default=DEFAULT_WEBHOOK_SECRET,
        help="Webhook secret compartilhado"
    )

    args = parser.parse_args()
    configure(args.url, args.netbipi_url, args.secret)


if __name__ == "__main__":
    main()
