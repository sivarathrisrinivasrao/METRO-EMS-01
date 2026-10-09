import yaml
import socket
import sqlite3
import os
import sys
from pathlib import Path

def get_base_path():
    if getattr(sys, "frozen", False):
        return Path(sys._MEIPASS)
    return Path(__file__).resolve().parent

BASE_PATH = os.getcwd()
CONFIG_PATH = BASE_PATH + "/config"+ "/config.yaml"

REQUIRED_KEYS = {
    "app": ["name", "env"],
    "server": ["host", "port"],
    # "databases": ["auth_db", "firmware_state_db"],
    "opennms": ["base_url", "timeout"],
    # "paths": ["firmware_dir"],
}

class AppConfig:
    def __init__(self, Path: str | None = None, raw: dict | None = None):
        if raw is None:
            raw = {}

        self.raw = raw
        self.app = raw.get("app", {})
        self.server = raw.get("server", {})
        self.opennms = raw.get("opennms", {})
        self.security = raw.get("security", {})

def load_config(config_path: str) -> AppConfig:
    if not Path(config_path).exists():
        raise RuntimeError("❌ config.yaml not found")

    with open(config_path, "r") as f:
        raw = yaml.safe_load(f)

    for section, keys in REQUIRED_KEYS.items():
        if section not in raw:
            raise RuntimeError(f"❌ Missing section: {section}")
        for key in keys:
            if key not in raw[section]:
                raise RuntimeError(f"❌ Missing key: {section}.{key}")

    return AppConfig(raw=raw)

# ---------- PORT CHECK ----------
def is_port_free(host: str, port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(1)
        return s.connect_ex((host, port)) != 0

def find_free_port(host: str, start_port: int) -> int:
    port = start_port
    while not is_port_free(host, port):
        port += 1
    return port

# ---------- STARTUP VALIDATION ----------
def validate_runtime(config: AppConfig):
    # ---- Port validation ----
    host = config.server.get("host")
    port = config.server.get("port")
    if not host:
        raise ValueError("Missing 'host' in server configuration")

    if not port:
        raise ValueError("Missing 'port' in server configuration")

    if not isinstance(port, int):
        raise ValueError("'port' must be an integer")

    if not is_port_free(host, port):
        # new_port = find_free_port(host, port + 1)
        # print(f"⚠️ Port {port} in use → switching to {new_port}")
        # config.server["port"] = new_port
        print(f"⚠️ Port {port} is already in use")
        sys.exit(1)
    else:
        print(f"✅ Port {port} available")

    # ---- Firmware directory ----
    # fw_dir = Path(config.paths["firmware_dir"]).resolve()
    # fw_dir.mkdir(parents=True, exist_ok=True)
    # print(f"✅ Firmware directory ready: {fw_dir}")

    # ---- SQLite DB validation ----
    # for db_name, db_path in config.databases.items():
    #     try:
    #         conn = sqlite3.connect(db_path)
    #         conn.execute("SELECT 1")
    #         conn.close()
    #         print(f"✅ Database OK: {db_name} ({db_path})")
    #     except Exception as e:
    #         raise RuntimeError(f"❌ Database error [{db_name}]: {e}")

    # ---- OpenNMS URL ----
    base_url = config.opennms.get("base_url")
    if not base_url or not base_url.startswith("http"):
        raise RuntimeError("❌ Invalid OpenNMS base_url")   

    print("✅ All startup checks passed")
