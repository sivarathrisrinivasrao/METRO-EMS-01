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
import encoderService from "../services/encoderService";
import SettingsPanel from "./setting";

// Static fallback device lists
const staticDeviceLists = {
  // 'Train Radios': [
  //   { id: 1, name: 'Train Device 1', icon: <MonitorSmartphone size={32} className="text-cyan-300" /> },
  //   { id: 2, name: 'Train Device 2', icon: <MonitorSmartphone size={32} className="text-cyan-300" /> },
  // ],
  // 'Transcoder': [
  //   { id: 1, name: 'Transcoder Device 1', icon: <Tv size={32} className="text-cyan-300" /> },
  //   { id: 2, name: 'Transcoder Device 2', icon: <Tv size={32} className="text-cyan-300" /> },
  // ],
  // 'Encoder': [
  //   { id: 1, name: 'Encoder Device 1', icon: <Camera size={32} className="text-cyan-300" /> },
  //   { id: 2, name: 'Encoder Device 2', icon: <Camera size={32} className="text-cyan-300" /> },
  // ],
  // 'OBC': [
  //   { id: 1, name: 'OBC Device 1', icon: <CpuChip size={32} className="text-cyan-300" /> },
  //   { id: 2, name: 'OBC Device 2', icon: <CpuChip size={32} className="text-cyan-300" /> },
  // ],
  // 'IO Box Controller': [
  //   { id: 1, name: 'IO Box Device 1', icon: <Box size={32} className="text-cyan-300" /> },
  //   { id: 2, name: 'IO Box Device 2', icon: <Box size={32} className="text-cyan-300" /> },
  // ],
};

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

function StationView() {
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
  const [loadingDeviceId, setLoadingDeviceId] = useState(null);
  const [showSettings, setShowSettings] = useState(false);

  // Check backend connection (only needed for Station Radios and similar)
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

  const handleBack = () => {
    setSelectedCategory(null);
    setDiscoveredDevices([]);
    setDiscoveryError("");
    navigate("/dashboard", { replace: true });
  };

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
  const [showStationDevices, setShowStationDevices] = useState(false);

  // const stations = [
  //   { label: "Select Station", value: "" },
  //   { label: "Highway 407", value: "Highway 407" },
  //   { label: "Pionneer Village", value: "Pionneer Village" },
  //   { label: "Finch West", value: "Finch West" },
  // ];

  const [selectedStation, setSelectedStation] = useState("");

  const [stations, setStations] = useState([
    { label: "Loading stations...", value: "" },
  ]);

  // const stationRadios = [
  //   { zone: "SBNE" },
  //   { zone: "SBSE" },
  //   { zone: "NBNE" },
  //   { zone: "NBSE" },
  // ];

  useEffect(() => {
    const fetchStations = async () => {
      try {
        const data = await apiService.getStations();
        setStations([
          { label: "Select Station", value: "" },
          ...data.map((station) => ({
            label: station.name,
            value: station.id,
          })),
        ]);
      } catch (err) {
        setDiscoveryError("Failed to load stations: " + err.message);
      }
    };

    fetchStations();
  }, []);

  const [deviceData, setDeviceData] = useState({
    station: [],
    transcoder: [],
    encoder: [],
  });

  const discoverDevices = async () => {
    if (!selectedStation) return;
    setDeviceData({
      station: [],
      transcoder: [],
      encoder: [],
    });
    setShowStationDevices(false);
    setDiscoveryError("");
    setIsDiscovering(true);

    try {
      const devices = await apiService.getDevicesByStation(selectedStation);
      setDeviceData(devices);
      setShowStationDevices(true);
    } catch (err) {
      setDeviceData({
        station: [],
        transcoder: [],
        encoder: [],
      });
      setShowStationDevices(false);
      setDiscoveryError(err.message);
    } finally {
      setIsDiscovering(false);
    }
  };

  const handleStartSession = async (device, category) => {
    if (category === "transcoder") {
      const ip = device.ip || device.label;
      try {
        const result = await transcoderService.startMediaTranscoder(
          ip,
          "start",
        );
        const { config, uptime, temp } = result;

        navigate(`/device/transcoder/${device.label}`, {
          state: {
            deviceInfo: {
              ip: device.label,
              name: device.sysName,
              config,
              uptime,
              temp,
            },
            selectedStation,
            deviceData,
          },
        });
      } catch (err) {
        setDiscoveryError(err.message);
      }
      return;
    }
  };

  const handleDeviceClick = async (device, category) => {
    const ip = device.ip || device.label;
    const deviceId = device.id || device.label;
    setLoadingDeviceId(deviceId);

    try {
      if (category === "Station Radios") {
        try {
          const radioCheck = await apiService.discoverRadioDevices(
            "station_radio",
            {
              ip: ip,
            },
          );

          if (radioCheck?.error) {
            // alert(radioCheck.error);
            // alert(
            //   "Device not found\n\nPossible reasons:\n1. Invalid IP address\n2. Device is down or not reachable",
            // );
             setDiscoveryError("Device not up/Agent not started.");
            return;
          }

          const message =
            typeof radioCheck === "string"
              ? radioCheck.toLowerCase()
              : (radioCheck?.message || "").toLowerCase();

          if (message.includes("not found") || message.includes("failure")) {
            // alert("Radio Device Not Found");
             setDiscoveryError("Device not up/Agent not started.");
            return;
          }

          const response = await apiService.discoverDevices("station_radio", {
            ips: [ip],
            community: "public",
          });

          if (!response || response.total_devices_found === 0) {
            // alert(
            //   "Device not found\n\nPossible reasons:\n1. Invalid IP address\n2. Device is down or not reachable",
            // );
             setDiscoveryError("Device not up/Agent not started.");
            return;
          }

          setDiscoveredDevices(response);
          setShowStationDevices(true);
        } catch (err) {
          // alert(err.message || "Radio discovery failed");
           setDiscoveryError("Device not up/Agent not started.");
        }
      }

      if (category === "Encoder") {
        try {
          const radioCheck = await encoderService.discoverRadioDevices(
            "encoder",
            {
              ip: ip,
            },
          );

          if (radioCheck?.error) {
            // alert(
            //   "Device not found\n\nPossible reasons:\n1. Invalid IP address\n2. Device is down or not reachable",
            // );
              setDiscoveryError("Device not up/Agent not started.");
            return;
          }

          const message =
            typeof radioCheck === "string"
              ? radioCheck.toLowerCase()
              : (radioCheck?.message || "").toLowerCase();

          if (message.includes("not found") || message.includes("failure")) {
            // alert("Encoder Device Not Found");
              setDiscoveryError("Device not up/Agent not started.");
            return;
          }

          const response = await encoderService.discoverDevices("encoder", {
            ips: [ip],
            community: "public",
          });

          if (!response || response.total_devices_found === 0) {
            // alert(
            //   "Device not found\n\nPossible reasons:\n1. Invalid IP address\n2. Device is down or not reachable",
            // );
              setDiscoveryError("Device not up/Agent not started.");
            return;
          }

          setDiscoveredDevices(response);
          setShowStationDevices(true);

          const sessionResponse = await encoderService.startSession(
            ip,
            "encoder",
            username,
            { community },
          );

          navigate(`/device/encoder/${device.label}`, {
            state: {
              deviceInfo: {
                ip: device.label,
                name: device.sysName,
                sessionId: sessionResponse.session_id,
              },
              selectedStation,
              deviceData: response,
            },
          });
        } catch (err) {
          console.error(err);

          // alert(
          //   "Device not found\n\nPossible reasons:\n1. Invalid IP address\n2. Device is down or not reachable",
          // );
            setDiscoveryError("Device not up/Agent not started.");

          // setDiscoveryError(err.message || "Encoder discovery failed");
        } finally {
          setIsDiscovering(false);
        }
      }

      if (category === "Transcoder") {
        try {
          await transcoderService.startMediaTranscoder(ip, "start");

          const discoveryResponse =
            await transcoderService.discoverTranscoder(ip);

          if (
            !discoveryResponse ||
            Object.keys(discoveryResponse).length === 0
          ) {
            // alert(
            //   "Device not found\n\nPossible reasons:\n1. Invalid IP address\n2. Device is down or not reachable",
            // );
              setDiscoveryError("Device not up/Agent not started.");
            return;
          }

          setDiscoveredDevices([discoveryResponse]);
          setShowStationDevices(true);

          const { config, uptime, temp } =
            await transcoderService.getTranscoderConfig(ip);

          navigate(`/device/transcoder/${device.label}`, {
            state: {
              deviceInfo: {
                ip: device.label,
                name: device.sysName,
                config,
                uptime,
                temp,
              },
              selectedStation,
              deviceData,
            },
          });
        } catch (err) {
          console.error(err);
          // alert(
          //   "Device not found\n\nPossible reasons:\n1. Invalid IP address\n2. Device is down or not reachable",
          // );
            setDiscoveryError("Device not up/Agent not started.");
          // setDiscoveryError(err.message || "transcoder discovery failed");
        } finally {
          setIsDiscovering(false);
        }

        return;
      }
    } catch (err) {
      // setDiscoveryError(err.message || "Staion radios discovery failed");
        setDiscoveryError("Device not up/Agent not started.");
    } finally {
      setIsDiscovering(false);
      setLoadingDeviceId(null);
    }

    const safeDevice = {
      ip,
      name: device.sysName,
      category,
    };

    if (category === "Transcoder") {
      transcoderService
        .getTranscoderConfig(ip)
        .then(({ config, uptime, temp }) => {
          navigate(`/device/transcoder/${device.label}`, {
            state: {
              deviceInfo: {
                ip: device.label,
                name: device.sysName,
                config,
                uptime,
                temp,
              },
              selectedStation,
              deviceData,
            },
          });
        })
        .catch((err) => setDiscoveryError(err.message));
      return;
    }

    if (category === "Station Radios") {
      apiService
        .startSession(ip, "station_radio", "admin", { community })
        .then((sessionResponse) => {
          navigate(`/device/station-radios/${device.label}`, {
            state: {
              deviceInfo: {
                ip: device.label,
                name: device.sysName,
                sessionId: sessionResponse.session_id,
              },
              selectedStation,
              deviceData,
            },
          });
        })
        .catch((err) => setDiscoveryError(err.message));
      return;
    }

    if (category === "Train Radios") {
      trainradiosService
        .startSession(ip, "train_radio", username, { community })
        .then((sessionResponse) => {
          navigate(`/device/train-radios/${deviceId}`, {
            state: {
              deviceInfo: safeDevice,
              sessionId: sessionResponse.session_id,
            },
            selectedStation,
            deviceData,
          });
        })
        .catch((err) => setDiscoveryError(err.message));
      return;
    }

    if (category === "Encoder") {
      encoderService
        .startSession(ip, "encoder", username, { community })
        .then((sessionResponse) => {
          navigate(`/device/encoder/${device.label}`, {
            state: {
              deviceInfo: {
                ip: device.label,
                name: device.sysName,
                sessionId: sessionResponse.session_id,
              },
              selectedStation,
              deviceData,
            },
          });
        })
        .catch((err) => setDiscoveryError(err.message));
      return;
    }
  };

  useEffect(() => {
    if (location.state?.selectedStation && location.state?.deviceData) {
      setSelectedStation(location.state.selectedStation);
      // setDeviceData(location.state.deviceData);
      setDeviceData({
        station: location.state.deviceData?.station || [],
        transcoder: location.state.deviceData?.transcoder || [],
        encoder: location.state.deviceData?.encoder || [],
      });
      setShowStationDevices(true);
    }
  }, [location.state]);

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
            <div className="bg-card backdrop-blur-md rounded-2xl shadow-2xl p-8">
              <button
                onClick={handleBack}
                className="mb-6 text-text hover:text-text font-semibold flex items-center gap-2"
              >
                <ArrowRight className="rotate-180" size={20} /> Back to
                Dashboard
              </button>
              <div className="flex items-center justify-center mb-6">
                {/* <h2 className="text-2xl font-bold text-white">Station </h2>e */}

                <div className="flex items-center gap-6 flex-wrap">
                  <select
                    id="selectedStation"
                    name="selectedStation"
                    value={selectedStation}
                    onChange={(e) => {
                      setSelectedStation(e.target.value);

                      // Clear previous devices
                      setDeviceData({
                        station: [],
                        transcoder: [],
                        encoder: [],
                      });
                      setShowStationDevices(false);
                      setDiscoveryError("");
                    }}
                    className="px-2 py-1 rounded bg-card text-text text-sm
                                                        focus:outline-none focus:ring-2 focus:ring-blue-400
                                                        border border-blue-500/30"
                    style={{ width: "160px" }}
                  >
                    {stations.map((station) => (
                      <option
                        key={station.value}
                        value={station.value}
                        className="bg-card text-text"
                      >
                        {station.label}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={discoverDevices}
                    disabled={!selectedStation || isDiscovering}
                    className="bg-buttonPrimary hover:bg-blue-600 text-white px-4 py-2
                                                        rounded-md flex items-center gap-2 transition
                                                        disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isDiscovering ? (
                      <Loader size={16} className="animate-spin" />
                    ) : (
                      <RefreshCw size={16} />
                    )}
                    {isDiscovering ? "Discovering..." : "Discover"}
                  </button>
                </div>
              </div>
              {showStationDevices && (
                <div className="mt-10 space-y-10">
                  <div className="grid grid-cols-6 sm:grid-cols-6 gap-4">
                    {deviceData.station.map((device, idx) => (
                      <button
                        key={idx}
                        onClick={() =>
                          handleDeviceClick(device, "Station Radios")
                        }
                        // disabled={
                        //   loadingDeviceId === (device.id || device.label)
                        // }
                        disabled={loadingDeviceId !== null}
                        className={`rounded-2xl shadow-xl flex flex-col items-center justify-center
                                                          w-[118px] h-[118px] mx-auto transition
                                                          ${
                                                            // loadingDeviceId ===
                                                            // (device.id ||
                                                            //   device.label)
                                                            //   ? "bg-gray-400 cursor-not-allowed"
                                                            //   : "bg-buttonPrimary from-cyan-400 to-blue-400 hover:scale-105"

                                                               loadingDeviceId === (device.id || device.label)
                                                                ? "bg-gray-400 cursor-not-allowed"
                                                                : loadingDeviceId !== null
                                                                ? "bg-buttonPrimary cursor-not-allowed"
                                                                : "bg-buttonPrimary cursor-pointer from-cyan-400 to-blue-400 hover:scale-105"
                                                          }`}
                      >
                        {loadingDeviceId === (device.id || device.label) ? (
                          <Loader
                            size={28}
                            className="animate-spin text-text mb-2"
                          />
                        ) : (
                          <Wifi size={36} className="text-text mb-2" />
                        )}

                        <div className="text-text  text-[12px] font-semibold">
                          {device.sysName} <br />
                          {/* {device.deviceType} */}
                        </div>
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-6 gap-4">
                    {deviceData.transcoder.map((device, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          handleDeviceClick(device, "Transcoder");
                          // handleStartSession(device, 'transcoder')
                        }}
                        // disabled={
                        //   loadingDeviceId === (device.id || device.label)
                        // }
                        disabled={loadingDeviceId !== null}
                        className={`rounded-2xl shadow-xl
                                                            flex flex-col items-center justify-center
                                                            w-[118px] h-[118px] mx-auto transition
                                                            ${
                                                              // loadingDeviceId ===
                                                              // (device.id ||
                                                              //   device.label)
                                                              //   ? "bg-gray-400 cursor-not-allowed"
                                                              //   : "bg-buttonPrimary from-cyan-400 to-blue-400 hover:scale-105"
                                                                loadingDeviceId === (device.id || device.label)
      ? "bg-gray-400 cursor-not-allowed"
      : loadingDeviceId !== null
      ? "bg-buttonPrimary cursor-not-allowed"
      : "bg-buttonPrimary cursor-pointer from-cyan-400 to-blue-400 hover:scale-105"
                                                            }`}
                      >
                        {loadingDeviceId === (device.id || device.label) ? (
                          <Loader
                            size={28}
                            className="animate-spin text-text mb-2"
                          />
                        ) : (
                          <Tv size={36} className="text-text mb-2" />
                        )}

                        <div className="text-text text-sm font-semibold">
                          {device.sysName}
                        </div>

                        <div className="text-text text-xs mt-1 text-center">
                          {device.radioMode} <br />
                          {device.deviceType}
                        </div>
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-6 gap-4">
                    {deviceData.encoder.map((device, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleDeviceClick(device, "Encoder")}
                        // disabled={
                        //   loadingDeviceId === (device.id || device.label)
                        // }
                        disabled={loadingDeviceId !== null}
                        className={`rounded-2xl shadow-xl
                                                          flex flex-col items-center justify-center
                                                          w-[118px] h-[118px] mx-auto transition
                                                          ${
                                                            // loadingDeviceId ===
                                                            // (device.id ||
                                                            //   device.label)
                                                            //   ? "bg-gray-400 cursor-not-allowed"
                                                            //   : "bg-buttonPrimary from-cyan-400 to-blue-400 hover:scale-105"
                                                               loadingDeviceId === (device.id || device.label)
      ? "bg-gray-400 cursor-not-allowed"
      : loadingDeviceId !== null
      ? "bg-buttonPrimary cursor-not-allowed"
      : "bg-buttonPrimary cursor-pointer from-cyan-400 to-blue-400 hover:scale-105"
                                                          }`}
                      >
                        {loadingDeviceId === (device.id || device.label) ? (
                          <Loader
                            size={28}
                            className="animate-spin text-text mb-2"
                          />
                        ) : (
                          <Server size={36} className="text-text mb-2" />
                        )}

                        <div className="text-text text-sm font-semibold">
                          {device.sysName}
                        </div>

                        <div className="text-text text-xs mt-1 text-center">
                          {device.radioMode} <br />
                          {device.deviceType}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

               {/* {discoveryError && (
                                  <div className="mt-4 flex items-center gap-2 text-red-600 text-sm justify-center">
                                    <AlertCircle size={14} />
                                    {discoveryError}
                                  </div>
                                )} */}

                                  {discoveryError && (
                                  <div
                                    className="mt-4 mx-auto flex items-center justify-center gap-2
                                               rounded-lg border border-red-500/30
                                               bg-red-500/10 px-4 py-2
                                               text-red-600 text-sm font-medium
                                               max-w-fit"
                                  >
                                    <AlertCircle size={16} className="text-red-600 shrink-0" />
                                    <span>{discoveryError}</span>
                                  </div>
                                )}
            </div>
          </div>
          <></>
        </div>
         {showSettings && (
        <SettingsPanel
          onClose={() => setShowSettings(false)}
        />
      )}
      </div>
    </>
  );
}

export default StationView;
