import React, { useState, useEffect, useRef } from 'react';
import DeviceSummary from './DeviceSummary';
import { ArrowLeft, Settings, Activity, UploadCloud, FileText, Trash2, Download, AlertCircle, CheckCircle, Loader, SettingsIcon } from 'lucide-react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { apiService } from '../services/apiService';
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
import ioboxcontrollerservice from '../services/ioboxcontrollerService';
import SettingsPanel from './setting';

const tabs = [
  { name: 'Configuration', icon: <Settings size={18} /> },
  // { name: 'Monitoring', icon: <Activity size={18} /> },
  // { name: 'Firmware', icon: <UploadCloud size={18} /> },
  // { name: 'Logs', icon: <FileText size={18} /> },
];

const initialConfig = {
  systemName: '',
  ipAddress: '',
  ssid: '',
  bandwidth: '',
  channel: '',
  radioMode: '',
  country:'',
  hardwareVersion: '',
  serialNumber: '',
  firmwareVersion: '',
  bootloaderVersion: '',
  EthernetMAC: '',
  WiFiMAC: '',
};

const bandwidthOptions = ['20MHz', '40MHz', '80MHz'];
const channelOptions = ['Auto', '1', '6', '11'];
// const radioModeOptions = ['Access Point', 'Client', 'Repeater'];
const radioModeOptions = ['Outdoor Base', 'Outdoor Subscriber',];
const countryOptions=['5 GHz']


const initialLogs = [
  {
    time: '[8/11/2025, 12:44:00 PM]',
    type: 'INFO',
    message: 'Station Radios initialized successfully',
  },
  {
    time: '[8/11/2025, 12:44:00 PM]',
    type: 'INFO',
    message: 'Network connection established',
  },
  {
    time: '[8/11/2025, 12:44:00 PM]',
    type: 'WARN',
    message: 'Signal strength below optimal threshold',
  },
];

const IoBoxControllerSummary =()=>{
    const [activeTab, setActiveTab] = useState('Configuration');
      const [config, setConfig] = useState(initialConfig);
      const [monitoring, setMonitoring] = useState({
        local_snr: '',
        remote_snr: '',
        tx_rate: '',
        rx_rate: '',
        latency:''
      });

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
      const [etherStat,setEtherStat] = useState([]);
      const [cart,setCart] = useState('');
      const MAX_POINTS = 60;
    
      const [showAll, setShowAll] = useState(false);
      const [showSettings, setShowSettings] = useState(false);
    
      const navigate = useNavigate();
      const location = useLocation();
       const navState = location.state || {};

        const trainId = location.state?.trainId;
        const discoveredDevices = location.state?.discoveredDevices;
      
      const sessionId = location.state?.sessionId || new URLSearchParams(location.search).get('session');
      // const trainId = location.state?.deviceInfo?.trainid || null;
      const ipAddress = location.state?.deviceInfo?.ip || null;
        const isNewDevice = navState.isNewDevice || false;



  // useEffect(() => {
  
  //   const fetchEtherStat = async () => {
  //     try {
  //       setIsLoading(true);
  //       const resp = await ioboxcontrollerservice.getEtherStat(ipAddress);
  //       setEtherStat(resp);
  //     } catch (err) {
  //       console.error(err);
  //       setError("Failed to load configuration");
  //     } finally {
  //       setIsLoading(false);
  //     }
  //   };
  
  //   if (ipAddress) fetchEtherStat();
  // }, [activeTab, ipAddress]);

   const filteredEtherStat = etherStat.filter(row => {
  const type = (row.type || "").toLowerCase();
  return type !== "bridge" && type !== "loopback";
});

// const formatToKbps = (value) => {
//   if (value === 0 || value === null || value === undefined) return 0;
//   return (Number(value) / 1024).toFixed(2);
// };

  useEffect(() => {
  const fetchEtherStat = async () => {
    try {
      setIsLoading(true);
      const resp = await ioboxcontrollerservice.getEtherStat(ipAddress);

      if (resp?.status === "success") {
        setEtherStat(resp.interfaces);
      } else {
        setEtherStat([]);
      }

    } catch (err) {
      console.error(err);
      setError("Failed to load configuration");
    } finally {
      setIsLoading(false);
    }
  };

  if (ipAddress && activeTab === "Configuration") {
    fetchEtherStat();
  }
}, [activeTab, ipAddress]);

    useEffect(() => {
  
    const fetchIoboxCart = async () => {
      try {
        setIsLoading(true);
        const resp = await ioboxcontrollerservice.getIoboxCart(ipAddress);
        setCart(resp);
      } catch (err) {
        console.error(err);
        setError("Failed to load configuration");
      } finally {
        setIsLoading(false);
      }
    };
  
    if (ipAddress) fetchIoboxCart();
  }, [activeTab, ipAddress]);
  


    
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
    
      const handleSave = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);
        
        try {
          if (isBackendConnected && sessionId) {
            // Save configuration to real device via backend
            await apiService.updateDeviceConfiguration(sessionId, config);
            alert('Configuration saved to device successfully!');
          } else {
            // Demo mode
            alert('Configuration saved!\n' + JSON.stringify(config, null, 2));
          }
        } catch (err) {
          console.error('Failed to save configuration:', err);
          setError('Failed to save configuration: ' + err.message);
        } finally {
          setIsLoading(false);
        }
      };
        
      const handleDownload = () => {
        const logText = logs.map(log => `${log.time} ${log.type}: ${log.message}`).join('\n');
        const blob = new Blob([logText], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'system_logs.txt';
        a.click();
        URL.revokeObjectURL(url);
      };
    
      const handleClear = () => setLogs([]);
    
      useEffect(() => {
        if (activeTab !== 'Monitoring') return;
        
        const updateMonitoring = async () => {
          if (isBackendConnected && sessionId) {
            try {
              // Get real monitoring data from backend
              const monitoringData = await apiService.getDeviceMonitoring(sessionId);
              if (monitoringData) {
                const next = {
                  signal: Number(
                    monitoringData.signal_strength ?? monitoring.signal
                  ),
                  localsnr: Number(monitoringData.localsnr ?? monitoring.local_snr),
                  remotesnr: Number(monitoringData.remotesnr ?? monitoring.remote_snr),
                  tx: Number(monitoringData.tx_rate ?? monitoring.tx_rate),
                  rx: Number(monitoringData.rx_rate ?? monitoring.rx_rate),
                  latency: Number(monitoringData.latency ?? monitoring.latency)
                };
                setMonitoring(next);
                setChartData(prev => {
                  const t = new Date();
                  const point = {
                    t: t.toLocaleTimeString(),
                    localsnr: next.localsnr,
                    remotesnr: next.remotesnr,
                    tx: next.tx,
                    rx: next.rx,
                    latency:next.latency
                  };
                  const arr = [...prev, point];
                  return arr.length > MAX_POINTS ? arr.slice(arr.length - MAX_POINTS) : arr;
                });
              }
            } catch (err) {
              console.warn('Failed to fetch real monitoring data, using simulation:', err);
              // Fall back to simulation
              const sim = {
                signal: Number((70 + Math.random() * 10).toFixed(2)),
                snr: Number((40 + Math.random() * 10).toFixed(1)),
                tx: Math.floor(120 + Math.random() * 40),
                rx: Math.floor(100 + Math.random() * 30),
                latency: Math.floor(120 + Math.random() * 20)
              };
              setMonitoring(sim);
              setChartData(prev => {
                const t = new Date();
                const point = { t: t.toLocaleTimeString(), ...sim };
                const arr = [...prev, point];
                return arr.length > MAX_POINTS ? arr.slice(arr.length - MAX_POINTS) : arr;
              });
            }
          } else {
            // Demo mode - keep lightweight placeholder values
            const sim = {
              signal: Number((70 + Math.random() * 10).toFixed(2)),
              snr: Number((40 + Math.random() * 10).toFixed(1)),
              tx: Math.floor(120 + Math.random() * 40),
              rx: Math.floor(100 + Math.random() * 30),
              latency: Math.floor(120 + Math.random() * 20)
            };
            setMonitoring(sim);
            setChartData(prev => {
              const t = new Date();
              const point = { t: t.toLocaleTimeString(), ...sim };
              const arr = [...prev, point];
              return arr.length > MAX_POINTS ? arr.slice(arr.length - MAX_POINTS) : arr;
            });
          }
        };
        
        updateMonitoring();
        
        const interval = setInterval(updateMonitoring, 1000);
        return () => clearInterval(interval);
      }, [activeTab, isBackendConnected, sessionId]);
    
      useEffect(() => {
        if (!(activeTab === 'Logs')) return;
        let cancelled = false;
    
        const fetchLogs = async () => {
          if (isBackendConnected && sessionId) {
            try {
              const newLogs = await apiService.getDeviceLogsEnhanced(sessionId);
              if (!cancelled && Array.isArray(newLogs)) {
                // Normalize possible shapes
                const normalized = newLogs.map(l => ({
                  time: l.time || l.timestamp || new Date().toISOString(),
                  type: l.type || l.level || 'INFO',
                  message: l.message || l.msg || ''
                }));
                // Merge by time+message (simple de-dup)
                setLogs(prev => {
                  const seen = new Set(prev.map(p => `${p.time}|${p.message}`));
                  const merged = [...prev];
                  for (const n of normalized) {
                    const key = `${n.time}|${n.message}`;
                    if (!seen.has(key)) merged.push(n);
                  }
                  // Keep last 500 logs
                  return merged.length > 500 ? merged.slice(merged.length - 500) : merged;
                });
              }
            } catch (e) {
              // ignore transient errors
            }
          } else {
            // In demo, append a synthetic log periodically
            const now = new Date();
            setLogs(prev => {
              const demo = {
                time: `[${now.toLocaleString()}]` ,
                type: Math.random() < 0.1 ? 'WARN' : 'INFO',
                message: Math.random() < 0.5 ? 'Periodic health check OK' : 'Monitoring tick update'
              };
              const arr = [...prev, demo];
              return arr.length > 200 ? arr.slice(arr.length - 200) : arr;
            });
          }
        };
    
        // Initial call and interval setup
        fetchLogs();
        const id = setInterval(fetchLogs, 1000);
        return () => { cancelled = true; clearInterval(id); };
      }, [activeTab, isBackendConnected, sessionId]);
    
      // // Auto-scroll the visible logs container only when following the tail
      // useEffect(() => {
      //   const el = logsContainerRef.current;
      //   if (!el || !followTail) return;
      //   // Scroll the container to bottom without affecting the page scroll
      //   el.scrollTop = el.scrollHeight;
      // }, [logs, followTail]);
    
      useEffect(() => {
        if (!showAll) return;
        const el = logsContainerRef.current;
        if (!el) return;
        el.scrollTop = el.scrollHeight;
      }, [logs, showAll]);
    
      const handleLogsScroll = () => {
        const el = logsContainerRef.current;
        if (!el) return;
        const threshold = 16;
        const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
        if (distanceFromBottom > threshold) {
          if (followTail) setFollowTail(false);
        } else {
          if (!followTail) setFollowTail(true);
        }
      };

      const { type } = useParams();



    const formatType = (type) => {
  if (!type) return "";

  return type
    .split("-")
    .map((word, index, arr) => {
      // Merge last word with IP → Controller-IP
      if (index === arr.length - 2 && arr[arr.length - 1] === "ip") {
        const baseWord =
          word === "box"
            ? "Controller"
            : word.charAt(0).toUpperCase() + word.slice(1);

        return baseWord + "-IP";
      }

      if (word === "io") return "IO";
      if (word === "ip") return "IP";
      if (word === "box") return "Controller";

      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .filter((_, index, arr) => {
      return !(index === arr.length - 1 && arr[index] === "ip");
    })
    .join(" ");
};

      
    return(
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
      

          <h2 className="text-2xl text-text font-semibold mb-4">
            {isNewDevice && activeTab === "Firmware"
              ? "Firmware Installation"
              : formatType(type)}

            {config?.ipAddress && (
              <span className="text-lg text-text ml-2">
                - {config.ipAddress}
              </span>
            )}
          </h2>
        
          {/* <div className="flex items-center gap-2">
            {isBackendConnected ? (
              <>
                <CheckCircle size={20} className="text-green-400" />
                <span className="text-green-400 text-sm">
                  {sessionId ? 'Real Device' : 'Backend Connected'}
                </span>
              </>
            ) : (
              <>
                <AlertCircle size={20} className="text-yellow-400" />
                <span className="text-yellow-400 text-sm">Demo Mode</span>
              </>
            )}
          </div> */}
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
              <Loader size={32} className="animate-spin text-text mx-auto mb-2" />
              <p className="text-text text-sm">Loading device data...</p>
            </div>
          </div>
        )}
        <div className="flex border-b border-blue-700 mb-4">
          {tabs.map(tab => (
            <button
              key={tab.name}
              onClick={() => setActiveTab(tab.name)}
              className={`flex items-center gap-2 px-6 py-3 font-semibold text-sm transition
                ${activeTab === tab.name
                  ? 'text-text border-b-2 border-cyan-300'
                  : 'text-text hover:text-white border-b-2 border-transparent'
                }`}
            >
              {tab.icon}
              {tab.name}
            </button>
          ))}
        </div>
        
        {activeTab === "Configuration" && (
                  <form className="gap-12" onSubmit={handleSave}>
                    <div className="w-full p-1 pt-[20px]">
                                <div className="flex justify-between mx-auto pl-[40px]">
                                      <div className='flex gap-4'>
                                     <label className="block text-text text-lg font-semibold mb-2">
                                            Cab:
                                          </label>
                                                <input
                                                 value={trainId}
                                            className="rounded-md bg-input text-text px-2 py-1 border-none
                                                                            focus:ring-2 focus:ring-cyan-400 w-[100px]"
                                            placeholder=""
                                        />
                                    <button
                                    type='button'
                                        className="px-4 py-1.5 rounded-full text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700"
                                      >
                                        Modify
                                      </button>
                                    </div>
                                  <label className="block text-text text-lg font-semibold mb-2 pr-[40px]">
                                    IP Address:{' '}
                                        {isLoading ? "Loading..." : ipAddress || ""}
                                    </label>
                                </div>
                            </div>
                             <div class="w-full flex flex-col gap-4 ">   
                                <div class="flex gap-4 pt-[50px] pl-[20px] pr-[40px]">
                                    {/* <h1>Hello</h1> */}
                                       <div className="w-full bg-buttonPrimary rounded-xl p-6 mb-8">
                                          <div className="min-w-full">
                                              <div className="bg-white/10 backdrop-blur-md border border-buttonPrimary rounded-2xl  overflow-hidden">
                                                <div className="">
                                                  <table className="min-w-full text-left">
                                                    <thead>
                                                      <tr className="bg-blue-900/40 text-text text-sm tracking-wider font-medium">
                                                        <th className="px-6 py-3 text-lg ">Name</th>
                                                        <th className="px-6 py-3 text-lg ">Type</th>
                                                        <th className="px-6 py-3  text-lg text-center">Status</th>
                                                         <th className="px-6 py-3  text-lg text-center">Tx-byte</th>
                                                          <th className="px-6 py-3  text-lg text-center">Rx-byte</th>
                                                      </tr>
                                                    </thead>

                                                    {/* <tbody>
                                  {[
                                    { name: "", type: "", status: "" },
                                    { name: "", type: "", status: "" },
                                    { name: "", type: "", status: "" },
                                    { name: "", type: "", status: "" },
                                  ].map((row, i) => (
                                    <tr key={i} className="border-t border-white/10 hover:bg-white/5 transition">
                                      <td className="px-6 py-4 text-white text-md font-medium">{row.name}</td>
                                      <td className="px-6 py-4 text-white text-md">{row.type}</td>
                                      <td className="px-6 py-4 text-center text-md">
                                        {row.status === "Up" && (
                                          <span className="text-green-400 font-semibold">{row.running}</span>
                                        )}
                                        {row.status === "Down" && (
                                          <span className="text-red-400 font-semibold">{row.running}</span>
                                        )}
                                        {row.status === "Updating" && (
                                          <span className="text-yellow-300 font-semibold">{row.running}…</span>
                                        )}
                                        {row.status === "Error" && (
                                          <span className="text-red-400 font-semibold">{row.running}</span>
                                        )}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody> */}

                                <tbody>
                                  {isLoading ? (
                                    <tr>
                                      <td colSpan="5" className="text-center text-text py-4">
                                        Loading...
                                      </td>
                                    </tr>
                                  ) : etherStat.length === 0 ? (
                                    <tr>
                                      <td colSpan="5" className="text-center text-text py-4">
                                        No Data Available
                                      </td>
                                    </tr>
                                  ) : (
                                    filteredEtherStat.map((row, i) => (
                                      <tr key={i} className="border-t border-buttonPrimary hover:bg-white/5 transition">
                                        
                                        <td className="px-6 py-4 text-text text-md font-medium">
                                          {row.name}
                                        </td>

                                        <td className="px-6 py-4 text-text text-md">
                                          {row.type}
                                        </td>

                                        <td className="px-6 py-4 text-center text-md">
                                          {row.running === "true" ? (
                                            <span className="text-green-600 font-semibold">Up</span>
                                          ) : (
                                            <span className="text-red-600 font-semibold">Down</span>
                                          )}
                                        </td>

                                        <td className="px-6 py-4 text-center text-text">
                                          {row["tx-byte"]}
                                        </td>

                                        <td className="px-6 py-4 text-center text-text">
                                          {row["rx-byte"]}
                                        </td>

                                      </tr>
                                    ))
                                  )}
                                </tbody>
                                                  </table>
                                                </div>
                                              </div>
                                            </div>

                </div>
                                    </div>
                             </div>

                        </form>
        )}

        {activeTab === "Monitoring" && (
          <>
              <div>
              {/* <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
               
                <div className="bg-blue-900/60 rounded-xl p-4 flex flex-col items-start relative">
                  <div className="flex w-full justify-between mb-2">
                    <div className="text-blue-100 text-sm">Local Snr</div>
                    <div className="text-blue-100 text-sm">Remote Snr</div>
                  </div>

                  <div className="flex w-full justify-between items-center">
                    <div className="text-2sm font-bold text-white">{monitoring.local_snr} dB</div>
                    <div className="text-2sm font-bold text-white mr-10">{monitoring.remote_snr} dB</div>
                  </div>

                  {isBackendConnected && sessionId && (
                    <div className="absolute top-2 right-2 w-2 h-2 bg-green-400 rounded-full animate-pulse" title="Live Data" />
                  )}
                </div>
                <div className="bg-blue-900/60 rounded-xl p-4 flex flex-col items-start relative">
                  <div className="flex w-full justify-between mb-2">
                    <div className="text-blue-100 text-sm">TX Rate</div>
                    <div className="text-blue-100 text-sm">RX Rate</div>
                  </div>

                  <div className="flex w-full justify-between items-center">
                    <div className="text-2sm font-bold text-white">{monitoring.tx_rate} Mbps</div>
                    <div className="text-2sm font-bold text-white ml-10">{monitoring.rx_rate} Mbps</div>
                  </div>

                  {isBackendConnected && sessionId && (
                    <div className="absolute top-2 right-2 w-2 h-2 bg-green-400 rounded-full animate-pulse" title="Live Data" />
                  )}
                </div>

                <div className="bg-blue-900/60 rounded-xl p-4 flex flex-col items-start relative">
                  <div className="text-blue-100 text-sm mb-2">Latency</div>
                  <div className="text-2sm font-bold text-white">{monitoring.latency} Ms</div>
                  {isBackendConnected && sessionId && (
                    <div className="absolute top-2 right-2 w-2 h-2 bg-green-400 rounded-full animate-pulse" title="Live Data" />
                  )}
                </div>
              </div> */}
                 <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                        <div className="bg-blue-900/60 rounded-xl p-6 flex flex-col items-start relative">

                        <div className="flex w-full justify-between mb-2">
            <div className="text-blue-100 text-sm">Ethernet 1</div>
            <div className="text-green-400 text-sm">Up</div>
          </div>
                          {/* <div className="text-blue-100 text-sm mb-2">Cam 1</div>
                          <div className="text-blue-100 text-sm mb-2">Up</div> */}
                          {/* <div className="text-2xl font-bold text-white">{transcoderMonitoring.tx}</div> */}
                          {isBackendConnected && sessionId && (
                            <div className="absolute top-2 right-2 w-2 h-2 bg-green-400 rounded-full animate-pulse" title="Live Data" />
                          )}
                        </div>
                        <div className="bg-blue-900/60 rounded-xl p-6 flex flex-col items-start relative">

                        <div className="flex w-full justify-between mb-2">
            <div className="text-blue-100 text-sm">Ethernet 2</div>
            <div className="text-green-400 text-sm">Up</div>
          </div>
                          {/* <div className="text-blue-100 text-sm mb-2">Cam 2</div> */}
                          {/* <div className="text-2xl font-bold text-white">{transcoderMonitoring.rx}</div> */}
                          {isBackendConnected && sessionId && (
                            <div className="absolute top-2 right-2 w-2 h-2 bg-green-400 rounded-full animate-pulse" title="Live Data" />
                          )}
                        </div>

                        <div className="bg-blue-900/60 rounded-xl p-6 flex flex-col items-start relative">

        <div className="flex w-full justify-between mb-2">
        <div className="text-blue-100 text-sm">Ethernet 3</div>
        <div className="text-red-400 text-sm">Down</div>
        </div>
          {/* <div className="text-blue-100 text-sm mb-2">Cam 2</div> */}
          {/* <div className="text-2xl font-bold text-white">{transcoderMonitoring.rx}</div> */}
          {isBackendConnected && sessionId && (
            <div className="absolute top-2 right-2 w-2 h-2 bg-green-400 rounded-full animate-pulse" title="Live Data" />
          )}
        </div>

        <div className="bg-blue-900/60 rounded-xl p-6 flex flex-col items-start relative">

        <div className="flex w-full justify-between mb-2">
        <div className="text-blue-100 text-sm">Ethernet 4</div>
        <div className="text-green-400 text-sm">Up</div>
        </div>
          {/* <div className="text-blue-100 text-sm mb-2">Cam 2</div> */}
          {/* <div className="text-2xl font-bold text-white">{transcoderMonitoring.rx}</div> */}
          {isBackendConnected && sessionId && (
            <div className="absolute top-2 right-2 w-2 h-2 bg-green-400 rounded-full animate-pulse" title="Live Data" />
          )}
        </div>
                      </div>
              <div className="bg-blue-900/60 rounded-xl p-6 mt-4">
                <div className="text-blue-100 mb-3 font-semibold flex items-center gap-2">
                  Network Performance
                  {isBackendConnected && sessionId ? (
                    <span className="text-xs text-green-400">(Live from device · 1s)</span>
                  ) : (
                    <span className="text-xs text-yellow-400">(Simulated · 1s)</span>
                  )}
                </div>
                <div className="gap-6">
                  <div className="h-56 bg-blue-900/50 rounded-lg p-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e3a8a" />
                        <XAxis dataKey="t" tick={{ fill: '#93c5fd', fontSize: 12 }} />
                        <YAxis tick={{ fill: '#93c5fd', fontSize: 12 }} domain={[0, 'auto']} />
                        <Tooltip contentStyle={{ background: '#0b1220', border: '1px solid #1e3a8a', color: '#e2e8f0' }} />
                        <Legend wrapperStyle={{ color: '#93c5fd' }} />
                        <Line type="monotone" dataKey="localsnr" stroke="#22d3ee" strokeWidth={2} dot={false} name=" Local Snr (dB)"  isAnimationActive={false}  />
                        <Line type="monotone" dataKey="remotesnr" stroke="#34d399" strokeWidth={2} dot={false} name="Remote Snr (dB)"   isAnimationActive={false}  />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  {/* <div className="h-56 bg-blue-900/50 rounded-lg p-2 mt-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e3a8a" />
                        <XAxis dataKey="t" tick={{ fill: '#93c5fd', fontSize: 12 }}  />
                        <YAxis tick={{ fill: '#93c5fd', fontSize: 12 }} domain={[0, 'auto']} />
                        <Tooltip contentStyle={{ background: '#0b1220', border: '1px solid #1e3a8a', color: '#e2e8f0' }} />
                        <Legend wrapperStyle={{ color: '#93c5fd' }} />
                        <Line type="monotone" dataKey="tx" stroke="#f59e0b" strokeWidth={2} dot={false} name="TX (Mbps)"isAnimationActive={false} />
                        <Line type="monotone" dataKey="rx" stroke="#60a5fa" strokeWidth={2} dot={false} name="RX (Mbps)" isAnimationActive={false}/>
                      </LineChart>
                    </ResponsiveContainer>
                  </div> */}
                  {/* <div className="h-56 bg-blue-900/50 rounded-lg p-2 mt-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e3a8a" />
                        <XAxis dataKey="t" tick={{ fill: '#93c5fd', fontSize: 12 }}  />
                        <YAxis tick={{ fill: '#93c5fd', fontSize: 12 }} domain={[0, 'auto']} />
                        <Tooltip contentStyle={{ background: '#0b1220', border: '1px solid #1e3a8a', color: '#e2e8f0' }} />
                        <Legend wrapperStyle={{ color: '#93c5fd' }} />
                        <Line type="monotone" dataKey="latency" stroke="#60a5fa" strokeWidth={2} dot={false} name="Latency (Ms)" isAnimationActive={false}/>
                      </LineChart>
                    </ResponsiveContainer>
                  </div> */}

                </div>
              </div>
              {/* Live Log Tail inside Monitoring */}
              {/* <div className="bg-blue-900/60 rounded-xl p-4 mt-6">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-blue-100 text-sm font-semibold">Live Logs</div>
                      <button
                        type="button"
                        onClick={() => setShowAll((prev) => !prev)}
                        className="px-2 py-1 rounded bg-blue-700 text-white hover:bg-blue-600"
                      >
                        {showAll ? "Hide Logs" : "Show All"}
                      </button>
                    </div>

                    {showAll && (
                      <div
                        ref={logsContainerRef}
                        className="max-h-48 overflow-auto rounded-md"
                        style={{ background: "#0f172a" }}
                      >
                        {logs.length === 0 ? (
                          <div className="text-blue-300 text-center py-4">
                            Waiting for logs…
                          </div>
                        ) : (
                          logs.map((log, idx) => (
                            <div
                              key={idx}
                              className="font-mono text-xs mb-1 px-2 py-1"
                              style={{
                                color:
                                  log.type === "WARN"
                                    ? "#facc15"
                                    : log.type === "INFO"
                                    ? "#22d3ee"
                                    : "#e5e7eb",
                                borderLeft:
                                  log.type === "WARN"
                                    ? "3px solid #facc15"
                                    : log.type === "INFO"
                                    ? "3px solid #22d3ee"
                                    : "none",
                              }}
                            >
                              <span className="text-blue-300">{log.time}</span> {log.type}:{" "}
                              {log.message}
                            </div>
                          ))
                        )}
                        <div ref={logsEndRef} />
                      </div>
                    )}
                  </div> */}
              {/* Static Device Summary below live metrics */}
              <div className="flex justify-end mb-2">
                {isBackendConnected && sessionId && (
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const refreshed = await apiService.refreshSession(sessionId);
                        setSummaryExtras({
                          sysDescr: refreshed.sysDescr,
                          sysUpTime: refreshed.sysUpTime,
                          system_name: refreshed.system_name
                        });
                        if (refreshed.system_name) {
                          setConfig(prev => ({ ...prev, systemName: refreshed.system_name }));
                        }
                      } catch (e) {
                        console.warn('Refresh failed', e);
                      }
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-3 py-1 rounded-md flex items-center gap-2"
                  >
                    {/* <RefreshCw size={14} /> Refresh Summary */}
                  </button>
                )}
              </div>
            </div>
          </>
        )}

        {activeTab === 'Firmware' && (
          <div>
            <div className="bg-blue-900/60 rounded-xl p-6 mb-8">
              <div className="text-blue-100 text-lg font-semibold mb-2">Current Firmware</div>
              <div className="text-white mb-1">Version: <span className="font-bold">v2.1.4</span></div>
              <div className="text-white mb-1">Build Date: <span className="font-bold">2024-12-01</span></div>
              <div className="text-green-400 font-semibold">Status: Up to date</div>
            </div>
            <div className="bg-blue-900/60 rounded-xl p-6">
              <div className="text-blue-100 text-lg font-semibold mb-2">Firmware Upgrade</div>
              <button
                type="button"
                className="bg-orange-500 hover:bg-orange-600 text-white font-semibold px-6 py-2 rounded-md shadow flex items-center gap-2 transition"
                onClick={() => alert('Firmware upgrade started!')}
              >
                <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" className="inline"><path d="M12 5v6h4M20 12a8 8 0 11-16 0 8 8 0 0116 0z"/></svg>
                Start Firmware Upgrade
              </button>
            </div>
          </div>
        )}

        {activeTab === 'Logs' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <div className="text-blue-100 text-lg font-semibold">System Logs</div>
              <div className="flex gap-2">
                <button
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-md flex items-center gap-2 transition"
                  onClick={handleDownload}
                >
                  <Download size={18} className="inline" />
                  Download
                </button>
                <button
                  className="bg-red-500 hover:bg-red-600 text-white font-semibold px-4 py-2 rounded-md flex items-center gap-2 transition"
                  onClick={handleClear}
                >
                  <Trash2 size={18} className="inline" />
                  Clear
                </button>
              </div>
            </div>
            <div className="bg-blue-900/80 rounded-xl p-4">
              {logs.length === 0 ? (
                <div className="text-blue-300 text-center py-8">No logs available.</div>
              ) : (
                <div>
                  {/* Optional: a contained scroll area for long logs page to avoid page jump */}
                  <div className="max-h-[70vh] overflow-auto rounded-md" ref={activeTab === 'Logs' ? logsContainerRef : null} onScroll={activeTab === 'Logs' ? handleLogsScroll : undefined} style={{ background: '#0f172a' }}>
                    {logs.map((log, idx) => (
                      <div
                        key={idx}
                        className="font-mono text-sm mb-2 px-2 py-1 rounded"
                        style={{
                          background: 'transparent',
                          color: log.type === 'WARN' ? '#facc15' : log.type === 'INFO' ? '#22d3ee' : '#fff',
                          borderLeft: log.type === 'WARN' ? '4px solid #facc15' : log.type === 'INFO' ? '4px solid #22d3ee' : 'none'
                        }}
                      >
                        <span className="text-blue-300">{log.time}</span>{' '}
                        <span className={log.type === 'WARN' ? 'text-yellow-400' : log.type === 'INFO' ? 'text-cyan-400' : 'text-white'}>
                          {log.type}
                        </span>: {log.message}
                      </div>
                    ))}
                    <div ref={activeTab === 'Logs' ? logsEndRef : null} />
                  </div>
                  <div className="flex items-center justify-end gap-3 mt-2 text-xs text-blue-200">
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
    )
}
export default IoBoxControllerSummary