import React, { useEffect,useState,useRef} from 'react';
import { ArrowLeft, Settings, Activity, UploadCloud, FileText, Trash2, Download, AlertCircle, CheckCircle, Loader, RefreshCcw, SettingsIcon } from 'lucide-react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { apiService } from '../services/apiService';
import { transcoderService } from '../services/transcoderService';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';
import transcoderImage from '../assets/images/transcoder.jpeg';
import deviceimage from '../assets/images/device.png';
import firmWareimage from '../assets/images/firmwareversion.png'
import hardwareimage from '../assets/images/hardware.png'
import TroubleshootTranscoder from './TroubleShootTranscoder';
import SettingsPanel from './setting';

const tabs = [
  { name: 'Configuration', icon: <Settings size={18} /> },
  { name: 'Connectivity', icon: <Activity size={18} /> },
  { name: 'Firmware', icon: <UploadCloud size={18} /> },
  { name: 'Logs', icon: <FileText size={18} /> },
];

const initialConfig = {
  systemName: '',
  ipAddress: '',
  ssid: '',
  bandwidth: '',
  channel: '',
  radioMode: '',
};

const initialLogs = [
  {
    time: '',
    type: '',
    message: '',
  },
  {
    time: '',
    type: '',
    message: '',
  },
  {
    time: '',
    type: '',
    message: '',
  },
];

const TranscoderSummary = ({state}) => {

   const fileRef = useRef(null);
   const [selectedFile, setSelectedFile] = useState(null);
   const [config, setConfig] = useState(initialConfig);
   const [monitoring, setMonitoring] = useState({
     signal: '',
     snr: '',
     tx: '',
     rx: '',
   });
   const [transcoderChartData, setTranscoderChartData] = useState([]);
   const [transcoderMonitoring, setTranscoderMonitoring] = useState({
     tx: 0,
     rx: 0,
     cpu: 30,
     temperature: 40
   });
   const transcoderPrevRef = useRef({ tx: 0, rx: 0 });
   const [logs, setLogs] = useState([]);
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
  //  const deviceIp =  config.ipAddress;

   const [transcoderStats, setTranscoderStats] = useState({
     System: {
       firmware: '',
       hardware: '',
       device_name: '',
       temperature: '',
       ntp_status: ''
     },
     Quad: {
       bitrate: '',
       profile: '',
       xpos: '',
       ypos: ''
     },
     RTSPURL: {
      "cam1.url": "",
      "cam2.url": "",
      "cam3.url": "",
      "cam4.url": "",
     }
   });
   const [changedSections, setChangedSections] = useState({
  quad: false,
  rtsp: false
});
const [canApply, setCanApply] = useState(false);

   const FIRMWARE_STATUS = {
    DOWNLOAD: "download",
    DOWNLOADING: "downloading",
    READY: "ready",
    PUSHING: "pushing",
    UPGRADING: "upgrading",
    EXISTS: "already_exists",
    CURRENT: "current",
    UPGRADED: "upgraded",
    FAILED: "failed",
  };
   const [showAll, setShowAll] = useState(false);
   
   const navigate = useNavigate();
   const { type } = useParams();
   const location = useLocation();
   const navState = location.state || {};
   const deviceIp = location?.state?.deviceInfo?.ip || location?.state?.ip;
  //  const deviceIp = location.state.ip;
  const selectedStation = location.state?.selectedStation;
const deviceData = location.state?.deviceData;
   const isNewDevice = navState.isNewDevice || false;
   const [activeTab, setActiveTab] = useState(navState.activeTab || 'Configuration');
   const { deviceInfo, sessionId = null } = location.state || {};
   const [firmwareCompleted, setFirmwareCompleted] = useState(false);
   
   const [firmwarePath, setFirmwarePath] = useState(null);
   const [deviceTableData, setDeviceTableData] = useState([]); 
   const [firmwareList, setFirmwareList] = useState([])
   const [firmwareResponse, setFirmwareResponse] = useState(false);
   const [selectedRows, setSelectedRows] = useState([]);

   const [systemForm, setSystemForm] = useState(
    location.state?.systemForm || { systemName: "", password: "" }
  );
  const [selectedTranscoderIp, setSelectedTranscoderIp] = useState(location.state?.ip || "");
   const [upgradeLogs, setUpgradeLogs] = useState([]);
   const [isUpgrading, setIsUpgrading] = useState(false);
   const [upgradeProgress, setUpgradeProgress] = useState(0);
   const [upgradePercent, setUpgradePercent] = useState(0);
   const [upgradingRowIndex, setUpgradingRowIndex] = useState(null);
   const [currentFirmware, setCurrentFirmware] = useState("");
   const [ip, setIp] = useState(""); // default IP
  const [loadingRefresh, setLoadingRefresh] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
   
  
 
  useEffect(() => {
    if (location.state?.activeTab) {
      setActiveTab(location.state.activeTab);
    }
  }, [location.state]);

  useEffect(() => {
    if (location.state?.deviceInfo?.ip) {
      setConfig(prev => ({
        ...prev,
        ipAddress: location.state.deviceInfo.ip,
        systemName: location.state.deviceInfo.name || prev.systemName,
      }));
      setSelectedTranscoderIp(location.state.deviceInfo.ip);
    }
  }, [location.state]);

  useEffect(() => {
    const ip = location.state?.deviceInfo?.ip;
    if (ip) {
      setConfig(prev => ({ ...prev, ipAddress: ip }));
      setSelectedTranscoderIp(ip);
    }
  }, []);
  
  
  

  useEffect(() => {
      if (activeTab !== "Configuration") return;
    
      const fetchConfig = async () => {
        try {
          setIsLoading(true);
          const resp = await transcoderService.getTranscoderConfig(deviceIp);
          const cfg = resp.config ? JSON.parse(resp.config) : resp;
          setConfig(cfg);
        } catch (err) {
          console.error(err);
          setError("Failed to load configuration");
        } finally {
          setIsLoading(false);
        }
      };
    
      if (deviceIp) fetchConfig();
    }, [activeTab, deviceIp]);

  // Check backend connectivity and load device session
  useEffect(() => {
    // Pre-fill with clicked device info if present
    if (location.state?.deviceInfo?.ip) {
      setConfig(prev => ({
        ...prev,
        ipAddress: location.state.deviceInfo.ip,
        systemName: location.state.deviceInfo.name || prev.systemName,
      }));
    }

    const checkBackendAndLoadDevice = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // Check backend connectivity
        const connected = await apiService.checkBackendConnection();
        setIsBackendConnected(connected);
        
        // If we have a session ID, load the device session
        if (connected && sessionId) {
          try {
            const session = await apiService.getDeviceSession(sessionId);
            setDeviceSession(session);
            
            // Update config with real device data
            if (session.device_info) {
              setConfig(prevConfig => ({
                ...prevConfig,
                systemName: session.device_info.name || prevConfig.systemName,
                ipAddress: session.device_info.ip_address || prevConfig.ipAddress,
                // Add other real device properties as available
              }));
            }
            
            // Load real device configuration
            const deviceConfig = await apiService.getDeviceConfiguration(sessionId);
            if (deviceConfig) {
              setRealDeviceData(deviceConfig);
              // Backend returns { systemName, ipAddress, ... } OR { config: {...} }
              const cfg = deviceConfig.config ? deviceConfig.config : deviceConfig;
              setConfig(prevConfig => ({
                ...prevConfig,
                ...cfg
              }));
            }
          } catch (sessionError) {
            console.warn('Failed to load device session:', sessionError);
            setError('Failed to load device session. Using demo mode.');
          }
        }
      } catch (err) {
        console.error('Backend connection failed:', err);
        setIsBackendConnected(false);
        setError('Backend connection failed. Running in demo mode.');
      } finally {
        setIsLoading(false);
      }
    };
    
    checkBackendAndLoadDevice();
  }, [sessionId]);

  const handleChange = (e) => {
    setConfig({ ...config, [e.target.name]: e.target.value });
  };

  // const handleSave = async (e) => {
  //   e.preventDefault();
  //   setIsLoading(true);
  //   setError(null);
    
  //   try {
  //     if (isBackendConnected && sessionId) {
  //       // Save configuration to real device via backend
  //       await apiService.updateDeviceConfiguration(sessionId, config);
  //       alert('Configuration saved to device successfully!');
  //     } else {
  //       // Demo mode
  //       alert('Configuration saved!\n' + JSON.stringify(config, null, 2));
  //     }
  //   } catch (err) {
  //     console.error('Failed to save configuration:', err);
  //     setError('Failed to save configuration: ' + err.message);
  //   } finally {
  //     setIsLoading(false);
  //   }
  // };
    

  const handleSave = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
  
    try {
      let payloadToSave;
  
      // if (isTranscoder) {
      //   payloadToSave = transcoderStats;          
      // } else {
      //   payloadToSave = config;         
      // }
  
      console.log("Payload being saved:", payloadToSave);
  
      alert("Configuration Saved:\n\n" + JSON.stringify(payloadToSave, null, 2));
  
      if (isBackendConnected && sessionId) {
        console.log("Sending payload to backend:", payloadToSave);
        await apiService.updateDeviceConfiguration(sessionId, payloadToSave);
        alert("Configuration saved to device successfully!");
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

  const fetchLogs = async () => {
    if (!deviceIp) return;
  setLoadingRefresh(true);
    try {
      const rawLogs = await transcoderService.getTranscoderLogs(deviceIp);

      const normalizedLogs = rawLogs.map(line => ({
        type: line.includes("WARN")
          ? "WARN"
          : line.includes("ERROR")
          ? "ERROR"
          : "INFO",
        message: line.trim()
      }));

      setLogs(normalizedLogs);
    } catch (err) {
      console.error("Failed to fetch logs", err);
    } finally {
    setLoadingRefresh(false);
  }
  };

   useEffect(() => {
  if (activeTab === "Logs") {
    fetchLogs();
  }
}, [activeTab, deviceIp]);

  useEffect(() => {
    if (activeTab !== "Logs") return;

    let cancelled = false;

    const loadLogs = async () => {
      if (cancelled) return;
      await fetchLogs();
    };

    loadLogs();

    return () => {
      cancelled = true;
    };

  }, [activeTab, deviceIp]);


  useEffect(() => {
    if (!showAll) return;
    const el = logsContainerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [logs, showAll]);

  // Detect user scroll position to toggle followTail off when scrolling up
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

  const transcoderFetchedRef = useRef(new Set());
  
  useEffect(() => {
    if (!deviceIp) return;
    if (transcoderFetchedRef.current.has(deviceIp)) return;
  
    transcoderFetchedRef.current.add(deviceIp);
    let cancelled = false;
  
    const fetchTranscoderStats = async () => {
      try {
        setIsLoading(true);
        setError(null);
  
        const { config, uptime, temp } = await transcoderService.getTranscoderConfig(deviceIp);
        if (!config) throw new Error("Empty transcoder config");
  
        // if (cancelled) {
          const RTSPURL = {};
          ["cam1", "cam2", "cam3", "cam4"].forEach(cam => {
            // const key = `${cam}.url`;
            // RTSPURL[cam] = { url: config?.RSTPURL?.[key] ?? "" };
            const key = `${cam}.url`; // flat key
    RTSPURL[key] = config?.RSTPURL?.[key] ?? "";
          });
  
          setTranscoderStats({
            System: {
              firmware: config?.System?.firmware ?? "N/A",
              hardware: config?.System?.hardware ?? "N/A",
              device_name: config?.System?.model ?? "N/A",
              syslogip: config?.System?.syslogip ?? "N/A",
              temperature: temp ?? "N/A",
              uptime: uptime ?? "N/A",
            },
            Quad: {
              bitrate: config?.Quad?.bitrate ?? "N/A",
              profile: config?.Quad?.profile ?? "N/A",
              xpos: config?.Quad?.xpos ?? "N/A",
              ypos: config?.Quad?.ypos ?? "N/A",
            },
            RTSPURL
          });
        // }
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
  
    fetchTranscoderStats();
    return () => { cancelled = true; };
  }, [deviceIp]);
  
  useEffect(() => {
    if (activeTab !== "Connectivity") return;
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
          txKbps = ((netstats.tx_bytes - transcoderPrevRef.current.tx) * 8) / 1000;
          rxKbps = ((netstats.rx_bytes - transcoderPrevRef.current.rx) * 8) / 1000;
        }

        transcoderPrevRef.current = {
          tx: netstats.tx_bytes,
          rx: netstats.rx_bytes
        };

        setTranscoderMonitoring({
          tx: txKbps.toFixed(2),
          rx: rxKbps.toFixed(2),
          cpu: netstats.cpu,
          temperature: netstats.temperature
        });

        setTranscoderChartData(prev => {
          const t = new Date();
          const point = {
            t: t.toLocaleTimeString(),
            //  t: new Date(),
            tx: txKbps.toFixed(2),
            rx: rxKbps.toFixed(2)
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
    if (isNewDevice) {
      setActiveTab('Firmware');
    }
  }, [isNewDevice]);


  useEffect(() => {
    if (
      isNewDevice &&
      !firmwareCompleted &&
      activeTab !== 'Firmware'
    ) {
      setActiveTab('Firmware');
    }
  }, [activeTab, firmwareCompleted, isNewDevice]);
  
  
   useEffect(() => {
      if (activeTab === 'Firmware' && selectedTranscoderIp) {
        fetchFirmwareList();
        setLogLines([]);
      }
    }, [activeTab, selectedTranscoderIp]);  
  
    useEffect(() => {
      const ip = selectedTranscoderIp || config.ipAddress;
      if (activeTab === 'Firmware' && ip) {
        fetchFirmwareList();
        setLogLines([]);
      }
    }, [activeTab, selectedTranscoderIp, config.ipAddress]);


  const normalizeStatus = (status) => {
    if (!status) return FIRMWARE_STATUS.DOWNLOAD;
  
    const s = status.toString().toLowerCase();
  
    if (s.includes("download")) return FIRMWARE_STATUS.DOWNLOAD;
    if (s.includes("downloading")) return FIRMWARE_STATUS.DOWNLOADING;
    if (s.includes("ready")) return FIRMWARE_STATUS.READY;
    if (s.includes("push")) return FIRMWARE_STATUS.PUSHING;
    if (s.includes("upgrade")) return FIRMWARE_STATUS.UPGRADING;
    if (s.includes("exist")) return FIRMWARE_STATUS.EXISTS;
    if (s.includes("current")) return FIRMWARE_STATUS.CURRENT;
    if (s.includes("failed")) return FIRMWARE_STATUS.FAILED;
  
    return FIRMWARE_STATUS.DOWNLOAD;
  };
  
  
 const fetchFirmwareList = async () => {
     try {
       const resp = await transcoderService.getFirmwareList();
       const files = resp?.files || resp || [];
   
       const transcoderFiles = files.filter(file => file.device_type === 'transcoder');
       
       let currentFirmware = "";
   
       if (!isNewDevice && selectedTranscoderIp) {
         try {
           currentFirmware = await transcoderService.getCurrentFirmware(selectedTranscoderIp);
         } catch (err) {
           console.error("getCurrentFirmware failed:", err);
           currentFirmware = "";
         }
       }
   
       setCurrentFirmware(currentFirmware);
   
       setDeviceTableData(
         transcoderFiles.map(file => {
           const filename = file.actualName || file.file_name;
   
           const status =
             file.version === currentFirmware
               ? FIRMWARE_STATUS.CURRENT
               : normalizeStatus(file.status);
   
           return {
             filename,
             firmware: file.version,
             status,
           };
         })
       );
     } catch (error) {
       console.error("Failed to fetch firmware list", error);
     }
   };
  
  const handlePushFirmware = async (filename, index) => {
    try {
      setDeviceTableData(prev =>
        prev.map((row, i) =>
          i === index ? { ...row, status: FIRMWARE_STATUS.DOWNLOADING } : row
        )
      );
  
      const alreadyExists = await transcoderService.pushFirmware(filename);
  
      setDeviceTableData(prev =>
        prev.map((row, i) =>
          i === index ? { ...row, status: FIRMWARE_STATUS.READY } : row
        )
      );
  
      alert(
        alreadyExists
          ? `Download successfully!`
          : `Firmware ${filename} already exists`
      );
    } catch (err) {
      console.error("Failed to push firmware:", err);
  
      setDeviceTableData(prev =>
        prev.map((row, i) =>
          i === index ? { ...row, status: FIRMWARE_STATUS.DOWNLOAD } : row
        )
      );
  
      alert(`Failed to push firmware ${filename}`);
    }
  };
  

  const handleCheckboxToggle = (row) => {
    setSelectedRows(prev => {
      const exists = prev.some(item => item.filename === row.filename);
  
      if (exists) {
        return prev.filter(item => item.filename !== row.filename);
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
      started: 10,
      progress: 40,
      uploaded: 70,
      upgrade_started: 90,
      upgrade_completed: 100,
      error: 0
    };
    

  // const handleFirmwareUpgrade = async (row, index) => {
  //   try {
  //     setIsUpgrading(true);
  //     setUpgradingRowIndex(index);
  //     setUpgradePercent(0);
  //     setUpgradeLogs(["Waiting for logs..."]);
  
  //     setDeviceTableData(prev =>
  //       prev.map((r, i) =>
  //         i === index ? { ...r, status: FIRMWARE_STATUS.UPGRADING } : r
  //       )
  //     );
  
  //     const filePath = await transcoderService.getFirmwareFilePath(row.filename);
  //     if (!filePath) throw new Error("Firmware file not found");
  
  //     await transcoderService.copyFirmwareToDevice({
  //       source_path: filePath,
  //       host: selectedTranscoderIp,
  //       // systemName: systemForm.systemName,
  //       // passWord: systemForm.password,
  //       deviceType: "transcoder",
  //     });
  
  //   await  transcoderService.firmwareUpgrade({
  //       ip: selectedTranscoderIp,
  //       fileName: row.filename,
  
  //             onEvent: async (evt) => {
  //       console.log("SSE EVENT:", evt);

  //       const { event, data } = evt;

  //       const progressMap = {
  //         started: 10,
  //         progress: 40,
  //         uploaded: 70,
  //         upgrade_started: 90,
  //         reboot_complete: 100
  //       };

  //       if (progressMap[event]) {
  //         setUpgradePercent(progressMap[event]);
  //         setUpgradeProgress(progressMap[event]);
  //       }

  //       let logLine = "";

  //       if (typeof data === "string") {
  //         logLine = `${event}: ${data}`;
  //       } else if (typeof data === "object") {
  //         logLine = `${event}: ${JSON.stringify(data)}`;
  //       }

  //       if (logLine) {
  //         setUpgradeLogs(prev => [logLine]);
  //       }

  //       if (event === "reboot_complete") {
  //         alert("Firmware Upgrade Successful. Device reboot completed.");
  //         setIsUpgrading(false);
  //         setUpgradingRowIndex(null);
  //       }
  //     },
  //       onError: (err) => {
  //         console.warn("Firmware SSE closed", err);
  //         setIsUpgrading(false);
  //       setUpgradingRowIndex(null);

  //       }
  //     });
  
  //   } catch (error) {
  //     console.error("Firmware upgrade failed:", error);
  //     setIsUpgrading(false);
  //     setDeviceTableData(prev =>
  //       prev.map((r, i) =>
  //         i === index ? { ...r, status: FIRMWARE_STATUS.FAILED } : r
  //       )
  //     );
  //   }
  // };


  const handleFirmwareUpgrade = async (row, index) => {
  try {
    if (!row || !row.filename) return alert("Firmware file missing!");
    if (!selectedTranscoderIp) return alert("Please select Transcoder IP first!");

    setIsUpgrading(true);
    setUpgradingRowIndex(index);
    setUpgradePercent(50);
    setUpgradeLogs(["Firmware upgrade started..."]);

    setDeviceTableData(prev =>
      prev.map((r, i) =>
        i === index ? { ...r, status: FIRMWARE_STATUS.UPGRADING } : r
      )
    );

    const filePath = await transcoderService.getFirmwareFilePath(row.filename);
    if (!filePath) throw new Error("Firmware file not found");

    await transcoderService.copyFirmwareToDevice({
      source_path: filePath,
      host: selectedTranscoderIp,
      deviceType: "transcoder",
    });

    setUpgradeLogs(prev => [...prev, "File copied to device"]);

    await transcoderService.firmwareUpgrade({
      ip: selectedTranscoderIp,
      fileName: row.filename,

      onEvent: (evt) => {
        const { event, data } = evt;

        let logLine = typeof data === "string" ? `${event}: ${data}` : `${event}: ${JSON.stringify(data)}`;
        setUpgradeLogs(prev => [logLine]);

        if (event === "reboot_complete") {
          setUpgradePercent(100);
          // setUpgradeLogs(prev => [...prev, "Firmware upgrade completed successfully"]);
          setDeviceTableData(prev =>
            prev.map((r, i) =>
              i === index ? { ...r, status: FIRMWARE_STATUS.CURRENT } : r
            )
          );
          alert("Firmware Upgrade Successful. Device reboot completed.");
          setIsUpgrading(false);
          setUpgradingRowIndex(null);
        }
      },

      onError: (err) => {
        console.error("Firmware SSE error:", err);
        setUpgradeLogs(prev => [...prev, `Error: ${err.message || "Upgrade failed"}`]);
        setUpgradePercent(50);
        setDeviceTableData(prev =>
          prev.map((r, i) =>
            i === index ? { ...r, status: FIRMWARE_STATUS.FAILED } : r
          )
        );
        setIsUpgrading(false);
        setUpgradingRowIndex(null);
        alert(err.message || "Firmware upgrade failed");
      }
    });

  } catch (error) {
    console.error("Firmware upgrade failed:", error);
    setUpgradeLogs(prev => [...prev, `Error: ${error.message}`]);
    setUpgradePercent(50);
    setDeviceTableData(prev =>
      prev.map((r, i) =>
        i === index ? { ...r, status: FIRMWARE_STATUS.FAILED } : r
      )
    );
    setIsUpgrading(false);
    setUpgradingRowIndex(null);
    alert(error.message || "Firmware upgrade failed");
  }
};
  

  const terminalRef = useRef(null)

  const [logLines, setLogLines] = useState(() => {
    const savedLog = localStorage.getItem("terminalLog");
    return savedLog ? JSON.parse(savedLog) : [];
  });
  
  const [cmdText, setCmdText] = useState("");

  useEffect(() => {
    localStorage.setItem("terminalLog", JSON.stringify(logLines));
  }, [logLines]);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [logLines]);


  const handleCommand = async (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
  
    const cmd = cmdText.trim();
    if (!cmd) return;

    if (!selectedTranscoderIp || !systemForm.systemName || !systemForm.password) {
      alert("Please enter IP + credentials first");
      return;
    }
  
    if (cmd === "clear") {
      setLogLines([]);
      setCmdText("");
      return;
    }
  
    try {
      const res = await transcoderService.execTerminal({
        host: selectedTranscoderIp,
        systemName: systemForm.systemName,
        passWord: systemForm.password,
        command: cmd,
        deviceType: "transcoder"
      });

      const output = (res.stdout || res.stderr || "No output");
      const status = res.status || "success";
  
      const outputLines = output
        .split(/\r?\n/)
        .flatMap(line => line.split(/\s+/))
        .filter(Boolean);
  
      setLogLines(prev => [
        ...prev,
        { type: "$", text: `$: ${cmd}` },
        { type: "output", text: outputLines },
        { type: "status", text: `(${status})` }
      ]);
    } catch (err) {
      setLogLines(prev => [
        ...prev,
        { type: "$", text: `$: ${cmd}` },
        { type: "output", text: [`Error: ${err.message}`] },
        { type: "status", text: "(error)" }
      ]);
    }
  
    setCmdText("");
  };

  const handlePush = async (row, index) => {
    try {
      setDeviceTableData(prev =>
        prev.map((r, i) =>
          i === index ? { ...r, status: FIRMWARE_STATUS.PUSHING } : r
        )
      );
  
      const filePath = await transcoderService.getFirmwareFilePath(row.filename);
  
      await transcoderService.copyFirmwareToDevice({
        source_path: filePath,
        host: selectedTranscoderIp,
        // systemName: systemForm.systemName,
        // passWord: systemForm.password,
        deviceType: "transcoder",
      });
  
      await transcoderService.setCurrentFirmware(selectedTranscoderIp, row.filename);
  
      const currentFirmwareResp = await transcoderService.getCurrentFirmware(selectedTranscoderIp);
      const currentFirmware = currentFirmwareResp?.current_firmware ?? currentFirmwareResp;
  
      const isSame = currentFirmware === row.filename;
  
      setDeviceTableData(prev =>
        prev.map((r, i) => {
          if (i === index) {
            return {
              ...r,
              status: isSame ? FIRMWARE_STATUS.CURRENT : FIRMWARE_STATUS.UPGRADED
            };
          }
          return r;
        })
      );
      // await transcoderService.setCurrentFirmware(selectedTranscoderIp, row.filename);

      await fetchFirmwareList();
  
      alert("Firmware pushed and set as current!");
  
    } catch (err) {
      console.error(err);
      setDeviceTableData(prev =>
        prev.map((r, i) =>
          i === index ? { ...r, status: FIRMWARE_STATUS.FAILED } : r
        )
      );
      alert("Firmware push failed");
    }
  };

  const [showTroubleshoot, setShowTroubleshoot] = useState(false);
const [troubleStep, setTroubleStep] = useState(1);

const deviceRef = useRef(null);

useEffect(() => {
  deviceRef.current = selectedTranscoderIp || deviceIp;
}, [selectedTranscoderIp, deviceIp]);

const stopTranscoderSession = async () => {
  const device = deviceRef.current;

  if (!device) return;

  try {
    const res = await transcoderService.stopMediaTranscoder(device, "stop");
    console.log("Session stopped:", res);
  } catch (err) {
    console.error("Failed to stop session:", err);
  }
};


const handleSaveConfiguration = async () => {
  const ip = location.state?.deviceInfo?.ip;
  try {
    if (changedSections.quad) {
      await transcoderService.quadAPICall(ip, transcoderStats.Quad);
    }

    if (changedSections.rtsp) {
      await transcoderService.rTSPAPICall(ip, transcoderStats.RTSPURL);
    }

    setChangedSections({ quad: false, rtsp: false });
     setCanApply(true);
  // const resp = await transcoderService.getTranscoderConfig(ip);

  //   setTranscoderStats(resp.data);
  //   console.log("Configuration saved successfully");
  } catch (error) {
    console.error("Save failed:", error);
  }
};


const handleApplyConfiguration = async () => {
  const ip = location.state?.deviceInfo?.ip;

  if (!ip) {
    console.error("IP not found");
    return;
  }

  try {
    const resp = await transcoderService.applyConfiguration(ip);
    console.log("Applied successfully:", resp);

    setCanApply(false);
  } catch (error) {
    console.error("Apply failed:", error);
  }
};

const handleRTSPChange = (cam, value) => {
  setTranscoderStats((prev) => ({
    ...prev,
    RTSPURL: {
       ...prev.RTSPURL,
      // [`${cam}.url`]: value
       [cam]: value
    }
  }));

  setChangedSections((prev) => ({ ...prev, rtsp: true }));
};
const handleQuadChange = (name, value) => {
  setTranscoderStats((prev) => ({
    ...prev,
    Quad: {
      ...prev.Quad,
      [name]: name === "bitrate" ? Number(value) * 1000 : value
    }
  }));

  setChangedSections((prev) => ({ ...prev, quad: true }));
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
      <div className="w-full max-w-[896px] max-h-[815px] min-w-[896px] min-h-[815px] mx-auto bg-card backdrop-blur-md rounded-2xl shadow-2xl p-5">

       <button
        onClick={async () => {
          await stopTranscoderSession();

          navigate("/stationview", {
            state: {
              selectedStation,
              deviceData
            }
          });
        }}
        className="mb-2 text-text hover:text-text font-semibold flex items-center gap-2"
      >
        <ArrowLeft size={20} /> Back to Station View
      </button>
        
        <div className="flex items-center gap-4">
         <h2 className="text-2xl text-text font-semibold mb-4">
          {isNewDevice && activeTab === "Firmware"
            ? "Firmware Installation"
            : `${type?.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase())}`}

          {(selectedTranscoderIp || config?.ipAddress) && (
            <span className="text-lg text-text ml-2">
              - {selectedTranscoderIp || config.ipAddress}
            </span>
          )}
        </h2>
          
          <div className="flex items-center gap-2">
          </div>
        </div>
        
        
        {isLoading && (
          <div className="mb-6 flex items-center justify-center py-8">
            <div className="text-center">
              <Loader size={32} className="animate-spin text-text mx-auto mb-2" />
              <p className="text-text text-sm">Loading device data...</p>
            </div>
          </div>
        )}
        <div className="flex border-b border-blue-700 mb-4">
        
           {tabs.map(tab => {
            const isDisabled = isNewDevice & !firmwareCompleted && tab.name !== 'Firmware';
            return (
              <button
                key={tab.name}
                disabled={isDisabled}
                onClick={() => setActiveTab(tab.name)}
                className={`flex items-center gap-2 px-6 py-3 font-semibold text-sm transition
                  ${activeTab === tab.name
                    ? 'text-text border-b-2 border-cyan-300'
                    : 'text-text border-b-2 border-transparent'
                  }
                  ${isDisabled
                    ? 'opacity-40 cursor-not-allowed'
                    : 'hover:text-text'
                  }
                `}
              >
                {tab.icon}
                {tab.name}
              </button>
            );
          })}
        </div>
    
        {activeTab === 'Configuration' && (
                    <>
                    <form className="flex gap-10" onSubmit={handleSave}>

                        <div className="w-1/3 p-4">
                            <div className="mx-auto text-center">

                                <label className="block text-text text-lg font-semibold mb-2">
                                    {isLoading ? "Loading..." : transcoderStats?.System?.device_name || "N/A"}
                                </label>

                                <label className="block text-text border border-blue-400 rounded-md text-sm mb-2">
                                    <i className="fas fa-arrow-up fa-1x"></i>{" "}
                                    {isLoading ? "Loading..." : transcoderStats?.System?.uptime || "N/A"}
                                </label>

                                <label className="block text-text mb-2">
                                    Temperature:{' '}
                                    {isLoading ? "Loading..." : transcoderStats?.System?.temperature || "N/A"}
                                </label>

                                <ul className='space-y-4'>
                                    <li className='flex items-center space-x-2 border-b border-cyan-300 pb-2'>
                                        <img src={deviceimage} alt="device" className="w-9"/>

                                        <div className='flex flex-col text-text'>
                                            <label className="text-text">NTP</label>

                                            <input
                                                className="rounded-md bg-input text-text px-2 py-1 border-none focus:ring-2 focus:ring-cyan-400 w-[120px]"
                                                name="ntp"
                                                value={transcoderStats?.System?.syslogip || ""}
                                                onChange={(e) =>
                                                    setTranscoderStats(prev => ({
                                                        ...prev,
                                                        System: { ...prev.System, syslogip: e.target.value }
                                                    }))
                                                }
                                                required
                                            />
                                             {/* <span className="rounded-md text-blue-100 px-2 py-1 border-none focus:ring-2 focus:ring-cyan-400 w-[120px]"
                                                >{transcoderStats?.System?.syslogip}</span> */}
                                        </div>
                                    </li>

                                    <li className='flex items-center space-x-2 border-b border-cyan-300 pb-2'>
                                        <img src={hardwareimage} alt="hardware" className="w-10" />
                                        <h6 className='flex flex-col text-text'>
                                            Hardware Version
                                            <span className='text-text'>{transcoderStats?.System?.hardware}</span>
                                        </h6>
                                    </li>

                                    <li className='flex items-center border-b border-cyan-300 pb-2'>
                                        <img src={firmWareimage} alt="firmware"  className='ml-2 w-9'/>
                                        <h6 className='flex flex-col text-text pl-2'>
                                            Firmware Version
                                            <span className='text-text'>{transcoderStats?.System?.firmware}</span>
                                        </h6>
                                    </li>
                                </ul>

                            </div>
                        </div>
                           <div class="w-2/3 flex flex-col gap-4 ">                     
                        <div className="gap-4">
                            <h1 className="text-text text-lg font-semibold mb-2">Quad</h1>

                            <div className="flex items-center gap-20 items-end mb-2">
                                <label className="text-text">Bitrate</label>
                                <input
                                    className="w-[185px] rounded-md bg-input text-text px-2 py-1"
                                    name="bitrate"
                                    value={transcoderStats.Quad.bitrate/1000}
                                    onChange={(e) => handleQuadChange("bitrate", e.target.value)}
                                    required
                                />
                            </div>

                            <div className="flex items-center gap-20 items-end mb-2">
                                <label className="text-text w-[52px]">Profile</label>
                                <input
                                    className="w-[185px] rounded-md bg-input text-text px-2 py-1"
                                    name="profile"
                                    value={transcoderStats.Quad.profile}
                                    onChange={(e) => handleQuadChange("profile", e.target.value)}
                                    required
                                />
                            </div>

                            <div className="flex items-center gap-20 items-end mb-2">
                                <label className="text-text w-[52px]">Xpos</label>
                                <input
                                    className="w-[185px] rounded-md bg-input text-text px-2 py-1"
                                    name="xpos"
                                    value={transcoderStats.Quad.xpos}
                                   onChange={(e) => handleQuadChange("xpos", e.target.value)}
                                    required
                                />
                            </div>

                            <div className="flex items-center gap-20 items-end mb-2">
                                <label className="text-text w-[52px]">Ypos</label>
                                <input
                                    className="w-[185px] rounded-md bg-input text-text px-2 py-1"
                                    name="ypos"
                                    value={transcoderStats.Quad.ypos}
                                    onChange={(e) => handleQuadChange("ypos", e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        <div className="gap-4">
                            <h1 className="text-text text-lg font-semibold mb-2">RTSPURL</h1>

                            <div className="flex items-center gap-[50px] items-end mb-2">
                                <label className="text-text w-24">Cam1URL</label>
                                <input
                                    className="rounded-md bg-input text-text px-2 py-1 w-[500px]"
                                    value={transcoderStats.RTSPURL["cam1.url"]}
                                   onChange={(e) => handleRTSPChange("cam1.url", e.target.value)}
                                    required
                                />
                            </div>

                            <div className="flex items-center gap-[50px] items-end mb-2">
                                <label className="text-text w-24">Cam2URL</label>
                                <input
                                    className="rounded-md bg-input text-text px-2 py-1 w-[500px]"
                                    value={transcoderStats.RTSPURL["cam2.url"]}
                                    onChange={(e) => handleRTSPChange("cam2.url", e.target.value)}
                                    required
                                />
                            </div>

                            <div className="flex items-center gap-[50px] items-end mb-2">
                                <label className="text-text w-24">Cam3URL</label>
                                <input
                                    className="rounded-md bg-input text-text px-2 py-1 w-[500px]"
                                    value={transcoderStats.RTSPURL["cam3.url"]}
                                    onChange={(e) => handleRTSPChange("cam3.url", e.target.value)}
                                    required
                                />
                            </div>

                            <div className="flex items-center gap-[50px] items-end mb-2">
                                <label className="text-text w-24">Cam4URL</label>
                                <input
                                    className="rounded-md bg-input text-text px-2 py-1 w-[500px]"
                                    value={transcoderStats.RTSPURL["cam4.url"]}
                                   onChange={(e) => handleRTSPChange("cam4.url", e.target.value)}
                                    required
                                />
                            </div>
                        </div>
                        
                        </div>
                       
                        </form>
                        <div className="flex justify-center gap-4 mt-4">
                          <div>
                          <button type="button" 
                           className={`bg-buttonSecondary from-cyan-400 to-blue-500 justify-end text-white font-semibold px-6 py-2 rounded-md shadow
                             ${!changedSections.quad && !changedSections.rtsp ? 'opacity-50 cursor-not-allowed' : ''}`}
                          onClick={handleSaveConfiguration}
                          disabled={!changedSections.quad && !changedSections.rtsp}
                          >
                            Save
                          </button>
                          </div>
                          <div>
                           <button type="button" 
                            className={`bg-buttonTertiary text-white font-semibold px-6 py-2 rounded-md shadow
                                        ${!canApply ? 'opacity-50 cursor-not-allowed' : ''}`}
                            onClick={handleApplyConfiguration}
                            disabled={!canApply}
                          >
                            Apply
                          </button>
                          </div>
                        </div>
                    </>
                                      )}

        {activeTab === "Connectivity" && (
                  <>
                      <div>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                              <div className="bg-buttonPrimary rounded-xl p-6 flex flex-col items-start relative">
                                <div className="text-text text-sm mb-2">Temperature</div>
                                <div className="text-2xl font-bold text-text">{transcoderMonitoring.temperature} c</div>
                                {isBackendConnected && sessionId && (
                                  <div className="absolute top-2 right-2 w-2 h-2 bg-green-400 rounded-full animate-pulse" title="Live Data" />
                                )}
                              </div>

                            <div className="bg-buttonPrimary rounded-xl p-6 flex flex-col items-start relative">
                              <div className="text-text text-sm mb-2">CPU</div>
                              <div className="text-2xl font-bold text-text">{transcoderMonitoring.cpu}%</div>
                              {isBackendConnected && sessionId && (
                                <div className="absolute top-2 right-2 w-2 h-2 bg-green-400 rounded-full animate-pulse" title="Live Data" />
                              )}
                            </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                        <div className="bg-buttonPrimary rounded-xl p-6 flex flex-col items-start relative">

                        <div className="flex w-full justify-between mb-2">
            <div className="text-text text-sm">Cam 1</div>
            <div className="text-green-600 text-sm">Up</div>
          </div>
                         
                          {isBackendConnected && sessionId && (
                            <div className="absolute top-2 right-2 w-2 h-2 bg-green-400 rounded-full animate-pulse" title="Live Data" />
                          )}
                        </div>
                        <div className="bg-buttonPrimary rounded-xl p-6 flex flex-col items-start relative">

                        <div className="flex w-full justify-between mb-2">
            <div className="text-text text-sm">Cam 2</div>
            <div className="text-green-600 text-sm">Up</div>
          </div>
                         
                          {isBackendConnected && sessionId && (
                            <div className="absolute top-2 right-2 w-2 h-2 bg-green-400 rounded-full animate-pulse" title="Live Data" />
                          )}
                        </div>

                        <div className="bg-buttonPrimary rounded-xl p-6 flex flex-col items-start relative">

        <div className="flex w-full justify-between mb-2">
        <div className="text-text text-sm">Cam 3</div>
        <div className="text-green-600 text-sm">Up</div>
        </div>
        
          {isBackendConnected && sessionId && (
            <div className="absolute top-2 right-2 w-2 h-2 bg-green-400 rounded-full animate-pulse" title="Live Data" />
          )}
        </div>

        <div className="bg-buttonPrimary rounded-xl p-6 flex flex-col items-start relative">

        <div className="flex w-full justify-between mb-2">
        <div className="text-text text-sm">Cam 4</div>
        <div className="text-green-600 text-sm">Up</div>
        </div>
         
          {isBackendConnected && sessionId && (
            <div className="absolute top-2 right-2 w-2 h-2 bg-green-400 rounded-full animate-pulse" title="Live Data" />
          )}
        </div>
                      </div>

                      {/* Network Performance Charts */}
                  <div className="bg-buttonPrimary rounded-xl p-6 mt-4">
                    <div className="text-text mb-3 font-semibold flex items-center gap-2">
                      Network Performance
                      {isBackendConnected && sessionId ? (
                        <span className="text-xs text-green-400">(Live from device · 1s)</span>
                      ) : (
                        <span className="text-xs text-text">(Simulated · 1s)</span>
                      )}
                    </div>
                    <div className="gap-6">
                      <div className="h-56 bg-text rounded-lg p-2 mt-4">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={transcoderChartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1e3a8a" />
                            <XAxis dataKey="t" tick={{ fill: '#93c5fd', fontSize: 12 }}/>
                            <YAxis tick={{ fill: '#93c5fd', fontSize: 12 }} domain={[0, 'auto']} />
                            <Tooltip contentStyle={{ background: '#0b1220', border: '1px solid #1e3a8a', color: '#e2e8f0' }} />
                            <Legend wrapperStyle={{ color: '#93c5fd' }} />
                            <Line type="monotone" dataKey="tx" stroke="#f59e0b" strokeWidth={2} dot={false} name="TX (Kbps)" isAnimationActive={false} />
                            <Line type="monotone" dataKey="rx" stroke="#60a5fa" strokeWidth={2} dot={false} name="RX (Kbps)" isAnimationActive={false}/>
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                    </div>
                    <div className='flex justify-center mt-6'>
                    <button
                    type="button"
                    onClick={() =>{
                      navigate("/transcoder/troubleshoot", {
                        state: {
                          activeTab: "Connectivity",
                          ip: selectedTranscoderIp || config.ipAddress,
                          deviceName: transcoderStats?.System?.device_name,
                           selectedStation,
                           deviceData
                        },
                      })
                    }
                    }
                    className="bg-buttonPrimary from-cyan-400 to-blue-500
                              text-white font-semibold px-6 py-2 rounded-md shadow"
                  >
                    Troubleshoot
                  </button>
                      </div>

                

                  </>
                )}

        {activeTab === 'Firmware' && (
          <div>

            <div className="bg-buttonPrimary rounded-xl p-6 mb-8">
            <div className="min-w-full">
                 <div className="bg-white/10 backdrop-blur-md border border-buttonPrimary rounded-2xl overflow-x-auto">
                   <div className="">
                     <table className="min-w-full text-left">
                       <thead>
                         <tr className="bg-blue-900/40 text-text text-sm tracking-wider font-medium">
                         <th className="px-6 py-3 text-sm "></th>
                           <th className="px-6 py-3 text-sm ">File Name</th>
                           <th className="px-6 py-3 text-sm ">Firmware Version</th>
                           <th className="px-6 py-3  text-sm text-center">Status</th>
                         </tr>
                       </thead>


                          <tbody>
                        {deviceTableData.length ? (
                          deviceTableData.map((row, i) => {
                            const isSelected = selectedRows.some(
                              item => item.filename === row.filename
                            );

                            const isBusy =
                              row.status === FIRMWARE_STATUS.DOWNLOADING ||
                              row.status === FIRMWARE_STATUS.PUSHING ||
                              row.status === FIRMWARE_STATUS.UPGRADING;

                            return (
                              <tr
                                key={i}
                                className="border-t border-buttonPrimary hover:bg-white/5 transition"
                              >
                                <td className="px-6 py-4 text-center">
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    disabled={isBusy}
                                    onChange={() => handleCheckboxToggle(row)}
                                    className="w-4 h-4 accent-blue-600 cursor-pointer disabled:opacity-50"
                                  />
                                </td>

                                <td className="px-6 py-4 text-text text-sm font-medium">
                                  {row.filename}
                                </td>

                                <td className="px-6 py-4 text-text text-sm">
                                  {row.firmware || "N/A"}
                                </td>

                                <td className="px-6 py-4 text-center">
                                  {row.status === FIRMWARE_STATUS.DOWNLOAD && (
                                    <button
                                      onClick={() => handlePushFirmware(row.filename, i)}
                                      className="px-4 py-1.5 rounded-full text-sm font-semibold text-text bg-blue-600 hover:bg-blue-700"
                                    >
                                      Download
                                    </button>
                                  )}

                                  {row.status === FIRMWARE_STATUS.DOWNLOADING && (
                                    <span className="inline-flex items-center gap-2 bg-gray-400/20 text-gray-200 px-3 py-1 rounded-full">
                                      Downloading...
                                    </span>
                                  )}

                                  {row.status === FIRMWARE_STATUS.READY && isNewDevice && (
                                    <button
                                      disabled={!isSelected || isBusy || row.status === FIRMWARE_STATUS.CURRENT}
                                      onClick={() => handlePush(row, i)}
                                      className={`px-4 py-1.5 rounded-full text-sm font-semibold text-white ${
                                        isSelected && !isBusy
                                          ? "bg-blue-600 hover:bg-blue-700"
                                          : "bg-gray-500 cursor-not-allowed"
                                      }`}
                                    >
                                      Push
                                    </button>
                                  )}

                                  {row.status === FIRMWARE_STATUS.READY && !isNewDevice && (
                                    <button
                                      disabled={!isSelected || isBusy}
                                      onClick={() => handleFirmwareUpgrade(row, i)}
                                      className={`px-4 py-1.5 rounded-full text-sm font-semibold text-white ${
                                        isSelected && !isBusy
                                          ? "bg-blue-600 hover:bg-blue-700"
                                          : "bg-gray-500 cursor-not-allowed"
                                      }`}
                                    >
                                      Upgrade
                                    </button>
                                  )}

                                  

                                  {row.status === FIRMWARE_STATUS.PUSHING && (
                                    <span className="inline-flex items-center gap-2 bg-gray-400/20 text-gray-200 px-3 py-1 rounded-full">
                                      Pushing...
                                    </span>
                                  )}


                              {row.status === FIRMWARE_STATUS.UPGRADING && upgradingRowIndex === i && (
                                <div className="flex flex-col items-center gap-2">
                                  <span className="px-4 py-1.5 rounded-full text-sm font-semibold bg-yellow-400/20 text-yellow-300">
                                    Upgrading… {upgradePercent}%
                                  </span>

                                  <div className="w-full max-w-[140px] bg-gray-300 rounded-full h-2">
                                    <div
                                      className="bg-green-400 h-2 rounded-full transition-all duration-300 ease-out"
                                      style={{ width: `${upgradePercent}%` }}
                                    />
                                  </div>
                                </div>
                              )}



                                  {row.status === FIRMWARE_STATUS.EXISTS && (
                                    <span className="text-green-300 px-3 py-1">
                                      Already Exists
                                    </span>
                                  )}

                                  {row.status === FIRMWARE_STATUS.CURRENT && (
                                    <span className="text-green-400 font-semibold px-3 py-1">
                                      Current
                                    </span>
                                  )}

                                  {row.status === FIRMWARE_STATUS.UPGRADED && (
                                    <span className="text-blue-200 px-3 py-1 rounded-full bg-blue-900/30">
                                      Upgraded
                                    </span>
                                  )}

                                  {row.status === FIRMWARE_STATUS.FAILED && (
                                    <span className="text-red-400 px-3 py-1 rounded-full bg-red-900/30">
                                      Failed
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
                      style={{ background: '#0f172a' }}
                      >
                      {upgradeLogs.length === 0 ? (
                        <div className="text-blue-300 text-center py-4">
                          Waiting for logs…
                        </div>
                      ) : (
                        upgradeLogs.map((log, idx) => (
                          <div key={idx} className="text-blue-100 text-sm px-3 py-2 border-b border-white/10">
                            {log}
                          </div>
                        ))
                      )}
                      </div>
                      </div>
                </div>
          </div>
        )}

        {activeTab === 'Logs' && (
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
              <div className="text-text text-center py-8">No logs available.</div>
            ) : (
              <div>
                <div
                  className="max-h-[50vh] overflow-auto rounded-md"
                  ref={activeTab === "Logs" ? logsContainerRef : null}
                  onScroll={activeTab === "Logs" ? handleLogsScroll : undefined}
                  style={{ background: "#0f172a" }}
                >
                  {logs.map((log, idx) => (
                    <div
                      key={idx}
                      className="font-mono text-sm mb-1 px-2 rounded break-all text-white"
                    >
                      {log.message}
                    </div>
                  ))}
                  <div ref={activeTab === "Logs" ? logsEndRef : null} />
                </div>
              </div>
            )}
          </div>
          </div>
        )}
    {showTroubleshoot && <TroubleshootTranscoder onClose={() => setShowTroubleshoot(false)} />}

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

export default TranscoderSummary;