import React, { useEffect, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { apiService } from "../services/apiService";
import SignalIconn from "./Configsingnal";
// import SignalIconn from "./signalIcon";

const TroubleshootStationRadios = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [step, setStep] = useState(0);
  const navState = location.state || {};
   const selectedStation = navState?.state?.selectedStation;
   const deviceData = navState?.state?.deviceData;

  const deviceInfo = navState?.state?.deviceInfo || null;
  const targetSessionId =
  navState?.state?.deviceInfo?.sessionId ||
  navState?.sessionId;

  const [linkDetails, setLinkDetails] = useState(null);
  const [loading, setLoading] = useState(true);

  const linkDetailsList = [
  { name: "lsnr", displayName: "Local SNR" },
  { name: "rsnr", displayName: "Remote SNR" },
  { name: "lsignal", displayName: "Local Signal" },
  { name: "rsignal", displayName: "Remote Signal" },
  { name: "lnoise", displayName: "Local Noise" },
  { name: "rnoise", displayName: "Remote Noise" },
  { name: "stationame", displayName: "Statio Name" },
  { name: "associatedipaddr", displayName: "Associatedipaddr" },
  { name: "associatedmacaddr", displayName: "Associatedmacaddr" },
];

  useEffect(() => {
    const runServiceCheck = async () => {
      if (!targetSessionId) return;

      try {
        const response = await apiService.radioServiceCheck(targetSessionId);

        if (response?.status === "success") {
          setLinkDetails(response.date);
        }

      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    runServiceCheck();
  }, [targetSessionId]);


  useEffect(() => {
    if (step < 2) {
      const timer = setTimeout(() => {
        setStep(step + 1);
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [step]);

   const SignalStrength = ({ value }) => {
          const MIN = 0;
          const MAX = 0.25;
        
          const normalized = Math.min(
            Math.max((value - MIN) / (MAX - MIN), 0),
            1
          );
        
          const activeCells = Math.ceil(normalized * 5);
        
          const getClass = (cell) =>
            cell <= activeCells ? 'fill-green-400' : 'fill-gray-400';
        
          return <SignalIconn getClass={getClass} />;
        };

  return (
    <>
      <div className="min-h-screen flex items-center justify-center bg-primary">
        <div className="w-full max-w-[896px] max-h-[800px] min-w-[896px] min-h-[800px] mx-auto bg-card backdrop-blur-md rounded-2xl shadow-2xl p-5">
          <button
         onClick={() => {
          navigate(`/device/station-radios/${location.state?.deviceId || "1"}`, {
            state: {
              activeTab: "Connectivity",
              deviceInfo: {
                ...deviceInfo,
                sessionId: targetSessionId,
                selectedStation: navState?.state?.selectedStation,
                deviceData: navState?.state?.deviceData
              }
            }
          });
        }}
          className="mb-2 text-text hover:text-text font-semibold flex items-center gap-2"
        >
            <ArrowLeft size={18} /> Back to Connectivity
          </button>

          

          {step >= 1 && (
  <>
    <h3 className="text-lg text-text font-semibold mb-4 text-center">
      Link Details
    </h3>

    {loading ? (
      <div className="text-center text-yellow-300 animate-pulse">
        Checking...
      </div>
    ) : (
      <div className="grid grid-cols-2 gap-6 px-12">       
        {/* Left Side */}
<ul className="space-y-3 pt-[17px]">
  {["stationame", "associatedmacaddr","local","lsignal","lsnr", ].map(
    (key, index) => {
       if (key === "stationame") {
        return (
          <li key={index} className="flex justify-between items-center text-text">
            <label className="inline-flex items-center gap-2">
              <span>Connected Car :</span>
              <div className="text-text">
              <span className="text-lg font-bold">
                {linkDetails?.stationame ?? ""} 
              </span>
            </div>
            </label>
          </li>
        );
      }
        if (key === "associatedmacaddr") {
        return (
          <li key={index} className="flex justify-between items-center text-text">
            <label className="inline-flex items-center gap-2">
              <span>Associated MAC Address :</span>
              <div className="text-text">
              <span className="text-lg font-bold">
                {linkDetails?.associatedmacaddr ?? ""} 
              </span>
            </div>
            </label>
          </li>
        );
      }
      if (key === "lsnr") {
        return (
          <li key={index} className="flex justify-between items-center text-text !mt-[25px]">
            <label className="inline-flex items-center gap-2">
              <span>SNR :</span>
              <span className="text-lg font-bold">
                {linkDetails?.[key] === null || linkDetails?.[key] === ""
                  ? " --"
                  : linkDetails[key] + " dB"}
              </span>
              <SignalStrength value={linkDetails?.[key] || 0} />
            </label>
          </li>
        );
      }
        if (key === "local") {
        return (
          <li key={index} className="flex justify-between items-center text-text">
            <label className="inline-flex items-center gap-2">
              <span className="text-lg font-bold">Local</span>
            </label>
          </li>
        );
      }
       if (key === "lsignal") {
        // Replace with custom label for Local SNR
        return (
          <li key={index} className="flex justify-between items-center text-text">
            <label className="inline-flex items-center gap-2">
              <span>Singnal/Noise :</span>
              <div className="text-text">
              <span className="text-lg font-bold">
                {linkDetails?.lsignal ?? "--"} dB / {linkDetails?.lnoise ?? "--"} dB
              </span>
            </div>
            </label>
          </li>
        );
      }

      return (
        <li key={index} className="flex justify-between items-center text-text">
          <span>{linkDetailsList.find((item) => item.name === key)?.displayName} :</span>
          <span className="text-white">{linkDetails?.[key] ?? ""}</span>
        </li>
      );
    }
  )}
</ul>       

        {/* Right Side */}
        <ul className="space-y-3 pt-[17px]">
  {["networkname", "associatedipaddr","remote","rsignal","rsnr"].map(
    (key, index) => {
        if (key === "networkname") {
        // Replace with custom label for Local SNR
        return (
          <li key={index} className="flex justify-between items-center text-text">
            <label className="inline-flex items-center gap-2">
              <span>Network Name :</span>
               <span className="text-white">{linkDetails?.[key] ?? ""}</span>
              {/* <span className="text-lg font-bold">
                {linkDetails?.[key] === null || linkDetails?.[key] === ""
                  ? " --"
                  : linkDetails[key] + " dB"}
              </span> */}
            </label>
          </li>
        );
      }
       if (key === "associatedipaddr") {
        // Replace with custom label for Local SNR
        return (
          <li key={index} className="flex justify-between items-center text-text">
            <label className="inline-flex items-center gap-2">
              <span>Associated IP Address :</span>
               <span className="text-text">{linkDetails?.[key] ?? ""}</span>
              {/* <span className="text-lg font-bold">
                {linkDetails?.[key] === null || linkDetails?.[key] === ""
                  ? " --"
                  : linkDetails[key] + " dB"}
              </span> */}
            </label>
          </li>
        );
      }
       if (key === "remote") {
        // Replace with custom label for Local SNR
        return (
          <li key={index} className="flex justify-between items-center text-text">
            <label className="inline-flex items-center gap-2">
              <span className="text-lg font-bold">Remote </span>
             
            </label>
          </li>
        );
      }
      if (key === "rsnr") {
        // Replace with custom label for Local SNR
        return (
          <li key={index} className="flex justify-between items-center text-text !mt-[25px]">
            <label className="inline-flex items-center gap-2">
              <span>SNR :</span>
              <span className="text-lg font-bold">
                {linkDetails?.[key] === null || linkDetails?.[key] === ""
                  ? " --"
                  : linkDetails[key] + " dB"}
              </span>
              <SignalStrength value={linkDetails?.[key] || 0} />
            </label>
          </li>
        );
      }
       if (key === "rsignal") {
        // Replace with custom label for Local SNR
        return (
          <li key={index} className="flex justify-between items-center text-text">
            <label className="inline-flex items-center gap-2">
              <span>Singnal/Noise :</span>
              <div className="text-text">
              <span className="text-lg font-bold">
                {linkDetails?.rsignal ?? "--"} dB / {linkDetails?.rnoise ?? "--"} dB
              </span>
            </div>
            </label>
          </li>
        );
      }

      // Default rendering for other fields
      return (
        <li key={index} className="flex justify-between items-center text-text">
          <span>{linkDetailsList.find((item) => item.name === key)?.displayName} :</span>
          <span className="text-text">{linkDetails?.[key] ?? ""}</span>
        </li>
      );
    }
  )}
</ul>
      </div>
    )}
  </>
)}

          {step >= 2 && (
            <div className="flex justify-center mt-6">
              <button
                onClick={() =>
                  navigate(`/device/station-radios/${location.state?.deviceId || "1"}`, {
                    state: {
                      activeTab: "Logs",
                      deviceInfo: {
                        ...deviceInfo,
                        sessionId: targetSessionId,
                        selectedStation: navState?.state?.selectedStation,
                        deviceData: navState?.state?.deviceData
                      }
                    },
                  })
                }
                className="w-[220px] py-3 bg-buttonPrimary from-cyan-400 to-blue-600 hover:from-cyan-500 hover:to-blue-700
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

export default TroubleshootStationRadios;


