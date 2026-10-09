  import React, { useEffect, useRef, useState } from "react";
  import { ArrowLeft } from "lucide-react";
  import { useNavigate, useLocation } from "react-router-dom";
  import { apiService } from "../services/apiService";
  import { transcoderService } from '../services/transcoderService';
  import WebRTCPlayer from "./WebRTCPlayer";

  const TroubleshootTranscoder = () => {
    const navigate = useNavigate();
    const location = useLocation();

  const checkServicesList = [
    { name: "vtranscoder", displayName: "Transcoder Service" },
    { name: "gst-health", displayName: "GST Health" },
    { name: "gstreamer", displayName: "G Stream Service" },
    { name: "cam1", displayName: "Camera 1" },
    { name: "cam2", displayName: "Camera 2" },
    { name: "cam3", displayName: "Camera 3" },
    { name: "cam4", displayName: "Camera 4" },
  ];


      const [step, setStep] = useState(0);
      const [serviceStatus, setServiceStatus] = useState(null);
    const [parsedServices, setParsedServices] = useState(
    checkServicesList.map(item => ({ ...item, status: "checking",value: null }))
  );
  const [allParsedServices, setAllParsedServices] = useState([]);
  const [showTerminal, setShowTerminal] = useState(false);
  const [terminalData, setTerminalData] = useState({
  camName: "",
  status: "unknown",
  pingHistory: [],
  loading: true,
});

  const [logs, setLogs] = useState('');
      const intervalRef = useRef(null);

        const navState = location.state || {};
        const deviceIp = location.state?.ip;
    const selectedStation = navState.selectedStation;
    const deviceData = navState.deviceData;

  const deviceInfo = navState.deviceInfo || null;
        const sessionId =
    navState.sessionId ||
    new URLSearchParams(location.search).get("session");

    const [activeTab, setActiveTab] = useState(navState.activeTab || 'Logs');
   


  useEffect(() => {
    const handleTrServiceCheck = async () => {
      try {
        if (!navState?.ip) return;

        const response = await transcoderService.getServiceCheckStatus(navState.ip);

        console.log("API Response:", response);

        setServiceStatus(response);
      } catch (error) {
        console.error("Error fetching service check status:", error);
      }
    };

    handleTrServiceCheck();

  }, [navState?.ip]);

  useEffect(() => {
    if (!serviceStatus) return;

    const parsedApi = serviceStatus
      .split("\n")
      .filter(line => line.startsWith("data:"))
      .map(line => {
        let jsonString = line.replace("data:", "").trim();
        jsonString = jsonString.replace(/'/g, '"');

        try {
          return JSON.parse(jsonString);
        } catch {
          return null;
        }
      })
      .filter(item => item && item.name);

    let index = 0;

    const interval = setInterval(() => {
      if (index >= parsedApi.length) {
        clearInterval(interval);
        return;
      }

      const current = parsedApi[index];


      setParsedServices(prev =>
        prev.map(item => {
          if (item.name === current.name) {
            const value =
              current.data && typeof current.data === "object"
                ?  Object.values(current.data)[0]
                : null;

            return {
              ...item,
              status: current.status,
              value: value,
            };
          }
          return item;
        })
      );
      index++;
    }, 700);

    return () => clearInterval(interval);

  }, [serviceStatus]);


  useEffect(() => {
    if (!allParsedServices.length) return;

    const timer = setInterval(() => {
      setParsedServices(prev => {
        if (prev.length < allParsedServices.length) {
          return [...prev, allParsedServices[prev.length]];
        } else {
          clearInterval(timer);
          return prev;
        }
      });
    }, 500);

    return () => clearInterval(timer);
  }, [allParsedServices]);


    
    const serviceStatusDt = [
      { name: "Transcoder Service", status: "running" },
      { name: "G Stream Service", status: "running" },
    ];
    
    const cameraStatus = [
      { cam: "Cam 1", status: "working" },
      { cam: "Cam 2", status: "working" },
      { cam: "Cam 3", status: "not reachable" },
      { cam: "Cam 4", status: "working" },
    ];
    
    const logsData = [
      "[INFO] Transcoder started successfully",
    ];

    const [selectedTranscoderIp, setSelectedTranscoderIp] = useState(location.state?.ip || "");

    const videoRef = useRef(null);
    const [rtspUrl, setRtspUrl] = useState("rtsp://192.168.66.12:554/quad");
    const pcRef = useRef(null);

    async function startStream() {
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
      });

      pc.addTransceiver("video", { direction: "recvonly" });

      pc.ontrack = (ev) => {
        videoRef.current.srcObject = ev.streams[0];
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const res = await fetch("http://192.168.66.155:8080/offer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rtspUrl: rtspUrl,
          offer: pc.localDescription
        })
      });

      const answer = await res.json();
      await pc.setRemoteDescription(answer);

      pcRef.current = pc;
    }

    async function stopStream() {
      await fetch("http://192.168.66.155:8080/stop", { method: "POST" });
      if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
      }
    }

    useEffect(() => {
      const runServiceCheck = async () => {
        if (!sessionId) return;
        try {
          const ip = deviceInfo?.ip || "unknown";
          const response = await apiService.radioServiceCheck(sessionId, ip);
          console.log("Service Check Response:", response);
        } catch (err) {
          console.error(err);
        }
      };

      runServiceCheck();
    }, [deviceInfo, sessionId]);

  useEffect(() => {
  if (showTerminal && terminalData?.camName) {
    const ip = navState?.ip || "unknown";

    intervalRef.current = setInterval(() => {
      fetchCamStatus(ip, terminalData.camName);
    }, 1000);
  }

  return () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };
}, [showTerminal]);

const fetchCamStatus = async (ip, camName) => {
  try {
    const result = await transcoderService.getCamStatus(ip, camName);

    let ms, bytes;
    if (result?.value) {
      const microseconds = parseFloat(result.value.replace("µs", ""));
      ms = microseconds / 1000;       
      bytes = microseconds / 600;  
    } else {
      ms = "N/A";
      bytes = 0;
    }

    setTerminalData(prev => ({
      ...prev,
      camName,
      status: result?.status || "unknown",
      pingHistory: [...(prev.pingHistory || []), { ms, bytes }],
      loading: false
    }));
  } catch (err) {
    setTerminalData(prev => ({
      ...prev,
      camName,
      status: "error",
      pingHistory: [...(prev.pingHistory || []), { ms: "Error", bytes: 0 }],
      loading: false
    }));
  }
};

  const handleCamStatus = async (camName) => {
  const ip = navState?.ip || "unknown";

  setShowTerminal(true);
   setTerminalData({
    camName,
    status: "loading",
    pingHistory: [],
    loading: true
  });

  fetchCamStatus(ip, camName);
};

  function formatValue(val) {
    if (!val) return "";
    
    const match = val.match(/^([\d.]+)([a-zµ]*)$/i);
    if (!match) return val;

    const number = parseFloat(match[1]);
    const unit = match[2] || "";

    const rounded = number.toFixed(2);

    return `${rounded}${unit}`;
  }

const pingMs = parseFloat('620.372'.replace('µs', '')) / 1000;
const bytes = 620.372 / 600;

    return (
      <>
      <div className="min-h-screen flex items-center justify-center bg-primary">
      <div className="w-full max-w-[896px] max-h-[880px] min-w-[896px] min-h-[880px] mx-auto bg-card backdrop-blur-md rounded-2xl shadow-2xl p-5">
        <button
          onClick={() => {
            navigate(`/device/transcoder/${location.state?.deviceId || '1'}`,{
            state: {
              activeTab: 'Connectivity',
              ip: selectedTranscoderIp,
              selectedStation: navState.selectedStation,
              deviceData: navState.deviceData
            }
          })}
        }
          className="mb-2 text-text hover:text-text font-semibold flex items-center gap-2"
        >
          <ArrowLeft size={18} /> Back to Connectivity
        </button>

        {/* {step >= 1 && ( */}
              <>
                <h3 className="text-lg text-text font-semibold mb-2 text-center">
                  Check Service
                </h3>


                <ul className="space-y-3">
    {parsedServices?.slice(0, 3).map((item, index) => (
      <li key={index} className="flex justify-between items-center text-text px-12">
        <span>{item.displayName}</span>
        {item.status === "success" ? (
          <span className="text-green-400">✔ {item.status === "success" ?  "Running" : "Failed" } </span>
        ) : item.status === "failure" ? (
          <span className="text-red-400">✖ Failed</span>
        ) : (
          <span className="text-yellow-400 animate-pulse">Checking...</span>
        )}
      </li>
    ))}

    {parsedServices.length < Math.min(3, allParsedServices?.length || 3) && (
      <li className="flex justify-between items-center text-blue-100 px-12 animate-pulse">
        <span>Checking...</span>
        <span className="text-yellow-400">⏳</span>
      </li>
    )}
  </ul>

              </>

        {/* {step >= 2 && ( */}
              <>
              <div className="mb-4">
                <h3 className="text-lg text-text font-semibold mb-2 text-center">
                Check Camera Connectivity
                </h3>

                <ul className="space-y-3">
                  {parsedServices?.slice(3, 7).map((item, index) => (
                    <li
                      key={index}
                      className="flex justify-between items-center text-text px-12"
                    >
                      <span>{item.displayName}</span>
                      {item.status === "success" ? (
                          <span className="text-green-400">✔ {item.status === "success" ?  "Pinging" : "Failed" } {item.value ? `(${formatValue(item.value)})` : ""} <button type="button" className="bg-gradient-to-r from-cyan-400 to-blue-500 text-white text-xs font-semibold px-1 py-1 rounded-md shadow" onClick={() => handleCamStatus(item.name)}>ping</button></span>
                        ) : item.status === "failure" ? (
                          <span className="text-red-400">✖ Not Pinging {item.value ? `(${formatValue(item.value)})` : ""} <button type="button" className="bg-gradient-to-r from-cyan-400 to-blue-500 text-white text-xs font-semibold px-1 py-1 rounded-md shadow" onClick={() => handleCamStatus(item.name)}>ping</button></span>
                        ) : (
                          <span className="text-yellow-400 animate-pulse">Checking...</span>
                        )}
                    </li>
                  ))}
                </ul>

                {showTerminal && (
                    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
                      <div className="bg-black text-green-400 min-h-[400px] max-h-[500px] overflow-y-auto font-mono w-[500px] rounded-lg shadow-lg p-4 relative">
                        
                        <button
                          className="absolute top-2 right-2 text-red-400"
                          onClick={() => setShowTerminal(false)}
                        >
                          ✖
                        </button>

                        <div className="text-sm">
                          {terminalData?.loading ? (
                            <p className="animate-pulse">Pinging {terminalData.camName}...</p>
                          ) : (
                            <>
                            <p>Pinging $: {terminalData.camName}</p>
                              {/* <p>Camera: {terminalData?.camName}</p> */}
                               {/* <ul>
                              {terminalData.pingHistory.map((ping, index) => (
                                <li key={index}>{bytes(ping)} {pingMs(ping)}</li>
                              ))}
                            </ul> */}
                            <ul>
                              {terminalData.pingHistory.map((ping, index) => (
                                <li key={index}>
                                  {Math.round(ping.bytes)} bytes from  {navState?.ip || "unknown"} : time =  
                                  {typeof ping.ms === "number" ? ping.ms.toFixed(3) : ping.ms} ms 
                                </li>
                              ))}
                            </ul>
                              {/* <p> {terminalData?.ping}ms   {terminalData?.status}</p> */}
                              {/* <p>Status: {terminalData?.status}</p>
                              <p>Ping: {terminalData?.ping} ms</p> */}
                            </>
                          )}
                        </div>

                      </div>
                    </div>
                  )}
              {parsedServices.length < Math.min(7, allParsedServices?.length || 7) && parsedServices.length >= 3 && (
                  <li className="flex justify-between items-center tex-text px-12 animate-pulse">
                    <span>Checking...</span>
                    <span className="text-yellow-400">⏳</span>
                  </li>
                )}

              </div>

              <div className="px-6 mt-6">

    <div className="rounded-xl">
      
      <div className="mt-3">
        <WebRTCPlayer />
      </div>

    </div>
  </div>


                <p className="text-text text-sm mt-2 text-center">
                  Quad Stream
                </p>
              </>

        {/* {step >= 3 && ( */}
          <div className="flex justify-center mt-6">
            <button
              onClick={() =>{
                  // fetchLogs();
                navigate(`/device/transcoder/${location.state?.deviceId || "1"}`, {
                  state: {
                    activeTab: "Logs",
                    ip: selectedTranscoderIp,
                    selectedStation: navState.selectedStation,
                    deviceData: navState.deviceData
                  },
                })
              }
              }
              className="w-[220px] py-3 bg-buttonPrimary from-cyan-400 to-blue-600 hover:from-cyan-500 hover:to-blue-700
                        text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition transform hover:-translate-y-0.5"
            >
              Verify Logs
            </button>
          </div>
        {/* )} */}

          </div>
        </div>
      </>
    );
  };

  export default TroubleshootTranscoder;



