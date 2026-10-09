import React, { useState, useEffect, useRef } from "react";
import DeviceSummary from "./DeviceSummary";
import {
  ArrowLeft,
  Settings,
  Activity,
  UploadCloud,
  FileText,
  Trash2,
  Download,
  AlertCircle,
  CheckCircle,
  Loader,
  SignalIcon,
  Upload,
  RefreshCcw,
  SettingsIcon,
} from "lucide-react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

import trainradiosService from "../services/trainradiosService";
import SignalIconn from "./signalIcon";
import transcoderService from "../services/transcoderService";
import encoderService from "../services/encoderService";
import SettingsPanel from "./setting";

const tabs = [
  { name: "Connectivity", icon: <Activity size={18} /> },
  { name: "Configuration", icon: <Settings size={18} /> },
  { name: "Firmware", icon: <UploadCloud size={18} /> },
  { name: "Logs", icon: <FileText size={18} /> },
];

const initialConfig = {
  ip: "",
  ipAddress: "",
  ssid: "",
  bandwidth: "",
  channel: "",
  radioMode: "",
  country: "",
  hardwareVersion: "",
  serialNumber: "",
  firmwareVersion: "",
  bootloaderVersion: "",
  EthernetMAC: "",
  WiFiMAC: "",
  ProductDescription: "",
  Temperature: "",
  productVersion: "",
  description: "",
  device_type: "",
  ENC_CAM_1_STR: "",
  ENC_CAM_2_STR: "",
  ENC_CAM_3_STR: "",
  ENC_CAM_4_STR: "",
  ENC_CAM_1_STATUS: "",
  ENC_CAM_2_STATUS: "",
  ENC_CAM_3_STATUS: "",
  ENC_CAM_4_STATUS: "",
};

const bandwidthOptions = ["20MHz", "40MHz", "80MHz"];
const channelOptions = ["Auto", "1", "6", "11"];
// const radioModeOptions = ['Access Point', 'Client', 'Repeater'];
const radioModeOptions = ["Outdoor Base", "Outdoor Subscriber"];
const countryOptions = ["5 GHz"];

const initialLogs = [
  {
    time: "",
    type: "",
    message: "",
  },
  {
    time: "",
    type: "",
    message: "",
  },
  {
    time: "",
    type: "",
    message: "",
  },
];

const EncoderSummary = () => {
  const { id } = useParams();
  // const [activeTab, setActiveTab] = useState('Configuration');
  const [config, setConfig] = useState([]);
  const [monitoring, setMonitoring] = useState({
    local_snr: "",
    remote_snr: "",
    tx_rate: "",
    rx_rate: "",
    latency: "",
  });
  const navigate = useNavigate();
  const location = useLocation();
  const navState = location.state || {};
  const deviceInfo = navState.deviceInfo || null;
  const selectedStation = location.state?.selectedStation;
  const deviceData = location.state?.deviceData;
  const targetIp = id || deviceInfo?.ip || "";
  const sessionId =
    navState.sessionId ||
    navState.sessionResponse?.session_id ||
    navState.sessionResponse?.session ||
    navState.session ||
    new URLSearchParams(location.search).get("session");
  const [logs, setLogs] = useState(initialLogs);
  const logsEndRef = useRef(null);
  const logsContainerRef = useRef(null);
  const [followTail, setFollowTail] = useState(true);
  const [isBackendConnected, setIsBackendConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [deviceSession, setDeviceSession] = useState(null);
  const [realDeviceData, setRealDeviceData] = useState(null);
  const [summaryExtras, setSummaryExtras] = useState({});
  const [chartData, setChartData] = useState([]);
  const MAX_POINTS = 60;
  const [firmwareFiles, setFirmwareFiles] = useState([]);
  const [selected, setSelected] = useState({});
  const [selectedTranscoderIp, setSelectedTranscoderIp] = useState(
    deviceInfo?.ip || "",
  );
  const [deviceTableData, setDeviceTableData] = useState([]);
  const [firmwareList, setFirmwareList] = useState([]);
  const [firmwareResponse, setFirmwareResponse] = useState(false);
  const [selectedRows, setSelectedRows] = useState([]);
  const isNewDevice = navState.isNewDevice || false;
  const [activeTab, setActiveTab] = useState(
    navState.activeTab || "Connectivity",
  );
  // const { deviceInfo = null } = location.state || {};
  const [firmwareCompleted, setFirmwareCompleted] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [upgradeLogs, setUpgradeLogs] = useState([]);
  const [upgradingRowIndex, setUpgradingRowIndex] = useState(null);
  const [loadingRefresh, setLoadingRefresh] = useState(false);

  const [upgradePercent, setUpgradePercent] = useState(null);
  const [upgradeStatus, setUpgradeStatus] = useState("");
  const transcoderPrevRef = useRef({ tx: 0, rx: 0 });
  const [transcoderChartData, setTranscoderChartData] = useState([]);
  const [transcoderMonitoring, setTranscoderMonitoring] = useState({
    tx: 0,
    rx: 0,
    cpu: 30,
    temperature: 40,
  });
   const [showSettings, setShowSettings] = useState(false);
     
  const targetSessionId = navState?.deviceInfo?.sessionId || id;
  // const sessionId = location.state?.sessionId || new URLSearchParams(location.search).get('session');

  useEffect(() => {
    // Pre-fill with clicked device info if present

    if (
      (location.state?.deviceInfo?.ip && activeTab === "Configuration") ||
      activeTab === "Connectivity"
    ) {
      setConfig((prev) => ({
        ...prev,
        ipAddress: location?.state?.deviceInfo?.ip || id,
        systemName: location?.state?.deviceInfo?.name || prev.systemName,
      }));
    }

    const checkBackendAndLoadDevice = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Check backend Connectivity
        const connected = await encoderService.checkBackendConnection();
        setIsBackendConnected(connected);

        // If we have a session ID, load the device session
        if (connected && sessionId) {
          try {
            const session = await encoderService.getDeviceSession(id);
            setDeviceSession(session);

            // Update config with real device data
            if (session.device_info) {
              setConfig((prevConfig) => ({
                ...prevConfig,
                systemName: session.device_info.name || prevConfig.systemName,
                ipAddress:
                  session.device_info.ip_address || prevConfig.ipAddress,
                // Add other real device properties as available
              }));
            }

            // Load real device configuration
            const deviceConfig =
              await encoderService.getDeviceConfiguration(targetSessionId);
            if (deviceConfig) {
              setRealDeviceData(deviceConfig);
              // Backend returns { systemName, ipAddress, ... } OR { config: {...} }
              const cfg = deviceConfig.config
                ? deviceConfig.config
                : deviceConfig;
              setConfig((prevConfig) => ({
                ...prevConfig,
                ...cfg,
              }));
            }
          } catch (sessionError) {
            console.warn("Failed to load device session:", sessionError);
            setError("Failed to load device session. Using demo mode.");
          }
        }
      } catch (err) {
        console.error("Backend connection failed:", err);
        setIsBackendConnected(false);
        setError("Backend connection failed. Running in demo mode.");
      } finally {
        setIsLoading(false);
      }
    };

    checkBackendAndLoadDevice();
  }, [sessionId, activeTab]);

  useEffect(() => {
    // Pre-fill with clicked device info if present

    if (location.state?.deviceInfo?.ip && activeTab === "Connectivity") {
      setConfig((prev) => ({
        ...prev,
        ipAddress: location.state.deviceInfo.ip,
        systemName: location.state.deviceInfo.name || prev.systemName,
      }));
    }

    const checkBackendAndLoadDevice = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Check backend Connectivity
        const connected = await encoderService.checkBackendConnection();
        setIsBackendConnected(connected);

        // If we have a session ID, load the device session
        if (connected && sessionId) {
          try {
            const session = await encoderService.getDeviceSession(id);
            setDeviceSession(session);

            // Update config with real device data
            if (session.device_info) {
              setConfig((prevConfig) => ({
                ...prevConfig,
                systemName: session.device_info.name || prevConfig.systemName,
                ipAddress:
                  session.device_info.ip_address || prevConfig.ipAddress,
                // Add other real device properties as available
              }));
            }

            // Load real device configuration
            const deviceConfig =
              await encoderService.getDeviceConfiguration(targetSessionId);
            if (deviceConfig) {
              setRealDeviceData(deviceConfig);
              // Backend returns { systemName, ipAddress, ... } OR { config: {...} }
              const cfg = deviceConfig.config
                ? deviceConfig.config
                : deviceConfig;
              setConfig((prevConfig) => ({
                ...prevConfig,
                ...cfg,
              }));
            }
          } catch (sessionError) {
            console.warn("Failed to load device session:", sessionError);
            setError("Failed to load device session. Using demo mode.");
          }
        }
      } catch (err) {
        console.error("Backend connection failed:", err);
        setIsBackendConnected(false);
        setError("Backend connection failed. Running in demo mode.");
      } finally {
        setIsLoading(false);
      }
    };

    checkBackendAndLoadDevice();
  }, [targetSessionId, activeTab]);

  const handleChange = (e) => {
    setConfig({ ...config, [e.target.name]: e.target.value });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      if (isBackendConnected && sessionId) {
        // Save configuration to real device via backend
        await encoderService.updateDeviceConfiguration(sessionId, config);
        alert("Configuration saved to device successfully!");
      } else {
        // Demo mode
        alert("Configuration saved!\n" + JSON.stringify(config, null, 2));
      }
    } catch (err) {
      console.error("Failed to save configuration:", err);
      setError("Failed to save configuration: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = () => {
    const logText = logs
      .map((log) => `${log.time} ${log.type}: ${log.message}`)
      .join("\n");
    const blob = new Blob([logText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "system_logs.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleClear = () => setLogs([]);

  useEffect(() => {
    if (activeTab !== "Conntectivity") return;
    // if (!deviceIp) return;

    const ip = selectedTranscoderIp || config.ipAddress;
    if (!ip) return;

    const intervalSec = 1;

    const updateMonitoring = async () => {
      try {
        const netstats = await transcoderService.getTranscoderNetstats(ip);

        let txKbps = 0;
        let rxKbps = 0;

        if (transcoderPrevRef.current.tx > 0) {
          txKbps =
            ((netstats.tx_bytes - transcoderPrevRef.current.tx) * 8) / 1000;
          rxKbps =
            ((netstats.rx_bytes - transcoderPrevRef.current.rx) * 8) / 1000;
        }

        transcoderPrevRef.current = {
          tx: netstats.tx_bytes,
          rx: netstats.rx_bytes,
        };

        setTranscoderMonitoring({
          tx: txKbps.toFixed(2),
          rx: rxKbps.toFixed(2),
          cpu: netstats.cpu,
          temperature: netstats.temperature,
        });

        setTranscoderChartData((prev) => {
          const t = new Date();
          const point = {
            t: t.toLocaleTimeString(),
            tx: txKbps.toFixed(2),
            rx: rxKbps.toFixed(2),
          };
          const arr = [...prev, point];
          return arr.length > MAX_POINTS ? arr.slice(-MAX_POINTS) : arr;
        });
      } catch (err) {
        console.warn("Transcoder netstats error", err);
      }
    };

    updateMonitoring();
    const interval = setInterval(updateMonitoring, intervalSec * 1000);
    return () => clearInterval(interval);
  }, [activeTab, selectedTranscoderIp, config.ipAddress]);

  useEffect(() => {
    if (activeTab !== "Configuration" || !targetSessionId) return;

    let isMounted = true;

    const getMonitoringData = async () => {
      try {
        const data = await encoderService.getDeviceMonitoring(targetSessionId);

        if (!isMounted || !data) return;

        setMonitoring({
          local_snr: data.local_snr,
          remote_snr: data.remote_snr,
          tx_rate: data.tx_rate,
          rx_rate: data.rx_rate,
          latency: data.latency,
        });

        setChartData((prev) => {
          const t = new Date();

          const point = {
            t: t.toLocaleTimeString(),
            //  t: t.getTime(),
            tx: data.tx_rate,
            rx: data.rx_rate,
          };

          const arr = [...prev, point];
          return arr.length > MAX_POINTS
            ? arr.slice(arr.length - MAX_POINTS)
            : arr;
        });
      } catch (e) {
        console.error(e);
        setError("Monitoring API failed");
      }
    };

    getMonitoringData();
    const interval = setInterval(getMonitoringData, 1000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [activeTab, targetSessionId]);

  // useEffect(() => {
  //   if (activeTab !== "Configuration" || !targetSessionId) return;

  //   let isMounted = true;

  //   const getMonitoringData = async () => {
  //     try {
  //       const data = await encoderService.getDeviceMonitoring(targetSessionId);
  //       if (!isMounted || !data) return;

  //       setMonitoring({
  //         local_snr: data.local_snr,
  //         remote_snr: data.remote_snr,
  //         tx_rate: data.tx_rate,
  //         rx_rate: data.rx_rate,
  //         latency: data.latency,
  //       });

  //       const now = Date.now();

  //       setChartData((prev) => {
  //         const arr = [...prev, { t: now, tx: data.tx_rate, rx: data.rx_rate }];
  //         return arr.length > MAX_POINTS ? arr.slice(arr.length - MAX_POINTS) : arr;
  //       });

  //     } catch (e) {
  //       console.error("Monitoring API error:", e);
  //       setError("Monitoring API failed");
  //     }
  //   };

  //   getMonitoringData();

  //   const interval = setInterval(getMonitoringData, 1000);

  //   return () => {
  //     isMounted = false;
  //     clearInterval(interval);
  //   };
  // }, [activeTab, targetSessionId]);

  const generate3MinTicks = (data) => {
    if (!data || !data.length) return [];

    const step = 1 * 60 * 1000;
    const start = data[0].t;
    const end = data[data.length - 1].t;

    const ticks = [];
    let firstTick = Math.floor(start / step) * step;
    for (let t = firstTick; t <= end; t += step) {
      ticks.push(t);
    }
    return ticks;
  };

  useEffect(() => {
    if (!(activeTab === "Logs")) return;
    let cancelled = false;

    const fetchLogs = async () => {
      if (isBackendConnected && sessionId) {
        try {
          const newLogs = await encoderService.getDeviceLogsEnhanced(sessionId);
          if (!cancelled && Array.isArray(newLogs)) {
            // Normalize possible shapes
            const normalized = newLogs.map((l) => ({
              time: l.time || l.timestamp || new Date().toISOString(),
              type: l.type || l.level || "INFO",
              message: l.message || l.msg || "",
            }));
            // Merge by time+message (simple de-dup)
            setLogs((prev) => {
              const seen = new Set(prev.map((p) => `${p.time}|${p.message}`));
              const merged = [...prev];
              for (const n of normalized) {
                const key = `${n.time}|${n.message}`;
                if (!seen.has(key)) merged.push(n);
              }
              // Keep last 500 logs
              return merged.length > 500
                ? merged.slice(merged.length - 500)
                : merged;
            });
          }
        } catch (e) {
          // ignore transient errors
        }
      } else {
        // In demo, append a synthetic log periodically
        const now = new Date();
        // setLogs(prev => {
        //   const demo = {
        //     time: `[${now.toLocaleString()}]` ,
        //     type: Math.random() < 0.1 ? 'WARN' : 'INFO',
        //     message: Math.random() < 0.5 ? 'Periodic health check OK' : 'Monitoring tick update'
        //   };
        //   const arr = [...prev, demo];
        //   return arr.length > 200 ? arr.slice(arr.length - 200) : arr;
        // });
      }
    };

    // Initial call and interval setup
    fetchLogs();
    const id = setInterval(fetchLogs, 1000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [activeTab, isBackendConnected, sessionId]);

  useEffect(() => {
    if (!showAll) return;
    const el = logsContainerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [logs, showAll]);

  const handleLogsScroll = () => {
    const el = logsContainerRef.current;
    if (!el) return;
    const threshold = 16; // px tolerance from bottom
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distanceFromBottom > threshold) {
      // User is not at the bottom; pause following
      if (followTail) setFollowTail(false);
    } else {
      // Near bottom; resume following
      if (!followTail) setFollowTail(true);
    }
  };

  const { type } = useParams();

  const SignalStrength = ({ value }) => {
    const MIN = 0;
    const MAX = 0.25;

    const normalized = Math.min(Math.max((value - MIN) / (MAX - MIN), 0), 1);

    const activeCells = Math.ceil(normalized * 5);

    const getClass = (cell) =>
      cell <= activeCells ? "fill-green-400" : "fill-gray-400";

    return <SignalIconn getClass={getClass} />;
  };

  const toggleFile = (fileName) => {
    setSelected((prev) => ({
      ...prev,
      [fileName]: !prev[fileName],
    }));
  };

  // useEffect(() => {
  //         if (location.pathname.endsWith('/firmware')) {
  //           setActiveTab('Firmware');
  //         }
  //       }, [location.pathname]);

  useEffect(() => {
    if (isNewDevice) {
      setActiveTab("Firmware");
    }
  }, [isNewDevice]);

  useEffect(() => {
    if (isNewDevice && !firmwareCompleted && activeTab !== "Firmware") {
      setActiveTab("Firmware");
    }
  }, [activeTab, firmwareCompleted, isNewDevice]);

  useEffect(() => {
    if (activeTab !== "Firmware") return;
    fetchFirmwareList();
  }, [activeTab]);

  const fetchFirmwareList = async () => {
    try {
      const fwResp = await encoderService.getFirmwareList();
      const files = fwResp?.files || fwResp?.data || [];

      let runningFilename = null;

      if (sessionId) {
        const currentFwResp =
          await encoderService.getCurrentFirmware(sessionId);
        runningFilename =
          currentFwResp?.actualName ||
          currentFwResp?.fileName ||
          currentFwResp?.file_name ||
          currentFwResp?.firmware ||
          currentFwResp ||
          null;
      }

      const trainRadiosFiles = files.filter((f) =>
        ["encoder"].includes(f.device_type?.toLowerCase()),
      );

      setDeviceTableData(
        trainRadiosFiles.map((file) => {
          const filename = file.actualName || file.file_name;

          if (filename === runningFilename) {
            return {
              filename,
              firmware: file.version || "N/A",
              status: "current",
            };
          }
          if (file.status === "already_exists") {
            return {
              filename,
              firmware: file.version || "N/A",
              status: "upgrade",
            };
          }

          return {
            filename,
            firmware: file.version || "N/A",
            status: "download",
          };
        }),
      );
    } catch (error) {
      console.error("Failed to fetch firmware list:", error);
    }
  };

  const handlePushFirmware = async (filename, index) => {
    try {
      setDeviceTableData((prev) =>
        prev.map((row, i) =>
          i === index ? { ...row, status: "downloading" } : row,
        ),
      );

      const response = await encoderService.pushFirmware(filename);

      const alreadyExists =
        response?.alreadyExists || response?.status === "already_exists";

      if (alreadyExists) {
        alert(`Firmware ${filename} already exists in Firmware EMS folder`);
      } else {
        alert(`downloaded successfully`);
      }

      await fetchFirmwareList();
    } catch (err) {
      console.error(err);

      setDeviceTableData((prev) =>
        prev.map((row, i) =>
          i === index ? { ...row, status: "download" } : row,
        ),
      );

      alert(`Failed to download firmware ${filename}`);
    }
  };

  const handleCheckboxToggle = (row) => {
    setSelectedRows((prev) => {
      const exists = prev.some((item) => item.filename === row.filename);

      if (exists) {
        return prev.filter((item) => item.filename !== row.filename);
      } else {
        return [...prev, row];
      }
    });
  };

  useEffect(() => {
    const el = document.getElementById("upgradeLogsBox");
    if (el) el.scrollTop = el.scrollHeight;
  }, [upgradeLogs]);

  const lastUpgradeStatusRef = useRef(null);

  const STATUS_PROGRESS_MAP = {
    "firmware update triggered": 0,
    "download in progress...": 25,
    "signature check in progress...": 50,
    "write on flash in progress...": 75,
    "the device is rebooting...": 90,
    "idle...": 100,
  };

  const handleFirmwareUpgrade = async (row, index) => {
    try {
      setUpgradingRowIndex(index);

      setDeviceTableData((prev) =>
        prev.map((r, i) => (i === index ? { ...r, status: "upgrading" } : r)),
      );

      const filePathResp = await encoderService.getFirmwareFilePath(
        row.filename,
      );
      if (!filePathResp?.filePath) {
        throw new Error("Firmware file path not found");
      }

      // await trainradiosService.fileCopy(filePathResp.filePath);

      setUpgradeLogs([]);
      setUpgradePercent(0);
      setUpgradeStatus("Starting firmware upgrade...");
      lastUpgradeStatusRef.current = null;

      await encoderService.firmwareUpgrade(
        {
          // sessionId,
          ip: deviceInfo.ip,
          // fileName: row.filename,
        },

        (statusMessage) => {
          if (!statusMessage) return;

          const normalized = statusMessage.trim().toLowerCase();

          setUpgradeLogs([`status: ${statusMessage}`]);

          if (lastUpgradeStatusRef.current === normalized) {
            return;
          }

          lastUpgradeStatusRef.current = normalized;
          setUpgradeStatus(statusMessage);

          if (STATUS_PROGRESS_MAP.hasOwnProperty(normalized)) {
            setUpgradePercent(STATUS_PROGRESS_MAP[normalized]);
          }
        },
      );

      await fetchFirmwareList();
      // await trainradiosService.getCurrentFirmware(sessionId);

      setDeviceTableData((prev) =>
        prev.map((r, i) => (i === index ? { ...r, status: "current" } : r)),
      );

      setSelectedRows((prev) =>
        prev.filter((r) => r.filename !== row.filename),
      );

      alert("Firmware upgraded successfully");
    } catch (error) {
      console.error("Firmware upgrade failed:", error);

      setDeviceTableData((prev) =>
        prev.map((r, i) => (i === index ? { ...r, status: "upgrade" } : r)),
      );

      alert(error.message || "Firmware upgrade failed");
    } finally {
      setUpgradingRowIndex(null);
    }
  };

  const [showTroubleshoot, setShowTroubleshoot] = useState(false);
  const [troubleStep, setTroubleStep] = useState(1);

  const serviceStatus = [
    { name: "Link Details", status: "" },
    // { name: "Train radio Agent", status: "running" },
  ];

  const cameraStatus = [
    { cam: "Train Radio", status: "working" },
    // { cam: "NTP Server", status: "working" },
    // { cam: "Encoder", status: "not reachable" },
  ];

  const logsData = [
    "[INFO] Train radio started successfully",
    // "[INFO] Obc Agent connection established",
    // "[WARN] Encoder ping timeout",
  ];

  useEffect(() => {
    if (!targetIp) return;

    if (activeTab === "Connectivity") {
      // fetchConnectivity();
      fetchConfiguration();
    } else if (activeTab === "Configuration") {
      fetchConfiguration();
      // fetchConnectivity();
    } else if (activeTab === "Firmware") {
      fetchFirmware();
    } else if (activeTab === "Logs") {
      fetchLogs();
    }
  }, [activeTab, targetIp]);

  const fetchConnectivity = async () => {
    try {
      setError(null);

      const data = await encoderService.getDeviceMonitoring(targetSessionId);
      setMonitoring({
        local_snr: data.localsnr,
        remote_snr: data.remotesnr,
        tx_rate: data.tx_rate,
        rx_rate: data.rx_rate,
        latency: data.latency,
      });
    } catch (e) {
      console.error(e);
      setError("Connectivity API failed");
    }
  };

  const fetchConfiguration = async () => {
    try {
      setError(null);

      const cfg = await encoderService.getDeviceConfiguration(targetSessionId);

      setConfig((prev) => ({
        ...initialConfig,
        ...(cfg || {}),
      }));
    } catch (e) {
      console.error(e);
      setError("Configuration API failed");
      setConfig(initialConfig);
    }
  };

  const fetchFirmware = async () => {
    try {
      setError(null);

      const list = await encoderService.getFirmwareList(targetIp);
      setFirmwareList(list);
    } catch (e) {
      console.error(e);
      setError("Firmware API failed");
    }
  };

  const fetchLogs = async () => {
    setLoadingRefresh(true);
    try {
      setError(null);

      const logData = await encoderService.getDeviceLogsEnhanced(targetIp);
      setLogs(logData);
    } catch (e) {
      console.error(e);
      setError("Logs API failed");
    } finally {
      setLoadingRefresh(false);
    }
  };

  const handleConfigDownload = async () => {
    const ip = selectedTranscoderIp || config.ipAddress;
    try {
      const response = await encoderService.getConfigDownload(ip);
      // setIoboxDiscoveryStatus(response);
    } catch (err) {
      console.log(err.message || "Train discovery failed");
    } finally {
    }
  };

  const handleConfigUpload = async () => {
    //         const ip = selectedTranscoderIp || config.ipAddress;
    // try {
    //     const response = await encoderService.configUpload(ip);
    //     // setIoboxDiscoveryStatus(response);
    //   } catch (err) {
    //     console.log(err.message || "Train discovery failed")
    //   } finally {
    //   }
  };

  const formatUptime = (seconds) => {
    const d = Math.floor(seconds / (24 * 3600));
    const h = Math.floor((seconds % (24 * 3600)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${d} d ${h} h ${m} m`;
  };

  return (
    <>

      <div className="flex justify-end p-4 fixed top-20 right-0 mr-4 mt-4 z-10">
            <button
        onClick={() => setShowSettings(true)}
        className="w-10 h-10 rounded-xl
          flex items-center justify-center
          text-text hover:bg-black/10
          transition"
        title="Settings"
      >
        <SettingsIcon
          size={35}
          className="accentColor"
        />
      </button>
          </div>

    <div className="min-h-screen flex items-center justify-center bg-primary">
      <div className="w-full max-w-[896px] max-h-[747px] min-w-[896px] min-h-[747px] mx-auto bg-card backdrop-blur-md rounded-2xl shadow-2xl p-5">
        <button
          onClick={() =>
            navigate("/stationview", {
              state: {
                selectedStation,
                deviceData,
              },
            })
          }
          className="mb-2 text-text hover:text-text font-semibold flex items-center gap-2"
        >
          <ArrowLeft size={20} /> Back to Station View
        </button>
        <div className="flex items-center gap-4">
          <h2 className="text-2xl text-text font-semibold mb-4">
            {isNewDevice && activeTab === "Firmware"
              ? "Firmware Installation"
              : `${type?.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}`}

            {(selectedTranscoderIp || config?.ipAddress) && (
              <span className="text-lg text-text ml-2">
                - {selectedTranscoderIp || config.ipAddress}
              </span>
            )}
          </h2>
        </div>

        {/* {error && (
          <div className="mb-6 p-4 bg-yellow-500/20 border border-yellow-500 rounded-md flex items-center gap-2">
            <AlertCircle size={16} className="text-yellow-400" />
            <span className="text-yellow-100 text-sm">{error}</span>
          </div>
        )} */}

        {isLoading && (
          <div className="mb-6 flex items-center justify-center py-8">
            <div className="text-center">
              <Loader
                size={32}
                className="animate-spin text-text mx-auto mb-2"
              />
              <p className="text-text text-sm">Loading device data...</p>
            </div>
          </div>
        )}

        <div className="flex border-b border-blue-700 mb-4">
          {tabs.map((tab) => (
            <button
              key={tab.name}
              onClick={() => setActiveTab(tab.name)}
              className={`flex items-center gap-2 px-6 py-3 font-semibold text-sm transition
                ${
                  activeTab === tab.name
                    ? "text-text border-b-2 border-cyan-300"
                    : "text-text hover:text-text border-b-2 border-transparent"
                }`}
            >
              {tab.icon}
              {tab.name}
            </button>
          ))}
        </div>

        {activeTab === "Configuration" && (
          <>
            <form className="flex gap-1 mb-10" onSubmit={handleSave}>
              <div className="w-1/2 p-2 mt-1">
                <div>
                  <div className="flex items-center gap-1 items-end mb-2">
                    <label className="text-text w-[182px]">
                      Serial Number :
                    </label>
                    <h6>
                      {" "}
                      <span className=" text-lg font-bold text-text">
                        {" "}
                        {config?.config?.serialNumber}{" "}
                      </span>
                    </h6>
                  </div>
                  <div className="flex items-center gap-1 items-end mb-2">
                    <label className="text-text w-[182px]">
                      Product Description :
                    </label>
                    <h6>
                      {" "}
                      <span className=" text-lg font-bold text-text">
                        {" "}
                        {config?.config?.sysDescr}{" "}
                      </span>
                    </h6>
                  </div>
                  <div className="flex items-center gap-1 items-end mb-2">
                    <label className="text-text w-[182px]">UpTime :</label>
                    <h6>
                      {" "}
                      <span className="text-lg font-bold text-text">
                        {" "}
                        {formatUptime(config?.config?.sysUpTime)}{" "}
                      </span>
                    </h6>
                  </div>
                </div>
              </div>

              <div className="w-1/2 p-2 mt-1">
                <div>
                  <div className="flex flex-col gap-3">
                    <div>
                      <h6>
                        <span className="text-text mb-1 font-semibold text-left text-md flex items-center gap-2 pl-2">
                          Configuration
                        </span>
                      </h6>
                    </div>
                    <div className="flex gap-3">
                      {/* Download Button */}
                      <button
                        type="button"
                        onClick={handleConfigDownload}
                        className="flex items-center gap-2 bg-buttonSecondary from-cyan-400 to-blue-500 
                                                    text-white font-semibold px-4 py-2 rounded-md shadow 
                                                    hover:scale-105 transition"
                      >
                        <Download size={18} />
                        Download
                      </button>

                      {/* Upload Button */}
                      <button
                        type="button"
                        onClick={handleConfigUpload}
                        className="flex items-center gap-2 bg-buttonTertiary from-green-400 to-emerald-500 
                                                    text-white font-semibold px-4 py-2 rounded-md shadow 
                                                    hover:scale-105 transition"
                      >
                        <Upload size={18} />
                        Upload
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </form>

            <div className="flex justify-center gap-4 mt-4">
              <div></div>
              <div></div>
            </div>

            <div className="bg-buttonPrimary rounded-xl p-6 mt-4">
              <div className="text-text mb-3 font-semibold flex items-center gap-2">
                Network Performance
                {isBackendConnected && sessionId ? (
                  <span className="text-xs text-text">
                    (Live from device · 1s)
                  </span>
                ) : (
                  <span className="text-xs text-text">(Simulated · 1s)</span>
                )}
              </div>
              <div className="gap-6">
                <div className="h-56 bg-text rounded-lg p-2 mt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={chartData}
                      margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e3a8a" />
                      <XAxis
                        dataKey="t"
                        tick={{ fill: "#93c5fd", fontSize: 12 }}
                      />
                      <YAxis
                        tick={{ fill: "#93c5fd", fontSize: 12 }}
                        domain={[0, "auto"]}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "#0b1220",
                          border: "1px solid #1e3a8a",
                          color: "#e2e8f0",
                        }}
                      />
                      <Legend wrapperStyle={{ color: "#93c5fd" }} />
                      <Line
                        type="monotone"
                        dataKey="tx"
                        stroke="#f59e0b"
                        strokeWidth={2}
                        dot={false}
                        name="TX (Kbps)"
                        isAnimationActive={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="rx"
                        stroke="#60a5fa"
                        strokeWidth={2}
                        dot={false}
                        name="RX (Kbps)"
                        isAnimationActive={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </>
        )}

        {activeTab === "Connectivity" && (
          <>
            <div className="flex gap-8 w-full">
              <div className="flex-1">
                <div>
                  <label className="block text-text mb-2 mt-4">
                    EthernetMAC :
                    <span className="text-lg font-bold">
                      {config?.config?.EthernetMAC}
                    </span>
                  </label>
                </div>
              </div>

              <div className="flex-1">
                <label className="block text-text mb-2 mt-4">
                  ProductVersion :
                  <span className="text-lg font-bold">
                    {config?.config?.productVersion}
                  </span>
                </label>
              </div>
            </div>

            <div className="mt-6">
              <div className="w-full bg-buttonPrimary rounded-xl p-6 mb-8">
                <div className="bg-white/10 backdrop-blur-md border border-buttonPrimary rounded-2xl  overflow-hidden">
                  <table className="min-w-full text-left">
                    <thead>
                      <tr className="bg-blue-900/40 text-text text-sm tracking-wider font-medium">
                        <th className="px-6 py-3 text-lg">Camera</th>
                        <th className="px-6 py-3 text-lg">Description</th>
                        <th className="px-6 py-3 text-lg text-center">
                          Status
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {isLoading ? (
                        <tr>
                          <td
                            colSpan="3"
                            className="text-center text-text py-4"
                          >
                            Loading...
                          </td>
                        </tr>
                      ) : !config?.config ? (
                        <tr>
                          <td
                            colSpan="3"
                            className="text-center text-text py-4"
                          >
                            No Data Available
                          </td>
                        </tr>
                      ) : (
                        [
                          {
                            name: "ENC-CAM-1",
                            str: config?.config?.ENC_CAM_1_STR,
                            status: config?.config?.ENC_CAM_1_STATUS,
                          },
                          {
                            name: "ENC-CAM-2",
                            str: config?.config?.ENC_CAM_2_STR,
                            status: config?.config?.ENC_CAM_2_STATUS,
                          },
                          {
                            name: "ENC-CAM-3",
                            str: config?.config?.ENC_CAM_3_STR,
                            status: config?.config?.ENC_CAM_3_STATUS,
                          },
                          {
                            name: "ENC-CAM-4",
                            str: config?.config?.ENC_CAM_4_STR,
                            status: config?.config?.ENC_CAM_4_STATUS,
                          },
                        ].map((row, i) => {
                          const camStatus = row.status?.toLowerCase();

                          return (
                            <tr
                              key={i}
                              className="border-t border-buttonPrimary hover:bg-white/5 transition"
                            >
                              <td className="px-6 py-4 text-text text-md font-medium">
                                {row.name}
                              </td>

                              <td className="px-6 py-4 text-text text-md">
                                {row.str}
                              </td>

                              <td className="px-6 py-4 text-center text-md">
                                {camStatus === "running" ? (
                                  <span className="text-green-600 font-semibold">
                                    Running
                                  </span>
                                ) : camStatus === "no video" ? (
                                  <span className="text-red-600 font-semibold">
                                    No Video
                                  </span>
                                ) : (
                                  <span className="text-yellow-600 font-semibold">
                                    {row.status || "Unknown"}
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            <div className="flex justify-center mt-6">
              {/* <button
                type="button"
                onClick={() =>
                  navigate("/encoder/troubleshoot", {
                    state: {
                      state: {
                        deviceInfo,
                        selectedStation,
                        deviceData
                      }
                    }
                  })
                }
                className="bg-gradient-to-r from-cyan-400 to-blue-500
                          text-white font-semibold px-6 py-2 rounded-md shadow"
              >
                Troubleshoot
              </button> */}
            </div>
          </>
        )}

        {activeTab === "Firmware" && (
          <div>
            {/* <div className="bg-blue-900/60 rounded-xl p-6 mb-8">
              <div className="text-blue-100 text-lg font-semibold mb-2">Current Firmware</div>
              <div className="text-white mb-1">Version: <span className="font-bold">v2.1.4</span></div>
              <div className="text-white mb-1">Build Date: <span className="font-bold">2024-12-01</span></div>
              <div className="text-green-400 font-semibold">Status: Up to date</div>
            </div> */}

            <div className="bg-buttonPrimary rounded-xl p-6 mb-8">
              <div className="min-w-full">
                <div className="bg-white/10 backdrop-blur-md border border-buttonPrimary rounded-2xl  overflow-hidden">
                  <div className="">
                    <table className="min-w-full text-left">
                      <thead>
                        <tr className="bg-blue-900/40 text-text text-sm tracking-wider font-medium">
                          <th className="px-6 py-3 text-sm "></th>
                          <th className="px-6 py-3 text-sm ">File Name</th>
                          <th className="px-6 py-3 text-sm ">
                            Firmware Version
                          </th>
                          <th className="px-6 py-3  text-sm text-center">
                            Status
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {deviceTableData.length ? (
                          deviceTableData.map((row, index) => {
                            const isSelected = selectedRows.some(
                              (item) => item.filename === row.filename,
                            );

                            const canUpgrade =
                              row.status === "upgrade" && isSelected;

                            return (
                              <tr
                                key={index}
                                className="border-t border-buttonPrimary hover:bg-white/5 transition"
                              >
                                <td className="px-6 py-4 text-center">
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    disabled={[
                                      "downloading",
                                      "upgrading",
                                      "upgraded",
                                    ].includes(row.status)}
                                    onChange={() => handleCheckboxToggle(row)}
                                    className="w-4 h-4 accent-text-text cursor-pointer"
                                  />
                                </td>

                                <td className="px-6 py-4 text-text font-medium text-sm">
                                  {row.filename}
                                </td>

                                <td className="px-6 py-4 text-text text-sm">
                                  {row.firmware || "N/A"}
                                </td>

                                <td className="p-3 text-center">
                                  {row.status === "download" && (
                                    <button
                                      onClick={() =>
                                        handlePushFirmware(row.filename, index)
                                      }
                                      className="px-4 py-1.5 rounded-full text-sm font-semibold text-white bg-blue-600"
                                    >
                                      Download
                                    </button>
                                  )}

                                  {row.status === "downloading" && (
                                    <span className="bg-gray-400/20 text-gray-200 px-4 py-1.5 rounded-full">
                                      Downloading...
                                    </span>
                                  )}

                                  {row.status === "upgrade" && (
                                    <button
                                      disabled={
                                        !selectedRows.some(
                                          (r) => r.filename === row.filename,
                                        )
                                      }
                                      onClick={() =>
                                        handleFirmwareUpgrade(row, index)
                                      }
                                      className={`px-4 py-1.5 rounded-full text-sm font-semibold transition
                                    ${
                                      selectedRows.some(
                                        (r) => r.filename === row.filename,
                                      )
                                        ? "bg-blue-600 text-white hover:bg-blue-700"
                                        : "bg-gray-500 text-gray-300 cursor-not-allowed"
                                    }`}
                                    >
                                      Upgrade
                                    </button>
                                  )}

                                  {row.status === "upgrading" &&
                                    upgradingRowIndex === index && (
                                      <div className="flex flex-col items-center gap-2">
                                        <span className="px-4 py-1.5 rounded-full text-sm font-semibold bg-yellow-400/20 text-yellow-300">
                                          Upgrading… {upgradePercent}%
                                        </span>

                                        <div className="w-full max-w-[140px] bg-gray-300 rounded-full h-2">
                                          <div
                                            className="bg-green-400 h-2 rounded-full transition-all duration-300 ease-out"
                                            style={{
                                              width: `${upgradePercent || 0}%`,
                                            }}
                                          />
                                        </div>
                                      </div>
                                    )}

                                  {row.status === "current" && (
                                    <span className="text-green-400 font-semibold">
                                      Current
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <td
                              colSpan="4"
                              className="px-6 py-10 text-center text-text"
                            >
                              No firmware data found
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className="bg-blue-900/60 rounded-xl p-6 mt-4">
                <div
                  id="upgradeLogsBox"
                  className="max-h-56 overflow-auto rounded-md"
                  style={{ background: "#0f172a" }}
                >
                  {upgradeLogs.length === 0 ? (
                    <div className="text-blue-300 text-center py-4">
                      Waiting for logs…
                    </div>
                  ) : (
                    // upgradeLogs.map(() => (
                    //   <div className="text-blue-100 text-sm px-3 py-2 border-b border-white/10">
                    //     {upgradeLogs[0] || "Waiting for logs…"}
                    //   </div>
                    // ))
                    upgradeLogs.map((log, idx) => (
                      <div
                        key={idx}
                        className="text-blue-100 text-sm px-3 py-2 border-b border-white/10"
                      >
                        {log}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "Logs" && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <div className="text-text text-lg font-semibold">System Logs</div>
              <div className="flex gap-2">
                <button
                  onClick={fetchLogs}
                  disabled={loadingRefresh}
                  className="bg-buttonPrimary hover:bg-blue-700 disabled:opacity-50 text-white font-semibold px-4 py-2 rounded-md flex items-center gap-2"
                >
                  {loadingRefresh ? (
                    <Loader size={18} className="animate-spin" />
                  ) : (
                    <RefreshCcw size={18} />
                  )}
                  Refresh
                </button>
              </div>
            </div>
            <div className="bg-buttonPrimary rounded-xl p-4">
              {loadingRefresh ? (
                <div className="text-text text-center py-8 flex items-center justify-center gap-2">
                  <Loader className="animate-spin" size={20} />
                  Loading logs...
                </div>
              ) : logs.length === 0 ? (
                <div className="text-text text-center py-8">
                  No logs available.
                </div>
              ) : (
                <div>
                  {/* Optional: a contained scroll area for long logs page to avoid page jump */}
                  <div
                    className="max-h-[48vh] overflow-auto rounded-md"
                    ref={activeTab === "Logs" ? logsContainerRef : null}
                    onScroll={
                      activeTab === "Logs" ? handleLogsScroll : undefined
                    }
                    style={{ background: "#0f172a" }}
                  >
                    {logs.map((log, idx) => (
                      <div
                        key={idx}
                        className="font-mono text-sm mb-2 px-2 py-1 rounded"
                        style={{
                          background: "transparent",
                          color:
                            log.type === "WARN"
                              ? "#facc15"
                              : log.type === "INFO"
                                ? "#22d3ee"
                                : "#fff",
                          // borderLeft:
                          //   log.type === "WARN"
                          //     ? "4px solid #facc15"
                          //     : log.type === "INFO"
                          //       ? "4px solid #22d3ee"
                          //       : "none",
                        }}
                      >
                        <span className="text-blue-300">{log.time}</span>{" "}
                        <span
                          className={
                            log.type === "WARN"
                              ? "text-yellow-400"
                              : log.type === "INFO"
                                ? "text-cyan-400"
                                : "text-white"
                          }
                        >
                          {log.type}
                        </span>
                        : {log.message}
                      </div>
                    ))}
                    <div ref={activeTab === "Logs" ? logsEndRef : null} />
                  </div>
                  <div className="flex items-center justify-end gap-3 mt-2 text-xs text-blue-200">
                    <label className="inline-flex items-center gap-1 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        className="accent-cyan-400"
                        checked={followTail}
                        onChange={(e) => setFollowTail(e.target.checked)}
                      />
                      Follow live
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        const el = logsContainerRef.current;
                        if (el) {
                          el.scrollTop = el.scrollHeight;
                        }
                        setFollowTail(true);
                      }}
                      className="px-2 py-1 rounded bg-blue-700 text-white hover:bg-blue-600"
                      title="Jump to bottom"
                    >
                      Jump to bottom
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
        {showSettings && (
        <SettingsPanel
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
    </>
  );
};
export default EncoderSummary;
