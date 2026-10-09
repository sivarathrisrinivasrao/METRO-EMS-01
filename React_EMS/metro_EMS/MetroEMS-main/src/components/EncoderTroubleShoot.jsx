import React, { useEffect, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";

const TroubleshootEncoder = () => {
  const navigate = useNavigate();
  const location = useLocation();

    const [step, setStep] = useState(0);
    const hasNavigatedRef = useRef(false);

    const navState = location.state || {};

    const selectedStation = navState.selectedStation;
    const deviceData = navState.deviceData;
    
      const deviceInfo = navState.deviceInfo || null;

      const targetSessionId =
  navState?.state?.deviceInfo?.sessionId ||
  navState?.sessionId;


   const [selectedTranscoderIp, setSelectedTranscoderIp] = useState(location.state?.ip || "");
  
    const serviceStatus = [
        { name: "Link Details", status: "running" },
      ];
      
      const logsData = [
        "[INFO] Encoder started successfully",
      ];

      

      useEffect(() => {
          if (step < 2) {
            const timer = setTimeout(() => {
              setStep(step + 1);
            }, 2000);
      
            return () => clearTimeout(timer);
          }
        }, [step]);
      

  return (
    <>
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-900 via-blue-800 to-blue-700">
    <div className="w-full max-w-[896px] max-h-[603px] min-w-[896px] min-h-[603px] mx-auto bg-white/10 backdrop-blur-md rounded-2xl shadow-2xl p-5">
      {/* <button
        onClick={() => navigate(-1)}
        // onClick={() => navigate('/device/station-radios',{
        //   state: {
        //     activeTab: 'Conntectivity',
        //     deviceInfo,
        //   }
        // })}
        className="mb-2 text-blue-200 hover:text-white font-semibold flex items-center gap-2"
      >
        <ArrowLeft size={18} /> Back to Connectivity
      </button> */}

      <button
                onClick={() => {
                  navigate(`/device/encoder/${location.state?.deviceId || '1'}`,{
                  state: {
                    activeTab: 'Connectivity',
                    ip: selectedTranscoderIp,
                    selectedStation: navState.selectedStation,
                    deviceData: navState.deviceData
                  }
                })}
              }
                className="mb-2 text-blue-200 hover:text-white font-semibold flex items-center gap-2"
              >
                <ArrowLeft size={18} /> Back to Connectivity
              </button>
      {step >= 1 && (
            <>
              <h3 className="text-lg text-white font-semibold mb-4 text-center">
              Link Details
              </h3>

              <ul className="space-y-3">
                {serviceStatus.map((srv, i) => (
                  <li
                    key={i}
                    className="flex justify-between items-center text-blue-100 px-12"
                  >
                    <span>{srv.name}</span>
                    {srv.status === "running" ? (
                      <span className="text-green-400"></span>
                    ) : (
                      <span className="text-red-400"></span>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}

            {step >= 2 && (
            <div className="flex justify-center mt-6">
              {/* <button
                onClick={() =>
                  navigate(`/device/encoder/${location.state?.deviceId || "1"}`, {
                    state: {
                      activeTab: "Logs",
                      deviceInfo,
                      selectedStation: navState.selectedStation,
                      deviceData: navState.deviceData
                    },
                  })
                }
                className="w-[220px] py-3 bg-gradient-to-r from-cyan-400 to-blue-600 hover:from-cyan-500 hover:to-blue-700
                          text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition transform hover:-translate-y-0.5"
              >
                Verify Logs
              </button> */}

               <button
              onClick={() =>{
                  // fetchLogs();
                navigate(`/device/encoder/${location.state?.deviceId || "1"}`, {
                  state: {
                    activeTab: "Logs",
                    ip: selectedTranscoderIp,
                    selectedStation: navState.selectedStation,
                    deviceData: navState.deviceData
                  },
                })
              }
              }
              className="w-[220px] py-3 bg-gradient-to-r from-cyan-400 to-blue-600 hover:from-cyan-500 hover:to-blue-700
                        text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition transform hover:-translate-y-0.5"
            >
              Verify Logs
            </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default TroubleshootEncoder;
