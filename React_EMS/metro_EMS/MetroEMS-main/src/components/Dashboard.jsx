import React, { useState, useEffect } from "react";
import DeviceSummary from "./DeviceSummary";
import { useNavigate, useLocation } from "react-router-dom";
import apiService from "../services/apiService";
import transcoderService from "../services/transcoderService";
import obcService from "../services/obcService";
import {
  Radio,
  Train,
  Cpu,
  Disc,
  Server,
  SlidersHorizontal,
  ArrowRight,
  Wifi,
  MonitorSmartphone,
  Tv,
  Camera,
  Cpu as CpuChip,
  Box,
  RefreshCw,
  AlertCircle,
  Loader,
  SettingsIcon,
} from "lucide-react";
import trainradiosService from "../services/trainradiosService";
import ioboxcontrollerservice from "../services/ioboxcontrollerService";
import encoderService from "../services/encoderService";
import SettingsPanel from "./setting";

const staticDeviceLists = {};

const elements = [
  {
    name: "Station Radios",
    icon: <Radio size={40} strokeWidth={2.2} className="text-cyan-400" />,
    desc: "Manage Device",
    color: "from-cyan-400 to-blue-400",
  },
  {
    name: "Train Radios",
    icon: <Train size={40} strokeWidth={2.2} className="text-cyan-400" />,
    desc: "Manage Device",
    color: "from-cyan-400 to-blue-400",
  },
  {
    name: "Transcoder",
    icon: <Cpu size={40} strokeWidth={2.2} className="text-cyan-400" />,
    desc: "Manage Device",
    color: "from-cyan-400 to-blue-400",
  },
  {
    name: "Encoder",
    icon: <Disc size={40} strokeWidth={2.2} className="text-cyan-400" />,
    desc: "Manage Device",
    color: "from-cyan-400 to-blue-400",
  },
  {
    name: "OBC",
    icon: <Server size={40} strokeWidth={2.2} className="text-cyan-400" />,
    desc: "Manage Device",
    color: "from-cyan-400 to-blue-400",
  },
  {
    name: "IO Box Controller",
    icon: (
      <SlidersHorizontal
        size={40}
        strokeWidth={2.2}
        className="text-cyan-400"
      />
    ),
    desc: "Manage Device",
    color: "from-cyan-400 to-blue-400",
  },
];

function Dashboard() {
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [discoveredDevices, setDiscoveredDevices] = useState([]);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [discoveryError, setDiscoveryError] = useState("");
  const [isBackendConnected, setIsBackendConnected] = useState(false);
  const [targetIp, setTargetIp] = useState("");
  const [community, setCommunity] = useState("public");
  const [showDiscoveryOptions, setShowDiscoveryOptions] = useState(false);
  const [discoveryFailed, setDiscoveryFailed] = useState(false);
  const [showSystemModal, setShowSystemModal] = useState(false);
  const [systemForm, setSystemForm] = useState({
    systemName: "",
    password: "",
  });

  const [systemLoading, setSystemLoading] = useState(false);
  const [pendingDiscoveryMethod, setPendingDiscoveryMethod] = useState(null);
  const [showCorrectIpModal, setShowCorrectIpModal] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const username = location.state?.username || "";
  const fromBackend = location.state?.fromBackend || false;
  const [deviceTableData, setDeviceTableData] = useState([]);
  const [firmwareList, setFirmwareList] = useState([]);
  const [firmwareResponse, setfirmwareResponse] = useState(false);
  const [showDeviceTable, setShowDeviceTable] = useState(false);
  const [isNewDevice, setIsNewDevice] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [discoverySucceeded, setDiscoverySucceeded] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    const checkBackend = async () => {
      try {
        const available = await apiService.isBackendAvailable();
        setIsBackendConnected(available);
        if (!available) setDiscoveryError("");
      } catch {
        setIsBackendConnected(false);
        setDiscoveryError("Failed to connect to backend server.");
      }
    };
    checkBackend();
  }, []);

  // const isValidIp = (ip) => {
  //   const ipRegex =
  //     /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)(:\d{1,5})?$/;
  //   return ipRegex.test(ip);
  // };

  // const requiresSystemDetails = (category) =>
  //   ["Transcoder", "OBC"].includes(category);

  // const discoverDevices = async (category) => {
  //   setDiscoveryError("");
  //   setDiscoveredDevices([]);
  //   setDeviceTableData([]);
  //   setShowDeviceTable(true);
  //   setDiscoveryFailed(false);
  //   setShowDiscoveryOptions(false);
  //   setIsDiscovering(true);

  //   console.log("Discover Devices clicked for:", category, "IP:", targetIp);

  //   if (!targetIp) {
  //     setDiscoveryError("Please enter IP address");
  //     return;
  //   }

  //   if (!isValidIp(targetIp)) {
  //     setDiscoveryError("Please enter a valid IP address");
  //     return;
  //   }

  //   setIsDiscovering(true);

  //   try {
  //     let devices = [];

  //     if (category === "Station Radios") {
  //       const response = await apiService.discoverDevices("station_radio", {
  //         ip: targetIp,
  //         community,
  //       });

  //       devices = response.candidates.map((device, index) => ({
  //         id: `discovered_${index}`,
  //         name: device.description || `Station Radio at ${device.ip}`,
  //         ip: device.ip,
  //         iconType: <Wifi size={32} className="text-cyan-300" />,
  //         isReal: true,
  //         status: "discovered",
  //       }));

  //       if (!devices.length) {
  //         setDiscoveryError("No Station Radio devices found on the network.");
  //       }
  //     } else if (category === "Train Radios" || category === "Encoder") {
  //       const response = await trainradiosService.discoverDevices(
  //         "train_radio",
  //         {
  //           ip: targetIp,
  //           community,
  //         },
  //       );

  //       devices = response.candidates.map((device, index) => ({
  //         id: `discovered_${index}`,
  //         name: device.description || `Train Radio at ${device.ip}`,
  //         ip: device.ip,
  //         iconType: <Wifi size={32} className="text-cyan-300" />,
  //         isReal: true,
  //         status: "discovered",
  //       }));

  //       if (!devices.length) {
  //         setDiscoveryError(`No ${category} devices found on the network.`);
  //       }
  //     } else if (category === "Transcoder") {
  //       const transcoderData =
  //         await transcoderService.discoverTranscoder(targetIp);
  //       devices = [
  //         {
  //           id: "transcoder_1",
  //           name: transcoderData?.System?.device_name || "Transcoder",
  //           ip: targetIp,
  //           iconType: <Tv size={32} className="text-cyan-300" />,
  //           isReal: true,
  //           status: "discovered",
  //         },
  //       ];
  //     } else if (category === "OBC") {
  //       const uptime = await obcService.discoverOBC(targetIp);
  //       devices = [
  //         {
  //           id: "obc_1",
  //           name: "On Board Controller",
  //           ip: targetIp,
  //           iconType: <Server size={32} className="text-cyan-300" />,
  //           isReal: true,
  //           status: "discovered",
  //           data: { System: { uptime: uptime.uptime || uptime } },
  //         },
  //       ];
  //     } else if (category === "IO Box Controller") {
  //       const IoBoxData = await ioboxcontrollerservice.discoverIobox(targetIp);

  //       devices = [
  //         {
  //           id: "iobox_1",
  //           name: IoBoxData.System.device_name || "IO Box Controller",
  //           ip: targetIp,
  //           icon: <Tv size={32} className="text-cyan-300" />,
  //           isReal: true,
  //           status: "discovered",
  //           data: IoBoxData,
  //         },
  //       ];
  //     }

  //     if (!devices.length) {
  //       setDiscoveryFailed(true);
  //       setDiscoverySucceeded(false);
  //       setDiscoveryError(`No ${category} devices found`);
  //     } else {
  //       setDiscoverySucceeded(true);
  //     }

  //     setDiscoveredDevices(devices);
  //   } catch (error) {
  //     console.error("Device discovery failed:", error);
  //     setDiscoveryError(`Discovery failed: ${error.message}`);
  //     setDiscoveredDevices([]);
  //     setDiscoveryFailed(true);
  //     setShowDiscoveryOptions(true);
  //   } finally {
  //     setIsDiscovering(false);
  //   }
  // };

  // const handleDiscoveryMethod = (method) => {
  //   setDiscoveryError("");
  //   setShowDiscoveryOptions(false);

  //   if (method === "new") {
  //     if (selectedCategory === "Transcoder" || selectedCategory === "OBC") {
  //       setIsNewDevice(true);
  //       setDiscoverySucceeded(false);
  //       setShowSystemModal(true);
  //       return;
  //     }

  //     if (
  //       selectedCategory === "Station Radios" ||
  //       selectedCategory === "Train Radios"
  //     ) {
  //       navigateToFirmwareDirect();
  //       return;
  //     }

  //     setDiscoveryError("New device setup not supported for this category");
  //   }

  //   if (method === "old") {
  //     setShowCorrectIpModal(true);
  //   }
  // };

  // const navigateToFirmwareDirect = () => {
  //   const navState = {
  //     ip: targetIp,
  //     activeTab: "Firmware",
  //     isNewDevice: true,
  //   };

  //   if (selectedCategory === "Station Radios") {
  //     navigate("/device/station-radios/new", { state: navState });
  //   }

  //   if (selectedCategory === "Train Radios") {
  //     navigate("/device/train-radios/new", { state: navState });
  //   }
  // };

  // const handleSystemNext = () => {
  //   if (!systemForm.systemName || !systemForm.password) {
  //     setDiscoveryError("System name and password are required");
  //     return;
  //   }

  //   const navState = {
  //     systemForm,
  //     ip: targetIp,
  //     activeTab: "Firmware",
  //     isNewDevice: !discoverySucceeded,
  //   };

  //   if (selectedCategory === "Transcoder" && !discoverySucceeded) {
  //     navigate("/device/transcoder/transcoder_1", { state: navState });
  //   } else if (selectedCategory === "Transcoder" && discoverySucceeded) {
  //     navigate("/device/transcoder/1", {
  //       state: {
  //         systemForm,
  //         ip: targetIp,
  //         activeTab: "Configuration",
  //         isNewDevice: !discoverySucceeded,
  //       },
  //     });
  //   } else if (selectedCategory === "OBC" && !discoverySucceeded) {
  //     navigate("/device/obc/obc_1", { state: navState });
  //   } else if (selectedCategory === "OBC" && discoverySucceeded) {
  //     navigate("/device/obc/1", {
  //       state: {
  //         systemForm,
  //         ip: targetIp,
  //         activeTab: "Configuration",
  //         isNewDevice: !discoverySucceeded,
  //       },
  //     });
  //   }

  //   setShowSystemModal(false);
  // };

  // const handleCardClick = (name) => {
  //   setSelectedCategory(name);

  //   if (
  //     name === "Transcoder" ||
  //     name === "OBC" ||
  //     name === "Station Radios" ||
  //     name === "Train Radios" ||
  //     name === "Encoder" ||
  //     name === "IO Box Controller"
  //   ) {
  //     setShowDiscoveryOptions(true);
  //   } else {
  //     setDiscoveredDevices([]);
  //     setDiscoveryError("");
  //     setDeviceTableData([]);
  //   }
  // };

  // const handleDeviceClick = (device, category) => {
  //   const safeDevice = {
  //     id: device.id,
  //     ip: device.ip,
  //     name: device.name,
  //     category: category,
  //   };

  //   if (requiresSystemDetails(category)) {
  //     setSelectedDevice(device);
  //     setIsNewDevice(false);
  //     setShowSystemModal(true);
  //     return;
  //   }

  //   if (category === "Transcoder") {
  //     transcoderService
  //       .getTranscoderConfig(device.ip)
  //       .then(({ config, uptime, temp }) => {
  //         navigate(`/device/transcoder/${device.id}`, {
  //           state: {
  //             deviceInfo: safeDevice,
  //             config,
  //             uptime,
  //             temp,
  //             fromBackend: isBackendConnected,
  //           },
  //         });
  //       })
  //       .catch((err) => setDiscoveryError(err.message));
  //     return;
  //   }

  //   if (category === "OBC") {
  //     obcService
  //       .getObcConfig(device.ip)
  //       .then(({ config, uptime }) => {
  //         navigate(`/device/obc/${device.id}`, {
  //           state: {
  //             deviceInfo: safeDevice,
  //             config,
  //             uptime,
  //             fromBackend: isBackendConnected,
  //           },
  //         });
  //       })
  //       .catch((err) => setDiscoveryError(err.message));
  //     return;
  //   }

  //   if (category === "Station Radios") {
  //     apiService
  //       .startSession(device.ip, "station_radio", username, { community })
  //       .then((sessionResponse) => {
  //         console.log("START SESSION RESPONSE:", sessionResponse);

  //         const sessionId =
  //           sessionResponse.session_id || sessionResponse.session;

  //         if (!sessionId) {
  //           throw new Error("Session ID missing from backend response");
  //         }

  //         navigate(`/device/station-radios/${device.id}`, {
  //           state: {
  //             deviceInfo: safeDevice,
  //             sessionId: sessionResponse.session_id,
  //             fromBackend: isBackendConnected,
  //           },
  //         });
  //       })
  //       .catch((err) => setDiscoveryError(err.message));
  //     return;
  //   }

  //   if (category === "Train Radios") {
  //     trainradiosService
  //       .startSession(device.ip, "train_radio", username, { community })
  //       .then((sessionResponse) => {
  //         navigate(`/device/train-radios/${device.id}`, {
  //           state: {
  //             deviceInfo: safeDevice,
  //             sessionId: sessionResponse.session_id,
  //             fromBackend: isBackendConnected,
  //           },
  //         });
  //       })
  //       .catch((err) => setDiscoveryError(err.message));
  //     return;
  //   }

  //   if (category === "Encoder") {
  //     encoderService
  //       .startSession(device.ip, "encoder", username, { community })
  //       .then((sessionResponse) => {
  //         navigate(`/device/encoder/${device.id}`, {
  //           state: {
  //             deviceInfo: safeDevice,
  //             sessionId: sessionResponse.session_id,
  //             fromBackend: isBackendConnected,
  //           },
  //         });
  //       })
  //       .catch((err) => setDiscoveryError(err.message));
  //     return;
  //   }

  //   navigate(`/device/${encodeURIComponent(category)}/${device.id}`);
  // };

  // const handleBack = () => {
  //   setSelectedCategory(null);
  //   setDiscoveredDevices([]);
  //   setDiscoveryError("");
  // };

  // const getDeviceList = (category) => {
  //   if (
  //     category === "Station Radios" ||
  //     category === "Train Radios" ||
  //     category === "Transcoder" ||
  //     category === "OBC" ||
  //     category === "Encoder" ||
  //     category === "IO Box Controller"
  //   )
  //     return discoveredDevices;
  //   return staticDeviceLists[category] || [];
  // };

  useEffect(() => {
    Promise.allSettled([
      apiService.isBackendAvailable(),
      trainradiosService.isBackendAvailable(),
    ]).then((results) => {
      setIsBackendConnected(
        results.some((r) => r.status === "fulfilled" && r.value),
      );
    });
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("authToken");
    navigate("/login", { replace: true });
  };

  const [selected, setSelected] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!selected) return;

    navigate(`/${selected}`, { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-primary">
      <div className="flex justify-end p-4 fixed top-0 right-0 mr-4 mt-4 z-10">
        <button
          className="text-text hover:text-text transition inline justify-end"
          onClick={handleLogout}
        >
          <i className="fa fa-sign-out fa-2x accentColor"></i>
        </button>
      </div>

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

      

      <div className="w-full max-w-5xl mx-auto flex">
        <div className="flex-1">
          <div className="mb-8 text-center">
            <h1 className="text-4xl font-bold text-text mb-2 drop-shadow">
              MetroEMS Dashboard
            </h1>
            <div className="text-text text-lg font-medium drop-shadow">
              Metro Element Management System
            </div>
          </div>

          {/* {selectedCategory ? (
            <div className="bg-white/10 backdrop-blur-md rounded-2xl shadow-2xl p-8">
              <button
                onClick={handleBack}
                className="mb-6 text-blue-200 hover:text-white font-semibold flex items-center gap-2"
              >
                <ArrowRight className="rotate-180" size={20} /> Back to
                Dashboard
              </button>

              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-white">
                  {selectedCategory}
                </h2>

                {[
                  "Station Radios",
                  "Train Radios",
                  "Transcoder",
                  "Encoder",
                  "OBC",
                  "IO Box Controller",
                ].includes(selectedCategory) && (
                  <div className="flex items-center gap-4 flex-wrap">
                    <input
                      type="text"
                      placeholder="Target IP (optional)"
                      value={targetIp}
                      onChange={(e) => setTargetIp(e.target.value.trim())}
                      className="px-2 py-1 rounded bg-blue-900/50 text-blue-100 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400 placeholder-blue-300/50"
                      style={{ width: "160px" }}
                    />

                    <button
                      onClick={() => {
                        if (!isDiscovering) discoverDevices(selectedCategory);
                      }}
                      disabled={isDiscovering}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md flex items-center gap-2 transition disabled:opacity-50"
                    >
                      {isDiscovering ? (
                        <Loader size={16} className="animate-spin" />
                      ) : (
                        <RefreshCw size={16} />
                      )}
                      {isDiscovering ? "Discovering..." : "Discover Devices"}
                    </button>
                  </div>
                )}
              </div>

              {discoveryError && (
                <div className="mb-6 p-4 bg-yellow-500/20 border border-yellow-500 rounded-md flex flex-col items-start gap-2">
                  <div className="flex items-center gap-2">
                    <AlertCircle size={16} className="text-yellow-400" />
                    <span className="text-yellow-100 text-sm">
                      {discoveryError}
                    </span>
                  </div>

                  {discoveryFailed && (
                    <div className="fixed inset-0 flex items-center justify-center z-40 mr-[-10px]">
                      <div className="mt-[200px] p-8 flex gap-4">
                        <button
                          onClick={() => handleDiscoveryMethod("new")}
                          className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-md"
                        >
                          New Device
                        </button>
                        <button
                          onClick={() => handleDiscoveryMethod("old")}
                          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-md"
                        >
                          Existing Device
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {[
                selectedCategory === "Station Radios" ||
                  selectedCategory === "Train Radios" ||
                  selectedCategory === "Transcoder" ||
                  selectedCategory === "OBC" ||
                  selectedCategory === "Encoder" ||
                  (selectedCategory === "IO Box Controller" &&
                    isDiscovering && (
                      <div className="flex items-center justify-center py-12">
                        <div className="text-center">
                          <Loader
                            size={40}
                            className="animate-spin text-blue-400 mx-auto mb-4"
                          />
                          <p className="text-blue-200">
                            Scanning network for devices...
                          </p>
                        </div>
                      </div>
                    )),
              ]}

              {!isDiscovering && (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8">
                  {getDeviceList(selectedCategory).map((device) => (
                    <button
                      key={device.id}
                      onClick={() =>
                        handleDeviceClick(device, selectedCategory)
                      }
                      className="bg-gradient-to-br from-cyan-400 to-blue-400 rounded-2xl shadow-xl flex flex-col items-center justify-center py-8 px-4 transition hover:scale-105 hover:shadow-2xl relative"
                      style={{
                        minHeight: "140px",
                        boxShadow: "0 8px 32px 0 rgba(31, 38, 135, 0.37)",
                      }}
                    >
                      {(selectedCategory === "Station Radios" ||
                        selectedCategory === "Train Radios" ||
                        selectedCategory === "Transcoder" ||
                        selectedCategory === "OBC" ||
                        selectedCategory === "Encoder" ||
                        selectedCategory === "IO Box Controller") && (
                        <div className="absolute top-2 right-2">
                          {device.isReal ? (
                            <div
                              className="w-3 h-3 bg-green-400 rounded-full animate-pulse"
                              title="Real Device"
                            />
                          ) : (
                            <div
                              className="w-3 h-3 bg-yellow-400 rounded-full"
                              title="Simulation"
                            />
                          )}
                        </div>
                      )}
                      <div className="mb-3">{device.icon}</div>
                      <div className="text-white text-lg font-semibold text-center">
                        {device.name}
                      </div>
                      {(selectedCategory === "Station Radios" ||
                        selectedCategory === "Train Radios" ||
                        selectedCategory === "Transcoder" ||
                        selectedCategory === "OBC" ||
                        selectedCategory === "Encoder" ||
                        selectedCategory === "IO Box Controller") &&
                        device.ip && (
                          <div className="text-blue-100 text-sm mt-1">
                            {device.ip}
                          </div>
                        )}
                      <div className="text-blue-100 text-sm mt-1">
                        {selectedCategory === "Station Radios" ||
                        selectedCategory === "Train Radios" ||
                        selectedCategory === "Transcoder" ||
                        selectedCategory === "OBC" ||
                        selectedCategory === "Encoder" ||
                        selectedCategory === "IO Box Controller"
                          ? "Connect"
                          : "Manage Device"}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : ( */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
              <div className="col-span-1 sm:col-span-2 lg:col-span-3 flex justify-center">
                <form
                  onSubmit={handleSubmit}
                  className="bg-card backdrop-blur-md rounded-2xl shadow-2xl p-8 w-full max-w-md mx-auto"
                  //  className="bg-[#EAE0CF] rounded-3xl shadow-xl border border-gray-200 p-8 w-full max-w-md"

                >
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-2xl font-bold text-text">
                      Select Options
                    </h3>
                  </div>

                  <div className="space-y-4">
                    {[
                      { label: "Station", value: "stationview" },
                      { label: "Train", value: "trainview" },
                    ].map((opt) => (
                      <label
                        key={opt.value}
                        className={`flex items-center gap-4 p-4 rounded-xl cursor-pointer border transition
                  ${
                    selected === opt.value
                      // ? "border-cyan-400 bg-cyan-400/20"
                      ? "border-cyan-400 bg-buttonPrimary"
                      : "border-blue-500/30 hover:bg-blue-500/10"
                  }`}
                      >
                        <input
                          type="radio"
                          name="option"
                          value={opt.value}
                          checked={selected === opt.value}
                          onChange={(e) => setSelected(e.target.value)}
                          className="accent-cyan-400 scale-125"
                        />

                        <span className="text-text text-lg font-medium">
                          {opt.label}
                        </span>
                      </label>
                    ))}
                  </div>

                  <button
                    type="submit"
                    disabled={!selected}
                    className="mt-8 w-full bg-buttonSecondary
                      hover:from-cyan-500 hover:to-blue-600
                      text-white font-semibold py-3 rounded-xl
                      transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Submit
                  </button>
                </form>
              </div>
            </div>
          {/* )} */}
        </div>
      </div>

      {/* {showSystemModal &&
        (selectedCategory === "Transcoder" || selectedCategory === "OBC") && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-md relative">
              <button
                onClick={() => {
                  setShowSystemModal(false);
                  setPendingDiscoveryMethod(null);
                }}
                className="absolute top-3 right-3 text-gray-400 hover:text-gray-700"
              >
                ✕
              </button>

              <h2 className="text-xl font-bold mb-4">
                {selectedCategory === "Transcoder"
                  ? "Transcoder Details"
                  : "OBC Details"}
              </h2>

              <input
                type="text"
                placeholder="System Name"
                value={systemForm.systemName}
                onChange={(e) =>
                  setSystemForm({ ...systemForm, systemName: e.target.value })
                }
                className="mb-3 w-full px-3 py-2 border rounded"
              />

              <input
                type="password"
                placeholder="Password"
                value={systemForm.password}
                onChange={(e) =>
                  setSystemForm({ ...systemForm, password: e.target.value })
                }
                className="mb-4 w-full px-3 py-2 border rounded"
              />

              <button
                disabled={systemLoading}
                onClick={handleSystemNext}
                className="bg-blue-600 disabled:bg-gray-400 text-white px-4 py-2 w-[100px] rounded flex items-center justify-center mx-auto block"
              >
                {systemLoading ? "Discovering..." : "Next"}
              </button>
            </div>
          </div>
        )} */}

      {/* {showCorrectIpModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md relative">
            <button
              onClick={() => setShowCorrectIpModal(false)}
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-700"
            >
              ✕
            </button>

            <h2 className="text-xl font-bold mb-4">Enter Correct IP Address</h2>

            <input
              type="text"
              placeholder="Enter IP"
              value={targetIp}
              onChange={(e) => setTargetIp(e.target.value.trim())}
              className="mb-4 w-full px-3 py-2 border rounded"
            />

            <button
              onClick={() => {
                if (!isValidIp(targetIp)) {
                  setDiscoveryError("Please enter a valid IP address");
                  return;
                }
                setShowCorrectIpModal(false);
                discoverDevices(selectedCategory);
              }}
              className="bg-blue-600 text-white px-4 py-2 rounded w-full"
            >
              Discover Devices
            </button>
          </div>
        </div>
      )} */}

      {showSettings && (
        <SettingsPanel
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}

export default Dashboard;
