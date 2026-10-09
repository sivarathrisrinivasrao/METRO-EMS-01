import React, { useEffect,useState,useRef, use} from 'react';
import { ArrowLeft, Settings, Activity, UploadCloud, FileText, Trash2, Download, AlertCircle, CheckCircle, Loader, RefreshCcw, SettingsIcon } from 'lucide-react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { apiService } from '../services/apiService';
import {obcService} from '../services/obcService'
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
import TroubleshootObc from './ObcTroubleShoot';
import SettingsPanel from './setting';

const tabs = [
  { name: 'Configuration', icon: <Settings size={18} /> },
  { name: 'Connectivity', icon: <Activity size={18} /> },
  { name: 'Firmware', icon: <UploadCloud size={18} /> },
  { name: 'Logs', icon: <FileText size={18} /> },
];

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

const initialConfig = {
  systemName: '',
  ipAddress: '',
  ssid: '',
  bandwidth: '',
  channel: '',
  radioMode: '',
};

const ObcSummary = () => {
  const fileRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [config, setConfig] = useState(initialConfig);
  const [monitoring, setMonitoring] = useState({
      signal: "",
      snr: "",
      tx:"",
      rx: "",
    });
  const [obcChartData, setObcChartData] = useState([]);
  const [obcMonitoring, setObcMonitoring] = useState({
    tx: 0,
    rx: 0,
  });
  const obcPrevRef = useRef({ tx: 0, rx: 0 });
   

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
  const [isObcLoading, setIsObcLoading] = useState(false);
  const [canApply, setCanApply] = useState(false);
  
  // const deviceIp = config.ipAddress;
const fileInputRef = useRef(null); 
  const [selectedFilePatch, setSelectedFilePatch] = useState(null); 
  const [setPatchResponse, setSetPatchResponse] = useState(null);

  const [obcStats, setObcStats] = useState({
    Network: {
      carnumber: '',
      encoderip: '',
      ntpserverip: '',
      trainradioip: '',
      ftpserverip: '',
      ftpusername: '',
      ftppassword: '',  
      monitor: '',
      obcnetgway:'',
      obcnetip: '',
      obcnetmask: '',
    },
    System: {
      uptime: ''
    }
  });
  const [obcDisk,setObcDisk] = useState({
    Disk :{
      total:'',
      free:'',
      used:'',
      percentage:''
    }

  })
  const [showAll, setShowAll] = useState(false);
  

  const navigate = useNavigate();
  const { type } = useParams();
  const location = useLocation();
  const navState = location.state || {};
  const deviceIp = location?.state?.deviceInfo?.ip

const trainId = location.state?.trainId;
const discoveredDevices = location.state?.discoveredDevices;

  const isNewDevice = navState.isNewDevice || false;
  const [activeTab, setActiveTab] = useState(navState.activeTab ||'Configuration');
  const { deviceInfo, sessionId = null } = location.state || {};
  const [firmwareCompleted, setFirmwareCompleted] = useState(false)
  const [deviceTableData, setDeviceTableData] = useState([]); 
  const [firmwareList, setFirmwareList] = useState([])
  const [firmwareResponse, setFirmwareResponse] = useState(false);
  const [selectedRows, setSelectedRows] = useState([]);
  const [systemForm, setSystemForm] = useState(
        location.state?.systemForm || { systemName: "", password: "" }
      );
  const [selectedObcIp, setSelectedObcIp] = useState(location.state?.ip || "");
  const [upgradeLogs, setUpgradeLogs] = useState([]);
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [upgradeProgress, setUpgradeProgress] = useState(0);
  const [upgradePercent, setUpgradePercent] = useState(0);
  const [upgradingRowIndex, setUpgradingRowIndex] = useState(null);
  const [currentFirmware, setCurrentFirmware] = useState("");

  const [loadingLogs, setLoadingLogs] = useState(false);
  // const [loadingBackup, setLoadingBackup] = useState(false);

  const [loadingCurrent, setLoadingCurrent] = useState(false);
const [loadingBackup, setLoadingBackup] = useState(false);
 const [showSettings, setShowSettings] = useState(false);


      useEffect(() => {
        if (location.state?.activeTab) {
          setActiveTab(location.state.activeTab);
        }
      }, [location.state]);

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
        const connected = await obcService.checkBackendConnection();
        setIsBackendConnected(connected);
        
        // If we have a session ID, load the device session
        if (connected && sessionId) {
          try {
            const session = await obcService.getDeviceSession(sessionId);
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
            const deviceConfig = await obcService.getDeviceConfiguration(sessionId);
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

  const handleSave = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
  
    try {
      let payloadToSave;
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

  // useEffect(() => {
  //   if (activeTab !== "Configuration") return;
  
  //   const fetchConfig = async () => {
  //     try {
  //       setIsLoading(true);
  //       const resp = await obcService.getObcConfig(deviceIp);
  //       const cfg = resp.config ? JSON.parse(resp.config) : resp;
  //       setConfig(cfg);
  //     } catch (err) {
  //       console.error(err);
  //       setError("Failed to load configuration");
  //     } finally {
  //       setIsLoading(false);
  //     }
  //   };
  
  //   if (deviceIp) fetchConfig();
  // }, [activeTab, deviceIp]);
  

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

  // Live logs polling for Monitoring and Logs tabs
  // useEffect(() => {
  //   if ((activeTab !== 'Logs')) return;
  //   let cancelled = false;

  //   const fetchLogs = async () => {
  //     if (isBackendConnected && sessionId) {
  //       try {
  //         const newLogs = await obcService.getCurrentLogs(sessionId);
  //         if (!cancelled && Array.isArray(newLogs)) {
  //           // Normalize possible shapes
  //           const normalized = newLogs.map(l => ({
  //             time: l.time || l.timestamp || new Date().toISOString(),
  //             type: l.type || l.level || 'INFO',
  //             message: l.message || l.msg || ''
  //           }));
  //           // Merge by time+message (simple de-dup)
  //           setLogs(prev => {
  //             const seen = new Set(prev.map(p => `${p.time}|${p.message}`));
  //             const merged = [...prev];
  //             for (const n of normalized) {
  //               const key = `${n.time}|${n.message}`;
  //               if (!seen.has(key)) merged.push(n);
  //             }
  //             // Keep last 500 logs
  //             return merged.length > 500 ? merged.slice(merged.length - 500) : merged;
  //           });
  //         }
  //       } catch (e) {
  //         // ignore transient errors
  //       }
  //     } 
  //     else {
  //       // In demo, append a synthetic log periodically
  //       const now = new Date();
  //       // setLogs(prev => {
  //       //   const demo = {
  //       //     time: `[${now.toLocaleString()}]` ,
  //       //     type: Math.random() < 0.1 ? 'WARN' : 'INFO',
  //       //     message: Math.random() < 0.5 ? 'Periodic health check OK' : 'Monitoring tick update'
  //       //   };
  //       //   const arr = [...prev, demo];
  //       //   return arr.length > 200 ? arr.slice(arr.length - 200) : arr;
  //       // });
  //     }
  //   };

  //   // Initial call and interval setup
  //   fetchLogs();
  //   const id = setInterval(fetchLogs, 1000);
  //   return () => { cancelled = true; clearInterval(id); };
  // }, [activeTab, isBackendConnected, sessionId]);

const loadLogs = async (type = "current") => {
  if (!deviceIp) return;

  try {
    setLoadingLogs(true);

    let logsData;

    if (type === "backup") {
      logsData = await obcService.getBackupLogs(deviceIp);
    } else {
      logsData = await obcService.getCurrentLogs(deviceIp);
    }

    setLogs(normalizeLogs(logsData));
  } catch (error) {
    console.error("Failed to load logs:", error);
  } finally {
    setLoadingLogs(false);
  }
};

const normalizeLogs = (logs) => {
  if (!Array.isArray(logs)) return [];

  return logs.map(line => {
    if (typeof line === "string") {
      const match = line.match(/^\[(.*?)\]\s+\[(.*?)\]\s+(INFO|ERROR|WARN):\s+(.*)$/);

      if (match) {
        return {
          time: match[1],
          type: match[3],
          message: match[4]
        };
      }

      return {
        time: "",
        type: "INFO",
        message: line
      };
    }

    return line;
  });
};

useEffect(() => {
  if (activeTab !== "Logs") return;
  if (!deviceIp) return;

  loadLogs("current");
}, [activeTab, deviceIp]);


  useEffect(() => {
  if (activeTab !== "Logs") return;
  if (!deviceIp) return;

  const fetchLogs = async () => {
    const logs = await obcService.getCurrentLogs(deviceIp);

    console.log("Current logs:", logs);

    if (Array.isArray(logs)) {
      const parsed = logs.map(line => {
        if (typeof line === "string") {
          const match = line.match(/^\[(.*?)\]\s+\[(.*?)\]\s+(INFO|ERROR|WARN):\s+(.*)$/);

          if (match) {
            return {
              time: match[1],
              type: match[3],
              message: match[4]
            };
          }

          return {
            time: "",
            type: "INFO",
            message: line
          };
        }

        return line;
      });

      setLogs(parsed);
    }
  };

  fetchLogs();
}, [activeTab, deviceIp]);

const handleCurrentLogs = async () => {
  if (!deviceIp) return;

  try {
    setLoadingCurrent(true);

    const logsData = await obcService.getCurrentLogs(deviceIp);
      const parsed = normalizeLogs(logsData);
       setLogs(parsed);
    // setLogs(normalizeLogs(logsData));

  } catch (error) {
    console.error(error);
  } finally {
    setLoadingCurrent(false);
  }
};


const handleBackupLogs = async () => {
  if (!deviceIp) return;

  try {
    setLoadingBackup(true);

    const logsData = await obcService.getBackupLogs(deviceIp);
     const parsed = normalizeLogs(logsData);
       setLogs(parsed);
    // setLogs(normalizeLogs(logsData));

  } catch (error) {
    console.error(error);
  } finally {
    setLoadingBackup(false);
  }
};


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

   useEffect(() => {
      if (location.state?.deviceInfo?.ip) {
        setConfig(prev => ({
          ...prev,
          ipAddress: location.state.deviceInfo.ip,
          systemName: location.state.deviceInfo.name || prev.systemName,
        }));
        setSelectedObcIp(location.state.deviceInfo.ip);
      }
    }, [location.state]);

  useEffect(() => {
      const ip = location.state?.deviceInfo?.ip;
      if (ip) {
        setConfig(prev => ({ ...prev, ipAddress: ip }));
        setSelectedObcIp(ip);
      }
    }, []);
    

  const obcFetchedRef = useRef(new Set());


   const getObcConfig = async (ip, options = {}) => {
      const res = await fetch(`/api/obc/${ip}`, {
        method: "GET",
        signal: options.signal,
      });

      return res.json();
      };
  

  useEffect(() => {
    if (activeTab !== "Configuration") return;
    if (!deviceIp) return;

      const controller = new AbortController();
    const signal = controller.signal;

  
    // if (obcFetchedRef.current.has(deviceIp)) return;
    // obcFetchedRef.current.add(deviceIp);
  
    // let cancelled = false;

    const fetchObcStats = async () => {
      try {
        setIsObcLoading(true);
        setError(null);
  
        // const data = await obcService.getObcConfig(deviceIp);
        const data = await obcService.getObcConfig(deviceIp, { signal });
        console.log("OBC RAW:", data);
  
        if (!data?.config) throw new Error("Empty config");
  
        const parsedConfig =
          typeof data.config === "string"
            ? JSON.parse(data.config)
            : data.config;
  
        // if (!cancelled) {
          setObcStats({
            Network: {
            carnumber: parsedConfig.carnumber ?? "N/A",
            encoderip: parsedConfig.encoderip ?? "N/A",
            ntpserverip: parsedConfig.ntpserverip ?? "N/A",
            trainradioip: parsedConfig.trainradioip ?? "N/A",
            ftpserverip: parsedConfig.ftpserverip ?? "N/A",
            ftpusername: parsedConfig.ftpusername ?? "N/A",
            ftppassword: parsedConfig.ftppassword ?? "N/A",
            monitor: parsedConfig.monitor ?? "N/A",
            obcnetgway:parsedConfig.obcnetgway ?? "N/A",
            obcnetip: parsedConfig.obcnetip ?? "N/A",
            obcnetmask: parsedConfig.obcnetmask ?? "N/A",
            },
            System: {
              uptime: data.uptime ?? "N/A",
            }
          });
        // }
      } catch (err) {
      if (err.name !== "AbortError") {
        console.error("OBC FETCH FAILED:", err);
        setError(err.message);
      }
    } finally {
      setIsObcLoading(false);
    }
      // catch (err) {
      //   console.error("OBC FETCH FAILED:", err);
      //   if (!cancelled) setError(err.message);
      // } finally {
      //   if (!cancelled) setIsObcLoading(false);
      // }
    };
  
    fetchObcStats();
     return () => {
    controller.abort();   // 🔥 Cancels API when tab changes
  };
  
    // return () => {
    //   cancelled = true;
    // };
}, [deviceIp,activeTab]);


useEffect(()=>{
  if (activeTab !== "Configuration") return;
    if (!deviceIp) return;

      const controller = new AbortController();
    const signal = controller.signal;

  

    const fetchObcDisk = async () => {
      try {
        setIsObcLoading(true);
        setError(null);
  
        const data = await obcService.getObcDisk(deviceIp, { signal });
        console.log("OBC RAW:", data);
  

  
        // if (!cancelled) {
          setObcDisk({
           Disk :{
              total: data.total || 'N/A',
              free:data.free || 'N/A',
              used:data.used || 'N/A',
              percentage:data.percentage || 'N/A'
            }
          });
        // }
      } catch (err) {
      if (err.name !== "AbortError") {
        // console.error("OBC FETCH FAILED:", err);
        setError(err.message);
      }
    } finally {
      setIsObcLoading(false);
    }
    };
  
    fetchObcDisk();
     return () => {
    controller.abort();   // 🔥 Cancels API when tab changes
  };
  
}, [deviceIp,activeTab]);


  useEffect(() => {
    if (activeTab !== "Connectivity") return;
    // if (!deviceIp) return;

    const ip = selectedObcIp || config.ipAddress;
   if (!ip) return;
  
    const intervalSec = 1;
  
    const updateMonitoring = async () => {
      try {
        const netstats = await obcService.getObcNetstats(ip);
  
        let txKbps = 0;
        let rxKbps = 0;
  
        if (obcPrevRef.current.tx > 0) {
          txKbps = ((netstats.tx_bytes - obcPrevRef.current.tx) * 8) / 1000;
          rxKbps = ((netstats.rx_bytes - obcPrevRef.current.rx) * 8) / 1000;
        }
  
        obcPrevRef.current = {
          tx: netstats.tx_bytes,
          rx: netstats.rx_bytes
        };
  
        setObcMonitoring({
          tx: txKbps.toFixed(2),
          rx: rxKbps.toFixed(2)
        });
  
        setObcChartData(prev => {
          const t = new Date();
          const point = {
            t: t.toLocaleTimeString(),
            tx: txKbps.toFixed(2),
            rx: rxKbps.toFixed(2)
          };
          const arr = [...prev, point];
          return arr.length > MAX_POINTS ? arr.slice(-MAX_POINTS) : arr;
        });
  
      } catch (err) {
        console.warn("OBC netstats error", err);
      }
    };
  
    updateMonitoring();
    const interval = setInterval(updateMonitoring, intervalSec * 1000);
    return () => clearInterval(interval);
  
  }, [activeTab, selectedObcIp, config.ipAddress]);


//   useEffect(() => {
//   if (activeTab !== "Connectivity") return;

//   const ip = selectedObcIp || config.ipAddress;
//   if (!ip) return;

//   const intervalSec = 1;
//   let interval;

//   const initConnectivity = async () => {
//     try {
//       const obcConfig = await obcService.getObcConfig(ip);
//       console.log("OBC Config:", obcConfig);

//       const updateMonitoring = async () => {
//         try {
//           const netstats = await obcService.getObcNetstats(ip);

//           let txKbps = 0;
//           let rxKbps = 0;

//           if (obcPrevRef.current.tx > 0) {
//             txKbps = ((netstats.tx_bytes - obcPrevRef.current.tx) * 8) / 1000;
//             rxKbps = ((netstats.rx_bytes - obcPrevRef.current.rx) * 8) / 1000;
//           }

//           obcPrevRef.current = {
//             tx: netstats.tx_bytes,
//             rx: netstats.rx_bytes
//           };

//           setObcMonitoring({
//             tx: txKbps.toFixed(2),
//             rx: rxKbps.toFixed(2)
//           });

//           setObcChartData(prev => {
//             const t = new Date();
//             const point = {
//               t: t.toLocaleTimeString(),
//               tx: txKbps.toFixed(2),
//               rx: rxKbps.toFixed(2)
//             };

//             const arr = [...prev, point];
//             return arr.length > MAX_POINTS ? arr.slice(-MAX_POINTS) : arr;
//           });

//         } catch (err) {
//           console.warn("OBC netstats error", err);
//         }
//       };

//       updateMonitoring();

//       interval = setInterval(updateMonitoring, intervalSec * 1000);

//     } catch (err) {
//       console.warn("OBC config error", err);
//     }
//   };

//   initConnectivity();

//   return () => {
//     if (interval) clearInterval(interval);
//   };

// }, [activeTab, selectedObcIp, config.ipAddress]);

useEffect(() => {
    if (isNewDevice) {
      setActiveTab('Firmware');
      setLogLines([]);
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
    if (activeTab === "Firmware") {
      fetchFirmwareList({ action: "list" });
      setLogLines([]);
    }
  }, [activeTab, selectedObcIp, config.ipAddress]);
  

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
 
  const fetchFirmwareList = async ({ action = "list", row = null } = {}) => {
    try {

      const resp = await obcService.getFirmwareList();
      const files = resp?.files || resp || [];
      const obcFiles = files.filter(f => f.device_type === "obc");

      let tableData = obcFiles.map(file => ({
        filename: file.actualName || file.file_name,
        firmware: file.version,
        status: normalizeStatus(file.status),
      }));

      setDeviceTableData(tableData);

      if (action === "set" && row && selectedObcIp) {
        setDeviceTableData(prev =>
          prev.map(r =>
            r.filename === row.filename
              ? { ...r, status: FIRMWARE_STATUS.UPGRADING }
              : r
          )
        );

        await obcService.setCurrentFirmware(selectedObcIp, row.filename);
      }
      if (!isNewDevice && selectedObcIp) {
        const currentFw = await obcService.getCurrentFirmware(selectedObcIp);
        setCurrentFirmware(currentFw);

        setDeviceTableData(prev =>
          prev.map(r => ({
            ...r,
            status:
              r.firmware === currentFw
                ? FIRMWARE_STATUS.CURRENT
                : r.status,
          }))
        );
    }

    } catch (err) {
      console.error("Firmware flow failed", err);
    }
  };

  const handlePushFirmware = async (filename, index) => {
      try {
        setDeviceTableData(prev =>
          prev.map((row, i) =>
            i === index ? { ...row, status: FIRMWARE_STATUS.DOWNLOADING } : row
          )
        );
    
        const alreadyExists = await obcService.pushFirmware(filename);
    
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
    uploaded: 75,
    upgrade_started: 100,
    error: 0
  };
  

  // const handleFirmwareUpgrade = async (row, index) => {
  //   if (!row || !row.filename) return alert("Firmware row missing!");
  //   if (!selectedObcIp) return alert("Please select OBC IP first!");
  
  //   let currentEvent = null;
  //   let upgradeStarted = false;
  
  //   try {
  //     setIsUpgrading(true);
  //     setUpgradingRowIndex(index);
  //     setUpgradePercent(0);
  
  //     setUpgradeLogs(["Waiting for status..."]);
  
  //     setDeviceTableData(prev =>
  //       prev.map((r, i) =>
  //         i === index ? { ...r, status: FIRMWARE_STATUS.UPGRADING } : r
  //       )
  //     );
  
  //     const filePath = await obcService.getFirmwareFilePath(row.filename);
  //     if (!filePath) throw new Error("Firmware file path not found");
  
  //     await obcService.copyFirmwareToDevice({
  //       source_path: filePath,
  //       host: selectedObcIp,
  //       // systemName: systemForm.systemName,
  //       // passWord: systemForm.password,
  //       deviceType: "obc"
  //     });
  
  //     setUpgradeLogs(["File copied to device"]);
  
  //     const stream = await obcService.firmwareUpgrade({
  //       ip: selectedObcIp,
  //       fileName: row.filename,
  //       // filePath,
  //       // address: selectedObcIp
  //     });
  
  //     const reader = stream.getReader();
  //     const decoder = new TextDecoder("utf-8");
  //     let buffer = "";
  
  //     while (true) {
  //       const { value, done } = await reader.read();
  //       if (done) break;
  
  //       buffer += decoder.decode(value, { stream: true });
  //       const lines = buffer.split("\n");
  //       buffer = lines.pop();
  
  //       for (let rawLine of lines) {
  //         const line = rawLine.trim();
  //         if (!line) continue;
  
  //         if (line.startsWith(":")) continue;
  
  //         if (line.startsWith("event:")) {
  //           currentEvent = line.replace("event:", "").trim();
  //           continue;
  //         }
  
  //         if (!line.startsWith("data:")) continue;
  
  //         const dataStr = line.replace("data:", "").trim();
  //         let statusText = "";
  
  //         try {
  //           const normalized = dataStr.replace(/'/g, '"');
  //           const parsed = JSON.parse(normalized);
  
  //           statusText =
  //             parsed?.raw?.status ||
  //             parsed?.status ||
  //             parsed?.message ||
  //             "";
  //         } catch {
  //           statusText = dataStr;
  //         }
  
  //         if (!statusText) continue;
  
  //         setUpgradeLogs([statusText]);
  
  //         const progress = STATUS_PROGRESS_MAP[currentEvent];
  //         if (progress !== undefined) setUpgradePercent(progress);
  
  //         if (currentEvent === "upgrade_started") {
  //           upgradeStarted = true;
  //           alert("Firmware upgrade initiated on device");
  //         }
  //       }
  //     }
  
  //     // if (upgradeStarted) {
  //     //   setUpgradePercent(100);
  
  //     //   const currentFw = await obcService.getCurrentFirmware(selectedObcIp);
  //     //   setCurrentFirmware(currentFw);
  
  //     //   setDeviceTableData(prev =>
  //     //     prev.map(r =>
  //     //       r.filename === row.filename
  //     //         ? { ...r, status: FIRMWARE_STATUS.CURRENT }
  //     //         : r
  //     //     )
  //     //   );
  
  //     //   setUpgradeLogs(["Upgrade completed successfully"]);
  //     // } else {
  //     //   setUpgradeLogs(["Upgrade ended without confirmation"]);
  //     // }
  
  //   } catch (err) {
  //     console.error(err);
  
  //     setDeviceTableData(prev =>
  //       prev.map((r, i) =>
  //         i === index ? { ...r, status: FIRMWARE_STATUS.FAILED } : r
  //       )
  //     );
  
  //     setUpgradeLogs([`Error: ${err.message}`]);
  //   } finally {
  //     setIsUpgrading(false);
  //     setUpgradingRowIndex(null);
  //   }
  // };

  const handleFirmwareUpgrade = async (row, index) => {
  if (!row || !row.filename) return alert("Firmware row missing!");
  if (!selectedObcIp) return alert("Please select OBC IP first!");

  try {
    setIsUpgrading(true);
    setUpgradingRowIndex(index);
    setUpgradePercent(50);
    setUpgradeLogs(["Firmware upgrade in progress..."]);

    setDeviceTableData(prev =>
      prev.map((r, i) =>
        i === index ? { ...r, status: FIRMWARE_STATUS.UPGRADING } : r
      )
    );

    const filePath = await obcService.getFirmwareFilePath(row.filename);
    if (!filePath) throw new Error("Firmware file path not found");

    await obcService.copyFirmwareToDevice({
      source_path: filePath,
      host: selectedObcIp,
      deviceType: "obc"
    });

    setUpgradeLogs(prev => [...prev, "File copied to device"]);

    const stream = await obcService.firmwareUpgrade({
      ip: selectedObcIp,
      fileName: row.filename,
    });

    const reader = stream.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    let upgradeSucceeded = false;

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop();

      for (let rawLine of lines) {
        const line = rawLine.trim();
        if (!line) continue;
        if (line.startsWith(":")) continue;

        if (line.startsWith("data:")) {
          const dataStr = line.replace("data:", "").trim();
          let statusText = "";

          try {
            const normalized = dataStr.replace(/'/g, '"');
            const parsed = JSON.parse(normalized);
            statusText =
              parsed?.raw?.status || parsed?.status || parsed?.message || "";
          } catch {
            statusText = dataStr;
          }

          if (!statusText) continue;

          setUpgradeLogs(prev => [statusText]);
        }

        if (line.includes("upgrade_completed") || line.includes("upgrade success")) {
          upgradeSucceeded = true;
        }
      }
    }

    if (upgradeSucceeded) {
      setUpgradePercent(100);
      // setUpgradeLogs(prev => [...prev, "Firmware upgrade completed successfully"]);
      setDeviceTableData(prev =>
        prev.map((r, i) =>
          i === index ? { ...r, status: FIRMWARE_STATUS.CURRENT } : r
        )
      );
      alert("Firmware upgraded successfully");
    } else {
      // setUpgradeLogs(prev => [...prev, "Firmware upgrade ended without confirmation"]);
      setDeviceTableData(prev =>
        prev.map((r, i) =>
          i === index ? { ...r, status: FIRMWARE_STATUS.FAILED } : r
        )
      );
      alert("Firmware upgrade failed");
    }

  } catch (err) {
    console.error(err);
    setUpgradeLogs([`Error: ${err.message}`]);
    setDeviceTableData(prev =>
      prev.map((r, i) =>
        i === index ? { ...r, status: FIRMWARE_STATUS.FAILED } : r
      )
    );
    setUpgradePercent(50);
    alert(err.message || "Firmware upgrade failed");
  } finally {
    setIsUpgrading(false);
    setUpgradingRowIndex(null);
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
  
      if (!selectedObcIp || !systemForm.systemName || !systemForm.password) {
        alert("Please enter IP + credentials first");
        return;
      }
    
      if (cmd === "clear") {
        setLogLines([]);
        setCmdText("");
        return;
      }
    
      try {
        const res = await obcService.execTerminal({
          host: selectedObcIp,
          systemName: systemForm.systemName,
          passWord: systemForm.password,
          command: cmd,
          deviceType: "obc"
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
    
        const filePath = await obcService.getFirmwareFilePath(row.filename);
    
        await obcService.copyFirmwareToDeviceScp({
          source_path: filePath,
          host: selectedObcIp,
          systemName: systemForm.systemName,
          passWord: systemForm.password,
          deviceType: "obc",
          status: "pushed",
        });
    
        setDeviceTableData(prev =>
          prev.map((r, i) =>
            i === index ? { ...r, status: FIRMWARE_STATUS.EXISTS } : r
          )
        );
    
        alert("Push success");
      } catch (err) {
        console.error("Push failed:", err);
    
        setDeviceTableData(prev =>
          prev.map((r, i) =>
            i === index ? { ...r, status: FIRMWARE_STATUS.FAILED } : r
          )
        );
    
        alert("Push failed: " + (err?.message || "Unknown error"));
      }
    };
    
    
  
    const FIRMWARE_STATUS = {
      DOWNLOAD: "download",
      DOWNLOADING: "downloading",
      READY: "ready",
      PUSHING: "pushing",
      UPGRADING: "upgrading",
      CURRENT: "current",
      EXISTS: "exists",
      UPGRADED: "upgraded",
      FAILED: "failed",
    };



      const [showTroubleshoot, setShowTroubleshoot] = useState(false);
      const [troubleStep, setTroubleStep] = useState(1);
    
    const serviceStatus = [
      { name: "OBC Service", status: "running" },
      { name: "OBC Agent", status: "running" },
    ];
    
    const cameraStatus = [
      { cam: "Train Radio", status: "working" },
      { cam: "NTP Server", status: "working" },
      { cam: "Encoder", status: "not reachable" },
    ];
    
    const logsData = [
      "[INFO] Obc started successfully",
      "[INFO] Obc Agent connection established",
      "[WARN] Encoder ping timeout",
    ];


  const handleFileChange = (e) => {
    setSelectedFilePatch(e.target.files[0]);
  };

  const handleAttachClick = () => {
    fileInputRef.current.click();
  };

  const handleUploadClick = async () => {
    if (!selectedFilePatch) return alert("Please select a file first!");
    const setPatch = await obcService.setPatchFile(selectedObcIp, selectedFilePatch);
    // setPatchResponse(setPatch);
    setSelectedFilePatch('')
    alert("Patch uploaded successfully!");
    console.log("Uploading:", setPatch);
  };


  const handleObcConfigChange = (name, value) => {
  setObcStats((prev) => ({
    ...prev,
    Network: {
      ...prev.Network,
      [name]: value
    }
  }));

};


const handleSaveConfiguration = async () => {
  const ip = location.state?.deviceInfo?.ip;
  try {
      await obcService.configSave(ip, obcStats.Network);

     setCanApply(true);
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
    const resp = await obcService.applyConfiguration(ip);
    console.log("Applied successfully:", resp);

    setCanApply(false);
  } catch (error) {
    console.error("Apply failed:", error);
  }
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
      <div className="w-full max-w-[896px] max-h-[825px] min-w-[896px] min-h-[825px] mx-auto bg-card backdrop-blur-md rounded-2xl shadow-2xl p-5">
        <button
            onClick={() =>
              navigate('/trainview', {
                state: {
                  trainId,
                  discoveredDevices
                }
              })
            }
            className="mb-2 text-text hover:text-text font-semibold flex items-center gap-2"
          >
            <ArrowLeft size={20} /> Back to Train View
          </button>
        <div className="flex items-center gap-4">
          {/* <h2 className="text-2xl text-white font-semibold mb-4">
          {isNewDevice && activeTab === "Firmware"
            ? "Firmware Installation"
            : `${type?.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase())}`}

          {(selectedObcIp || config?.ipAddress) && (
            <span className="text-lg text-blue-200 ml-2">
              - {selectedObcIp || config.ipAddress}
            </span>
          )}
        </h2> */}

        <h2 className="text-2xl text-text font-semibold mb-4">
  {isNewDevice && activeTab === "Firmware"
    ? "Firmware Installation"
    : `${type
        ?.replace(/-/g, " ")
        .replace(/\bobc\b/gi, "OBC")
        .replace(/\b\w/g, c => c.toUpperCase())}`}

  {(selectedObcIp || config?.ipAddress) && (
    <span className="text-lg text-text ml-2">
      - {selectedObcIp || config.ipAddress}
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
            const isDisabled =
              isNewDevice &&
              !firmwareCompleted &&
              tab.name !== 'Firmware';

            return (
              <button
              type='button'
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
                        <form className="flex gap-1" onSubmit={handleSave}>
                          <div className="w-1/3 p-2">

                            <div className="flex flex-col gap-4">
                                <div className="mx-auto text-center w-[150px]">

                                    <label className="block text-text text-lg font-semibold mb-2">
                                    Cab:{' '}
                                        {isLoading ? "Loading..." : obcStats?.Network?.carnumber|| "N/A"}
                                    </label>

                                    <label className="block text-text border border-blue-400 rounded-md text-sm mb-2 text-start">
                                        <i className="fas fa-arrow-up fa-1x"></i>{" "}
                                        {isLoading ? "Loading..." :obcStats.System.uptime || "N/A"}
                                    </label>
                                    <ul className='space-y-4 text-left'>
                                    <li className='flex items-center space-x-2 border-b border-cyan-300 pb-2 pl-3'>
                                      <h6 className='flex flex-col text-text'>
                                        IP
                                        <span className='text-text'> {isLoading ? "Loading..." : deviceIp|| "N/A"}</span>
                                      </h6>
                                    </li>

                                    <li className='flex items-center space-x-2 border-b border-cyan-300 pb-2 pl-3'>
                                      <h6 className='flex flex-col text-text'>
                                        Total
                                        <span className='text-text'>{obcDisk?.Disk?.total}</span>
                                      </h6>
                                    </li>

                                    <li className='flex items-center space-x-2 border-b border-cyan-300 pb-2 pl-3'>
                                      <h6 className='flex flex-col text-text'>
                                        Free
                                        <span className='text-text'>{obcDisk?.Disk?.free}</span>
                                      </h6>
                                    </li>

                                  <li className='flex items-center space-x-2 border-b border-cyan-300 pb-2 pl-3'>
                                    <h6 className='flex flex-col text-text'>
                                      Used
                                      <span className='text-text'>{obcDisk?.Disk?.used}</span>
                                    </h6>
                                  </li>

                                  <li className='flex items-center space-x-2 border-b border-cyan-300 pb-2 pl-3'>
                                    <h6 className='flex flex-col text-text'>
                                      Percentage
                                      <span className='text-text'>{obcDisk?.Disk?.percentage}</span>
                                    </h6>
                                  </li>
                                </ul>

                                </div>
                            </div>

                            <div className="md:col-span-2 flex justify-end mt-1 w-full">
                            </div>
                            </div>
                            <div className='w-2/3 p-4'>
                            <div>
                                     <div className="flex items-center gap-1 items-end mb-2">
                                <label className="text-text w-[182px]">Train Radio IP</label>
                                {/* <h6> <span className='text-blue-100'> {obcStats.Network.trainradioip}</span></h6> */}
                                <input
                                    className="w-[185px] rounded-md bg-input text-text px-2 py-1"
                                    name="trainradioip"
                                    value={obcStats.Network.trainradioip}
                                    onChange={(e) => handleObcConfigChange("trainradioip", e.target.value)}
                                    required
                                />
                            </div> 
                                <div className="flex items-center gap-1 items-end mb-2">
                                <label className="text-text w-[182px]">Encoder IP</label>
                                <input
                                    className="w-[185px] rounded-md bg-input text-text px-2 py-1"
                                    name="encoderip"
                                    value={obcStats.Network.encoderip}
                                    onChange={(e) => handleObcConfigChange("encoderip", e.target.value)}
                                    required
                                />
                            </div> 
                                <div className="flex items-center gap-1 items-end mb-2">
                                <label className="text-text w-[182px]">NTP IP</label>
                                <input
                                    className="w-[185px] rounded-md bg-input text-text px-2 py-1"
                                    name="ntpserverip"
                                    value={obcStats.Network.ntpserverip}
                                    onChange={(e) => handleObcConfigChange("ntpserverip", e.target.value)}
                                    required
                                />
                            </div> 
                                <div className="flex items-center gap-1 items-end mb-2">
                                <label className="text-text w-[182px]">FTP server IP</label>
                                <input
                                    className="w-[185px] rounded-md bg-input text-text px-2 py-1"
                                    name="ftpserverip"
                                     value={obcStats.Network.ftpserverip}
                                     onChange={(e) => handleObcConfigChange("ftpserverip", e.target.value)}
                                    required
                                />
                            </div> 
                                <div className="flex items-center gap-18 items-end mb-2">
                                <label className="text-text w-[185px]">FTP server User</label>
                                <input
                                    className="w-[185px] rounded-md bg-input text-text px-2 py-1"
                                    name="ftpusername"
                                    value={obcStats.Network.ftpusername}
                                    onChange={(e) => handleObcConfigChange("ftpusername", e.target.value)}
                                    required
                                />
                            </div> 
                                <div className="flex items-center gap-1 items-end mb-2">
                                <label className="text-text w-[180px]">FTP server Password</label>
                                <input
                                    className="w-[185px] rounded-md bg-input text-text px-2 py-1"
                                    name="ftppassword"
                                   value={obcStats.Network.ftppassword }
                                    onChange={(e) => handleObcConfigChange("ftppassword", e.target.value)}
                                    required
                                />
                            </div> 
                                    
                            </div>
                            </div>
                            <div className="w-[250px]">

                    <article className="p-4">
                          <label className="block text-text font-medium mb-1">
                            Select your patch file
                          </label>

                          
                           {selectedFilePatch ? (
                            <button className="px-1 py-2 mb-2 rounded flex items-center justify-between text-white w-[120px]">
                                    <span className="truncate min-w-0">
                                      {selectedFilePatch.name}
                                    </span>
                                    {/* <i className="fa fa-file-text ml-2 flex-shrink-0" aria-hidden="true"></i> */}
                                  </button>
                          ) : ( <div className="mb-3 text-text">
                            {selectedFilePatch ? selectedFilePatch.name : "No file selected"}
                          </div> )}

                          <input
                            type="file"
                            ref={fileInputRef}
                            className="hidden"
                            onChange={handleFileChange}
                          />

                          <div className="flex space-x-2 mb-3">
                            <button
                              type="button"
                              className="bg-buttonPrimary  text-white px-3 py-2 rounded flex items-center"
                              onClick={handleAttachClick}
                            >
                              <i className="fa-solid fa-paperclip text-[rgb(219 234 254)] text-lg"></i>
                            </button>

                            <button
                              type="button"
                              className="bg-buttonPrimary text-white px-3 py-2 rounded flex items-center"
                              onClick={handleUploadClick}
                            >
                              <i className="fa-solid fa-upload text-[rgb(219 234 254)] text-lg"></i> 
                            </button>
                          </div>

                        </article>
                        </div>

                        </form>

                           <div className="flex justify-center gap-4 mt-4">
                          <div>
                          <button type="button" 
                           className="bg-buttonSecondary from-cyan-400 to-blue-500 justify-end text-white font-semibold px-6 py-2 rounded-md shadow"
                          onClick={handleSaveConfiguration}
                          >
                            Save
                          </button>
                          </div>
                          <div>
                            <button type="button" 
                            className={`bg-buttonTertiary text-white font-semibold px-6 py-2 rounded-md shadow
                                        `}
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
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-buttonPrimary rounded-xl p-6 flex flex-col items-start relative">
                  <div className="text-text text-sm mb-2">TX Rate</div>
                  <div className="text-2xl font-bold text-text">{obcMonitoring.tx}</div>
                  {isBackendConnected && sessionId && (
                    <div className="absolute top-2 right-2 w-2 h-2 bg-green-400 rounded-full animate-pulse" title="Live Data" />
                  )}
                </div>
                <div className="bg-buttonPrimary rounded-xl p-6 flex flex-col items-start relative">
                  <div className="text-text text-sm mb-2">RX Rate</div>
                  <div className="text-2xl font-bold text-text">{obcMonitoring.rx}</div>
                  {isBackendConnected && sessionId && (
                    <div className="absolute top-2 right-2 w-2 h-2 bg-green-400 rounded-full animate-pulse" title="Live Data" />
                  )}
                </div>

                <div className="bg-buttonPrimary rounded-xl p-6 flex flex-col items-start relative">
                  <div className="text-text text-sm mb-2">Latency</div>
                  <div className="text-2xl font-bold text-text">{obcMonitoring.rx}</div>
                  {isBackendConnected && sessionId && (
                    <div className="absolute top-2 right-2 w-2 h-2 bg-green-400 rounded-full animate-pulse" title="Live Data" />
                  )}
                </div>

                <div className="bg-buttonPrimary rounded-xl p-6 flex flex-col items-start relative">
                  <div className="text-text text-sm mb-2">Train Radio</div>
                  <div className="text-2xl font-bold text-text">Connected</div>
                  {isBackendConnected && sessionId && (
                    <div className="absolute top-2 right-2 w-2 h-2 bg-green-400 rounded-full animate-pulse" title="Live Data" />
                  )}
                </div>
                <div className="bg-buttonPrimary rounded-xl p-6 flex flex-col items-start relative">
                  <div className="text-text text-sm mb-2">Encoder</div>
                  <div className="text-2xl font-bold text-text">Not Connected</div>
                  {isBackendConnected && sessionId && (
                    <div className="absolute top-2 right-2 w-2 h-2 bg-green-400 rounded-full animate-pulse" title="Live Data" />
                  )}
                </div>
                <div className="bg-buttonPrimary rounded-xl p-6 flex flex-col items-start relative">
                  <div className="text-text text-sm mb-2">NTP Service</div>
                  <div className="text-2xl font-bold text-text">Up</div>
                  {isBackendConnected && sessionId && (
                    <div className="absolute top-2 right-2 w-2 h-2 bg-green-400 rounded-full animate-pulse" title="Live Data" />
                  )}
                </div>
              </div>

              {/* Network Performance Charts */}
          <div className="bg-buttonPrimary rounded-xl p-6 mt-4">
            <div className="text-text mb-3 font-semibold flex items-center gap-2">
              Network Performance

              {/* Latency Connectivity */}
              {isBackendConnected && sessionId ? (
                <span className="text-xs text-text">(Live from device · 1s)</span>
              ) : (
                <span className="text-xs text-text">(Simulated · 1s)</span>
              )}
            </div>
            <div className="gap-6">
              <div className="h-56 bg-text rounded-lg p-2 mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={obcChartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e3a8a" />
                    <XAxis dataKey="t" tick={{ fill: '#93c5fd', fontSize: 12 }}/>
                    <YAxis tick={{ fill: '#93c5fd', fontSize: 12 }} domain={[0, 'auto']} />
                    <Tooltip contentStyle={{ background: '#0b1220', border: '1px solid #1e3a8a', color: '#e2e8f0' }} />
                    <Legend wrapperStyle={{ color: '#93c5fd' }} />
                    <Line type="monotone" dataKey="tx" stroke="#f59e0b" strokeWidth={2} dot={false} name="TX (Kbps)" isAnimationActive={false} />
                    <Line type="monotone" dataKey="rx" stroke="#60a5fa" strokeWidth={2} dot={false} name="RX (Kbps)" isAnimationActive={false}/>

                    {/* <Line type="monotone" dataKey="tx" stroke="#f59e0b" strokeWidth={2} dot={false} name="Latency" isAnimationActive={false} /> */}

                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
              <div className='flex justify-center mt-6'>
              <button
            type="button"
            onClick={() =>
              navigate("/obc/troubleshoot", {
                state: {
                  activeTab: "Connectivity",
                  ip: selectedObcIp || config.ipAddress,
                  deviceName: obcStats?.System?.device_name || "OBC Device",
                   trainId,
                  discoveredDevices
                },
                
              })
            }
            className="bg-buttonPrimary from-cyan-400 to-blue-500
                      text-white font-semibold px-6 py-2 rounded-md shadow"
          >
            Troubleshoot
          </button>
              </div>
      

       
            </div>          
          </>
        )}

        {activeTab === 'Firmware' && (
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
                                      className="px-4 py-1.5 rounded-full text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700"
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

                                  {/* {row.status === FIRMWARE_STATUS.UPGRADING && (
                                    <span className="inline-flex items-center gap-2 bg-gray-400/20 text-gray-200 px-3 py-1 rounded-full">
                                      <Loader size={14} className="animate-spin" />
                                      Upgrading...
                                    </span>
                                  )} */}

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
                                       Pushed
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

               {!isNewDevice && (
              
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
                       )}
                </div>
          </div>
        )}

        {activeTab === 'Logs' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <div className="text-text text-lg font-semibold">System Logs</div>
              <div className="flex gap-2">
               <button
                onClick={handleCurrentLogs}
                disabled={loadingCurrent}
                className="bg-buttonPrimary hover:bg-blue-700 disabled:opacity-50 text-white font-semibold px-4 py-2 rounded-md flex items-center gap-2"
              >
                {loadingCurrent ? (
                  <Loader size={18} className="animate-spin" />
                ) : (
                  <RefreshCcw size={18} />
                )}
                Current Logs
              </button>
              

               <button
                onClick={handleBackupLogs}
                disabled={loadingBackup}
                className="bg-buttonPrimary hover:bg-blue-700 disabled:opacity-50 text-white font-semibold px-4 py-2 rounded-md flex items-center gap-2"
              >
                {loadingBackup ? (
                  <Loader size={18} className="animate-spin" />
                ) : (
                  <RefreshCcw size={18} />
                )}
                Backup Logs
              </button>
              </div>
            </div>
           
            <div className="bg-buttonPrimary rounded-xl p-4">
              {loadingCurrent || loadingBackup ? (
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
                  <div
                    className="max-h-[55vh] overflow-auto rounded-md"
                    ref={activeTab === 'Logs' ? logsContainerRef : null}
                    onScroll={activeTab === 'Logs' ? handleLogsScroll : undefined}
                    style={{ background: '#0f172a' }}
                  >
                    {logs.map((log, idx) => (
                      <div
                        key={idx}
                        className="font-mono text-sm mb-1 px-2  rounded"
                        style={{
                          background: 'transparent',
                          color:
                            log.type === 'WARN'
                              ? '#facc15'
                              : log.type === 'INFO'
                              ? '#22d3ee'
                              : '#fff',
                          // borderLeft:
                          //   log.type === 'WARN'
                          //     ? '4px solid #facc15'
                          //     : log.type === 'INFO'
                          //     ? '4px solid #22d3ee'
                          //     : 'none'
                        }}
                      >
                        <span className="text-blue-300">{log.time}</span>{' '}
                        <span className="text-blue-300">{log.type}</span>{' '}
                        <span className="text-blue-300">{log.message}</span>{' '}
                        {/* <span
                          className={
                            log.type === 'WARN'
                              ? 'text-yellow-400'
                              : log.type === 'INFO'
                              ? 'text-cyan-400'
                              : 'text-white'
                          }
                        >
                          {log.type}
                        </span>{' '}
                        {log.message} */}
                      </div>
                    ))}
                    <div ref={activeTab === 'Logs' ? logsEndRef : null} />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
 {showTroubleshoot && <TroubleshootObc onClose={() => setShowTroubleshoot(false)} />}
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

export default ObcSummary;
