import React, { useEffect, useState } from "react";
import {
  Settings,
  Save,
  X,
  Shield,
  Server,
  Loader,
  AlertCircle,
  CheckCircle,
} from "lucide-react";

const API_URL = "http://localhost:8002";

function SettingsPanel({ onClose }) {
  const [settings, setSettings] = useState({
    radio_snmp_read: "",
    radio_snmp_write: "",
    encoder_snmp_read: "",
    encoder_snmp_write: "",
    tftp_ip: "",
  });

  const [originalSettings, setOriginalSettings] = useState({
    radio_snmp_read: "",
    radio_snmp_write: "",
    encoder_snmp_read: "",
    encoder_snmp_write: "",
    tftp_ip: "",
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [applying, setApplying] = useState(false);

  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [applied, setApplied] = useState(false);
  const [saveEnabled, setSaveEnabled] = useState(false);
  const [applyEnabled, setApplyEnabled] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(`${API_URL}/settings`, {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to load settings (${response.status})`);
        }

        const data = await response.json();

        console.log("GET /settings response:", data);

        if (data.status !== "success") {
          throw new Error(data.message || "Failed to load settings");
        }

        if (data.settings) {
          const loadedSettings = {
            radio_snmp_read: data.settings.radio_snmp_read || "",

            radio_snmp_write: data.settings.radio_snmp_write || "",

            encoder_snmp_read: data.settings.encoder_snmp_read || "",

            encoder_snmp_write: data.settings.encoder_snmp_write || "",

            tftp_ip: data.settings.tftp_ip || "",
          };

          setSettings(loadedSettings);
          setOriginalSettings(loadedSettings);
          setSaveEnabled(false);
        setApplyEnabled(false);
        setSaved(false);
        setApplied(false);
        }
      } catch (err) {
        console.error("Settings GET error:", err);

        setError(err.message || "Unable to load settings");
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;

    setSettings((prev) => ({
      ...prev,
      [name]: value,
    }));
setSaveEnabled(true);
    setApplyEnabled(false);
    setSaved(false);
    setApplied(false);
    setError("");
  };

    const handleSave = () => {
   
    setSaving(true);
    setError("");
    setSaved(false);

    try {
      // Save locally
      localStorage.setItem(
        "metroEMSSettings",
        JSON.stringify(settings)
      );

      setSaved(true);

      // Save disabled
      setSaveEnabled(false);

      // Apply enabled
      setApplyEnabled(true);

      setTimeout(() => {
        setSaved(false);
      }, 3000);
    } catch (err) {
      console.error("Settings save error:", err);

      setError(
        err.message || "Unable to save settings"
      );
    } finally {
      setSaving(false);
    }
  };

   const handleApply = async () => {
    if (!applyEnabled) {
      return;
    }

    setApplying(true);
    setError("");
    setApplied(false);

    try {
      console.log("PUT /settings body:", settings);

      const response = await fetch(`${API_URL}/settings`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          radio_snmp_read: settings.radio_snmp_read,
          radio_snmp_write: settings.radio_snmp_write,
          encoder_snmp_read: settings.encoder_snmp_read,
          encoder_snmp_write: settings.encoder_snmp_write,
          tftp_ip: settings.tftp_ip,
        }),
      });

      if (!response.ok) {
        throw new Error(
          `Failed to apply settings (${response.status})`
        );
      }

      const data = await response.json();

      console.log("PUT /settings response:", data);

      if (data.status !== "success") {
        throw new Error(
          data.message || "Failed to apply settings"
        );
      }

      // --------------------------------------------------------
      // Update inputs with response from backend
      // --------------------------------------------------------
      if (data.settings) {
        setSettings({
          radio_snmp_read:
            data.settings.radio_snmp_read || "",

          radio_snmp_write:
            data.settings.radio_snmp_write || "",

          encoder_snmp_read:
            data.settings.encoder_snmp_read || "",

          encoder_snmp_write:
            data.settings.encoder_snmp_write || "",

          tftp_ip:
            data.settings.tftp_ip || "",
        });
      }

      // --------------------------------------------------------
      // After successful Apply
      // --------------------------------------------------------
      setSaveEnabled(false);
      setApplyEnabled(false);

      setSaved(false);
      setApplied(true);

      // Update local storage
      localStorage.setItem(
        "metroEMSSettings",
        JSON.stringify(data.settings || settings)
      );

      setTimeout(() => {
        setApplied(false);
      }, 3000);
    } catch (err) {
      console.error("Settings PUT error:", err);

      setError(
        err.message || "Unable to apply settings"
      );

      /*
       * If API fails:
       * Keep Apply enabled so user can try again.
       */
      setApplyEnabled(true);
    } finally {
      setApplying(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} />

      <div className="fixed right-9 top-1/2 -translate-y-1/2 z-50 w-[380px] max-h-[75vh] overflow-y-auto bg-card rounded-2xl shadow-2xl border border-blue-500/20">
        <div className="sticky top-0 z-10 bg-card border-b border-blue-500/20 px-5 py-4 flex items-center justify-between rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-buttonPrimary flex items-center justify-center">
              <Settings size={21} className="text-white" />
            </div>

            <div>
              <h2 className="text-xl font-bold text-text">Settings</h2>

              <p className="text-xs text-text opacity-60">
                MetroEMS Configuration
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-lg text-text hover:bg-black/10 transition">
            <X size={21} />
          </button>
        </div>

        {loading && (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader size={35} className="animate-spin text-cyan-400 mb-4" />

            <p className="text-text text-sm">Loading settings...</p>
          </div>
        )}

        {!loading && error && (
          <div className="mx-5 mt-5">
            <div
              className="flex items-start gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/30">
              <AlertCircle size={20} className="text-red-400 mt-0.5" />

              <div>
                <p className="text-red-400 text-sm font-medium">
                  Settings Error
                </p>

                <p className="text-red-300/80 text-xs mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

       
        {!loading && (
          <div className="p-5 space-y-5">
            <div
              className="rounded-2xl border border-blue-500/20 bg-black/5 p-4">
              <div className="flex items-center gap-3 mb-4">
                <div
                  className="w-9 h-9 rounded-lg bg-buttonPrimary flex items-center justify-center">
                  <Shield size={18} className="text-white" />
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-text">SNMP</h3>

                  <p className="text-xs text-text opacity-60">
                    SNMP Community Configuration
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {/* Radio Read */}
                <div>
                  <label className="block text-sm font-medium text-text mb-1.5">
                    Radio Read
                  </label>

                  <input
                    type="text"
                    name="radio_snmp_read"
                    value={settings.radio_snmp_read}
                    onChange={handleChange}
                    className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-blue-500/30 text-text outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20"/>
                </div>

                {/* Radio Write */}
                <div>
                  <label className="block text-sm font-medium text-text mb-1.5">
                    Radio Write
                  </label>

                  <input
                    type="text"
                    name="radio_snmp_write"
                    value={settings.radio_snmp_write}
                    onChange={handleChange}
                    className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-blue-500/30 text-text outline-none focus:border-cyan-400 focus:ring-2
                      focus:ring-cyan-400/20"/>
                </div>

                {/* Encoder Read */}
                <div>
                  <label className="block text-sm font-medium text-text mb-1.5">
                    Encoder Read
                  </label>

                  <input
                    type="text"
                    name="encoder_snmp_read"
                    value={settings.encoder_snmp_read}
                    onChange={handleChange}
                    className=" w-full px-3 py-2.5 rounded-xl bg-white/5 border border-blue-500/30 text-text outline-none focus:border-cyan-400 focus:ring-2
                     focus:ring-cyan-400/20"/>
                </div>

                {/* Encoder Write */}
                <div>
                  <label className="block text-sm font-medium text-text mb-1.5">
                    Encoder Write
                  </label>

                  <input
                    type="text"
                    name="encoder_snmp_write"
                    value={settings.encoder_snmp_write}
                    onChange={handleChange}
                    className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-blue-500/30 text-text outline-none focus:border-cyan-400 focus:ring-2
                      focus:ring-cyan-400/20"/>
                </div>
              </div>
            </div>

           
            <div
              className="rounded-2xl border border-blue-500/20 bg-black/5 p-4">
              <div className="flex items-center gap-3 mb-4">
                <div
                  className="w-9 h-9 rounded-lg bg-buttonPrimary flex items-center justify-center">
                  <Server size={18} className="text-white" />
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-text">TFTP</h3>

                  <p className="text-xs text-text opacity-60">
                    File Transfer Server
                  </p>
                </div>
              </div>

              <label className="block text-sm font-medium text-text mb-1.5">
                TFTP Server IP
              </label>

              <input
                type="text"
                name="tftp_ip"
                value={settings.tftp_ip}
                onChange={handleChange}
                className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-blue-500/30 text-text outline-none focus:border-cyan-400 focus:ring-2
                  focus:ring-cyan-400/20"/>
            </div>

           
            <div className="flex gap-3">
              {/* RESET */}
              {/* <button
                onClick={handleReset}
                disabled={saving || applying}
                className="flex-1 flex items-center justify-center gap-2 bg-black/10 hover:bg-black/20 text-text font-semibold py-3 rounded-xl transition
                  border border-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed">
                <X size={18} />
                Reset
              </button> */}

              {/* SAVE */}
              <button
                onClick={handleSave}
                // disabled={saving || applying}
                 disabled={!saveEnabled || saving || applying}
                className="flex-1 flex items-center justify-center gap-2 bg-buttonSecondary hover:opacity-90 text-white font-semibold py-3 rounded-xl transition
                  disabled:opacity-50 disabled:cursor-not-allowed">
                {saving ? (
                  <>
                    <Loader size={18} className="animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save size={18} />
                    Save
                  </>
                )}
              </button>

              {/* APPLY */}
              <button
                onClick={handleApply}
                // disabled={applying || saving}
                 disabled={!applyEnabled || applying || saving}
                className="flex-1 flex items-center justify-center gap-2 bg-buttonPrimary hover:opacity-90 text-white font-semibold py-3 rounded-xl transition
                  disabled:opacity-50 disabled:cursor-not-allowed">
                {applying ? (
                  <>
                    <Loader size={18} className="animate-spin" />
                    Applying...
                  </>
                ) : (
                  <>
                    <CheckCircle size={18} />
                    Apply
                  </>
                )}
              </button>
            </div>

          
            {saved && (
              <div
                className="flex items-center justify-center gap-2 text-sm text-green-500 font-medium">
                <CheckCircle size={17} />
                Settings saved locally.
              </div>
            )}

           
            {applied && (
              <div
                className="flex items-center justify-center gap-2 text-sm text-green-500 font-medium">
                <CheckCircle size={17} />
                Settings applied successfully.
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

export default SettingsPanel;
