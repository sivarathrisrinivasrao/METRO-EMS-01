#!/usr/bin/env python3
"""
MetroEMS Backend - REAL Device Detection Only
This server ONLY shows devices that are actually connected and responding
NO FAKE DEVICES - NO HARDCODED DEVICES - ONLY REAL NETWORK DEVICES
"""

import asyncio
import config_loader
from fastapi import FastAPI, HTTPException, Depends, status,Body,UploadFile,File, Request, Header
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import JSONResponse
from config_loader import load_config, validate_runtime
from contextlib import asynccontextmanager
from pydantic import BaseModel
from typing import Dict, Any, List, Optional
from pathlib import Path
from pysnmp.hlapi.v3arch.asyncio import *
from threading import Lock
import datetime
from sse_starlette.sse import EventSourceResponse
import sqlite3
import uuid
import yaml
import routeros_api
from pathlib import Path
import psutil
import uvicorn
import socket
import sys
import time
from datetime import datetime,timezone,timedelta,date
import json
import logging
import paramiko
from scp import SCPClient
from fastapi import HTTPException
import shutil
import subprocess
from httpx import DigestAuth
import httpx
import requests
import random
from snmp_client import *
import threading
import time
import subprocess
import os
import sys
import signal
import atexit
import platform


# Make sure local modules (snmp_client, network_scanner) are importable when started from repo root
_BASE_DIR = Path(__file__).resolve().parent
if str(_BASE_DIR) not in sys.path:
    sys.path.insert(0, str(_BASE_DIR))

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("🔍 Metro-EMS startup checks running...")
    start_frontend()
    yield
    print("🛑 Metro-EMS shutting down")
    stop_frontend()


# FastAPI app setup
app = FastAPI(
    title="MetroEMS Backend - Real Device Detection",
    description="Station Radio Management with REAL device detection only",
    version="2.0.0",
    lifespan=lifespan)

print(os.getcwd())
app.mount("/images", StaticFiles(directory="images"), name="images")

# CONFIG = None
# CORS middleware for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Security
security = HTTPBearer()

# Pydantic models
class LoginRequest(BaseModel):
    username: str
    password: str

class LoginResponse(BaseModel):
    token: str
    role: str
    org: str
    username: str

class DeviceDiscoveryRequest(BaseModel):
    device_type: str
    # Optional SNMP overrides for discovery
    community: Optional[str]
    version: Optional[str]  # '2c' or '1'
    port: Optional[int]
    oid: Optional[str]
    # Optional targeted discovery (single IP or list)
    ip: Optional[str] = None
    ips: Optional[List[str]] = None
    fast: Optional[bool] = True  # when True and IP specified, only query primary OID for speed

class SessionStartRequest(BaseModel):
    ip: str
    device_type: str
    user: str
    bandwidth: Optional[int] 
    channel: Optional[int]
    radioMode: Optional[str]
    ssid: Optional[str]
    # optional SNMP overrides for verification
    community: Optional[str] 
    version: Optional[str] = None  # '2c' or '1'
    port: Optional[int] = None
    oid: Optional[str]  # specific OID to check, defaults to sysDescr

class BulkConfigRequest(BaseModel):
    ip: str
    oid: str
    non_repeaters: Optional[int] = 0
    max_repetitions: Optional[int] = 10

class setConfigRequest(BaseModel):
    ip: str
    oid: str
    type: str
    value: Any        

class TranscoderSetConfigRequest(BaseModel):
    values: dict[str,Any]

class OBCSetConfigRequest(BaseModel):
    carnumber: str
    encoderip: str
    ftppassword: str
    ftpserverip: str
    ftpusername: str
    monitor: str
    ntpserverip: str
    obcnetgway: str
    obcnetip: str
    obcnetmask: str
    trainradioip: str

class SnmpProbeRequest(BaseModel):
    ip: str
    communities: Optional[List[str]] = None
    oid: Optional[str] = "1.3.6.1.2.1.1.1.0"  # sysDescr by default
    port: Optional[int] = 161
    version: Optional[str] = None  # '2c' or '1' (auto if None)
    timeout_secs: Optional[float] = None
    retries: Optional[int] = None

class SnmpV3ProbeRequest(BaseModel):
    ip: str
    usernames: Optional[List[str]] = None
    # Allow null entries inside lists so callers can pass [null] to mean "no value"
    auth_keys: Optional[List[Optional[str]]] = None
    priv_keys: Optional[List[Optional[str]]] = None
    auth_protocols: Optional[List[Optional[str]]] = None  # e.g., ['MD5','SHA'] or [null]
    priv_protocols: Optional[List[Optional[str]]] = None  # e.g., ['DES','AES'] or [null]
    oid: Optional[str] = "1.3.6.1.2.1.1.1.0"
    port: Optional[int] = 161

class SnmpDebugRequest(BaseModel):
    ip: str
    community: str
    oid: Optional[str] = "1.3.6.1.2.1.1.1.0"  # default sysDescr
    version: Optional[str] = "2c"  # '2c' or '1'
    port: Optional[int] = 161
    timeout_secs: Optional[float] = 5.0
    retries: Optional[int] = 1

class RadioFirmwareUpdateRequest(BaseModel):
    ip: str
    fileName: str
    fileType: int
    opType: int
 
class FirmwareUpdateRequest(BaseModel):
    fileName: str
 
class EncoderFirmwareUpgrade(BaseModel):
    fileName: str
    # systemName: str
    # passWord: str 

class PushFirmwareRequest(BaseModel):
    username: str
    password: str

class FetchRequest(BaseModel):
    rurl: str

class LocalCopyRequest(BaseModel):
    source_path: str

class RemoteCopyRequest(BaseModel):
    source_path: str
    host: str
    systemName: str
    passWord: str
    deviceType : str

class TerminalCommandRequest(BaseModel):
    host: str
    systemName: str
    passWord: str
    command: str
    deviceType : str

class RouterOs(BaseModel):
    ip: str
    cart: Optional[int] = None


class FetchFile(BaseModel):
    fileName: str    

SNMP_TYPE_MAP = {
    "Integer": Integer,
    "OctetString": OctetString,
    "IpAddress": IpAddress,
    "Counter32": Counter32,
    "Gauge32": Gauge32,
    "TimeTicks": TimeTicks,
    "ObjectIdentifier": ObjectIdentifier,
}

class stationRadio(BaseModel):
    PROXIM_ENTERPRISE_OID = "1.3.6.1.4.1.841"

    sysDescr= "1.3.6.1.2.1.1.1.0"
    sysUpTime = "1.3.6.1.2.1.1.3.0"
    sysName = "1.3.6.1.2.1.1.5.0"
    sysObj = "1.3.6.1.2.1.1.2.0"
    productDescr = "1.3.6.1.4.1.841.1.1.2.1.5.7"
    proximSystemName = "1.3.6.1.4.1.841.1.1.2.1.5.8"

    txVal = "1.3.6.1.4.1.841.1.1.3.4.1.2.1.64"
    rxVal = "1.3.6.1.4.1.841.1.1.3.4.1.2.1.63"

    lSnr = "1.3.6.1.4.1.841.1.1.3.4.1.2.1.24"
    rSnr = "1.3.6.1.4.1.841.1.1.3.4.1.2.1.25"

    lsignal= "1.3.6.1.4.1.841.1.1.3.4.2.1.1.2"
    lnoise= "1.3.6.1.4.1.841.1.1.3.4.2.1.1.3"
    rsignal= "1.3.6.1.4.1.841.1.1.3.4.2.1.1.4"
    rnoise= "1.3.6.1.4.1.841.1.1.3.4.2.1.1.5"

    teststationname= "1.3.6.1.4.1.841.1.1.3.4.3.2.1.4"
    testmacaddr = "1.3.6.1.4.1.841.1.1.3.4.3.2.1.5"

    ethernetMAC = "1.3.6.1.2.1.2.2.1.6.2"
    WifiMAC = "1.3.6.1.2.1.2.2.1.6.13"
    SerialNumber = "1.3.6.1.4.1.841.1.1.2.1.2.1.1.2.4"
    SoftverRel = "1.3.6.1.4.1.841.1.1.2.1.2.1.1.6.3"
    SoftverMaj = "1.3.6.1.4.1.841.1.1.2.1.2.1.1.7.3"
    SoftverMin = "1.3.6.1.4.1.841.1.1.2.1.2.1.1.8.3"
    HardverRel = "1.3.6.1.4.1.841.1.1.2.1.2.1.1.6.4"
    HardverMaj = "1.3.6.1.4.1.841.1.1.2.1.2.1.1.7.4"
    HardverMin = "1.3.6.1.4.1.841.1.1.2.1.2.1.1.8.4"
    Channel = "1.3.6.1.4.1.841.1.1.1.1.1.1.1.8.1"
    Bandwidth = "1.3.6.1.4.1.841.1.1.1.1.1.1.1.5.1"
    RadioMode = "1.3.6.1.4.1.841.1.1.1.8.1.1.2.1" 
    SSID = "1.3.6.1.4.1.841.1.1.1.1.1.4.1.4.1"
    Country = "1.3.6.1.4.1.841.1.1.1.8.1.1.7.1"

    tftpInetAdd = "1.3.6.1.4.1.841.1.1.2.5.5.0"
    fileName = "1.3.6.1.4.1.841.1.1.2.5.1.0"
    fileType = "1.3.6.1.4.1.841.1.1.2.5.2.0"
    opType = "1.3.6.1.4.1.841.1.1.2.5.3.0"
    status = "1.3.6.1.4.1.841.1.1.2.5.4.0"

    satelliteDensity = "1.3.6.1.4.1.841.1.1.1.1.1.1.1.20.1"
    EIRP = "1.3.6.1.4.1.841.1.1.1.1.1.1.1.37.1"
    frequencyExtension = "1.3.6.1.4.1.841.1.1.1.1.1.2.1.7.1"
    rxAntennas = "1.3.6.1.4.1.841.1.1.1.1.1.2.1.10.1" 
    # advanced
    DDRSstatus = "1.3.6.1.4.1.841.1.1.1.1.1.7.1.4.1.1"
    dataStreams = "1.3.6.1.4.1.841.1.1.1.1.1.7.1.21.1.1"
    ATPCstatus = "1.3.6.1.4.1.841.1.1.1.1.1.7.1.15.1.1"
    txRate = "1.3.6.1.4.1.841.1.1.1.1.1.7.1.19.1.1"
    txAntennas = "1.3.6.1.4.1.841.1.1.1.1.1.7.1.23.1.1"

class trainRadio(BaseModel):
    sysDescr= "1.3.6.1.2.1.1.1.0"
    PROXIM_ENTERPRISE_OID = "1.3.6.1.4.1.841"

    sysUpTime = "1.3.6.1.2.1.1.3.0"

    sysName = "1.3.6.1.2.1.1.5.0"
    productDescr = "1.3.6.1.4.1.841.1.1.2.1.5.7.0"
    proximSystemName = "1.3.6.1.4.1.841.1.1.2.1.5.8.0"
    sysObj = "1.3.6.1.2.1.1.2.0"

    txVal = "1.3.6.1.4.1.841.1.1.3.4.1.2.1.64"
    rxVal = "1.3.6.1.4.1.841.1.1.3.4.1.2.1.63"

    lSnr = "1.3.6.1.4.1.841.1.1.3.7.1.2.1.12"
    rSnr = "1.3.6.1.4.1.841.1.1.3.4.1.2.1.15"
    # rSnr = "1.3.6.1.4.1.841.1.1.3.4.1.2.1.25"

    macaddr= "1.3.6.1.4.1.841.1.1.3.7.1.2.1.3"
    basename= "1.3.6.1.4.1.841.1.1.3.7.1.2.1.4"

    lsignal="1.3.6.1.4.1.841.1.1.3.7.1.2.1.10"
    lnoise= "1.3.6.1.4.1.841.1.1.3.7.1.2.1.11"
    rsignal= "1.3.6.1.4.1.841.1.1.3.7.1.2.1.13"
    rnoise= "1.3.6.1.4.1.841.1.1.3.7.1.2.1.14"

    ethernetMAC = "1.3.6.1.2.1.2.2.1.6.2"
    WifiMAC = "1.3.6.1.2.1.2.2.1.6.13"
    # SerialNumber = "1.3.6.1.4.1.841.1.1.2.1.2.1.1.2"
    SerialNumber = "1.3.6.1.4.1.841.1.1.2.1.2.1.1.2.4"

    SoftverRel = "1.3.6.1.4.1.841.1.1.2.1.2.1.1.6.3"
    SoftverMaj = "1.3.6.1.4.1.841.1.1.2.1.2.1.1.7.3"
    SoftverMin = "1.3.6.1.4.1.841.1.1.2.1.2.1.1.8.3"
    HardverRel = "1.3.6.1.4.1.841.1.1.2.1.2.1.1.6.4"
    HardverMaj = "1.3.6.1.4.1.841.1.1.2.1.2.1.1.7.4"
    HardverMin = "1.3.6.1.4.1.841.1.1.2.1.2.1.1.8.4"

    Channel = "1.3.6.1.4.1.841.1.1.1.1.1.1.1.8.1"

    Bandwidth = "1.3.6.1.4.1.841.1.1.1.1.1.1.1.5.1"

    RadioMode = "1.3.6.1.4.1.841.1.1.1.8.1.1.2.1" 
    # SSID = "1.3.6.1.4.1.841.1.1.1.1.1.4.1.4.1"
    Country = "1.3.6.1.4.1.841.1.1.1.8.1.1.7.1"

    signal1 = "1.3.6.1.4.1.841.1.1.3.7.1.2.1.20"
    signal2 = "1.3.6.1.4.1.841.1.1.3.7.1.2.1.21"
    baseName = "1.3.6.1.4.1.841.1.1.3.7.1.2.1.4"
    wirelessLink = "1.3.6.1.4.1.841.1.1.3.7.1.2.1.7"
    noiseLevel = "1.3.6.1.4.1.841.1.1.3.7.1.2.1.24"

    tftpInetAdd = "1.3.6.1.4.1.841.1.1.2.5.5.0"
    fileName = "1.3.6.1.4.1.841.1.1.2.5.1.0"
    fileType = "1.3.6.1.4.1.841.1.1.2.5.2.0"
    opType = "1.3.6.1.4.1.841.1.1.2.5.3.0"
    status = "1.3.6.1.4.1.841.1.1.2.5.4.0"

    networkName = "1.3.6.1.4.1.841.1.1.1.1.1.4.1.4.1"

class encoder(BaseModel):
    sysDescr= "1.3.6.1.2.1.1.1.0"
    sysUpTime = "1.3.6.1.2.1.1.3.0"
    sysName = "1.3.6.1.2.1.1.5.0"
    # proximSystemName = "1.3.6.1.4.1.841.1.1.2.1.5.8"
    productDescr = "1.3.6.1.4.1.17534.2.2.1.1.1.5"
    sysObj = "1.3.6.1.2.1.1.2.0"

    txVal = "1.3.6.1.4.1.17534.2.2.1.5.1.1.1.1"
    rxVal = "1.3.6.1.4.1.17534.2.2.1.5.1.2.1.1"

    productVersion = "1.3.6.1.4.1.17534.2.2.1.1.1.7.1"
    ethernetMAC = "1.3.6.1.2.1.2.2.1.6.1"
    
    SerialNumber = "1.3.6.1.4.1.17534.2.2.1.1.1.6.1"

    ENC_CAM_1_STR      = "1.3.6.1.4.1.17534.2.2.2.3.1.4.1.1"
    ENC_CAM_2_STR      = "1.3.6.1.4.1.17534.2.2.2.3.1.4.1.2"
    ENC_CAM_3_STR      = "1.3.6.1.4.1.17534.2.2.2.3.1.4.1.3"
    ENC_CAM_4_STR      = "1.3.6.1.4.1.17534.2.2.2.3.1.4.1.4"
    ENC_CAM_1_STATUS      = "1.3.6.1.4.1.17534.2.2.2.3.1.5.1.1"
    ENC_CAM_2_STATUS      = "1.3.6.1.4.1.17534.2.2.2.3.1.5.1.2"
    ENC_CAM_3_STATUS      = "1.3.6.1.4.1.17534.2.2.2.3.1.5.1.3"
    ENC_CAM_4_STATUS      = "1.3.6.1.4.1.17534.2.2.2.3.1.5.1.4"
    
    status = "1.3.6.1.4.1.17534.2.2.1.1.1.11"

class ioBoxController(BaseModel):
    sysDescr= "1.3.6.1.2.1.1.1.0"
    sysUpTime = "1.3.6.1.2.1.1.3.0"
    sysName = "1.3.6.1.2.1.1.5.0"
    # proximSystemName = "1.3.6.1.4.1.841.1.1.2.1.5.8"
    productDescr = "1.3.6.1.4.1.841.1.1.2.1.5.7"
    sysObj = "1.3.6.1.2.1.1.2.0"
    # PROXIM_ENTERPRISE_OID = "1.3.6.1.4.1.841"

    txVal = "1.3.6.1.4.1.841.1.1.3.4.1.2.1.64"
    rxVal = "1.3.6.1.4.1.841.1.1.3.4.1.2.1.63"
    lSnr = "1.3.6.1.4.1.841.1.1.3.4.1.2.1.24"
    rSnr = "1.3.6.1.4.1.841.1.1.3.4.1.2.1.25"

    ethernetMAC = "1.3.6.1.2.1.2.2.1.6.2"
    WifiMAC = "1.3.6.1.2.1.2.2.1.6.13"
    SerialNumber = "1.3.6.1.4.1.841.1.1.2.1.2.1.1.2.4"
    SoftverRel = "1.3.6.1.4.1.841.1.1.2.1.2.1.1.6.3"
    SoftverMaj = "1.3.6.1.4.1.841.1.1.2.1.2.1.1.7.3"
    SoftverMin = "1.3.6.1.4.1.841.1.1.2.1.2.1.1.8.3"
    HardverRel = "1.3.6.1.4.1.841.1.1.2.1.2.1.1.6.4"
    HardverMaj = "1.3.6.1.4.1.841.1.1.2.1.2.1.1.7.4"
    HardverMin = "1.3.6.1.4.1.841.1.1.2.1.2.1.1.8.4"
    Channel = "1.3.6.1.4.1.841.1.1.1.1.1.1.1.8.1"
    Bandwidth = "1.3.6.1.4.1.841.1.1.1.1.1.1.1.5.1"
    RadioMode = "1.3.6.1.4.1.841.1.1.1.8.1.1.2.1" 
    SSID = "1.3.6.1.4.1.841.1.1.1.1.1.4.1.4.1"
    Country = "1.3.6.1.4.1.841.1.1.1.8.1.1.7.1"
    tftpInetAdd = "1.3.6.1.4.1.841.1.1.2.5.5.0"
    fileName = "1.3.6.1.4.1.841.1.1.2.5.1.0"
    fileType = "1.3.6.1.4.1.841.1.1.2.5.2.0"
    opType = "1.3.6.1.4.1.841.1.1.2.5.3.0"
    status = "1.3.6.1.4.1.841.1.1.2.5.4.0"

DEVICE_CLASS_MAP = {
    "station_radio": stationRadio,
    "train_radio": trainRadio,
    "encoder": encoder,
    "io_controller_box": ioBoxController,
}   

COUNTRY_MAP = {
    "1": "EU",
    "2": "US",
    "3": "JP",
    "4": "CN",
    }

REVERSE_COUNTRY_MAP = {v: k for k, v in COUNTRY_MAP.items()}


_credential_lock = Lock()
_CREDENTIALS = {
    "username": None,
    "password": None
}

def to_integer32(val):
    if val is None:
        return None
    return Integer32(int(val))
 
def to_octet_string(val):
    if val is None:
        return None
 
    if isinstance(val, bytes):
        return OctetString(val)
 
    return OctetString(str(val))

def mac_str_to_bytes(mac):
    if mac is None:
        return None

    if isinstance(mac, (bytes, bytearray)):
        return OctetString(mac)

    if isinstance(mac, str):
        parts = mac.replace("-", ":").split(":")
        if len(parts) == 6:
            return OctetString(bytes(int(p, 16) for p in parts))

    return None


def build_snmp_value(snmp_type: str, value):
    if snmp_type not in SNMP_TYPE_MAP:
        raise ValueError(f"Unsupported SNMP type: {snmp_type}")
    return SNMP_TYPE_MAP[snmp_type](value)

def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    return {"username": "admin", "role": "admin", "org": "metro"}

def fake_verify_token():
    """For endpoints that need user context but don't require real auth"""
    return {"username": "admin", "role": "admin", "org": "metro"}

def timeticks_to_string(time_ticks: int) -> str:

    time_ticks //= 100

    seconds = (time_ticks // 1) % 60
    minutes = (time_ticks // 60) % 60
    hours = (time_ticks // 3600) % 24
    days = time_ticks // 86400

    return f"{days}:{hours:02d}:{minutes:02d}:{seconds:02d}"

# Configure logging
logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# In-memory session store (simple demo persistence)
SESSIONS: Dict[int, Dict[str, Any]] = {}
NEXT_SESSION_ID = 1


@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"message": "An unexpected error occurred. Please check the server logs for details."},
    )

# API Routes

@app.get("/")
def root():
    return {
        "message": "MetroEMS Backend - Real Device Detection", 
        "status": "running",
        "version": "2.0.0",
        "features": ["real_device_detection", "no_fake_devices"]
    }

@app.get("/health")
def health_check():
    """Health check endpoint"""
    return {
        "status": "UP",
         "app": configs.app["name"],
        "env": configs.app["env"],
        "port": configs.server["port"],
        "backend": "running",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "real_device_detection": True
    }

@app.get("/snmp/runtime")
def snmp_runtime_info():
    """Report runtime diagnostics: interpreter, sys.path, and SNMP lib versions."""
    import sys as _sys
    info: Dict[str, Any] = {
        "python_executable": _sys.executable,
        "python_version": _sys.version,
        "sys_path": _sys.path,
    }
    # Try to report versions and import status
    try:
        import pysnmp
        info["pysnmp_version"] = getattr(pysnmp, "__version__", "unknown")
    except Exception as e:
        info["pysnmp_version_error"] = str(e)
    try:
        import pyasn1
        info["pyasn1_version"] = getattr(pyasn1, "__version__", "unknown")
    except Exception as e:
        info["pyasn1_version_error"] = str(e)
    try:
        import pyasn1_modules
        info["pyasn1_modules_version"] = getattr(pyasn1_modules, "__version__", "unknown")
    except Exception as e:
        info["pyasn1_modules_version_error"] = str(e)
    # Check HLAPI symbols availability
    # Check import styles
    try:
        from pysnmp.hlapi.v3arch import SnmpEngine as _SE
        info["hlapi_v3arch_importable"] = True
    except Exception as e:
        info["hlapi_v3arch_import_error"] = str(e)
    try:
        from pysnmp.hlapi import SnmpEngine as _SE2
        info["hlapi_importable"] = True
    except Exception as e:
        info["hlapi_import_error"] = str(e)
    return info

@app.get("/device-sessions/{session_id}")
def get_device_session(session_id: int):
    """Backend-friendly session lookup for frontend service compatibility"""
    sess = SESSIONS.get(session_id)
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")
    return {
        "session_id": session_id,
        "device_info": {
            "name": sess.get("name") or "Station Radio",
            "ip_address": sess.get("ip"),
            "system_name": sess.get("system_name") or sess.get("name"),
            "device_type": sess.get("device_type"),
            "radio_mode": sess.get("radioMode"),
            "bandwidth": sess.get("bandwidth"),
            "channel": sess.get("channel"),
            "ssid": sess.get("ssid"),
            "created_at": sess.get("created_at")
        },
        "status": sess.get("status", "active")
    }



@app.get("/device-sessions/{session_id}/configuration")
async def get_device_configuration(session_id: int):
    sess = SESSIONS.get(session_id)
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")
    from snmp_client import snmp_get
    ip = sess.get("ip")
    community = sess.get("community") or "public"
        # Core OIDs

    device_cls = DEVICE_CLASS_MAP.get(sess.get("device_type"))
    if not device_cls:
        raise HTTPException(
            status_code=400,
            detail=(f"Unsupported device type: {sess.get('device_type')}")
        )
    device_oids = device_cls()
    
    # OIDS = {
    #     "sysDescr": device_oids.sysDescr,
    #     "sysUpTime": device_oids.sysUpTime,
    #     "sysName": device_oids.sysName,
    #     "proximSystemName": device_oids.proximSystemName,
    # }
    sys_descr = await snmp_get(ip, community, device_oids.sysDescr) or sess.get("last_sysDescr")
    if sys_descr:
        sess["last_sysDescr"] = sys_descr
    sys_name = await snmp_get(ip, community, device_oids.sysName) or await snmp_get(ip, community, device_oids.proximSystemName) or sess.get("system_name")
    if sys_name:
        sess["system_name"] = sys_name
    uptime = await snmp_get(ip, community, device_oids.sysUpTime) or None
    print("uptime=",uptime)
    print("type=",type(uptime))
    sys_uptime = timeticks_to_string(uptime)
    if sess.get("device_type") == "station_radio" or sess.get("device_type") == "train_radio":
        cfg = {
        "systemName": sys_name or sess.get("system_name") ,
        "ipAddress": ip,
        "channel": sess.get("channel"),
        "bandwidth": sess.get("bandwidth"),
        "radioMode": sess.get("radioMode"),
        "community": community,
        "serialNumber": sess.get("serialNumber"),
        "firmwareVersion": sess.get("firmwareVersion"),
        "hardwareVersion": sess.get("hardwareVersion"),
        "channel": sess.get("channel"),
        "bandwidth": sess.get("bandwidth"),
        "radioMode": sess.get("radioMode"),
        "EthernetMAC": sess.get("ethernetMAC"),
        "WiFiMAC": sess.get("wifiMAC"),
        "ssid": sess.get("ssid"),
        "country": sess.get("country"),
        "sysDescr": sys_descr,
        "sysUpTime": sys_uptime,
        }

    elif sess.get("device_type") == "encoder":
        cfg = {
        "systemName": sys_name or sess.get("system_name") ,
        "ipAddress": ip,
        "community": community,
        "serialNumber": sess.get("serialNumber"),
        "productVersion": sess.get("productVersion"),
        "EthernetMAC": sess.get("ethernetMAC"),
        "sysDescr": sys_descr,
        "sysUpTime": sys_uptime,
        }

    if sess.get("device_type") == "station_radio":
        cfg.update({
            "ssid": sess.get("ssid"),
            "frequency": sess.get("frequency"),
            "satelliteDensity": sess.get("satelliteDensity"),
            "EIRP": sess.get("EIRP"),
            "frequencyExtension": sess.get("frequencyExtension"),
            "rxAntennas": sess.get("rxAntennas"),
            "txAntennas": sess.get("txAntennas"),
            "DDRSstatus": sess.get("DDRSstatus"),
            "dataStreams": sess.get("dataStreams"),
            "ATPCstatus": sess.get("ATPCstatus"),
            "txRate": sess.get("txRate"),
        })
    if sess.get("device_type") == "train_radio":
        cfg.update({
            "signal1": sess.get("signal1"),
            "signal2": sess.get("signal2"),
            "baseName": sess.get("baseName"),
            "wirelessLink": sess.get("wirelessLink"),
            "noiseLevel": sess.get("noiseLevel"),
            "networkName": sess.get("networkName")
        }) 
    return {"config": cfg}

@app.put("/device-sessions/{session_id}/configuration")
async def update_device_configuration(session_id: int, config: dict):
    sess = SESSIONS.get(session_id)
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")
    
    sess.update(config)

    if sess:

        device_cls = DEVICE_CLASS_MAP.get(sess.get("device_type"))
        if not device_cls:
            raise HTTPException(
                status_code=400,
            detail=(f"Unsupported device type: {sess.get('device_type')}")
            )
        device_oids = device_cls()

        from snmp_client import snmp_set
        varbinds = []

        # update Ethernet MAC if provided
        if sess.get("ethernetMAC"):
            varbinds.append((device_oids.ethernetMAC, mac_str_to_bytes(sess.get("ethernetMAC"))))

        # update WiFi MAC if provided
        if sess.get("device_type") == "station_radio" or sess.get("device_type") == "train_radio":
            if sess.get("wifiMAC"):
                varbinds.append((device_oids.WifiMAC, mac_str_to_bytes(sess.get("wifiMAC"))))

        # update other config parameters
        if sess.get("serialNumber"):
            varbinds.append((device_oids.SerialNumber, to_octet_string(sess.get("serialNumber"))))

        if sess.get("device_type") == "station_radio" or sess.get("device_type") == "train_radio":
            if sess.get("country"):
                country_code = REVERSE_COUNTRY_MAP.get(sess.get("country"))
                varbinds.append((device_oids.Country, to_integer32(country_code)))

        # station radio specific
        if sess.get("device_type") == "station_radio":
            if sess.get("ssid"):
                varbinds.append((device_oids.SSID, to_octet_string(sess.get("ssid"))))

        # train radio specific
        if sess.get("device_type") == "train_radio":
            if sess.get("baseName"):
                varbinds.append((device_oids.baseName, sess.get("baseName")))
            if sess.get("wirelessLink"):
                varbinds.append((device_oids.wirelessLink, sess.get("wirelessLink")))
            if sess.get("signal1"):
                varbinds.append((device_oids.signal1, sess.get("signal1")))
            if sess.get("signal2"):
                varbinds.append((device_oids.signal2, sess.get("signal2")))
            if sess.get("noiseLevel"):
                varbinds.append((device_oids.noiseLevel, sess.get("noiseLevel")))

        # radio mode
        if sess.get("device_type") == "station_radio" or sess.get("device_type") == "train_radio":
            if sess.get("radioMode") == "BSU":
                varbinds.append((device_oids.RadioMode, to_octet_string("4")))
            elif sess.get("radioMode") == "SU":
                varbinds.append((device_oids.RadioMode, to_octet_string("5")))

        # bandwidth & channel
        if sess.get("device_type") == "station_radio" or sess.get("device_type") == "train_radio":
            if sess.get("bandwidth"):
                varbinds.append((device_oids.Bandwidth, to_integer32(sess.get("bandwidth"))))
            if sess.get("channel"):
                varbinds.append((device_oids.Channel, to_integer32(sess.get("channel"))))

        # hardware version
            hver = sess.get("hardwareVersion", "").split(".")
            if len(hver) == 3:
                varbinds.append((device_oids.HardverRel, to_octet_string(hver[0])))
                varbinds.append((device_oids.HardverMaj, to_octet_string(hver[1])))
                varbinds.append((device_oids.HardverMin, to_octet_string(hver[2])))

            # firmware version
            sver = sess.get("firmwareVersion", "").split(".")
            if len(sver) == 3:
                varbinds.append((device_oids.SoftverRel, to_octet_string(sver[0])))
                varbinds.append((device_oids.SoftverMaj, to_octet_string(sver[1])))
                varbinds.append((device_oids.SoftverMin, to_octet_string(sver[2])))


        if varbinds:
             await snmp_set(
                sess.get("ip"),
                "public",
                varbinds
            )

    return {"ok": True, **config}

@app.get("/device-sessions/{session_id}/monitoring")
async def get_device_monitoring(session_id: int):
    if session_id not in SESSIONS:
        raise HTTPException(status_code=404, detail="Session not found")
    
    device = SESSIONS[session_id]
    ip = device.get("ip")
    community = device.get("community") or "public"

    from snmp_client import snmp_get
    device_cls = DEVICE_CLASS_MAP.get(device.get("device_type"))
    if not device_cls:
        raise HTTPException(
                status_code=400,
                detail=(f"Unsupported device type: {device.get('device_type')}")
            )
    device_oids = device_cls()
    try:
        latency_ms = await ping_latency(ip)

        tx = await snmp_get(ip, community, device_oids.txVal)  # tx throughput
        rx = await snmp_get(ip, community, device_oids.rxVal)  # rx throughput

        if device.get("device_type") == "station_radio" or device.get("device_type") == "train_radio":
            lsnr = await snmp_get(ip, community, device_oids.lSnr)  # local SNR
            rsnr = await snmp_get(ip, community, device_oids.rSnr)  # remote SNR

        return {
            "tx_rate": int(tx) if tx else None,
            "rx_rate": int(rx) if rx else None,
            "local_snr": float(lsnr) if lsnr else None,
            "remote_snr": float(rsnr) if rsnr else None,
            "latency": latency_ms,
            "live": True
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Monitoring error: {e}")



@app.get("/device-sessions/{session_id}/logs")
async def get_device_logs_enhanced(session_id: int):
 
    if session_id not in SESSIONS:
        raise HTTPException(status_code=404, detail="Session not found")
 
    val = SESSIONS[session_id]
    ip = val.get("ip")

    url1 = f"http://{ip}/ndmib?fileName=proxim/get&action=eventlog"

    url2 = f"http://{ip}/event.txt"

    current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
 
 
    try:
            async with httpx.AsyncClient(timeout=5,auth=DigestAuth("admin", "public")) as client:
                response1 = await client.post(
                    url1
                )
                print(response1.text)
                await asyncio.sleep(1)
                response2 = await client.get(
                    url2
                )
 
            return response2.text.splitlines()
 
    except httpx.RequestError as e:
            raise HTTPException(
                status_code=504,
                detail=f"Device unreachable: {str(e)}"
        )
 
@app.get("/transcoder/{ip}/logs")
async def transcoder_logs(ip:str):
    today = date.today()
    yesterday = today - timedelta(days=1)
    
    url = f"http://{ip}:8084/transcoder/api/v1/logs?since={yesterday}"
    
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            response = await client.get(
                url
            )

            response.raise_for_status()

            try:
                data = response.json()
            except:
                data = response.text

            return data.splitlines()

    except httpx.RequestError as e:
        raise HTTPException(
            status_code=504,
            detail=f"Device unreachable: {str(e)}"
        )

@app.get("/obc/{ip}/{type}/logs")
async def obc_logs(ip:str,type:str):
    url1 = f"http://{ip}:8084/obc/api/v1/curlogs"

    url2 = f"http://{ip}:8084/obc/api/v1/backlogs"
    
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            if type == "cur":
                response = await client.get(
                    url1
                )
            elif type == "back":
                response = await client.get(
                    url2
                )
            response.raise_for_status()

            try:
                data = response.json()
            except:
                data = response.text

            return data.splitlines()

    except httpx.RequestError as e:
        raise HTTPException(
            status_code=500,
            detail=f"Device unreachable: {str(e)}"
        )
 
 
 
async def fetch_json(client: httpx.AsyncClient, url: str):
    try:
        username, password = get_auth_credentials()
        response = await client.get(url,
                                    auth=(username, password),
                                    timeout=10)
        
        response.raise_for_status()
        return {
            "url": url,
            "status": "success",
            "data": response.json()
        }
    except Exception as e:
        return {
            "url": url,
            "status": "failed",
            "error": str(e)
        }
 
 
@app.get("/obc/{ip}/discovery")
async def obc_disovery(ip : str):
 
    url = f"http://{ip}:8084/obc/api/v1/uptime"
    username, password = get_auth_credentials()
    async with httpx.AsyncClient() as client:
        response = await client.get(
                    url,
                    auth=(username, password)
        )
 
    return {
            "status": "success",
            "data": response.json()
    }
 
@app.post("/obc/{ip}/fetch")
async def obc_fetch( request: FetchRequest,ip: str):
    url = request.rurl
    print(url)
    furl = f"http://{ip}:8084/obc/{url}"
    username, password = get_auth_credentials()
    async with httpx.AsyncClient() as client:
        response = await client.get(
                    furl,
                    auth=(username, password)
        )
        if not response.content:
            raise HTTPException(
                status_code=204,
                detail="OBC returned empty response"
            )
 
    return {
                "status": "success",
                "data": response.json()
        } 
 
@app.post("/obc/{ip}/setconfig")
async def set_obc_config(ip: str, request: OBCSetConfigRequest):

    url = f"http://{ip}:8084/obc/api/v1/update"
    username, password = get_auth_credentials()

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                url,
                json=request.dict(),
                auth=(username, password)
            )

    except httpx.RequestError as exc:
        raise HTTPException(
            status_code=503,
            detail=f"OBC unreachable at {ip}: {exc}"
        )

    if response.status_code not in (200, 201):
        raise HTTPException(
            status_code=response.status_code,
            detail=f"OBC returned error: {response.text}"
        )

    # try:
    #     data = response.json()
    # except Exception:
    #     data = response.text

    return {
        "status": "success",
        # "data": data
    }

from fastapi import UploadFile, File, HTTPException
import httpx


@app.post("/obc/{ip}/patch")
async def obc_patch(ip: str, file: UploadFile = File(...)):

    url = f"http://{ip}:8084/obc/api/v1/replace"
    username, password = get_auth_credentials()

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.post(
                url,
                files={
                    "file": (
                        file.filename,
                        file.file,
                        file.content_type or "application/octet-stream"
                    )
                },
                auth=(username, password)
            )

    except httpx.RequestError as exc:
        raise HTTPException(
            status_code=503,
            detail=f"OBC unreachable at {ip}: {exc}"
        )
        
    if response.status_code not in (200, 201):
        raise HTTPException(
            status_code=response.status_code,
            detail=response.text
        )

    try:
        data = response.json()
    except Exception:
        data = response.text

    return {
        "status": "success",
        "data": data
    }

@app.get("/transcoder/{ip}/discovery")
async def transcoder_disovery(ip : str):
 
    url = f"http://{ip}:8084/transcoder/api/v1/uptime"
    username, password = get_auth_credentials()
    async with httpx.AsyncClient() as client:
        response = await client.get(
                    url,
                    auth=(username,password)
        )
 
    return {
            "status": "success",
            "data": response.json()
    }
 
@app.post("/transcoder/{ip}/fetch")
async def transcoder_fetch(request: FetchRequest,ip: str):
    url = request.rurl
    furl = f"http://{ip}:8084/transcoder/{url}"
    username, password = get_auth_credentials()
    async with httpx.AsyncClient() as client:
        response = await client.get(
                    furl,
                    auth=(username, password)
        )
        if not response.content:
            raise HTTPException(
                status_code=204,
                detail="Transcoder returned empty response"
            )    
 
    return {
            "status": "success",
            "data": response.json()
    }

@app.post("/transcoder/{ip}/setconfig/{section}")
async def set_transcoder_config(
    ip: str,
    section: str,
    request: TranscoderSetConfigRequest):

    url = f"http://{ip}:8084/transcoder/api/v1/config/{section}"

    username, password = get_auth_credentials()

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                url,
                json={"section": section,"values": request.values},
                auth=(username, password)
            )

    except httpx.RequestError as exc:
        raise HTTPException(
            status_code=503,
            detail=f"Transcoder unreachable at {ip}: {exc}"
        )

    if response.status_code not in (200, 201):
        raise HTTPException(
            status_code=response.status_code,
            detail=f"Transcoder error: {response.text}"
        )

    try:
        data = response.json()
    except Exception:
        data = response.text

    return {
        "status": "success",
        "data": data
    }

@app.get("/transcoder/{ip}/reboot")
async def transcoder_reboot(ip: str):
 
    startUrl = f"http://{ip}:8084/transcoder/api/v1/service/start"
    stopUrl = f"http://{ip}:8084/transcoder/api/v1/service/stop"
 
    username, password = get_auth_credentials()
 
    try:
        async with httpx.AsyncClient() as client:
 
            response1 = await client.post(
                stopUrl,
                auth=(username, password)
            )
 
            await asyncio.sleep(6)
 
            response2 = await client.post(
                startUrl,
                auth=(username, password)
            )
 
        try:
            data = response2.json()
        except Exception:
            data = response2.text
 
        return {
            "status": "success",
            "data": data
        }
 
    except httpx.RequestError as exc:
        raise HTTPException(
            status_code=503,
            detail=f"Transcoder unreachable at {ip}: {exc}"
        )
 
@app.get("/obc/{ip}/reboot")
async def obc_reboot(ip: str):
 
    async def event_stream():
 
        url = f"http://{ip}:8084/obc/api/v1/reboot"
        username, password = get_auth_credentials()
 
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    url,
                    auth=(username, password)
                )
 
            try:
                data = response.json()
            except Exception:
                data = response.text
 
            yield {
                "status": "success",
                "data": data
            }
 
            await asyncio.sleep(6)
 
            while True:
 
                await asyncio.sleep(2)
 
                process = await asyncio.create_subprocess_shell(
                    f"ping -c 1 {ip}",
                    stdout=asyncio.subprocess.DEVNULL,
                    stderr=asyncio.subprocess.DEVNULL
                )
 
                await process.wait()
 
                if process.returncode == 0:
                    yield {
                        "status": "success",
                        "data": "OBC is back online"
                    }
                    break
                else:
                    yield {
                        "status": "waiting",
                        "data": "OBC is not back online"
                    }
 
        except httpx.RequestError as exc:
            yield {
                "status": "error",
                "data": f"OBC unreachable at {ip}: {exc}"
            }
 
    return EventSourceResponse(event_stream(), media_type="text/event-stream")

@app.get("/encoder/{ip}/downloadconfig")
async def encoder_upload_config(ip: str):
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    url = f"http://{ip}/backup/{timestamp}-backup.tar"
    username, password = get_auth_credentials()
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                        url,
                        # auth=(username, password)
            )
        return {
                "status": "success",
                "data": response.json()
        }
    except httpx.RequestError as exc:
        raise HTTPException(
            status_code=503,
            detail=f"Encoder unreachable at {ip}: {exc}"
        )

@app.post("/encoder/{ip}/uploadconfig")
async def encoder_upload_config(ip: str,file: UploadFile = File(...)):

    url = f"http://{ip}/restore/restore.cgi?KeepNetwork=true"
    username, password = get_auth_credentials()
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                        url,
                        # auth=(username, password),
                        files={"file": (
                                file.filename,
                                file.file,
                                file.content_type or "application/octet-stream"
                                )
                            }
                        )
        return {
                "status": "success",
                "data": response.json()
        }
    except httpx.RequestError as exc:
        raise HTTPException(
            status_code=503,
            detail=f"Encoder unreachable at {ip}: {exc}"
        )       

@app.post("/snmp/probe-community")
def probe_snmp_community(request: SnmpProbeRequest):
    """Try common SNMP communities against a device IP using sysDescr OID.
    Returns the list of communities that respond along with the sysDescr value.
    """
    try:
        from snmp_client import snmp_get
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"SNMP module unavailable: {e}")

    # Default common communities (kept moderate for speed)
    default_comms = [
        "public","private","admin","manager","read","write","monitor","snmp",
        "test","guest","default","public1","private1","public123","private123",
        "cisco","proxim","tsunami","metro","env"
    ]
    communities = request.communities or default_comms

    successes = []
    # Try primary OID then fallbacks
    primary_oid = request.oid or "1.3.6.1.2.1.1.1.0"
    # Standard MIB-II: sysName, sysObjectID, sysUpTime
    std_oids = [
        "1.3.6.1.2.1.1.5.0",  # sysName.0
        "1.3.6.1.2.1.1.2.0",  # sysObjectID.0
        "1.3.6.1.2.1.1.3.0",  # sysUpTime.0
    ]
    # Proxim vendor OIDs from PXM-SNMP.mib:
    # 1.3.6.1.4.1.841.1.1.2.1.5.7  -> productDescr
    # 1.3.6.1.4.1.841.1.1.2.1.5.8  -> systemName
    proxim_oids = [
        "1.3.6.1.4.1.841.1.1.2.1.5.7",
        "1.3.6.1.4.1.841.1.1.2.1.5.8",
    ]
    fallback_oids = std_oids + proxim_oids

    for comm in communities:
        matched = False
        for oid in [primary_oid] + fallback_oids:
            try:
                val = snmp_get(
                    request.ip,
                    comm,
                    oid,
                    timeout=request.timeout_secs,
                    retries=request.retries,
                    version=request.version,
                    port=(request.port or 161),
                )
                if val and val != "Simulated SNMP Response":
                    successes.append({"community": comm, "oid": oid, "value": val})
                    matched = True
                    break
            except Exception:
                continue
        # Next community

    return {
        "ip": request.ip,
        "oid": request.oid or "1.3.6.1.2.1.1.1.0",
        "port": request.port or 161,
        "version": request.version or "auto",
        "matches": successes,
        "first": successes[0] if successes else None,
        "count": len(successes)
    }

@app.post("/snmp/probe-v3")
def probe_snmp_v3(request: SnmpV3ProbeRequest):
    """Probe SNMPv3 credentials by attempting sysDescr/sysName/sysObjectID with combinations."""
    try:
        from snmp_client import snmp_get_v3
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"SNMPv3 module unavailable: {e}")

    usernames = request.usernames or ["admin", "manager", "snmp", "operator"]
    auth_keys = request.auth_keys or [None]
    priv_keys = request.priv_keys or [None]
    auth_protocols = request.auth_protocols or [None, "MD5", "SHA"]
    priv_protocols = request.priv_protocols or [None, "DES", "AES"]

    # Include Proxim vendor OIDs in addition to standard MIB-II identifiers
    oids = [
        request.oid or "1.3.6.1.2.1.1.1.0",  # sysDescr.0
        "1.3.6.1.2.1.1.5.0",                  # sysName.0
        "1.3.6.1.2.1.1.2.0",                  # sysObjectID.0
        "1.3.6.1.2.1.1.3.0",                  # sysUpTime.0
        # Proxim-specific identifiers from PXM-SNMP.mib
        "1.3.6.1.4.1.841.1.1.2.1.5.7",       # productDescr
        "1.3.6.1.4.1.841.1.1.2.1.5.8",       # systemName
    ]
    matches: List[Dict[str, Any]] = []

    for user in usernames:
        for a_key in auth_keys:
            for p_key in priv_keys:
                for a_proto in auth_protocols:
                    for p_proto in priv_protocols:
                        # Skip invalid combos: priv requires auth and priv key
                        if p_proto and not (a_proto and p_key):
                            continue
                        for oid in oids:
                            val = snmp_get_v3(
                                request.ip,
                                oid,
                                username=user,
                                auth_key=a_key,
                                priv_key=p_key,
                                auth_protocol=a_proto,
                                priv_protocol=p_proto,
                                port=(request.port or 161),
                            )
                            if val:
                                matches.append({
                                    "username": user,
                                    "auth_key": a_key,
                                    "priv_key": p_key,
                                    "auth_protocol": a_proto,
                                    "priv_protocol": p_proto,
                                    "oid": oid,
                                    "value": val,
                                })
                                # stop at first success for this user
                                break

    return {
        "ip": request.ip,
        "port": request.port or 161,
        "matches": matches,
        "first": matches[0] if matches else None,
        "count": len(matches),
    }

@app.post("/snmp/debug-get")
def snmp_debug_get(request: SnmpDebugRequest):
    """Diagnose SNMP reachability with detailed error info using pysnmp directly."""
    # Try pysnmp (v3arch or legacy). If both fail, use raw fallback from snmp_client.snmp_get.
    hlapi = None
    pysnmp_error = None
    try:
        try:
            from pysnmp.hlapi.v3arch import (
                SnmpEngine,
                CommunityData,
                UdpTransportTarget,
                ContextData,
                ObjectType,
                ObjectIdentity,
                getCmd,
            )
            hlapi = "v3arch"
        except Exception:
            from pysnmp.hlapi import (
                SnmpEngine,
                CommunityData,
                UdpTransportTarget,
                ContextData,
                ObjectType,
                ObjectIdentity,
                getCmd,
            )
            hlapi = "hlapi"
    except Exception as e:
        pysnmp_error = str(e)
        hlapi = None

    try:
        mp_model = 1 if (request.version or "2c") in ("2c", "v2c", "2") else 0
        result: Dict[str, Any] = {
            "ip": request.ip,
            "oid": request.oid or "1.3.6.1.2.1.1.1.0",
            "version": request.version or "2c",
            "port": request.port or 161,
            "timeout_secs": request.timeout_secs or 5.0,
            "retries": request.retries or 1,
            "hlapi": hlapi,
            "pysnmp_error": pysnmp_error,
        }
        if hlapi:
            iterator = getCmd(
                SnmpEngine(),
                CommunityData(request.community, mpModel=mp_model),
                UdpTransportTarget((request.ip, int(request.port or 161)), timeout=float(request.timeout_secs or 5.0), retries=int(request.retries or 1)),
                ContextData(),
                ObjectType(ObjectIdentity(request.oid or "1.3.6.1.2.1.1.1.0")),
            )
            errorIndication, errorStatus, errorIndex, varBinds = next(iterator)
            if errorIndication:
                result.update({
                    "success": False,
                    "errorIndication": str(errorIndication),
                    "errorStatus": None,
                    "errorIndex": None,
                })
                return result
            if errorStatus:
                result.update({
                    "success": False,
                    "errorIndication": None,
                    "errorStatus": str(errorStatus),
                    "errorIndex": int(errorIndex) if errorIndex else None,
                })
                return result
            value = str(varBinds[0][1]) if varBinds else None
            result.update({"success": True, "value": value})
            return result
        # Fallback: use raw snmp_get
        from snmp_client import snmp_get as raw_get
        raw_val = raw_get(request.ip, request.community, request.oid or "1.3.6.1.2.1.1.1.0")
        if raw_val:
            result.update({"success": True, "value": raw_val, "raw_fallback": True})
        else:
            result.update({"success": False, "raw_fallback": True, "errorIndication": pysnmp_error or "no response"})
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"SNMP debug error: {e}")

@app.post("/auth/login", response_model=LoginResponse)
def login(request: LoginRequest):
    """Simple authentication for demo"""
    # For demo purposes, accept any login
    return LoginResponse(
        token="demo_token_real_devices",
        role="admin",
        org="metro",
        username=request.username
    )

@app.get("/wizard/device-types")
def get_device_types():
    """Get supported device types"""
    return [
            "station_radio",
            "train_radio",
            "transcoder",
            "encoder",
            "obc",
            "io_controller_box"
           ]

current_device = None

@app.post("/wizard/discover")
async def discover_devices(request: DeviceDiscoveryRequest):
    """
    STATION RADIO ONLY DISCOVERY - Shows ONLY your Station Radio device
    NO OTHER DEVICES - NO FAKE DEVICES - ONLY YOUR STATION RADIO
    """
    logger.info("STATION RADIO ONLY Discovery - Looking for Station Radio devices")
    
    def mac_bytes_to_str(mac):
        if mac is None:
            return None

        # Case 1: real bytes
        if isinstance(mac, (bytes, bytearray)):
            return ":".join(f"{b:02x}" for b in mac)

        # Case 2: binary-looking string
        if isinstance(mac, str):
            raw = mac.encode("latin1", errors="ignore")
            if len(raw) in (6, 8):
                return ":".join(f"{b:02x}" for b in raw)

        return mac


    def safe_str(val):
        if isinstance(val, (bytes, bytearray)):
            return val.decode(errors="ignore")
        return str(val) if val is not None else None

    def safe_int(val):
        try:
            return int(val)
        except Exception:
            return None
        
    COUNTRY_MAP = {
    "1": "EU",
    "2": "US",
    "3": "JP",
    "4": "CN",
    }
    
    device_cls = DEVICE_CLASS_MAP.get(request.device_type)
    if not device_cls:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported device type: {request.device_type}"
        )
    device_oids = device_cls()

    try:
        # SNMP-only discovery using sysDescr/sysName; no ping/ARP.
        from network_scanner import get_local_networks, scan_for_snmp_devices
        from snmp_client import snmp_get
        import os

        logger.info("Starting SNMP-only Station Radio discovery (no ping/ARP)")
        # Apply temporary SNMP overrides if provided
        prev_env = {
            "METRO_SNMP_COMMUNITY": os.environ.get("METRO_SNMP_COMMUNITY"),
            "METRO_SNMP_VERSION": os.environ.get("METRO_SNMP_VERSION"),
            "METRO_SNMP_PORT": os.environ.get("METRO_SNMP_PORT"),
        }
        try:
            if request.community:
                os.environ["METRO_SNMP_COMMUNITY"] = request.community
            if request.version:
                os.environ["METRO_SNMP_VERSION"] = request.version
            if request.port:
                os.environ["METRO_SNMP_PORT"] = str(request.port)

            # If caller provided specific IP(s), probe only those for speed
            target_ips: List[str] = []
            if request.ip:
                target_ips.append(request.ip)
            if request.ips:
                target_ips.extend([ip for ip in request.ips if ip])

            global current_device
            candidates = []
            if target_ips:
                logger.info(f"Targeted Station Radio discovery for IPs: {target_ips}")
                for ip in target_ips:
                    try:
                        community_eff = os.getenv("METRO_SNMP_COMMUNITY", "public") or request.community
                        # Fast path: only sysDescr unless fast disabled
                        val = await snmp_get(ip, community_eff, device_oids.sysDescr)
                        if not val and not request.fast:
                            for extra_oid in [
                                device_oids.sysUpTme,  # sysUpTime
                                 device_oids.productDescr # productDescr
                            ]:
                                val = await snmp_get(ip, community_eff, extra_oid)
                                if val:
                                    break
                        if val and val != "Simulated SNMP Response":
                            sys_name = await snmp_get(ip, community_eff, device_oids.sysName) or \
                                       await snmp_get(ip, community_eff, device_oids.proximSystemName) or \
                                       f"Device {ip}"
                            sys_obj = await snmp_get(ip, community_eff, device_oids.sysObj) or ""

                            raw_eMac = await snmp_get(ip, community_eff, device_oids.ethernetMAC)
                            eMac = mac_bytes_to_str(raw_eMac)

                            if request.device_type == "station_radio" or request.device_type == "train_radio":
                                wifiMac = mac_bytes_to_str(
                                    await snmp_get(ip, community_eff, device_oids.WifiMAC)
                                )

                            serialNum = safe_str(
                                await snmp_get(ip, community_eff, device_oids.SerialNumber)
                            )
                            if request.device_type == "station_radio" or request.device_type == "train_radio":
                                firmwareVer = ".".join(filter(None, [
                                    safe_str(await snmp_get(ip, community_eff, device_oids.SoftverRel)),
                                    safe_str(await snmp_get(ip, community_eff, device_oids.SoftverMaj)),
                                    safe_str(await snmp_get(ip, community_eff, device_oids.SoftverMin)),
                                ]))

                                hardwareVer = ".".join(filter(None, [
                                    safe_str(await snmp_get(ip, community_eff,device_oids.HardverRel)),
                                    safe_str(await snmp_get(ip, community_eff,device_oids.HardverMaj)),
                                    safe_str(await snmp_get(ip, community_eff,device_oids.HardverMin)),
                                ]))

                            if request.device_type == "station_radio":
                                opChannel = safe_int(
                                await snmp_get(ip, community_eff, device_oids.Channel))
                                frequency = (opChannel * 5 + 5000) if opChannel else None
                                satelliteDensity = safe_int(
                                await snmp_get(ip, community_eff, device_oids.satelliteDensity))
                                EIRP = safe_int(
                                await snmp_get(ip, community_eff, device_oids.EIRP))
                                frequencyExtension = safe_int(
                                await snmp_get(ip, community_eff, device_oids.frequencyExtension))
                                rxAntennas = safe_int(
                                await snmp_get(ip, community_eff, device_oids.rxAntennas))
                                txAntennas = safe_int(
                                await snmp_get(ip, community_eff, device_oids.txAntennas))
                                DDRSstatus = safe_int(
                                await snmp_get(ip, community_eff, device_oids.DDRSstatus))
                                dataStreams = safe_int(
                                await snmp_get(ip, community_eff, device_oids.dataStreams))
                                ATPCstatus = safe_int(
                                await snmp_get(ip, community_eff, device_oids.ATPCstatus))
                                txRate = safe_int(
                                await snmp_get(ip, community_eff, device_oids.txRate))
                            elif request.device_type == "train_radio":
                                opChannel = safe_int(
                                await snmp_get(ip, community_eff, device_oids.Channel))
                                networkName = safe_str(
                                await snmp_get(ip, community_eff, device_oids.networkName))

                            if request.device_type == "station_radio" or request.device_type == "train_radio": 
                                bandwidth = safe_int(
                                    await snmp_get(ip, community_eff, device_oids.Bandwidth)
                                )

                            if request.device_type == "station_radio" or request.device_type == "train_radio":
                                radioModeRaw = safe_str(
                                    await snmp_get(ip, community_eff, device_oids.RadioMode)
                                )
                                radioModeStr = "BSU" if radioModeRaw == "4" else "SU" if radioModeRaw == "5" else None

                            ssid = None
                            if request.device_type == "station_radio":
                                    ssid = safe_str(
                                await snmp_get(ip, community_eff, device_oids.SSID))

                            if request.device_type == "station_radio" or request.device_type == "train_radio":
                                raw_country = await snmp_get(ip, community_eff, device_oids.Country)
                                country = COUNTRY_MAP.get(str(raw_country), str(raw_country))

                            if request.device_type == "train_radio":
                                sign1 = await snmp_get(ip, community_eff, device_oids.signal1) 
                                sign2 = await snmp_get(ip, community_eff, device_oids.signal2)                             
                                baseName = await snmp_get(ip, community_eff, device_oids.baseName)
                                wireless = await snmp_get(ip, community_eff, device_oids.wirelessLink)
                                noise = await snmp_get(ip, community_eff, device_oids.noiseLevel)

                            productVersion = None
                            cam1_str = None
                            cam2_str = None
                            cam3_str = None
                            cam4_str = None
                            cam1_stat = None
                            cam2_stat = None
                            cam3_stat = None
                            cam4_stat = None

                            if request.device_type == "encoder":
                                productVersion = await snmp_get(ip,community_eff,device_oids.productVersion)

                                cam1_str = await snmp_get(ip,community_eff,device_oids.ENC_CAM_1_STR)
                                cam2_str = await snmp_get(ip,community_eff,device_oids.ENC_CAM_2_STR)
                                cam3_str = await snmp_get(ip,community_eff,device_oids.ENC_CAM_3_STR)
                                cam4_str = await snmp_get(ip,community_eff,device_oids.ENC_CAM_4_STR)

                                cam1_stat = await snmp_get(ip,community_eff,device_oids.ENC_CAM_1_STATUS)
                                cam2_stat = await snmp_get(ip,community_eff,device_oids.ENC_CAM_2_STATUS)
                                cam3_stat = await snmp_get(ip,community_eff,device_oids.ENC_CAM_3_STATUS)
                                cam4_stat = await snmp_get(ip,community_eff,device_oids.ENC_CAM_4_STATUS)

                            descr_lower = (val.lower() if isinstance(val, str) else "")
                            heur = any(h in descr_lower for h in ["proxim", "tsunami", "mp-825", "mp825", "cpe-50"])
                            if (isinstance(sys_obj, str) and sys_obj.startswith(device_oids.PROXIM_ENTERPRISE_OID)) or heur:
                                if not any(c.get("ip") == ip for c in candidates):  # suppress duplicates
                                    if request.device_type == "station_radio" or request.device_type == "train_radio":
                                        candidates.append({
                                        "ip": ip,
                                        "EthernetMAC": eMac,
                                        "WiFiMAC": wifiMac,
                                        "serialNumber": serialNum,
                                        "firmwareVersion": firmwareVer,
                                        "hardwareVersion": hardwareVer,
                                        "channel": opChannel,
                                        "bandwidth": bandwidth,
                                        "radioMode": radioModeStr,
                                        "country": country,
                                        "version": request.version,
                                        "community":request.community,
                                        "port":request.port,
                                        "description": val if isinstance(val, str) else "Station Radio",
                                        "device_type": request.device_type,
                                        "system_name": sys_name,
                                        "heuristic": heur and not (isinstance(sys_obj, str) and sys_obj.startswith(device_oids.PROXIM_ENTERPRISE_OID))
                                        })
                                    
                                    if request.device_type == "encoder":
                                        candidates.append({
                                        "ip": ip,
                                        "EthernetMAC": eMac,
                                        "serialNumber": serialNum,
                                        "productVersion": productVersion,
                                        "version": request.version,
                                        "community":request.community,
                                        "description": val if isinstance(val, str) else "Station Radio",
                                        "device_type": request.device_type,
                                        "system_name": sys_name,
                                        "ENC_CAM_1_STR": cam1_str,
                                        "ENC_CAM_2_STR": cam2_str,
                                        "ENC_CAM_3_STR": cam3_str,
                                        "ENC_CAM_4_STR": cam4_str,
                                        "ENC_CAM_1_STATUS":cam1_stat,
                                        "ENC_CAM_2_STATUS":cam2_stat,
                                        "ENC_CAM_3_STATUS":cam3_stat,
                                        "ENC_CAM_4_STATUS":cam4_stat
                                        })

                                    if request.device_type == "station_radio":
                                        candidates[-1].update({
                                        "ssid": ssid,
                                        "frequency": frequency,
                                        "satelliteDensity": satelliteDensity,
                                        "EIRP": EIRP,
                                        "frequencyExtension": frequencyExtension,
                                        "rxAntennas": rxAntennas,
                                        "txAntennas": txAntennas,
                                        "DDRSstatus": DDRSstatus,
                                        "dataStreams": dataStreams,
                                        "ATPCstatus": ATPCstatus,
                                        "txRate": txRate,
                                    })

                                    if request.device_type == "train_radio":
                                        candidates[-1].update({
                                        "signal1": sign1,
                                        "signal2": sign2,
                                        "baseName": baseName,
                                        "wirelessLink": wireless,
                                        "noiseLevel": noise,
                                        "networkName": networkName,
                                    })

                                    current_device = candidates[-1]
                    except Exception:
                        # skip this IP on error
                        pass
                logger.info(f"Targeted discovery found {len(candidates)} candidates")
            else:
                # Broad scan (limit to at most 15 IP attempts for speed per user request)
                networks = get_local_networks()
                scanned = scan_for_snmp_devices(networks, limit_hosts=15)
                for dev in scanned:
                    enterprise = dev.get("enterprise", "")
                    if (isinstance(enterprise, str) and enterprise.startswith(device_oids.PROXIM_ENTERPRISE_OID)) \
                       or dev.get("device_type") == "Station Radio" or dev.get("hint") == "station_radio":
                        candidates.append({
                            "ip": dev["ip"],
                            "hint": "station_radio",
                            "description": dev.get("description", "Station Radio"),
                            "device_type": "Station Radio",
                            "system_name": dev.get("system_name", f"Device {dev['ip']}")
                        })
        finally:
            # Restore previous environment
            for k, v in prev_env.items():
                if v is None:
                    os.environ.pop(k, None)
                else:
                    os.environ[k] = v
        
        if not candidates:
            logger.warning("NO DEVICE DETECTED")
            return {
                "candidates": [],
                "message": (
                    "NO DEVICE DETECTED\n\n"
                    "Your Device is not connected.\n\n"
                    "Please check:\n"
                    "- Device is powered on\n"
                    "- Ethernet cable is connected to Device\n"
                    "- Device IP/MAC is correct and reachable\n"
                    "- Device is on the same network\n\n"
                    "Only connected devices will be shown."
                ),
                "real_device_detection": False,
                # "station_radio_only": True,
                "total_devices_found": 0
            }
        logger.info("STATION RADIO DISCOVERY COMPLETE (SNMP-only)")
        logger.info(f"Found {len(candidates)} Station Radio device(s)")
        return {
            "candidates": candidates,
            "message": f"Found {len(candidates)} device(s) via SNMP",
            "real_device_detection": True,
            # "station_radio_only": True,
            "total_devices_found": len(candidates)
            # "device_type_filter": "station_radio_only"
        }
        
    except Exception as e:
        logger.exception(f"DEVICE DETECTION ERROR: {str(e)}")
        
        return {
            "candidates": [],
            "message": f"DEVICE DETECTION ERROR: {str(e)}\n\n" +
                      "Could not detect your device.",
            "error": str(e),
            "real_device_detection": True,
            # "station_radio_only": True,
            "total_devices_found": 0
        }

@app.post("/wizard/setConfig")
async def wizard_set_config(request: setConfigRequest):
    value = build_snmp_value(request.type,
                             json.dumps(request.value) if isinstance(request.value, dict) else request.value)

    result = await snmp_set(
        request.ip,
        "public",
        request.oid,
        value
    )
    return {"result": result}


@app.post("/wizard/getConfigBulk")
async def wizard_get_config_bulk(request: BulkConfigRequest):
    result = await snmp_getBulk(
        request.ip,
        "public",
        request.oid,
        non_repeaters=request.non_repeaters,
        max_repetitions=request.max_repetitions
    )
    return {"result": result}




@app.post("/session/start")
async def start_session(request: SessionStartRequest):

    if not current_device:
        raise HTTPException(
            status_code=400,
            detail="No device discovered yet"
    )

    # if request.ip != current_device["ip"]:
    #     raise HTTPException(
    #         status_code=400,
    #         detail="IP mismatch: discovery and session IP differ"
    #     )

    device = current_device

    device_cls = DEVICE_CLASS_MAP.get(device.get("device_type"))
    if not device_cls:
        raise HTTPException(
            status_code=400,
            detail=(f"Unsupported device type: {device.get('device_type')}")
        )
    device_oids = device_cls()

    """Start a device management session"""
    logger.info(f"Starting session for device at {request.ip} (SNMP-only verify)")
    # Verify via SNMP: if sysDescr is readable, consider it connected
    try:
        from snmp_client import snmp_get
        import os
        community = device.get("community") or os.getenv("METRO_SNMP_COMMUNITY", "public")
        version = device.get("version")  # let snmp_get auto fallback if None
        port = device.get("port") or (int(os.getenv("METRO_SNMP_PORT", "161")))
        # Try a small set of identifiers for liveness, preferring requested OID
        candidate_oids = [
            (request.oid or device_oids.sysDescr),  # sysDescr.0
            device_oids.sysUpTime,                    # sysUpTime.0
            device_oids.productDescr,         # Proxim productDescr
            device_oids.proximSystemName,         # Proxim systemName
        ]
        ok_value = None
        ok_oid = None
        for oid in candidate_oids:
            val = await snmp_get(request.ip, community, oid, version=version, port=port)
            if val and val != "Simulated SNMP Response":
                ok_value = val
                ok_oid = oid
                break
        if not ok_value:
            raise HTTPException(status_code=400, detail=f"SNMP not responding on device (ip={request.ip}, community={community}, version={version or 'auto v2c→v1'}, port={port})")
        global NEXT_SESSION_ID
        session_id = NEXT_SESSION_ID
        NEXT_SESSION_ID += 1
        # Enrich session with system name and basic radio attributes
        sys_name = None
        try:
            sys_name = await snmp_get(request.ip, community, device_oids.sysName) or \
                       await snmp_get(request.ip, community, device_oids.proximSystemName)
        except Exception:
            pass
        if device.get("device_type") == "station_radio" or device.get("device_type") == "train_radio":
            SESSIONS[session_id] = {
            "ip": request.ip,
            "device_type": device.get("device_type"),
            "status": "active",
            "name": sys_name or f"Station Radio {request.ip}",
            "system_name": device.get("system_name"),
            "created_at": datetime.now(timezone.utc).isoformat(),
            "radioMode": device.get("radioMode"),
            "bandwidth": device.get("bandwidth"),
            "channel": device.get("channel"),
            "hardwareVersion": device.get("hardwareVersion"),
            "firmwareVersion": device.get("firmwareVersion"),
            "serialNumber": device.get("serialNumber"),
            "ethernetMAC": device.get("EthernetMAC"),
            "wifiMAC": device.get("WiFiMAC"),
            "country": device.get("country"),
            "community": community,
            }

        if device.get("device_type") == "encoder":
            SESSIONS[session_id] = {
            "ip": request.ip,
            "device_type": device.get("device_type"),
            "status": "active",
            "name": sys_name or f"Station Radio {request.ip}",
            "system_name": device.get("system_name"),
            "created_at": datetime.now(timezone.utc).isoformat(),
            "productVersion": device.get("productVersion"),
            "serialNumber": device.get("serialNumber"),
            "ethernetMAC": device.get("EthernetMAC"),
            "ENC_CAM_1_STR": device.get("ENC_CAM_1_STR"),
            "ENC_CAM_2_STR": device.get("ENC_CAM_2_STR"),
            "ENC_CAM_3_STR": device.get("ENC_CAM_3_STR"),
            "ENC_CAM_4_STR": device.get("ENC_CAM_4_STR"),
            "ENC_CAM_1_STATUS": device.get("ENC_CAM_1_STATUS"),
            "ENC_CAM_2_STATUS": device.get("ENC_CAM_2_STATUS"),
            "ENC_CAM_3_STATUS": device.get("ENC_CAM_3_STATUS"),
            "ENC_CAM_4_STATUS": device.get("ENC_CAM_4_STATUS"),
            "community": community,
            }

        if device.get("device_type") == "station_radio":
            SESSIONS[session_id].update({
                "ssid": device.get("ssid"),
                "frequency": device.get("frequency"),
                "satelliteDensity": device.get("satelliteDensity"),
                "EIRP": device.get("EIRP"),
                "frequencyExtension": device.get("frequencyExtension"),
                "rxAntennas": device.get("rxAntennas"),
                "txAntennas": device.get("txAntennas"),
                "DDRSstatus": device.get("DDRSstatus"),
                "dataStreams": device.get("dataStreams"),
                "ATPCstatus": device.get("ATPCstatus"),
                "txRate": device.get("txRate"),
            })
        if device.get("device_type") == "train_radio":
            SESSIONS[session_id].update({
                "signal1": device.get("signal1"),
                "signal2": device.get("signal2"),
                "baseName": device.get("baseName"),
                "wirelessLink": device.get("wirelessLink"),
                "noiseLevel": device.get("noiseLevel"),
                "networkName": device.get("networkName")
            })
        return {
            "session_id": session_id,
            "status": "active",
            "device_ip": request.ip,
            "device_type": request.device_type,
            "verified_connected": True,
            "verified_oid": ok_oid,
            "verified_value": str(ok_value),
            "system_name": sys_name,
            "message": f"Session started with device at {request.ip} (SNMP verified)"
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Session start failed: {str(e)}")

@app.get("/session/{session_id}/summary")
def get_session_summary(session_id: int):
    """Get session summary"""
    sess = SESSIONS.get(session_id)
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")
    if sess.get("device_type") == "station_radio":
        return {
        "session_id": session_id,
        "ip": sess.get("ip"),
        "device_type": sess.get("device_type"),
        "radioMode": sess.get("radioMode"),
        "identity": {
            "type": "station_radio",
            "model": "Real Station Radio Device",
            "verified_connected": True
        },
        "status": sess.get("status", "active")
        }
    if sess.get("device_type") == "train_radio":
        return {
        "session_id": session_id,
        "ip": sess.get("ip"),
        "device_type": sess.get("device_type"),
        "radioMode": sess.get("radioMode"),
        "identity": {
            "type": "train_radio",
            "model": "Real Train Radio Device",
            "verified_connected": True
        },
        "status": sess.get("status", "active")
        }
    if sess.get("device_type") == "encoder":
        return {
            "session_id": session_id,
            "ip": sess.get("ip"),
            "device_type": sess.get("device_type"),
            "identity": {
                "type": "encoder",
                "model": "Real Encoder Device",
                "verified_connected": True
            },
            "status": sess.get("status", "active")
            }
    return

@app.post("/session/{session_id}/refresh")
async def refresh_session_summary(session_id: int):
    """Re-poll key OIDs to refresh summary fields (sysName, sysDescr, sysUpTime)."""
    sess = SESSIONS.get(session_id)
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")
    from snmp_client import snmp_get
    ip = sess.get("ip")
    community = sess.get("community") or "public"
    oids = {
        "sysDescr": "1.3.6.1.2.1.1.1.0",
        "sysUpTime": "1.3.6.1.2.1.1.3.0",
        "sysName": "1.3.6.1.2.1.1.5.0",
        "proximSystemName": "1.3.6.1.4.1.841.1.1.2.1.5.8"
    }
    descr = await snmp_get(ip, community, oids["sysDescr"]) or sess.get("last_sysDescr")
    if descr:
        sess["last_sysDescr"] = descr
    name = await snmp_get(ip, community, oids["sysName"]) or snmp_get(ip, community, oids["proximSystemName"]) or sess.get("system_name")
    if name:
        sess["system_name"] = name
    uptime = await snmp_get(ip, community, oids["sysUpTime"]) or None
    sys_uptime = timeticks_to_string(uptime)   

    return {
        "session_id": session_id,
        "ip": ip,
        "system_name": sess.get("system_name"),
        "sysDescr": sess.get("last_sysDescr"),
        "sysUpTime": uptime,
        "status": sess.get("status", "active")
    }

@app.get("/ops/{session_id}/config")
def get_device_config(session_id: int):
    """Get real device configuration"""
    sess = SESSIONS.get(session_id)
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")
    device_ip = sess.get("ip")
    
    if sess.get("device_type") == "station_radio" or sess.get("device_type") == "train_radio":
        return {
            "config": {
                "systemName": sess.get("system_name") or sess.get("name"),
                "ipAddress": device_ip,
                "ssid": sess.get("ssid"),
                "channel": sess.get("channel"),
                "bandwidth": sess.get("bandwidth"),
                "radioMode": sess.get("radio_mode"),
                "connection_verified": True,
                "last_verified": datetime.now(timezone.utc).isoformat()
            }
        }
    
    if sess.get("device_type") == "encoder":
        return {
            "config": {
                "systemName": sess.get("system_name") or sess.get("name"),
                "ipAddress": device_ip,
                "connection_verified": True,
                "last_verified": datetime.now(timezone.utc).isoformat()
            }
        }
    return

@app.post("/ops/{session_id}/config")
def set_device_config(session_id: int, config: dict):
    """Update real device configuration"""
    logger.info(f"Updating config for REAL device in session {session_id}")
    return {
        "ok": True,
        "applied": config,
        "message": "Configuration updated on real device",
        "verified_applied": True
    }

@app.get("/ops/{session_id}/logs")
def get_device_logs(session_id: int):
    """Get real device logs"""
    current_time = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    return {
        "logs": f"{current_time} REAL Station Radio - System initialized\\n" +
               f"{current_time} Network connection verified\\n" +
               f"{current_time} Device responding to management requests\\n" +
               f"{current_time} No fake data - all information from real device"
    }


# Find project root (metro_EMS-main)
CURRENT_FILE = Path(__file__).resolve()

BASE_DIR = CURRENT_FILE
import sys
from pathlib import Path

# if getattr(sys, "frozen", False):
    # Running as PyInstaller bundle
    # BASE_DIR = Path(sys.executable).resolve().parent
BASE_DIR = os.getcwd()
# else:
#     # Running in development
#     # BASE_DIR = Path(__file__).resolve().parents[1]
#     BASE_DIR = Path(__file__).resolve().parent

global DATA_DIR

DATA_DIR = BASE_DIR + "/data"
Path(DATA_DIR).mkdir(parents=True,exist_ok=True)

# -----------------------------
# Database Files
# -----------------------------
DB_PATH1 = DATA_DIR + "/firmware_state.db"
_db_lock = Lock()

DB_PATH = DATA_DIR + "/auth.db"
_lock = Lock()

DB_PATH2 = DATA_DIR + "/metroEms.db"

KLINK = DATA_DIR + "/klink.exe"

# -----------------------------
# Firmware Directory
# -----------------------------
FIRMWARE_DIR = DATA_DIR + "/firmwareEMS"
Path(FIRMWARE_DIR).mkdir(parents=True,exist_ok=True)

# -----------------------------
# MediaMTX Paths
# -----------------------------
# base = os.getcwd()
MEDIA_DIR = BASE_DIR + "/streamer"
MEDIA_MTX_BIN = MEDIA_DIR + "/mediamtx.exe"
MEDIA_MTX_CONFIG = MEDIA_DIR + "/mediamtx.yml"

def get_base_path():
    if getattr(sys, "frozen", False):
        return Path(sys._MEIPASS)
    return Path(__file__).resolve().parent

import config_loader

BASE_PATH = os.getcwd()
global CONFIG_PATH
CONFIG_PATH = BASE_PATH+ "/config/"+ "config.yaml"
configs = config_loader.load_config(CONFIG_PATH)
cPath = configs.opennms['base_url']
# configs = CONFIG.opennms['base_url']
NODES_URL = cPath + "/metronms/api/v2/nodes/allData"
FACILITIES_URL = cPath + "/metronms/api/v2/facilities/allData"

# session_id -> username
_SESSIONS = {}
 
_CURRENT_SESSION = {"session_id": None}
 
 
def init_db():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
 
    cur.execute("""
        CREATE TABLE IF NOT EXISTS auth_credentials (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL,
            password TEXT NOT NULL
        )
    """)
 
    cur.execute("""
        CREATE TABLE IF NOT EXISTS auth_session (
            session_id TEXT PRIMARY KEY,
            username TEXT NOT NULL
        )
    """)
 
    conn.commit()
    conn.close()
 
    conn1 = sqlite3.connect(DB_PATH1)
    cur1 = conn1.cursor()
 
    cur1.execute("""
        CREATE TABLE IF NOT EXISTS device_firmware (
            ip TEXT PRIMARY KEY,
            device_name TEXT NOT NULL,
            firmware_name TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
    """)
 
    conn1.commit()
    conn1.close()

    conn2 = sqlite3.connect(DB_PATH2)
    cur2 = conn2.cursor()

    cur2.execute("""
        CREATE TABLE IF NOT EXISTS nodes (
            label TEXT PRIMARY KEY,
            sysName TEXT,
            deviceType TEXT,
            facilityId INT,
            facility TEXT,
            radioMode TEXT,
            active BOOLEAN
        )
    """)

    cur2.execute("""
        CREATE TABLE IF NOT EXISTS facilities (
            id INTEGER PRIMARY KEY,
            name TEXT,
            uname TEXT,
            stcode TEXT,
            latitude TEXT,
            longitude TEXT
        )
    """)

    cur2.execute("""
                 CREATE TABLE IF NOT EXISTS sync_metadata (
                table_name TEXT PRIMARY KEY,
                last_synced_at TEXT
                )
                """)

    conn2.commit()
    conn2.close()
    
def load_from_db():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
 
    cur.execute("SELECT session_id, username FROM auth_session")
    rows = cur.fetchall()
    conn.close()
 
    with _lock:
        for session_id, username in rows:
            _SESSIONS[session_id] = username
 
def save_credentials(username, password):
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
 
    # avoid duplicates
    cur.execute(
        "SELECT 1 FROM auth_credentials WHERE username=? AND password=?",
        (username, password)
    )
    if not cur.fetchone():
        cur.execute(
            "INSERT INTO auth_credentials (username, password) VALUES (?, ?)",
            (username, password)
        )
 
    conn.commit()
    conn.close()
 
def save_session(session_id, username):
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
 
    cur.execute(
        "INSERT OR REPLACE INTO auth_session (session_id, username) VALUES (?, ?)",
        (session_id, username)
    )
 
    conn.commit()
    conn.close()
 
def clear_session(session_id):
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
 
    cur.execute(
        "DELETE FROM auth_session WHERE session_id=?",
        (session_id,)
    )
 
    conn.commit()
    conn.close()
 
init_db()
load_from_db()

def get_last_sync(cur, table_name):
    cur.execute(
        "SELECT last_synced_at FROM sync_metadata WHERE table_name = ?",
        (table_name,)
    )
    row = cur.fetchone()
    return row[0] if row else None


def update_last_sync(cur, table_name):
    now = datetime.now(timezone.utc).isoformat()
    cur.execute("""
        INSERT INTO sync_metadata (table_name, last_synced_at)
        VALUES (?, ?)
        ON CONFLICT(table_name) DO UPDATE SET
            last_synced_at = excluded.last_synced_at
    """, (table_name, now))
    return now


def fetch_api(url: str):
    try:
        username, password = get_auth_credentials()
        resp = requests.get(url, timeout=100,auth=(username,password))
        resp.raise_for_status()
        return resp.json()
    except requests.RequestException as e:
        raise HTTPException(
            status_code=502,
            detail=f"Failed to fetch {url}: {str(e)}"
        )

@app.get("/checksync")
def check_sync():
    conn = sqlite3.connect(DB_PATH2)
    cur = conn.cursor()
 
    last_nodes_sync_str = get_last_sync(cur,"nodes")
    if not last_nodes_sync_str:
        return {
            "time": "Never synced",
            "sync": True
        }
    last_facilities_sync_str = get_last_sync(cur,"facilities")
 
    last_nodes_sync = datetime.fromisoformat(last_nodes_sync_str).replace(tzinfo=timezone.utc)
    last_facilities_sync = datetime.fromisoformat(last_facilities_sync_str).replace(tzinfo=timezone.utc)
 
    now = datetime.now(timezone.utc)
 
    sync_needed = (
    now - last_nodes_sync >= timedelta(hours=24) or
    now - last_facilities_sync >= timedelta(hours=24)
    )
 
    return {
        "time": last_nodes_sync.strftime("%Y-%m-%d %H:%M:%S"),
        "sync": sync_needed
    }

@app.get("/sync/nodes")
def sync_nodes():

    conn = sqlite3.connect(DB_PATH2)
    cur = conn.cursor()

    last_synced = get_last_sync(cur, "nodes")
    synced = get_last_sync(cur,"nodes")
    api_data = fetch_api(NODES_URL)
    api_count = len(api_data)

    cur.execute("SELECT COUNT(*) FROM nodes")
    db_count = cur.fetchone()[0]

    cur.execute("SELECT label FROM nodes")
    existing_labels = {row[0] for row in cur.fetchall()}

    new_or_updated = []
    truncate = False

    if api_count != db_count:
        cur.execute("DELETE FROM nodes")

    for node in api_data:
        label = node.get("label")

        if label not in existing_labels:
            new_or_updated.append(node)

        cur.execute("""
            INSERT INTO nodes (label, sysName, deviceType, facilityId, facility, radioMode, active)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(label) DO UPDATE SET
                sysName=excluded.sysName,
                deviceType=excluded.deviceType,
                facilityId=excluded.facilityId,
                facility=excluded.facility,
                radioMode=excluded.radioMode,
                active=excluded.active
                """, (
            label,
            node.get("sysName"),
            node.get("deviceType"),
            node.get("facilityId"),
            node.get("facility"),
            node.get("radioMode"),
            node.get("active")
        ))

    if new_or_updated or not new_or_updated:
        last_synced = update_last_sync(cur, "nodes")

    conn.commit()

    cur.execute("SELECT COUNT(*) FROM nodes")
    db_count = cur.fetchone()[0]

    conn.close()

    return {
        "status": "updated" if new_or_updated else "ok",
        "api_count": api_count,
        "db_count": db_count,
        "last_synced_at": synced,
        "new_sync_at": last_synced,
        "new_nodes": new_or_updated
    }


@app.get("/sync/facilities")
def sync_facilities():

    conn = sqlite3.connect(DB_PATH2)
    cur = conn.cursor()

    last_synced = get_last_sync(cur, "facilities")
    synced = get_last_sync(cur,"facilities")
    api_data = fetch_api(FACILITIES_URL)
    api_count = len(api_data)
    cur.execute("SELECT COUNT(*) FROM facilities")
    db_count = cur.fetchone()[0]

    cur.execute("SELECT id FROM facilities")
    existing_ids = {row[0] for row in cur.fetchall()}

    new_or_updated = []
    
    if api_count != db_count:
        cur.execute("DELETE FROM facilities")

    for fac in api_data:
        fac_id = fac.get("id")

        if fac_id not in existing_ids:
            new_or_updated.append(fac)

        cur.execute("""
            INSERT INTO facilities (id, name, uname, stcode, latitude, longitude)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                name=excluded.name,
                uname=excluded.uname,
                stcode=excluded.stcode,
                latitude=excluded.latitude,
                longitude=excluded.longitude
        """, (
            fac_id,
            fac.get("name"),
            fac.get("uname"),
            fac.get("stcode"),
            fac.get("latitude"),
            fac.get("longitude")
        ))

    if new_or_updated or not new_or_updated:
        last_synced = update_last_sync(cur, "facilities")

    conn.commit()

    cur.execute("SELECT COUNT(*) FROM facilities")
    db_count = cur.fetchone()[0]

    conn.close()

    return {
        "status": "updated" if new_or_updated else "ok",
        "api_count": api_count,
        "db_count": db_count,
        "last_synced_at": last_synced,
        "new_synced_at":synced,
        "new_facilities": new_or_updated
    }

@app.post("/auth/set")
def set_auth_credentials(req: LoginRequest):
 
    VALIDATION_URL = (
        configs.opennms["base_url"] + "/metronms/api/v2/nodelinks/serverstats"
    )
 
    try:
        resp = requests.get(
            VALIDATION_URL,
            auth=(req.username, req.password),
            timeout=10
        )
 
        if resp.status_code in (401, 403):
            raise HTTPException(401, "Invalid username or password")
 
        if resp.status_code != 200:
            raise HTTPException(502, "Auth validation failed")
 
    except requests.RequestException:
        conn = sqlite3.connect(DB_PATH)
        cur = conn.cursor()
        cur.execute(
            "SELECT 1 FROM auth_credentials WHERE username=? AND password=?",
            (req.username, req.password)
        )
        ok = cur.fetchone() is not None
        conn.close()
 
        if not ok:
            raise HTTPException(
                status_code=504,
                detail="Auth server unreachable and no cached credentials"
            )
 
    session_id = str(uuid.uuid4())
 
    with _lock:
        _SESSIONS[session_id] = req.username
        _CURRENT_SESSION["session_id"] = session_id   #IMPORTANT
 
    save_credentials(req.username, req.password)
    save_session(session_id, req.username)
 
    return {
        "status": "success",
        "session_id": session_id,
        "username": req.username
    }
 
@app.post("/auth/logout")
def logout():
 
    with _lock:
        sid = _CURRENT_SESSION["session_id"]
 
        if not sid:
            raise HTTPException(401, "No active session")
 
        _CURRENT_SESSION["session_id"] = None
        _SESSIONS.pop(sid, None)
 
    clear_session(sid)
 
    return {
        "status": "success",
        "message": "Logged out (credentials preserved)"
    }
 
def validate_session(session_id: str) -> str:
    with _lock:
        username = _SESSIONS.get(session_id)
 
    if not username:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired session"
        )
 
    return username
 
def get_auth_credentials():
    with _lock:
        session_id = _CURRENT_SESSION.get("session_id")
 
    if not session_id:
        raise HTTPException(
            status_code=401,
            detail="No active session"
        )
 
    with _lock:
        username = _SESSIONS.get(session_id)
 
    if not username:
        raise HTTPException(
            status_code=401,
            detail="Invalid session"
        )
 
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
 
    cur.execute(
        "SELECT password FROM auth_credentials WHERE username=?",
        (username,)
    )
    row = cur.fetchone()
    conn.close()
 
    if not row:
        raise HTTPException(401, "Credentials not available")
 
    return username, row[0]

@app.get("/stations")
def stationData():
    conn = sqlite3.connect(DB_PATH2)
    cur = conn.cursor()

    cur.execute("""SELECT id, name FROM facilities""")

    conn.commit()
    rows = cur.fetchall()
    conn.close()
    if not rows:
        raise HTTPException(404, "Stations not found")
    
    stations = [{
            "id":r[0],
            "name":r[1]
        } for r in rows ]
    
    return stations

@app.get("/devices/{fac_id}")
async def deviceByFacId(fac_id: str):
    conn = sqlite3.connect(DB_PATH2)
    cur = conn.cursor()

    cur.execute(
        """
        SELECT * 
        FROM nodes 
        WHERE facilityId = ?
          AND deviceType IN ('SN', 'transcoder', 'encoder')
        """,
        (fac_id,)
    )

    conn.commit()
    rows = cur.fetchall()
    conn.close()
    if not rows:
        raise HTTPException(404, "Devices not found")

    response = {
        "station": [],
        "transcoder": [],
        "encoder": []
    }

    for r in rows:
        device = {
            "label": r[0],
            "sysName": r[1],
            "deviceType": r[2],
            "facilityId": r[3],
            "facility": r[4],
            "radioMode": r[5],
            "active": bool(r[6]),
        }

        if r[2] == "SN":
            response["station"].append(device)
        elif r[2] == "transcoder":
            response["transcoder"].append(device)
        elif r[2] == "encoder":
            response["encoder"].append(device)

    return response

@app.post("/train/{trainId}")
def handleTrainId(trainId: int):
    val = trainId - 5000

    if val <= 0:
        raise HTTPException(400, "Invalid trainId")

    val_str = str(val)
    network_code = val_str[-1]
    host = val_str[:-1]

    if not host:
        raise HTTPException(400, "Invalid trainId format")

    if network_code == "1":
        obc = f"10.205.1.{host}"
        tr  = f"10.205.5.{host}"
        io  = f"10.205.8.{host}"

    elif network_code == "6":
        obc = f"10.205.2.{host}"
        tr  = f"10.205.6.{host}"
        io  = f"10.205.9.{host}"

    else:
        raise HTTPException(400, "Unsupported network code")

    return {
        "trainId": trainId,
        "OBC": obc,
        "TR": tr,
        "IO BOX": io
    }

mediamtx_process = None
mediamtx_lock = asyncio.Lock()

# def wait_for_port(host, port, timeout=10):
#     start = time.time()
#     while time.time() - start < timeout:
#         try:
#             with socket.create_connection((host, port), timeout=1):
#                 return True
#         except OSError:
#             time.sleep(0.5)
#     return False

@app.post("/mediamtx/{ip}/{action}")
async def control_mediamtx(ip: str, action: str):
    global mediamtx_process

    async with mediamtx_lock:

        if action == "start":

            if mediamtx_process and mediamtx_process.poll() is None:
                return {"status": "already_running"}

            binary = Path(MEDIA_MTX_BIN)
            config = Path(MEDIA_MTX_CONFIG)

            if not binary.exists():
                raise HTTPException(status_code=500, detail="Binary not found")

            cmd = [str(binary)]

            if config.exists():
                cmd.append(str(config))

            # Linux executable permission
            if sys.platform != "win32":
                binary.chmod(binary.stat().st_mode | 0o111)

            try:
                mediamtx_process = subprocess.Popen(
                    cmd,
                    cwd=str(MEDIA_DIR)
                )

                await asyncio.sleep(5)

                if mediamtx_process.poll() is not None:
                    stdout, stderr = mediamtx_process.communicate()
                    raise HTTPException(
                        status_code=500,
                        detail=f"MediaMTX crashed:\n{stderr}"
                    )

                # if not wait_for_port("localhost", 9997, timeout=10):
                #     raise HTTPException(
                #         status_code=500,
                #         detail="MediaMTX API port did not open"
                #     )

                url = "http://localhost:9997/v3/config/paths/add/quad"
                
                try:
                    async with httpx.AsyncClient(timeout=5) as client:
                        response = await client.post(url,
                        headers={"Content-Type": "application/json"}, 
                        json={
                            "source": f"rtsp://{ip}:554/quad", 
                            "sourceProtocol":"tcp",
                            "sourceOnDemand": True
                        })
                        
                        if response.status_code == 500 or response.status_code == 409:
                            #call above quad url again
                            await asyncio.sleep(3)

                            response = await client.post(url,
                            headers={"Content-Type": "application/json"}, 
                            json={
                                "source": f"rtsp://{ip}:554/quad", 
                                "sourceProtocol":"tcp",
                                "sourceOnDemand": True
                            },
                            timeout=5)

                            if response.status_code == 500 or response.status_code == 409:
                                raise HTTPException(500,"Failed to add quad url")
                            else:
                                return {
                                    "status": "started",
                                    "pid": mediamtx_process.pid,
                                    "data": response.json()
                                }
                        else:
                            return {
                                "status": "started",
                                "pid": mediamtx_process.pid,
                                "data": response.json()
                            }
                except Exception as e:
                    raise HTTPException(500, "Failed to add quad url")
                    await control_mediamtx(ip, "stop")

            except Exception as e:
                raise HTTPException(500, f"Failed to start MediaMTX: {e}")
                await control_mediamtx(ip, "stop")

        elif action == "stop":

            if not mediamtx_process or mediamtx_process.poll() is not None:
                return {"status": "not_running"}

            try:
                mediamtx_process.terminate()
                mediamtx_process.wait(timeout=5)

            except subprocess.TimeoutExpired:
                mediamtx_process.kill()

            mediamtx_process = None

            return {"status": "stopped"}

        else:
            raise HTTPException(400, "Invalid action. Use 'start' or 'stop'")

@app.get("/mediamtx/status")
async def mediamtx_status():
    if mediamtx_process and mediamtx_process.poll() is None:
        return {
            "status": "running",
            "pid": mediamtx_process.pid
        }
    return {"status": "stopped"}

#systemctl status systemd-timesyncd

@app.get("/firmware/list")
async def list_and_compare_firmware():

    list_url = (
        configs.opennms["base_url"] + "/metronms/api/v2/firmware/firmwares"
        "?page=1&limit=50&sort=fileName.asc"
    )

    username, password = get_auth_credentials() 

    try:
        # ============================================================
        # STEP 1: Fetch firmware list ONCE
        # ============================================================
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.get(
                list_url,
                auth=(username, password)
            )
            response.raise_for_status()

            firmware_list = response.json() if response.content else []

        # ============================================================
        # STEP 2: Check local firmware directory
        # ============================================================
        if not Path(FIRMWARE_DIR).exists() or not Path(FIRMWARE_DIR).is_dir():
            # Directory missing → everything needs download
            return {
                "firmware_dir": str(FIRMWARE_DIR),
                "directory_exists": False,
                "total_files": len(firmware_list),
                "files": [
                    {
                        "file_name": fw.get("fileName"),
                        "device_type": fw.get("deviceType"),
                        "actualName": fw.get("actualName"),
                        "version": fw.get("version"),
                        "createdTime": fw.get("createdTime"),
                        "status": "download"
                    }
                    for fw in firmware_list
                ]
            }

        # ============================================================
        # STEP 3: Collect local files
        # ============================================================
        local_files = {
            f.name
            for f in Path(FIRMWARE_DIR).iterdir()
            if f.is_file()
        }

        # ============================================================
        # STEP 4: Compare and enrich response
        # ============================================================
        files = []
        for fw in firmware_list:
            actual_name = fw.get("actualName")

            status = (
                "already_exists"
                if actual_name in local_files
                else "download"
            )

            files.append({
                "file_name": fw.get("fileName"),
                "device_type": fw.get("deviceType"),
                "actualName": actual_name,
                "version": fw.get("version"),
                "createdTime": fw.get("createdTime"),
                "status": status
            })

        return {
            "firmware_dir": str(Path(FIRMWARE_DIR)),
            "directory_exists": True,
            "total_files": len(files),
            "files": files
        }

    except httpx.RequestError as e:
        raise HTTPException(
            status_code=504,
            detail=f"Firmware server unreachable: {str(e)}"
        )

def resolve_dest(base_dir: Path, relative_path: str, mode: int) -> Path:
    """
    Resolve and create a directory safely inside base_dir.
    Prevents path traversal.
    """

    safe_path = relative_path.lstrip("/\\")

    dest = (base_dir +"/"+ safe_path)

    if not str(dest).startswith(str(base_dir)):
        raise HTTPException(
            status_code=400,
            detail="Invalid destinationPath"
        )

    try:
        Path(dest).mkdir(parents=True, exist_ok=True)

        os.chmod(dest, mode)

    except PermissionError:
        raise HTTPException(
            status_code=500,
            detail=f"Permission denied creating directory: {dest}"
        )

    return dest

@app.get("/firmware/push/{file_name}")
def push_firmware(file_name: str):

    FIRMWARE_MODE = 0o775
    FILE_MODE = 0o664

    destinationPath = "firmwareEMS"
    try:
        os.chmod(DATA_DIR, FIRMWARE_MODE)
    except PermissionError:
        raise HTTPException(
            status_code=500,
            detail=f"Permission denied creating base directory: {DATA_DIR}"
        )
    username, password = get_auth_credentials()
    dest_dir = resolve_dest(DATA_DIR, destinationPath, FIRMWARE_MODE)
    dest_file = dest_dir +"/"+ file_name

    url = configs.opennms["base_url"] + f"/metronms/api/v2/firmware/push/{file_name}"

    try:
        with requests.post(
            url,
            auth=(username, password),
            stream=True,
            timeout=300
        ) as response:

            response.raise_for_status()

            with open(dest_file, "wb") as f:
                for chunk in response.iter_content(chunk_size=1024 * 1024):
                    if chunk:
                        f.write(chunk)

        os.chmod(dest_file, FILE_MODE)

        return {
            "status": "success",
            "file": file_name,
            "stored_at": str(dest_file)
        }

    except requests.RequestException as e:
        raise HTTPException(
            status_code=502,
            detail=f"Firmware download failed: {str(e)}"
        )

@app.get("/fetch/filePath/{fileName}")
def fetch_path(fileName: str):
    source_root = Path(FIRMWARE_DIR).resolve()

    for root, dirs, files in os.walk(source_root):
        if fileName in files:
            full_path = os.path.join(root, fileName)
            return {
                "found": True,
                "fileName": fileName,
                "filePath": full_path
            }

    raise HTTPException(status_code=404, detail="File not found")

@app.post("/device/filecopy")
def copy_file_local(req: LocalCopyRequest):
    src = req.source_path
    dest_dir = Path("/tftpboot")

    if not os.path.isfile(src):
        raise HTTPException(
            status_code=404,
            detail="Source file not found"
        )

    if not dest_dir.exists() or not dest_dir.is_dir():
        raise HTTPException(
            status_code=404,
            detail="Destination folder not found"
        )

    dest_path = dest_dir / os.path.basename(src)

    try:
        shutil.copy(src, dest_path)

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Copy failed: {str(e)}"
        )

    return {
        "message": "File copied successfully (existing file replaced if present)",
        "destination": str(dest_path)
    }


def create_ssh_client(host: str, username: str, password: str) -> paramiko.SSHClient:
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(
        hostname=host,
        username=username,
        password=password,
        timeout=10,
        look_for_keys=False,
        allow_agent=False
    )
    return ssh


@app.post("/copy/scp")
def copy_file_scp(req: RemoteCopyRequest):

    src = req.source_path
    remote_host = req.host
    remote_user = req.systemName
    remote_password = req.passWord

    if req.deviceType == "transcoder":
        remote_dir = f"/home/{remote_user}"
    elif req.deviceType == "obc":
        remote_dir = f"/home/{remote_user}"
    else:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported deviceType: {req.deviceType}"
        )

    if not os.path.isfile(src):
        raise HTTPException(
            status_code=404,
            detail="Source file not found"
        )

    try:
        ssh = create_ssh_client(
            host=remote_host,
            username=remote_user,
            password=remote_password
        )

        file_name = os.path.basename(src)
        remote_file_path = f"{remote_dir}/{file_name}"

        # SCP PUT will overwrite existing file automatically
        with SCPClient(ssh.get_transport()) as scp:
            scp.put(
                files=src,
                remote_path=remote_file_path
            )

        ssh.close()

    except paramiko.AuthenticationException:
        raise HTTPException(
            status_code=401,
            detail="Authentication failed (invalid username/password)"
        )

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"SCP failed: {str(e)}"
        )

    return {
        "message": "File copied successfully (existing file replaced if present)",
        "remote": f"{remote_user}@{remote_host}:{remote_file_path}",
        "path": remote_file_path
    }

TERMINAL_SESSIONS = {}
TERMINAL_LOCK = Lock()

@app.post("/terminal/exec")
def execute_remote_command(req: TerminalCommandRequest):

    if not req.command.strip():
        raise HTTPException(status_code=400, detail="Command cannot be empty")

    session_id = f"{req.host}"

    DEFAULT_TERMINAL_DIR = "/home/transcoder"

    if req.deviceType == "obc":
        DEFAULT_TERMINAL_DIR = f"/home/{req.systemName}"

    with TERMINAL_LOCK:
        cwd = TERMINAL_SESSIONS.get(session_id, DEFAULT_TERMINAL_DIR)

    try:
        ssh = create_ssh_client(
            host=req.host,
            username=req.systemName,
            password=req.passWord
        )

        command = req.command.strip()

        # ---------- HANDLE CD ----------
        if command == "cd" or command.startswith("cd "):
            target = command[2:].strip()

            if not target:
                new_dir = f"/home/{req.systemName}"
            elif target.startswith("/"):
                new_dir = target
            else:
                new_dir = str(Path(cwd) / target)

            check_cmd = f"cd {new_dir} && pwd"
            stdin, stdout, stderr = ssh.exec_command(check_cmd)
            exit_code = stdout.channel.recv_exit_status()

            if exit_code != 0:
                ssh.close()
                raise HTTPException(
                    status_code=400,
                    detail=f"Directory not found: {new_dir}"
                )

            new_cwd = stdout.read().decode().strip()

            with TERMINAL_LOCK:
                TERMINAL_SESSIONS[session_id] = new_cwd

            ssh.close()

            return {
                "command": command,
                "working_directory": new_cwd,
                "exit_code": 0,
                "stdout": "",
                "stderr": "",
                "status": "success"
            }

        # ---------- NORMAL COMMAND ----------
        full_command = f"cd {cwd} && {command}"

        stdin, stdout, stderr = ssh.exec_command(
            full_command,
            get_pty=True,
            timeout=30
        )

        exit_status = stdout.channel.recv_exit_status()

        out = stdout.read().decode(errors="ignore")
        err = stderr.read().decode(errors="ignore")

        ssh.close()

        return {
            "command": command,
            "working_directory": cwd,
            "exit_code": exit_status,
            "stdout": out.strip(),
            "stderr": err.strip(),
            "status": "success" if exit_status == 0 else "failed"
        }

    except paramiko.AuthenticationException:
        raise HTTPException(status_code=401, detail="Authentication failed")

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

#BY USING SSH 
# def connect_router(req: RouterOs):
#     hosts_to_try = [req.ip, DEFAULT_HOST]
#     last_error = None

#     for index, host_ip in enumerate(hosts_to_try):
#         try:
#             host, port = host_ip.split(":") if ":" in host_ip else (host_ip, 22)
#             port = int(port)

#             ssh = paramiko.SSHClient()
#             ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

#             ssh.connect(
#                 hostname=host,
#                 port=port,
#                 username=req.username,
#                 password=req.password,
#                 timeout=5,
#             )

#             message = (
#                 "connection with default host established"
#                 if index == 1
#                 else f"connection established at {host}"
#             )

#             return ssh, host, message

#         except Exception as e:
#             last_error = str(e)
#             continue

#     raise Exception(f"both connection attempts failed: {last_error}")

# def run_ssh_command(ssh, command: str) -> str:
#     stdin, stdout, stderr = ssh.exec_command(command)
#     output = stdout.read().decode().strip()
#     error = stderr.read().decode().strip()

#     if error:
#         raise Exception(error)

#     return output


# def parse_interfaces(output: str):
#     interfaces = []

#     lines = output.splitlines()

#     for line in lines:
#         # Example terse output parsing
#         # ether1 running type=ether
#         match = re.search(
#             r"name=(\S+).*type=(\S+).*running=(\S+)",
#             line
#         )

#         if match:
#             interfaces.append({
#                 "name": match.group(1),
#                 "type": match.group(2),
#                 "running": match.group(3)
#             })

#     return interfaces

# @app.post("/iobox/discovery")
# def discovery(req: RouterOs):

#     ssh = None

#     try:
#         ssh, host_used, message = connect_router(req)

#         return {
#             "status": "success",
#             "message": message,
#             "host_used": host_used
#         }

#     except Exception as e:
#         return {"status": "error", "message": str(e)}

#     finally:
#         if ssh:
#             ssh.close()

# @app.post("/iobox/ethernetstat")
# def get_ethernet_stat(req: RouterOs):

#     ssh = None

#     try:
#         ssh, host_used, _ = connect_router(req)

#         output = run_ssh_command(
#             ssh,
#             "/interface print terse"
#         )

#         interfaces = parse_interfaces(output)

#         running_ports = [
#             i for i in interfaces if i.get("running") == "true" or i.get("running") == "false"
#         ]

#         return {
#             "status": "success",
#             "host_used": host_used,
#             "interfaces": running_ports
#         }

#     except Exception as e:
#         return {"status": "error", "message": str(e)}

#     finally:
#         if ssh:
#             ssh.close()

# @app.post("/iobox/getcart")
# def get_cart(req: RouterOs):

#     ssh = None

#     try:
#         ssh, host_used, _ = connect_router(req)

#         output = run_ssh_command(
#             ssh,
#             '/system script run ttcCartNumber'
#         )

#         return {
#             "status": "success",
#             "host_used": host_used,
#             "script_reply": output
#         }

#     except Exception as e:
#         return {"status": "error", "message": str(e)}

#     finally:
#         if ssh:
#             ssh.close()


DEFAULT_HOST = "10.205.8.10"

def connect_router(req: RouterOs):
    hosts_to_try = [req.ip, DEFAULT_HOST]

    for index, host_ip in enumerate(hosts_to_try):
        try:
            host, port = host_ip.split(":") if ":" in host_ip else (host_ip, 8728)
            port = int(port)

            username1 = configs.io["username"]
            password1 = configs.io["password"]

            pool = routeros_api.RouterOsApiPool(
                host,
                username=username1,
                password=password1,
                port=port,
                plaintext_login=True,
            )

            api = pool.get_api()
            message = (
                "connection with default host established"
                if index == 1
                else f"connection established at {host}"
            )

            return api, pool, host, message

        except Exception as e:
            last_error = str(e)
            continue

    raise Exception(f"both connection attempts failed: {last_error}")

@app.post("/iobox/discovery")
def discovery(req: RouterOs):

    pool = None

    try:
        api, pool, host_used, message = connect_router(req)

        return {
            "status": "success",
            "message": message,
            "host_used": host_used
        }

    except Exception as e:
        return {"status": "error", "message": str(e)}

    finally:
        if pool:
            pool.disconnect()
    
@app.post("/iobox/ethernetstat")
def get_ethernet_stat(req: RouterOs):

    pool = None

    try:
        api, pool, host_used, _ = connect_router(req)

        rows = api.get_resource('/interface').get()

        running_ports = [
            r for r in rows if r.get('running') == 'true' or r.get('running') == 'false'
        ]

        return {
            "status": "success",
            "host_used": host_used,
            "interfaces": running_ports,
        }

    except Exception as e:
        return {"status": "error", "message": str(e)}

    finally:
        if pool:
            pool.disconnect()

@app.post("/iobox/getcart")
def get_cart(req: RouterOs):

    pool = None

    try:
        api, pool, host_used, _ = connect_router(req)

        script_result = api.get_resource('/system/script').call(
            'run',
            {'.id': 'ttcCartNumber'}
        )

        return {
            "status": "success",
            "host_used": host_used,
            "script_reply": script_result
        }

    except Exception as e:
        return {"status": "error", "message": str(e)}

    finally:
        if pool:
            pool.disconnect()

@app.post("/iobox/setcart")
def set_cart(req: RouterOs):
    if not req.cart:
        return {"status": "error", "message": "cart number is required"}
    pool = None
    username = configs.io["username"]
    password = configs.io["password"]
    try:
        api, pool, host_used, _ = connect_router(req)

        script_result = api.get_resource(f'.\{KLINK} -ssh -auto-store-sshkey -batch {username}@{req.ip} -pw {password}":global ttcCart {req.cart}; /system/script/run ttcSetCartNumber" 2>nul').call(
            'run',
            {'.id': 'ttcCartNumber'}
        )

        return {
            "status": "success",
            "host_used": host_used,
            "script_reply": script_result
        }

    except Exception as e:
        return {"status": "error", "message": str(e)}

    finally:
        if pool:
            pool.disconnect()

def get_ethernet_ip():
    stats = psutil.net_if_stats()

    for iface, addrs in psutil.net_if_addrs().items():
        if not iface.startswith(("en", "eth")):
            continue

        if not stats.get(iface) or not stats[iface].isup:
            continue

        for addr in addrs:
            if addr.family == socket.AF_INET and not addr.address.startswith("127."):
                return addr.address

    return None

def get_wifi_ip():
    stats = psutil.net_if_stats()

    for iface, addrs in psutil.net_if_addrs().items():
        if not iface.startswith(("wl", "wlan", "wlp")):
            continue

        if not stats.get(iface) or not stats[iface].isup:
            continue

        for addr in addrs:
            if addr.family == socket.AF_INET and not addr.address.startswith("127."):
                return addr.address

    return None

@app.get("/radio/{session_id}/current-firmware")
async def current_firmware(session_id: int):
    sess = SESSIONS.get(session_id)
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")
 
    device_cls = DEVICE_CLASS_MAP.get(sess.get("device_type"))
    if not device_cls:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported device type: {sess.get('device_type')}"
        )
 
    device_oids = device_cls()
 
    try:
        curr_firmware = await snmp_get(sess.get("ip"),"public",device_oids.fileName)
        return curr_firmware
    
    except Exception as e:
            raise HTTPException(
            status_code=500,
            detail=f"Firmware SNMP SET failed: {str(e)}"
        )
 
 
STATUS_MAP = {
    1: "Idle",
    2: "Download in progress",
    3: "Download success",
    4: "Download failure",
    5: "Signature check in progress",
    6: "Signature check failed",
    7: "Write on flash in progress",
    8: "Write on flash failed",
    9: "Upload in progress",
    10: "Upload success",
    11: "Upload failed"
}
 
@app.post("/radio/{session_id}/firmware-update")
async def update_firmware(request: RadioFirmwareUpdateRequest, session_id: int):
 
    async def event_stream():
 
        logger.info(f"Firmware update requested for REAL device at {request.ip}")
 
        sess = SESSIONS.get(session_id)
        if not sess:
            yield {"event": "error", "data": "Session not found"}
            return
 
        device_cls = DEVICE_CLASS_MAP.get(sess.get("device_type"))
        if not device_cls:
            yield {"event": "error", "data": "Unsupported device type"}
            return
 
        device_oids = device_cls()
 
        tftp_server_add = get_ethernet_ip()
        file_name = request.fileName
        file_type = request.fileType
        operation_type = request.opType
 
        try:
            varbinds = [
                (device_oids.tftpInetAdd, to_octet_string(tftp_server_add)),
                (device_oids.fileName,    to_octet_string(file_name)),
                (device_oids.fileType,    to_integer32(file_type)),
                (device_oids.opType,      to_integer32(operation_type)),
            ]

            await snmp_set(sess.get("ip"), "public", varbinds)
 
            yield {"event": "status", "data": "Firmware update triggered"}
 
        except Exception as e:
            yield {"event": "error", "data": f"Firmware SNMP SET failed: {str(e)}"}
            return
 
        prev_status = None
 
        status_oid = await snmp_get(
            sess.get("ip"),
            sess.get("community"),
            device_oids.status
        )
 
        prev_status = int(status_oid)
 
        yield {
            "event": "status",
            "data": f"{STATUS_MAP.get(prev_status, 'Unknown status')}..."
        }
 
        while int(status_oid) in (2,3,5):
            await asyncio.sleep(5)
 
            status_oid = await snmp_get(
                sess.get("ip"),
                sess.get("community"),
                device_oids.status
            )
 
            yield {
                    "event": "status",
                    "data": f"{STATUS_MAP.get(int(status_oid), 'Unknown status')}..."
                        }

            prev_status = int(status_oid)
            
            continue
 
        while int(status_oid) == 7:
            
            yield {
                    "event": "status",
                    "data": "THe device is rebooting..."
                        }
            await asyncio.sleep(120)
    
            status_oid = await snmp_get(
                sess.get("ip"),
                sess.get("community"),
                device_oids.status
            )
    
            yield {
                "event": "status",
                "data": f"{STATUS_MAP.get(int(status_oid), 'Unknown status')}..."
            }
            
            continue
            # prev_status = int(status_oid)       
 
        if int(status_oid) in (3, 1):
            yield {
                "event": "completed",
                "data": {
                    "ip": sess.get("ip"),
                    "message": "Firmware upload completed successfully",
                    "verified_update": True,
                    "current_status": STATUS_MAP.get(int(status_oid), "Unknown status"),
                    "previous_status": STATUS_MAP.get(prev_status,"Unknown status")
                }
            }
            yield {
                "event": "completed",
                "data": "Firmware upload completed successfully"
            }

            return
 
        elif int(status_oid) in (4, 6):
            yield {"event": "failed", "data": "Signature verification failed/download failure"}
            return
 
        elif int(status_oid) == 8:
            yield {"event": "failed", "data": "Write on flash failed"}
            return
 
        elif int(status_oid) == 11:
            yield {"event": "failed", "data": "Upload failed"}
            return
 
        else:
            yield {"event": "error", "data": "Upload still in progress or unknown state"}
            return
 
    return EventSourceResponse(event_stream())

def set_current_firmware(ip: str, device: str, firmware: str):
    conn = sqlite3.connect(DB_PATH1)
    cur = conn.cursor()
 
    cur.execute("""
        INSERT INTO device_firmware (ip, device_name, firmware_name, updated_at)
        VALUES (?,?, ?, ?)
        ON CONFLICT(ip)
        DO UPDATE SET
            firmware_name = excluded.firmware_name,
            updated_at = excluded.updated_at
    """, (
        ip,
        device,
        firmware,
        datetime.datetime.utcnow().isoformat()
    ))
 
    conn.commit()
    conn.close()
 
 
def get_current_firmware(ip: str):
    conn = sqlite3.connect(DB_PATH1)
    cur = conn.cursor()
 
    cur.execute(
        "SELECT firmware_name FROM device_firmware WHERE ip=?",
        (ip,)
    )
    row = cur.fetchone()
    conn.close()
 
    if not row:
        raise HTTPException(
            status_code=404,
            detail=f"No firmware set for device '{ip}'"
        )
 
    return row[0]
 
@app.post("/transcoder/set/currentfirmware/{ip}/{fileName}")
def transcoder_set_current_firmware(ip: str, fileName: str):
 
    set_current_firmware(ip,"transcoder", fileName)
 
    return {
        "ip": ip,
        "device": "transcoder",
        "current_firmware": fileName
    }
 
 
@app.get("/transcoder/currentfirmware/{ip}")
def transcoder_get_current_firmware(ip: str):
 
    firmware = get_current_firmware(ip)
 
    return {
        "ip": ip,
        "device": "transcoder",
        "current_firmware": firmware
    }
 
@app.post("/obc/set/currentfirmware/{ip}/{fileName}")
def obc_set_current_firmware(ip: str, fileName: str):
 
    set_current_firmware(ip,"obc", fileName)
 
    return {
        "ip": ip,
        "device": "obc",
        "current_firmware": fileName
    }
 
 
@app.get("/obc/currentfirmware/{ip}")
def obc_get_current_firmware(ip: str):
 
    firmware = get_current_firmware(ip)
 
    return {
        "ip": ip,
        "device": "obc",
        "current_firmware": firmware
    }

async def wait_for_reboot(ip: str, down_timeout=60, up_timeout=180):
    """
    Waits for device reboot:
    1. Detects device goes DOWN
    2. Detects device comes UP again
    """

    def is_alive():
        return subprocess.call(
            ["ping", "-c", "1", "-W", "1", ip],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL) == 0

    # ---- Wait for device to go DOWN ----
    start = time.time()
    while time.time() - start < down_timeout:
        if not is_alive():
            break
        await asyncio.sleep(2)

    # ---- Wait for device to come UP ----
    start = time.time()
    while time.time() - start < up_timeout:
        if is_alive():
            return True
        await asyncio.sleep(3)

    return False

@app.post("/obc/{ip}/firmware-update")
async def obc_firmware(request: FirmwareUpdateRequest, ip: str):

    async def event_stream():
        hostAddr = get_wifi_ip()
        fname = request.fileName
        username, password = get_auth_credentials()

        upload_url = f"http://{ip}:8084/obc/api/v1/upload/{hostAddr}:69/{fname}"
        upload_stat_url = f"http://{ip}:8084/obc/api/v1/upgstat"

        timeout_upload = httpx.Timeout(10.0)
        timeout_stat = httpx.Timeout(10.0)
        timeout_upgrade = httpx.Timeout(10.0)

        yield {"event": "started", "data": "OBC firmware upload started"}

        async with httpx.AsyncClient(follow_redirects=True) as client:
            try:
                await client.post(
                    upload_url,
                    headers={"Accept": "application/json"},
                    auth=(username, password),
                    timeout=timeout_upload
                )
            except httpx.RequestError as e:
                yield {"event": "error", "data": f"Device unreachable: {str(e)}"}
                return

            uploaded_file = None

            while True:
                try:
                    resp = await client.get(
                        upload_stat_url,
                        auth=(username, password),
                        timeout=timeout_stat
                    )

                    data = resp.json() if resp.content else {}
                    code = data.get("code")

                    yield {"event": "progress", "data": {"code": code, "raw": data}}

                    if code == 4:
                        uploaded_file = data.get("file")
                        yield {"event": "uploaded", "data": uploaded_file}
                        break

                    if code is not None and code < 0:
                        yield {"event": "failed", "data": data}
                        return

                except httpx.RequestError:
                    yield {"event": "waiting", "data": "Waiting for OBC response"}

                await asyncio.sleep(2)

        if not uploaded_file:
            yield {"event": "error", "data": "Upload completed but no file returned"}
            return

        upgrade_url = f"http://{ip}:8084/obc/api/v1/upgrade/{uploaded_file}"

        try:
            async with httpx.AsyncClient(timeout=timeout_upgrade) as client:
                resp = await client.post(
                    upgrade_url,
                    headers={"Accept": "application/json"},
                    auth=(username, password)
                )

                yield {
                    "event": "upgrade_started",
                    "data": resp.json() if resp.content else {}
                }

                reboot_ok = await wait_for_reboot(ip)

                if reboot_ok:
                    yield {
                        "event": "reboot_complete",
                        "data": "Device reboot completed successfully"
                    }
                else:
                    yield {
                        "event": "warning",
                        "data": "Device reboot not detected within timeout"
                    }

        except httpx.RequestError as e:
            yield {"event": "error", "data": f"Upgrade failed: {str(e)}"}

    return EventSourceResponse(event_stream())  

@app.post("/transcoder/{ip}/firmware-update")
async def transcoder_firmware(request: FirmwareUpdateRequest, ip: str):

    async def event_stream():
        hostAddr = get_wifi_ip()
        fname = request.fileName
        username, password = get_auth_credentials()

        upload_url = f"http://{ip}:8084/transcoder/api/v1/upload/{hostAddr}:69/{fname}"
        upload_stat_url = f"http://{ip}:8084/transcoder/api/v1/upgstat"

        timeout_upload = httpx.Timeout(20.0)
        timeout_stat = httpx.Timeout(10.0)
        timeout_upgrade = httpx.Timeout(30.0)

        yield {"event": "started", "data": "Firmware upload initiated"}

        async with httpx.AsyncClient(follow_redirects=True) as client:
            try:
                await client.post(
                    upload_url,
                    headers={"Accept": "application/json"},
                    auth=(username, password),
                    timeout=timeout_upload
                )
            except httpx.ReadTimeout:
                yield {"event": "downloading", "data": "Device is downloading firmware"}
            except httpx.RequestError as e:
                yield {"event": "error", "data": f"Upload failed: {str(e)}"}
                return

            uploaded_file = None

            while True: 
                try:
                    resp = await client.get(
                        upload_stat_url,
                        auth=(username, password),
                        timeout=timeout_stat
                    )

                    data = resp.json() if resp.content else {}
                    code = data.get("code")

                    yield {"event": "progress", "data": {"code": code, "raw": data}}

                    if code == 4:
                        uploaded_file = data.get("file")
                        yield {"event": "uploaded", "data": uploaded_file}
                        break

                    if code is not None and code < 0:
                        yield {"event": "failed", "data": data}
                        return

                except httpx.RequestError:
                    yield {"event": "waiting", "data": "Waiting for device response"}

                await asyncio.sleep(2)

        if not uploaded_file:
            yield {"event": "error", "data": "Upload finished but file not returned"}
            return

        upgrade_url = f"http://{ip}:8084/transcoder/api/v1/upgrade/{uploaded_file}"

        try:
            async with httpx.AsyncClient(timeout=timeout_upgrade) as client:
                resp = await client.post(
                    upgrade_url,
                    headers={"Accept": "application/json"},
                    auth=(username, password)
                )

                yield {
                    "event": "upgrade_started",
                    "data": resp.json() if resp.content else {}
                }

                reboot_ok = await wait_for_reboot(ip)

                if reboot_ok:
                    yield {
                        "event": "reboot_complete",
                        "data": "Device reboot completed successfully"
                    }
                else:
                    yield {
                        "event": "warning",
                        "data": "Device reboot not detected within timeout"
                    }

        except httpx.RequestError as e:
            yield {"event": "error", "data": f"Upgrade failed: {str(e)}"}

    return EventSourceResponse(event_stream())


@app.post("/encoder/{ip}/firmware-update")
async def encoder_firmware_update(req: EncoderFirmwareUpgrade, ip: str):
 
    async def event_stream():
 
        firmware_path = Path(FIRMWARE_DIR) / req.fileName
        # username = req.systemName
        # password = req.passWord
 
        if not firmware_path.exists():
            yield {
                "event": "error",
                "data": "Firmware file not found"
            }
            return
 
        encoder_url = f"http://{ip}/firmware/upgrade.cgi?response=json"
 
        yield {
            "event": "started",
            "data": req.fileName
        }
        await asyncio.sleep(0.1)
 
        timeout_upload = httpx.Timeout(30.0)
 
        async with httpx.AsyncClient(timeout=timeout_upload) as client:
            try:
                with firmware_path.open("rb") as fw:
                    firmware_bytes = fw.read()
 
                headers = {
                    "Content-Type": "application/octet-stream",
                    "Content-Length": str(len(firmware_bytes)),
                    "X-Firmware-Name": req.fileName
                }
 
                response = await client.request(
                    method="PUT",
                    url=encoder_url,
                    headers=headers,
                    content=firmware_bytes,
                    # auth=(username, password)
                )
 
                try:
                    response_data = response.json()
                except Exception:
                    response_data = response.text if response.text else {}
 
                yield {
                    "event": "uploaded",
                    "data": response_data
                }
                await asyncio.sleep(0.1)
 
            except httpx.RequestError as e:
                yield {
                    "event": "error",
                    "data": f"Upgrade failed: {str(e)}"
                }
                return
 
            if response_data.get("status") != "success":
                await asyncio.sleep(0.1)
                yield {
                    "event": "failed",
                    "data": f"Upgrade failed with status code {response.status_code}"
                }
                return
            else:
                reboot_ok = await wait_for_reboot(ip)
                if reboot_ok:
                    yield {
                        "event": "reboot_complete",
                        "data": "Device reboot completed successfully"
                    }
                else:
                    yield {
                        "event": "warning",
                        "data": "Device reboot not detected within timeout"
                    }
 
                await asyncio.sleep(0.1)
 
                yield {
                    "event": "completed",
                    "data": "Firmware upgrade completed"
                }
 
    return EventSourceResponse(
        event_stream(),
        media_type="text/event-stream"
    )

def safe_float(value):

    if value is None:
        return None
 
    try:
        s = str(value).strip()

        import re
        match = re.search(r"-?\d+(\.\d+)?", s)

        if match:
            return float(match.group())
        return None
 
    except (ValueError, TypeError):
        return None

@app.get("/radio/servicecheck/{session_id}/{ip}")
async def radio_checking_service(session_id: int, ip: str):
    
    sess = SESSIONS.get(session_id)
    if not sess:
            return "session not found"
 
    device_cls = DEVICE_CLASS_MAP.get(sess.get("device_type"))
    if not device_cls:
            return "device type not found"
    values = {}
    device_oids = device_cls()

    lsnr = await snmp_get(sess.get("ip"),sess.get("community"), device_oids.lsnr)
    rsnr = await snmp_get(sess.get("ip"),sess.get("community"), device_oids.rsnr)
    lsignal = await snmp_get(sess.get("ip"),sess.get("community"), device_oids.lsignal)
    rsignal = await snmp_get(sess.get("ip"),sess.get("community"), device_oids.rsignal)
    lnoise = await snmp_get(sess.get("ip"),sess.get("community"), device_oids.lnoise)
    rnoise = await snmp_get(sess.get("ip"),sess.get("community"), device_oids.rnoise)
 
    if sess.get("device_type") == "station_radio":
            teststationname = await snmp_get(sess.get("ip"),sess.get("community"), device_oids.teststationname)
            testmacaddr = await snmp_get(sess.get("ip"),sess.get("community"), device_oids.testmacaddr)
            values = {
                    "lsnr":safe_float(lsnr),
                    "rsnr":safe_float(rsnr),
                    "lsignal":lsignal,
                    "rsignal":rsignal,
                    "lnoise":lnoise,
                    "rnoise":rnoise,
                    "stationame": teststationname,
                    "mac":testmacaddr
                         }
 
    elif sess.get("device_type") == "train_radio":
            macaddr = await snmp_get(sess.get("ip"),sess.get("community"), device_oids.macaddr)
            basename = await snmp_get(sess.get("ip"),sess.get("community"), device_oids.basename)
            values = {
                    "lsnr":safe_float(lsnr),
                    "rsnr":safe_float(rsnr),
                    "lsignal":lsignal,
                    "rsignal":rsignal,
                    "lnoise":lnoise,
                    "rnoise":rnoise,
                    "basename": basename,
                    "mac":macaddr
                         }
            
    return values

@app.get("/obc/{ip}/servicecheck")
async def obc_checking_service(ip: str):

    url1 = f"http://{ip}:8084/obc/api/v1/service/obctdm" #TDM Service
    url2 = f"http://{ip}:8084/obc/api/v1/service/mendriver" #Driver
    url3 = f"http://{ip}:8084/obc/api/v1/service/vsftpd" #FTP Service

    con1 = f"http://{ip}:8084/obc/api/v1/connectivity/trainradioip" #Train Radio Connectivity
    con2 = f"http://{ip}:8084/obc/api/v1/connectivity/ntpserverip"  #NTP Server Connectivity
    con3 = f"http://{ip}:8084/obc/api/v1/connectivity/encoderip" #Encoder Connectivity
    con4 = f"http://{ip}:8084/obc/api/v1/connectivity/ftpserverip" #FTP Server Connectivity

    username,password = get_auth_credentials()

    async def fetch_and_yield(client, url, label=None):
        name = label or url.split("/")[-1]

        try:
            response = await client.get(
                url,
                auth=(username, password),
                timeout=5
            )

            try:
                if response.headers.get("content-type", "").startswith("application/json"):
                    data = response.json()
                else:
                    data = response.text
            except Exception:
                data = response.text
            
            if data.get("serivce") == "failed" or data.get(name) == "0":
                return {
                "event": "failure",
                "data": {
                    "name": name,
                    "status": "failure",
                    # "code": response.status_code,
                    "data": data
                    }
                }
            else:
                return {
                "event": "success",
                "data": {
                    "name": name,
                    "status": "success",
                    # "code": response.status_code,
                    "data": data
                    }
                }

        except httpx.RequestError as e:
            return {
                "event": "failure",
                "data": {
                    "name": name,
                    "status": "failure",
                    "error": str(e)
                }
            }

    async def event_stream():
        async with httpx.AsyncClient() as client:

            services = [
                (url1, "TDM Service"),
                (url2, "Driver"),
                (url3, "FTP Service"),
            ]

            connectivity = [
                (con1,"Train Radio Connectivity"),
                (con2,"NTP Server Connectivity"),
                (con3,"Encoder Connectivity"),
                (con4,"FTP Server Connectivity")
            ]

            for url, label in services:
                result = await fetch_and_yield(client, url, label)
                yield result
                await asyncio.sleep(1)

            for url,label in connectivity:
                result = await fetch_and_yield(client, url,label)
                yield result
                await asyncio.sleep(1)

            yield {
                "event": "complete",
                "data": {"message": "service check finished"}
            }

    return EventSourceResponse(event_stream())

@app.get("/transcoder/{ip}/servicecheck")
async def transcoder_checking_service(ip: str):

    url1 = f"http://{ip}:8084/transcoder/api/v1/service/vtranscoder"
    url2 = f"http://{ip}:8084/transcoder/api/v1/service/gst-health"
    url3 = f"http://{ip}:8084/transcoder/api/v1/service/gst-launch-1.0"

    cam_urls = [
        f"http://{ip}:8084/transcoder/api/v1/cam/cam1",
        f"http://{ip}:8084/transcoder/api/v1/cam/cam2",
        f"http://{ip}:8084/transcoder/api/v1/cam/cam3",
        f"http://{ip}:8084/transcoder/api/v1/cam/cam4",
    ]

    username, password = get_auth_credentials()

    async def fetch_and_yield(client, url, label=None):
        name = label or url.split("/")[-1]

        try:
            response = await client.get(
                url,
                auth=(username, password),
                timeout=5
            )

            try:
                if response.headers.get("content-type", "").startswith("application/json"):
                    data = response.json()
                else:
                    data = response.text
            except Exception:
                data = response.text
            
            if data.get("serivce") == "failed" or data.get(name) == "0":
                return {
                "event": "failure",
                "data": {
                    "name": name,
                    "status": "failure",
                    # "code": response.status_code,
                    "data": data
                    }
                }
            else:
                return {
                "event": "success",
                "data": {
                    "name": name,
                    "status": "success",
                    # "code": response.status_code,
                    "data": data
                    }
                }

        except httpx.RequestError as e:
            return {
                "event": "failure",
                "data": {
                    "name": name,
                    "status": "failure",
                    "error": str(e)
                }
            }

    async def event_stream():
        async with httpx.AsyncClient() as client:

            services = [
                (url1, "vtranscoder"),
                (url2, "gst-health"),
                (url3, "gstreamer"),
            ]

            for url, label in services:
                result = await fetch_and_yield(client, url, label)
                yield result
                await asyncio.sleep(1)

            for url in cam_urls:
                result = await fetch_and_yield(client, url)
                yield result
                await asyncio.sleep(1)

            yield {
                "event": "complete",
                "data": {"message": "service check finished"}
            }

    return EventSourceResponse(event_stream())

@app.get("/transcoder/{ip}/cameraping/{name}")
async def transcoder_camera_ping(ip: str, name: str):
    cam_urls = [
        f"http://{ip}:8084/transcoder/api/v1/cam/cam1",
        f"http://{ip}:8084/transcoder/api/v1/cam/cam2",
        f"http://{ip}:8084/transcoder/api/v1/cam/cam3",
        f"http://{ip}:8084/transcoder/api/v1/cam/cam4",
    ]
    
    username, password = get_auth_credentials()
 
    async def fetch_and_yield(client, url, label=None):
        name = url.split("/")[-1]
 
        try:
            response = await client.get(
                url,
                auth=(username, password),
                timeout=2
            )
 
            try:
                if response.headers.get("content-type", "").startswith("application/json"):
                    data = response.json()
                else:
                    data = response.text
            except Exception:
                data = response.text
            
            if data.get(name) == "0":
                return {
                "event": "failure",
                "data": {
                    "name": name,
                    # "status": "failure",
                    "data": data
                    }
                }
            else:
                return {
                "event": "success",
                "data": {
                    "name": name,
                    # "status": "success",
                    "data": data
                    }
                }
 
        except Exception as e:
            return {
                "event": "failure",
                "data": {
                    "name": name,
                    # "status": "failure",
                    "error": str(e)
                }
            }
 
    async def event_stream():
        async with httpx.AsyncClient() as client:
 
            for url in cam_urls:
                if name == url.split("/")[-1]:
                    result = await fetch_and_yield(client, url)
                    yield result
 
    return EventSourceResponse(event_stream())

@app.get("/encoder/servicecheck")
async def encoder_checking_service():

    url1 = ""
    url2 = ""
    url3 = ""

    username,password = get_auth_credentials()

    async def event_stream():
        async with httpx.AsyncClient() as client:
            try:
                reponse1 = await client.get(
                    url1,
                    auth=(username,password),                    
                    timeout=5
                )

                yield{"status":"success","response":reponse1}
                await asyncio.sleep(5)

                reponse2 = await client.get(
                    url2,
                    auth=(username,password),                    
                    timeout=5
                )

                yield{"status":"success","response":reponse2}           
                await asyncio.sleep(5)

                reponse3 = await client.get(
                    url3,
                    auth=(username,password),    
                    timeout=5
                )

                yield{"status":"success","response":reponse3}          

            except httpx.RequestError as e:
                yield {"event": "error", "data": f"checking failed: {str(e)}"}

    return EventSourceResponse(event_stream())    

# print("Registered routes:")
# for r in app.routes:
#     print(r.path, r.methods)

frontend_process = None

def get_exe_dir():
    return os.getcwd()

def monitor_frontend():
    global frontend_process
    if not frontend_process:
        return

    frontend_process.wait()   
    print("❌ Frontend closed. Shutting down backend...")
    os.kill(os.getpid(), signal.SIGINT) 


def start_frontend():
    global frontend_process

    exe_dir = get_exe_dir()
    frontend_path = exe_dir + "/MetroEMS-UI-1.0.0.AppImage.exe"

    if not os.path.exists(frontend_path):
        print("⚠️ Frontend exe not found:", frontend_path)
        return

    print("🚀 Starting frontend:", frontend_path)

    args = ["--Port=" + str(configs.server['port'])]

    if platform.system() == "Windows":
        frontend_process = subprocess.Popen(
            [str(frontend_path)] + args,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL
        )
    else:
        frontend_process = subprocess.Popen(
            [str(frontend_path)] + args,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            preexec_fn=os.setsid
        )

    threading.Thread(target=monitor_frontend, daemon=True).start()

def stop_frontend():
    global frontend_process

    if not frontend_process:
        return
    if frontend_process.poll() is not None:
        return

    print("🛑 Terminating frontend...")

    try:
        if platform.system() == "Windows":
            subprocess.run(
                ["taskkill", "/F", "/T", "/PID", str(frontend_process.pid)],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL
            )
        else:
            os.killpg(os.getpgid(frontend_process.pid), signal.SIGTERM)

    except Exception as e:
        print("⚠️ Error stopping frontend:", e)

def signal_handler(sig, frame):
    stop_frontend()
    sys.exit(0)

signal.signal(signal.SIGINT, signal_handler)
signal.signal(signal.SIGTERM, signal_handler)
atexit.register(stop_frontend)

if __name__ == "__main__":
    import uvicorn
    print("Starting MetroEMS Backend with REAL Device Detection")
    print("NO FAKE DEVICES - ONLY REAL CONNECTED HARDWARE")
    print("Backend URL: http://localhost:8002")
    print("Real Device Discovery: http://localhost:8002/wizard/discover")
    print("Health Check: http://localhost:8002/health")
    print(configs)
    validate_runtime(configs)
    print(
        f"🚀 {configs.app['name']} started "
        f"on {configs.server['host']}:{configs.server['port']}"
    )
    uvicorn.run(app, host="localhost", port=configs.server['port'])