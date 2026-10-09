import React, { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import obcService from "../services/obcService";

const TroubleshootObc = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const navState = location.state || {};
const trainId = navState?.discoveredDevices?.trainId;
const discoveredDevices = navState?.discoveredDevices;
  const { type, id } = useParams();

     const [step, setStep] = useState(0);
  
    const serviceStatusDt = [
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

      const checkServicesList = [
  { name: "TDM Service", displayName: "TDM Service" },
  { name: "Driver", displayName: "Driver Service" },
  { name: "FTP Service", displayName: "FTP Service" },
  { name: "Train Radio Connectivity", displayName: "Train Radio Connectivity" },
  { name: "NTP Server Connectivity", displayName: "NTP Server Connectivity" },
  { name: "Encoder Connectivity", displayName: "Encoder Connectivity" },
  { name: "FTP Server Connectivity", displayName: "FTP Server Connectivity" },
];


      const [selectedObcIp, setSelectedObcIp] = useState(location.state?.ip || "");
      const [serviceStatus, setServiceStatus] = useState(null);
        const [parsedServices, setParsedServices] = useState(
        checkServicesList.map(item => ({ ...item, status: "checking",value: null  }))
      );
      const [allParsedServices, setAllParsedServices] = useState([]); 

        useEffect(() => {
          const handleObcServiceCheck = async () => {
            try {
              if (!navState?.ip) return;
        
              const response = await obcService.getServiceCheckStatus(navState.ip);
        
              console.log("API Response:", response);
        
              setServiceStatus(response);
            } catch (error) {
              console.error("Error fetching service check status:", error);
            }
          };
        
          handleObcServiceCheck(); 
        
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
          }, 200);
        
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
          }, 200);
        
          return () => clearInterval(timer);
        }, [allParsedServices]);
        
        
        
  function formatValue(val) {
    if (!val) return "";
    
    const match = val.match(/^([\d.]+)([a-zµ]*)$/i);
    if (!match) return val;

    const number = parseFloat(match[1]);
    const unit = match[2] || "";

    const rounded = number.toFixed(2);

    return `${rounded}${unit}`;
  }
  
  return (
    <>
    <div className="min-h-screen flex items-center justify-center bg-primary">
    <div className="w-full max-w-[896px] max-h-[825px] min-w-[896px] min-h-[825px] mx-auto bg-card backdrop-blur-md rounded-2xl shadow-2xl p-5">
      <button
      type="button"
        onClick={() => navigate(`/device/obc/${navState?.ip}`,{
          state: {
            activeTab: 'Connectivity',
            ip: selectedObcIp,
            trainId,
            discoveredDevices
          }
        })}
        className="mb-2 text-text hover:text-text font-semibold flex items-center gap-2"
      >
        <ArrowLeft size={18} /> Back to Connectivity
      </button>

      {/* {step >= 1 && ( */}
            <>
              <h3 className="text-lg text-text font-semibold mb-4 text-center">
                 Check Service
              </h3>

                <ul className="space-y-3">
                {parsedServices?.slice(0, 3).map((item, index) => (
                  <li key={index} className="flex justify-between items-center text-text px-12">
                    <span>{item.displayName}</span>
                    {/* {item.status === "success" ? (
                      <span className="text-green-400">✔ {item.status === "success" ?  "Running" : "Failed" } {item.value }</span>
                    ) : item.status === "failure" ? (
                      <span className="text-red-400">✖ Failed {item.value}</span>
                    ) : (
                      <span className="text-yellow-400 animate-pulse">Checking...</span>
                    )} */}

                    {item.value === "running" ? (
                      <span className="text-green-400">✔ Running</span>
                    ) : item.value === "failed" ? (
                      <span className="text-red-400">✖ Failed</span>
                    ) : (
                      <span className="text-yellow-400 animate-pulse">Checking...</span>
                    )}
                  </li>
                ))}

                {parsedServices.length < Math.min(3, allParsedServices?.length || 3) && (
                  <li className="flex justify-between items-center text-text px-12 animate-pulse">
                    <span>Checking...</span>
                    <span className="text-yellow-400">⏳</span>
                  </li>
                )}
              </ul>
            </>

          {/* {step >= 2 && ( */}
            <>
            <div className="mb-4">
              <h3 className="text-lg text-text font-semibold mb-4 text-center">
               Check Camera Connectivity
              </h3>

              <ul className="space-y-3">
                {parsedServices?.slice(3, 7).map((item, index) => (
                  <li
                    key={index}
                    className="flex justify-between items-center text-text px-12"
                  >
                    <span>{item.displayName}</span>
                     {/* {item.status === "success" ? (
                        <span className="text-green-400">✔ {item.status === "success" ?  "Pinging" : "Failed" } {item.value ? `(${formatValue(item.value)})` : ""}</span>
                      ) : item.status === "failure" ? (
                        <span className="text-red-400">✖ Not Pinging {item.value ? `(${formatValue(item.value)})` : ""}</span>
                      ) : (
                        <span className="text-yellow-400 animate-pulse">Checking...</span>
                      )} */}
                      {item.value === "0" ? (
                        <span className="text-green-400">✔ Pinging</span>
                      ) : item.value ? (
                        <span className="text-red-400">✖ Not Pinging</span>
                      ) : (
                        <span className="text-yellow-400 animate-pulse">Checking...</span>
                      )}
                  </li>
                ))}
              </ul>
            {parsedServices.length < Math.min(7, allParsedServices?.length || 7) && parsedServices.length >= 3 && (
                <li className="flex justify-between items-center text-text px-12 animate-pulse">
                  <span>Checking...</span>
                  <span className="text-yellow-400">⏳</span>
                </li>
              )}
            </div>
            </>

      {/* {step >= 3 && ( */}
              <div className="flex justify-center mt-6">
                <button
                type="button"
                  onClick={() =>
                    navigate(`/device/obc/${navState?.ip}`, {
                      state: {
                        activeTab: "Logs",
                        ip: selectedObcIp,
                        trainId,
                        discoveredDevices
                      }
                    })
                  }
                  className="w-[220px] py-3 bg-buttonPrimary from-cyan-400 to-blue-600 hover:from-cyan-500 hover:to-blue-700
                            text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition transform hover:-translate-y-0.5"
                >
                  Verify Logs
                </button>
              </div>
        </div>
      </div>
    </>
  );
};

export default TroubleshootObc;
