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
import SettingsPanel from "./setting";

const tabs = [
  { name: "Connectivity", icon: <Activity size={18} /> },
  { name: "Configuration", icon: <Settings size={18} /> },
  { name: "Firmware", icon: <UploadCloud size={18} /> },
  { name: "Logs", icon: <FileText size={18} /> },
];

// const initialConfig = {
//   systemName: '',
//   ipAddress: '',
//   ssid: '',
//   bandwidth: '',
//   channel: '',
//   radioMode: '',
//   country:'',
//   hardwareVersion: '',
//   serialNumber: '',
//   firmwareVersion: '',
//   bootloaderVersion: '',
//   EthernetMAC: '',
//   WiFiMAC: '',
// };

// const bandwidthOptions = ['20MHz', '40MHz', '80MHz'];
// const channelOptions = ['Auto', '1', '6', '11'];
// const radioModeOptions = ['Access Point', 'Client', 'Repeater'];
// const radioModeOptions = ['Outdoor Base', 'Outdoor Subscriber',];
// const countryOptions=['5 GHz']

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

const TrainRadiosSummary = () => {
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
  const trainId = location.state?.trainId;
  const discoveredDevices = location.state?.discoveredDevices;

  const targetIp = id || deviceInfo?.ip || "";
  const targetSessionId = navState?.deviceInfo?.sessionId || id;
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
  const [configTab, setConfigTab] = useState("basic");
  const [changedConfig, setChangedConfig] = useState({});

  const [showAll, setShowAll] = useState(false);
  const [upgradeLogs, setUpgradeLogs] = useState([]);
  const [upgradingRowIndex, setUpgradingRowIndex] = useState(null);
  const [txAntennas, setTxAntennas] = useState(["A1", "A2"]); // default checked
  const [isChanged, setIsChanged] = useState(false);
  const [canApply, setCanApply] = useState(false);

  const [upgradePercent, setUpgradePercent] = useState(null);
  const [upgradeStatus, setUpgradeStatus] = useState("");
  const [loadingRefresh, setLoadingRefresh] = useState(false);
   const [showSettings, setShowSettings] = useState(false);

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
        const connected = await trainradiosService.checkBackendConnection();
        setIsBackendConnected(connected);

        // If we have a session ID, load the device session
        if (connected && sessionId) {
          try {
            const session = await trainradiosService.getDeviceSession(id);
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
              await trainradiosService.getDeviceConfiguration(targetSessionId);
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
        const connected = await trainradiosService.checkBackendConnection();
        setIsBackendConnected(connected);

        // If we have a session ID, load the device session
        if (connected && sessionId) {
          try {
            const session = await trainradiosService.getDeviceSession(id);
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
              await trainradiosService.getDeviceConfiguration(targetSessionId);
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
        await trainradiosService.updateDeviceConfiguration(
          targetSessionId,
          config,
        );
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

  // const handleDownload = () => {
  //   const logText = logs.map(log => `${log.time} ${log.type}: ${log.message}`).join('\n');
  //   const blob = new Blob([logText], { type: 'text/plain' });
  //   const url = URL.createObjectURL(blob);
  //   const a = document.createElement('a');
  //   a.href = url;
  //   a.download = 'system_logs.txt';
  //   a.click();
  //   URL.revokeObjectURL(url);
  // };

  const handleClear = () => setLogs([]);

  useEffect(() => {
    if (activeTab !== "Connectivity") return;

    const updateMonitoring = async () => {
      if (isBackendConnected && targetSessionId) {
        try {
          // Get real monitoring data from backend
          const monitoringData =
            await trainradiosService.getDeviceMonitoring(targetSessionId);
          if (monitoringData) {
            // const next = {
            //   signal: Number(
            //     monitoringData.signal_strength ?? monitoring.signal
            //   ),
            //   local_snr: Number(monitoringData.local_snr ?? monitoring.local_snr),
            //   remote_snr: Number(monitoringData.remote_snr ?? monitoring.remote_snr),
            //   tx: Number(monitoringData.tx_rate ?? monitoring.tx_rate),
            //   rx: Number(monitoringData.rx_rate ?? monitoring.rx_rate),
            //   latency: Number(monitoringData.latency ?? monitoring.latency)
            // };
            setMonitoring(monitoringData);
            // setChartData(prev => {
            //   const t = new Date();
            //   const point = {
            //     t: t.toLocaleTimeString(),
            //     local_snr: next.local_snr,
            //     remote_snr: next.remote_snr,
            //     tx: next.tx,
            //     rx: next.rx,
            //     latency:next.latency
            //   };
            //   const arr = [...prev, point];
            //   return arr.length > MAX_POINTS ? arr.slice(arr.length - MAX_POINTS) : arr;
            // });
          }
        } catch (err) {
          console.warn(
            "Failed to fetch real monitoring data, using simulation:",
            err,
          );
          // Fall back to simulation
          const sim = {
            signal: Number((70 + Math.random() * 10).toFixed(2)),
            local_snr: Number((40 + Math.random() * 10).toFixed(1)),
            tx: Math.floor(120 + Math.random() * 40),
            rx: Math.floor(100 + Math.random() * 30),
            latency: Math.floor(120 + Math.random() * 20),
          };
          setMonitoring(sim);
          setChartData((prev) => {
            const t = new Date();
            const point = { t: t.toLocaleTimeString(), ...sim };
            const arr = [...prev, point];
            return arr.length > MAX_POINTS
              ? arr.slice(arr.length - MAX_POINTS)
              : arr;
          });
        }
      } else {
        // Demo mode - keep lightweight placeholder values
        const sim = {
          signal: Number((70 + Math.random() * 10).toFixed(2)),
          local_snr: Number((40 + Math.random() * 10).toFixed(1)),
          tx: Math.floor(120 + Math.random() * 40),
          rx: Math.floor(100 + Math.random() * 30),
          latency: Math.floor(120 + Math.random() * 20),
        };
        setMonitoring(sim);
        setChartData((prev) => {
          const t = new Date();
          const point = { t: t.toLocaleTimeString(), ...sim };
          const arr = [...prev, point];
          return arr.length > MAX_POINTS
            ? arr.slice(arr.length - MAX_POINTS)
            : arr;
        });
      }
    };

    updateMonitoring();

    const interval = setInterval(updateMonitoring, 1000);
    return () => clearInterval(interval);
  }, [activeTab, isBackendConnected, sessionId]);

  useEffect(() => {
    if (!(activeTab === "Logs")) return;
    let cancelled = false;

    const fetchLogs = async () => {
      if (isBackendConnected && sessionId) {
        try {
          const newLogs =
            await trainradiosService.getDeviceLogsEnhanced(sessionId);
          if (!cancelled && Array.isArray(newLogs)) {
            // Normalize possible shapes
            // const normalized = newLogs.map(l => ({
            //   time: l.time || l.timestamp || new Date().toISOString(),
            //   type: l.type || l.level || 'INFO',
            //   message: l.message || l.msg || ''
            // }));
            const normalized = newLogs.map((l) => {
              if (typeof l === "number" || typeof l === "string") {
                return {
                  time: new Date().toISOString(),
                  type: "INFO",
                  message: l.toString(),
                };
              }
              return {
                time: l.time || l.timestamp || new Date().toISOString(),
                type: l.type || l.level || "INFO",
                message: l.message || l.msg || "",
              };
            });

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
    // const id = setInterval(fetchLogs, 1000);
    // return () => { cancelled = true; clearInterval(id); };
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
      const fwResp = await trainradiosService.getFirmwareList();
      const files = fwResp?.files || fwResp?.data || [];

      let runningFilename = null;

      if (sessionId) {
        const currentFwResp =
          await trainradiosService.getCurrentFirmware(sessionId);
        runningFilename =
          currentFwResp?.actualName ||
          currentFwResp?.fileName ||
          currentFwResp?.file_name ||
          currentFwResp?.firmware ||
          currentFwResp ||
          null;
      }

      const trainRadiosFiles = files.filter((f) =>
        ["sta"].includes(f.device_type?.toLowerCase()),
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

      const response = await trainradiosService.pushFirmware(filename);

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

  // const handleFirmwareUpgrade = async (row, index) => {
  //   try {
  //     setUpgradingRowIndex(index);

  //     setDeviceTableData(prev =>
  //       prev.map((r, i) =>
  //         i === index ? { ...r, status: "upgrading" } : r
  //       )
  //     );

  //     const filePathResp = await trainradiosService.getFirmwareFilePath(row.filename);
  //     if (!filePathResp?.filePath) {
  //       throw new Error("Firmware file path not found");
  //     }

  //     await trainradiosService.fileCopy(filePathResp.filePath);

  //     setUpgradeLogs([]);
  //     setUpgradePercent(0);
  //     setUpgradeStatus("Starting firmware upgrade...");
  //     lastUpgradeStatusRef.current = null;

  //     await trainradiosService.firmwareUpgrade(
  //       {
  //         targetSessionId,
  //         ip: deviceInfo.ip,
  //         fileName: row.filename,
  //       },

  //       (statusMessage) => {
  //         if (!statusMessage) return;

  //         const normalized = statusMessage.trim().toLowerCase();

  //         setUpgradeLogs([ `status: ${statusMessage}`]);

  //         if (lastUpgradeStatusRef.current === normalized) {
  //           return;
  //         }

  //         lastUpgradeStatusRef.current = normalized;
  //         setUpgradeStatus(statusMessage);

  //         if (STATUS_PROGRESS_MAP.hasOwnProperty(normalized)) {
  //           setUpgradePercent(STATUS_PROGRESS_MAP[normalized]);
  //         }
  //       }

  //     );

  //     await fetchFirmwareList();
  //     await trainradiosService.getCurrentFirmware(targetSessionId);

  //     setDeviceTableData(prev =>
  //       prev.map((r, i) =>
  //         i === index ? { ...r, status: "current" } : r
  //       )
  //     );

  //     setSelectedRows(prev =>
  //       prev.filter(r => r.filename !== row.filename)
  //     );

  //     alert("Firmware upgraded successfully");
  //   } catch (error) {
  //     console.error("Firmware upgrade failed:", error);

  //     setDeviceTableData(prev =>
  //       prev.map((r, i) =>
  //         i === index ? { ...r, status: "upgrade" } : r
  //       )
  //     );

  //     alert(error.message || "Firmware upgrade failed");
  //   } finally {
  //     setUpgradingRowIndex(null);
  //   }
  // };

  const handleFirmwareUpgrade = async (row, index) => {
    try {
      setUpgradingRowIndex(index);

      setDeviceTableData((prev) =>
        prev.map((r, i) => (i === index ? { ...r, status: "upgrading" } : r)),
      );

      const filePathResp = await trainradiosService.getFirmwareFilePath(
        row.filename,
      );
      if (!filePathResp?.filePath) {
        throw new Error("Firmware file path not found");
      }

      await trainradiosService.fileCopy(filePathResp.filePath);

      setUpgradeLogs([]);
      setUpgradePercent(50);
      setUpgradeStatus("Firmware upgrade in progress...");

      await trainradiosService.firmwareUpgrade(
        {
          targetSessionId,
          ip: deviceInfo.ip,
          fileName: row.filename,
        },
        (statusMessage) => {
          if (!statusMessage) return;

          setUpgradeLogs((prevLogs) => [statusMessage]);

          setUpgradeStatus(statusMessage);
        },
      );

      await fetchFirmwareList();
      await trainradiosService.getCurrentFirmware(targetSessionId);

      setUpgradePercent(100);
      setUpgradeStatus("Firmware upgrade completed successfully");
      setDeviceTableData((prev) =>
        prev.map((r, i) => (i === index ? { ...r, status: "current" } : r)),
      );

      setSelectedRows((prev) =>
        prev.filter((r) => r.filename !== row.filename),
      );

      alert("Firmware upgraded successfully");
    } catch (error) {
      console.error("Firmware upgrade failed:", error);

      setUpgradePercent(50);
      setUpgradeStatus("Firmware upgrade failed");
      setUpgradeLogs((prevLogs) => [
        ...prevLogs,
        `Error: ${error.message || "Upgrade failed"}`,
      ]);

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
      fetchConnectivity();
      fetchConfiguration();
    } else if (activeTab === "Configuration") {
      fetchConfiguration();
    } else if (activeTab === "Firmware") {
      fetchFirmware();
    } else if (activeTab === "Logs") {
      fetchLogs();
    }
  }, [activeTab, targetIp]);

  const fetchConnectivity = async () => {
    try {
      setError(null);

      const data =
        await trainradiosService.getDeviceMonitoring(targetSessionId);
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

  //   const fetchConfiguration = async () => {
  //   try {
  //     setError(null);

  //     const cfg = await trainradiosService.getDeviceConfiguration(targetSessionId);

  //     setConfig(prev => ({
  //       // ...initialConfig,
  //       ...(cfg)
  //     }));

  //   } catch (e) {
  //     console.error(e);
  //     setError("Configuration API failed");
  //     setConfig();
  //   }
  // };

  const fetchConfiguration = async () => {
    try {
      setError(null);

      const response =
        await trainradiosService.getDeviceConfiguration(targetSessionId);

      setConfig({
        config: response.config || response,
      });
    } catch (e) {
      console.error(e);
      setError("Configuration API failed");
    }
  };

  const fetchFirmware = async () => {
    try {
      setError(null);

      const list = await trainradiosService.getFirmwareList(targetIp);
      setFirmwareList(list);
    } catch (e) {
      console.error(e);
      setError("Firmware API failed");
    }
  };
  //  useEffect(() => {
  //   const interval = setInterval(() => {
  //      if(activeTab === 'Logs'){
  //     fetchLogs();

  //      }
  //   }, 1000);

  //   return () => clearInterval(interval);
  // }, [targetSessionId]);

  const fetchLogs = async () => {
    setLoadingRefresh(true);
    try {
      setError(null);

      const logData =
        await trainradiosService.getDeviceLogsEnhanced(targetSessionId);
      setLogs(logData);
    } catch (e) {
      console.error(e);
      setError("Logs API failed");
    } finally {
      setLoadingRefresh(false);
    }
  };

  const antennaValues = {
    A1: 1,
    A2: 2,
    A3: 4,
  };
  const getTxAntennaValue = (selected) => {
    return selected.reduce((sum, ant) => sum + antennaValues[ant], 0);
  };

  const bandwidthOptions = ["20", "40"];
  const radioStatusOptions = [
    { label: "Enable", value: 1 },
    { label: "Disable", value: 2 },
  ];
  const radioModeOptions = ["SU", "BSU"];
  const countryOptions = ["EU", "JP", "CN", "US"];
  const preferredChannelsOptions = [-2, -1, 0, 1, 2];
  const operationalModeOptions = ["HT", "VHT"];
  const frequencyExtensionOptions = [
    { label: "upperExtensionChannel", value: 1 },
    { label: "lowerExtensionChannel", value: 2 },
  ];
  const satelliteDensityOptions = [
    { label: "Disable", value: 1 },
    { label: "Large", value: 2 },
    { label: "Medium", value: 3 },
    { label: "Small", value: 4 },
    { label: "Mini", value: 5 },
    { label: "Micro", value: 6 },
  ];
  const dataStreamsOptions = [
    { label: "Single", value: 1 },
    { label: "Dual", value: 2 },
    { label: "Auto", value: 3 },
  ];
  const singleStOptions = [
    { label: "MCS0 (13.5Mbps)", value: 0 },
    { label: "MCS1 (27Mbps)", value: 1 },
    { label: "MCS2 (40.5Mbps)", value: 2 },
    { label: "MCS3 (54Mbps)", value: 3 },
    { label: "MCS4 (81Mbps)", value: 4 },
    { label: "MCS5 (108Mbps)", value: 5 },
    { label: "MCS6 (121.5Mbps)", value: 6 },
    { label: "MCS7 (135Mbps)", value: 7 },
  ];
  const dualStOptions = [
    { label: "MCS8 (27Mbps)", value: 8 },
    { label: "MCS9 (54Mbps)", value: 9 },
    { label: "MCS10 (81Mbps)", value: 10 },
    { label: "MCS11 (108Mbps)", value: 11 },
    { label: "MCS12 (121.5Mbps)", value: 12 },
    { label: "MCS13 (135Mbps)", value: 13 },
    { label: "MCS14 (202.5Mbps)", value: 14 },
    { label: "MCS15 (270Mbps)", value: 15 },
  ];
  const autoStOptions = [...singleStOptions, ...dualStOptions];
  const channelOptions = [
    "Auto",
    "36",
    "40",
    "44",
    "48",
    "149",
    "153",
    "157",
    "158",
    "161",
  ];

  const [dataStream, setDataStream] = useState("Single");

  const getDdrsOptions = () => {
    if (dataStream === 1) return singleStOptions; // Single
    if (dataStream === 2) return dualStOptions; // Dual
    if (dataStream === 3) return autoStOptions; // Auto
    return [];
  };

  const [saveLoading, setSaveLoading] = useState(false);

  const handleSaveConfiguration = async () => {
    try {
      setSaveLoading(true);
      const response1 = await trainradiosService.updateDeviceConfiguration(
        targetSessionId,
        changedConfig,
      );

      if (response1?.ok === true || response1?.status === 200) {
        setIsChanged(false);
        setCanApply(true);
      } else {
        console.error("First API call did not succeed:", response1);
      }
    } catch (error) {
      console.error("API call failed:", error);
    } finally {
      setSaveLoading(false);
    }
  };

  const [loading, setLoading] = useState(false);
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const handleApplyConfiguration = async () => {
    const ip = location.state?.deviceInfo?.ip;

    if (!targetSessionId) {
      console.error("Session ID not found");
      return;
    }

    try {
      setLoading(true);

      const commitResp = await trainradiosService.applyCommit(targetSessionId);

      if (!commitResp) {
        throw new Error("Commit failed");
      }

      console.log("Commit successful");

      const rebootResp =
        await trainradiosService.applyConfiguration(targetSessionId);

      if (!rebootResp) {
        throw new Error("Reboot failed");
      }

      console.log("Reboot triggered");

      setCanApply(false);

      await delay(30000);

      await fetchConfiguration();
    } catch (error) {
      console.error("Apply process failed:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleStationConfigChange = (key, value) => {
    setConfig((prev) => ({
      ...prev,
      config: {
        ...prev.config,
        [key]: value,
      },
    }));
    setIsChanged(true);

    setChangedConfig((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const getTxSelectedAntennas = (value) => {
    if (!value) return [];
    return Object.keys(antennaMap).filter((key) => value & antennaMap[key]);
  };

  const handleTxAntennaChange = (antenna, checked) => {
    let current = config?.config?.txAntennas || 0; // assume API stores numeric bitmask

    if (checked) {
      current |= antennaMap[antenna]; // add antenna
    } else {
      current &= ~antennaMap[antenna]; // remove antenna
    }

    handleStationConfigChange("txAntennas", current);
  };

  const antennaMap = {
    A1: 1,
    A2: 2,
    A3: 4,
  };

  const getSelectedAntennas = (value) => {
    if (!value) return [];

    return Object.keys(antennaMap).filter((key) => value & antennaMap[key]);
  };

  const handleRxAntennaChange = (antenna, checked) => {
    let current = config?.config?.rxAntennas || 0;

    if (checked) {
      current |= antennaMap[antenna]; // add
    } else {
      current &= ~antennaMap[antenna]; // remove
    }

    handleStationConfigChange("rxAntennas", current);
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
      <div className="w-full max-w-[896px] max-h-[800px] min-w-[896px] min-h-[800px] mx-auto bg-card backdrop-blur-md rounded-2xl shadow-2xl p-5">
        <button
          onClick={() =>
            navigate("/trainview", {
              state: {
                trainId,
                discoveredDevices,
              },
            })
          }
          className="mb-2 text-text hover:text-text font-semibold flex items-center gap-2"
        >
          <ArrowLeft size={20} /> Back to Train View
        </button>
        <div className="flex items-center gap-4">
          <h2 className="text-2xl text-text font-semibold mb-4">
            {isNewDevice && activeTab === "Firmware"
              ? "Firmware Installation"
              : `${type
                  ?.replace(/-/g, " ")
                  .replace(/\b\w/g, (c) => c.toUpperCase())}`}
            {config?.config?.ipAddress && (
              <span className="text-lg text-text ml-2">
                - {config.config.ipAddress}
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
            <div className="flex gap-4 justify-center mb-6">
              <button
                onClick={() => setConfigTab("basic")}
                className={`px-4 py-2 rounded-t-md font-medium ${
                  configTab === "basic"
                    ? "bg-buttonPrimary text-white"
                    : "text-text hover:text-text"
                }`}
              >
                Basic
              </button>

              <button
                onClick={() => setConfigTab("advanced")}
                className={`px-4 py-2 rounded-t-md font-medium ${
                  configTab === "advanced"
                    ? "bg-buttonPrimary text-white"
                    : "text-text hover:text-text"
                }`}
              >
                Advanced
              </button>
            </div>

            {configTab === "basic" && (
              <form className="flex flex-col margin-auto gap-12 justify-center mr-[48px] mt-2">
                <div className="flex flex-col gap-2 w-[500px] m-auto justify-center content-center">
                  <div className="flex gap-1">
                    <label className="w-full text-text mb-1 block">
                      Radio Mode
                    </label>
                    <input
                      className="w-full bg-input text-text px-4 rounded-md text-md"
                      value={config?.config?.radioMode || ""}
                      disabled
                    />
                  </div>
                  <div className="flex gap-1">
                    <label className="w-full text-text mb-1 block">
                      Frequency Domain
                    </label>
                    <select
                      className="w-full bg-input text-text px-4 rounded-md text-md"
                      value={config?.config?.freqDomain ?? ""}
                      onChange={(e) =>
                        handleStationConfigChange(
                          "freqDomain",
                          e.target.value === "" ? null : e.target.value,
                        )
                      }
                    >
                      <option value="">Select Frequency Domain</option>

                      {countryOptions.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex gap-1">
                    <label className="w-full text-text mb-1 block">
                      Preferred Channel Bandwidth
                    </label>
                    <select
                      className="w-full bg-input text-text px-1 rounded-md text-md"
                      value={config?.config?.bandwidth ?? ""}
                      onChange={(e) =>
                        handleStationConfigChange(
                          "bandwidth",
                          e.target.value === "" ? null : Number(e.target.value),
                        )
                      }
                    >
                      <option value="">Select</option>

                      {bandwidthOptions.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt} MHz
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex gap-1">
                    <label className="w-full text-text mb-1 block">
                      Active Bandwidth
                    </label>
                    <input
                      className="w-full bg-input text-text px-4 rounded-md text-md"
                      value={config?.config?.currentChannelBandwidth || ""}
                      disabled
                    />
                  </div>
                  <div className="flex gap-1">
                    <label className="w-full text-text mb-1 block">
                      Operational Mode
                    </label>
                    <select
                      className="w-full bg-input text-text px-4 rounded-md text-md"
                      value={config?.config?.operationalMode ?? ""}
                      onChange={(e) =>
                        handleStationConfigChange(
                          "operationalMode",
                          e.target.value === "" ? null : e.target.value,
                        )
                      }
                    >
                      <option value="">Select Mode</option>

                      {operationalModeOptions.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex gap-1">
                    <label className="w-full text-text mb-1 block">
                      Auto Channel Selection
                    </label>

                    <select
                      className="w-full bg-input text-text px-4 rounded-md text-md"
                      value={config?.config?.autoChannelSelection ?? ""}
                      onChange={(e) =>
                        handleStationConfigChange(
                          "autoChannelSelection",
                          e.target.value === "" ? null : e.target.value,
                        )
                      }
                    >
                      <option value="">Select Channel</option>

                      {radioStatusOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex gap-1">
                    <label className="w-full text-text mb-1 block">
                      Preferred Channel
                    </label>

                    <input
                      className="w-full bg-input text-text px-4 rounded-md text-md"
                      value={config?.config?.prefChannel || ""}
                      onChange={(e) =>
                        handleStationConfigChange(
                          "preferredChannelBandwidth",
                          Number(e.target.value) || 0,
                        )
                      }
                    />
                  </div>
                  <div className="flex gap-1">
                    <label className="w-full text-text mb-1 block">
                      Active Channel
                    </label>
                    <input
                      className="w-full bg-input text-text px-4 rounded-md text-md"
                      value={config?.config?.prefChannel || ""}
                      // onChange={(e) => handleStationConfigChange("prefChannel", e.target.value)}
                      disabled
                    />
                  </div>
                  <div className="flex gap-1">
                    <label className="w-full text-text mb-1 block">
                      Satellite Density
                    </label>
                    <select
                      className="w-full bg-input text-text px-4 rounded-md text-md"
                      disabled
                      value={config?.config?.satelliteDensity ?? ""}
                      onChange={(e) =>
                        handleStationConfigChange(
                          "satelliteDensity",
                          e.target.value === "" ? null : Number(e.target.value),
                        )
                      }
                    >
                      <option value="">Select Density</option>
                      {satelliteDensityOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex gap-1">
                    <label className="w-full text-text mb-1 block">
                      Auto Tx Antenna Status
                    </label>
                    <input
                      className="w-full bg-input text-text px-4 rounded-md text-md"
                      value={config?.config?.txAntennaStatus || ""}
                      onChange={(e) =>
                        handleStationConfigChange(
                          "txAntennaStatus",
                          Number(e.target.value) || 0,
                        )
                      }
                      disabled
                    />
                  </div>

                  <div className="flex gap-1">
                    <label className="w-full text-text mb-1 block">
                      Rx Antenna Status
                    </label>

                    <div className="flex flex-row gap-4">
                      {["A1", "A2", "A3"].map((antenna) => {
                        const selected = getSelectedAntennas(
                          config?.config?.rxAntennas,
                        );

                        return (
                          <label
                            key={antenna}
                            className="flex items-center gap-2 text-text"
                          >
                            <input
                              type="checkbox"
                              checked={selected.includes(antenna)}
                              onChange={(e) =>
                                handleRxAntennaChange(antenna, e.target.checked)
                              }
                              className="w-5 h-5 accent-blue-500"
                            />
                            {antenna}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </form>
            )}

            {configTab === "advanced" && (
              <form className="flex flex-col margin-auto gap-12 justify-center mr-[48px] mt-2">
                <div className="flex flex-col gap-2 w-[500px] m-auto justify-center content-center">
                  <div className="flex gap-1">
                    <label className="w-full text-text mb-1 block">
                      DDRS Status
                    </label>
                    <select
                      className="w-full bg-input text-text px-4 rounded-md text-md"
                      value={config?.config?.DDRSstatus ?? ""}
                      onChange={(e) =>
                        handleStationConfigChange(
                          "DDRSstatus",
                          e.target.value === "" ? null : Number(e.target.value),
                        )
                      }
                    >
                      <option value="">Select Status</option>

                      {radioStatusOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex gap-1">
                    <label className="w-full text-text mb-1 block">
                      Data Streams
                    </label>
                    <select
                      className="w-full bg-input text-text px-4 rounded-md text-md"
                      value={dataStream ?? ""}
                      onChange={(e) =>
                        setDataStream(
                          e.target.value === "" ? null : Number(e.target.value),
                        )
                      }
                    >
                      <option value="">Select Data Stream</option>

                      {dataStreamsOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {config?.config?.DDRSstatus === 1 && (
                    <div className="flex gap-1">
                      <label className="w-full text-text mb-1 block">
                        DDRS Maximum Data Rate
                      </label>
                      <select
                        className="w-full bg-input text-text px-4 rounded-md text-md"
                        value={config?.config?.DDRSmaxDataRate ?? ""}
                        onChange={(e) =>
                          handleStationConfigChange(
                            "DDRSmaxDataRate",
                            e.target.value === ""
                              ? null
                              : Number(e.target.value),
                          )
                        }
                      >
                        <option value="">Select Status</option>

                        {getDdrsOptions().map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  {config?.config?.DDRSstatus === 1 && (
                    <div className="flex gap-1">
                      <label className="w-full text-text mb-1 block">
                        DDRS Minimum Data Rate
                      </label>

                      <select
                        className="w-full bg-input text-text px-4 rounded-md text-md"
                        value={config?.config?.DDRSminDataRate ?? ""}
                        onChange={(e) =>
                          handleStationConfigChange(
                            "DDRSminDataRate",
                            e.target.value === ""
                              ? null
                              : Number(e.target.value),
                          )
                        }
                      >
                        <option value="">Select Status</option>

                        {getDdrsOptions().map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="flex gap-1">
                    <label className="w-full text-text mb-1 block">
                      ATPC Status
                    </label>
                    <select
                      className="w-full bg-input text-text px-4 rounded-md text-md"
                      value={config?.config?.bandwidth ?? ""}
                      onChange={(e) =>
                        handleStationConfigChange(
                          "bandwidth",
                          e.target.value === "" ? null : e.target.value,
                        )
                      }
                    >
                      <option value="">Select Channel</option>{" "}
                      {/* Placeholder */}
                      {radioStatusOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex gap-1">
                    <label className="w-full text-text mb-1 block">
                      Tx Rate
                    </label>
                    <input
                      className="w-full bg-input text-text px-4 rounded-md text-md"
                      value={config?.config?.txRate || ""}
                      onChange={(e) =>
                        handleStationConfigChange(
                          "txRate",
                          Number(e.target.value) || 0,
                        )
                      }
                      disabled
                    />
                  </div>

                  <div className="flex gap-1">
                    <label className="w-full text-text mb-1 block">
                      Tx Antenna Status
                    </label>
                    <div className="flex flex-row gap-4">
                      {["A1", "A2", "A3"].map((antenna) => {
                        const selected = getTxSelectedAntennas(
                          config?.config?.txAntennas,
                        );

                        return (
                          <label
                            key={antenna}
                            className="flex items-center gap-2 text-text"
                          >
                            <input
                              type="checkbox"
                              checked={selected.includes(antenna)}
                              onChange={(e) =>
                                handleTxAntennaChange(antenna, e.target.checked)
                              }
                              className="w-5 h-5 accent-blue-500"
                            />
                            {antenna}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </form>
            )}

            <div className="flex justify-center gap-4 mt-4">
              <div>
                <button
                  type="button"
                  className={`text-white font-semibold px-6 py-2 rounded-md shadow
                  ${
                    saveLoading
                      ? "bg-buttonSecondary cursor-not-allowed"
                      : "bg-buttonSecondary from-cyan-400 to-blue-500"
                  }
                  ${!isChanged ? "opacity-50 cursor-not-allowed" : ""}
                `}
                  onClick={handleSaveConfiguration}
                  disabled={!isChanged || saveLoading}
                >
                  {saveLoading ? "Saving..." : "Save"}
                </button>
              </div>

              <div>
                <button
                  type="button"
                  className={`text-white font-semibold px-6 py-2 rounded-md shadow
                  ${
                    loading
                      ? "bg-buttonTertiary cursor-not-allowed"
                      : "bg-buttonTertiary hover:bg-buttonTertiary"
                  }
                  ${!canApply ? "opacity-50 cursor-not-allowed" : ""}
                `}
                  onClick={handleApplyConfiguration}
                  disabled={!canApply || loading}
                >
                  {loading ? "Applying..." : "Apply"}
                </button>
              </div>
            </div>
          </>
        )}

        {activeTab === "Connectivity" && (
          <>
            <div className="flex gap-8 w-full">
              {/* Train Radio Details */}
              <div className="flex-1">
                <h1 className="font-semibold text-text text-1xl mb-2 mt-4">
                  Cab Radio Details
                </h1>

                <div>
                  <label className="block text-text  mb-2 mt-4">
                    System Name :{" "}
                    <span className="text-lg font-bold">
                      {" "}
                      {config?.config?.systemName}{" "}
                    </span>
                  </label>
                  <label className="block text-text mb-2 mt-4">
                    Up Time :{" "}
                    <span className="text-lg font-bold">
                      {" "}
                      {config?.config?.sysUpTime}
                    </span>
                  </label>
                  <label className="block text-text mb-2 mt-4">
                    Signal(dBm) :{" "}
                    <span className="text-lg font-bold">
                      {" "}
                      {config?.config?.signal1}{" "}
                    </span>
                  </label>
                  <label className="block text-text mb-2 mt-4">
                    Noise (dBm) :{" "}
                    <span className="text-lg font-bold">
                      {" "}
                      {config?.config?.noiseLevel}{" "}
                    </span>
                  </label>
                  <label className="block text-text mb-2 mt-4">
                    Basename :{" "}
                    <span className="text-lg font-bold">
                      {" "}
                      {config?.config?.basename}{" "}
                    </span>
                  </label>
                  <label className="block text-text mb-2 mt-4">
                    Associated IP Address :{" "}
                    <span className="text-lg font-bold">
                      {" "}
                      {config?.config?.associatedipaddr}{" "}
                    </span>
                  </label>
                  <label className="block text-text mb-2 mt-4">
                    Associated MAC Address :{" "}
                    <span className="text-lg font-bold">
                      {" "}
                      {config?.config?.associatedmacaddr}{" "}
                    </span>
                  </label>
                </div>

                <div>
                  <div>
                    <label className="inline text-text mb-2 mt-4">
                      Local SNR :
                      <span className="text-text text-lg">
                        {monitoring?.local_snr === null
                          ? " --"
                          : monitoring?.local_snr + "dB"}{" "}
                      </span>
                      <SignalStrength value={monitoring?.local_snr || 0} />
                    </label>
                  </div>
                </div>
              </div>

              {/* Cab Radio Details */}
              <div className="flex-1">
                <h1 className="font-semibold text-text text-1xl mb-2 mt-4">
                  Wireless Details
                </h1>

                <div>
                  <label className="block text-text mb-2 mt-4">
                    Network Name :{" "}
                    <span className="text-lg font-bold">
                      {" "}
                      {config?.config?.networkName}{" "}
                    </span>
                  </label>
                  <label className="block text-text mb-2 mt-4">
                    Country :{" "}
                    <span className="text-lg font-bold">
                      {" "}
                      {config?.config?.country}{" "}
                    </span>
                  </label>
                  <label className="block text-text mb-2 mt-4">
                    BandWidth :{" "}
                    <span className="text-lg font-bold">
                      {" "}
                      {config?.config?.bandwidth}MHz{" "}
                    </span>
                  </label>
                  <label className="block text-text mb-2 mt-4">
                    Operating Channel ( Frequency ) :{" "}
                    <span className="text-lg font-bold">
                      {" "}
                      {config?.config?.channel} {config?.config?.frequency}{" "}
                    </span>
                  </label>
                </div>

                <div>
                  <div>
                    <label className="inline text-text mb-2 mt-4">
                      Remote SNR :
                      <span>
                        {monitoring?.remote_snr === null
                          ? " --"
                          : monitoring?.remote_snr + "dB"}{" "}
                      </span>
                      <SignalStrength value={monitoring.remote_snr || 0} />
                    </label>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-center mt-6">
              <button
                type="button"
                onClick={() =>
                  navigate("/train-radios/troubleshoot", {
                    state: {
                      state: { deviceInfo, trainId, discoveredDevices },
                    },
                  })
                }
                className="bg-buttonPrimary from-cyan-400 to-blue-500
                      text-white font-semibold px-6 py-2 rounded-md shadow"
              >
                Troubleshoot
              </button>
            </div>
          </>
        )}

        {activeTab === "Firmware" && (
          <div>
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
                                    className="w-4 h-4 accent-blue-600 cursor-pointer"
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
                    <div className="text-white text-center py-4">
                      Waiting for logs…
                    </div>
                  ) : (
                    upgradeLogs.map((log, idx) => (
                      <div
                        key={idx}
                        className="text-white text-sm px-3 py-2 border-b border-white/10"
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
                    className="max-h-[55vh] overflow-auto rounded-md"
                    ref={activeTab === "Logs" ? logsContainerRef : null}
                    onScroll={
                      activeTab === "Logs" ? handleLogsScroll : undefined
                    }
                    style={{ background: "#0f172a" }}
                  >
                    {logs.map((log, idx) => (
                      <div
                        key={idx}
                        className="font-mono text-sm mb-1 px-2 rounded"
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
                        {/* <span className="text-blue-300">{log.time}</span>{' '} */}
                        {/* <span className={log.type === 'WARN' ? 'text-yellow-400' : log.type === 'INFO' ? 'text-cyan-400' : 'text-white'}>
                          {log.type}
                        </span>:  */}
                        {/* {log.message} */}
                        {typeof log === "object" ? log.message : log.toString()}
                      </div>
                    ))}
                    <div ref={activeTab === "Logs" ? logsEndRef : null} />
                  </div>

                  {/* <div className="flex items-center justify-end gap-3 mt-2 text-xs text-blue-200">
                    <label className="inline-flex items-center gap-1 cursor-pointer select-none">
                      <input type="checkbox" className="accent-cyan-400" checked={followTail} onChange={(e) => setFollowTail(e.target.checked)} />
                      Follow live
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        const el = logsContainerRef.current;
                        if (el) { el.scrollTop = el.scrollHeight; }
                        setFollowTail(true);
                      }}
                      className="px-2 py-1 rounded bg-blue-700 text-white hover:bg-blue-600"
                      title="Jump to bottom"
                    >
                      Jump to bottom
                    </button>
                  </div> */}
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
export default TrainRadiosSummary;
