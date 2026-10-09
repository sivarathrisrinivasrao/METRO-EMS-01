import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import apiService from '../services/apiService';
import transcoderService from '../services/transcoderService';

function SynicView() {
  const navigate = useNavigate();
  const location = useLocation();

  const [isSyncing, setIsSyncing] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState(false);
  const [discoveryError, setDiscoveryError] = useState('');
  const [checkSyncResult, setCheckSyncResult] = useState(null);

useEffect(() => {
    const fetchCheckSync = async () => {
      try {
        const result = await apiService.getCheckSync();
        setCheckSyncResult(result);
      } catch (err) {
        console.error("Check sync failed:", err);
      }
    };
    fetchCheckSync();
  }, []);


  const handleLogout = () => {
    sessionStorage.removeItem("demo_auth");
    navigate("/login", { replace: true });
    window.location.reload();
  };


    const handleSyncAll = async () => {
      setIsSyncing(true);
      setSyncSuccess(false);
      setDiscoveryError('');

      let nodesRes = null;
      let facilitiesRes = null;

      try {
        [nodesRes, facilitiesRes] = await Promise.all([
          apiService.syncNodes(),
          apiService.syncFacilities()
        ]);
      } catch (err) {
        setDiscoveryError("Sync failed: " + err.message);
      }

      try {
        const checkResult = await apiService.getCheckSync();
        setCheckSyncResult(checkResult);
      } catch (err) {
        setDiscoveryError(prev => prev ? prev + " | CheckSync failed" : "CheckSync failed");
      }

      const nodesStatus = nodesRes?.status === 'updated' || nodesRes?.status === 'ok';
      const facilitiesStatus = facilitiesRes?.status === 'updated' || facilitiesRes?.status === 'ok';

      if (nodesStatus && facilitiesStatus) {
        setSyncSuccess(true);
        setDiscoveryError('');
      } else {
        setSyncSuccess(false);
        if (!discoveryError) {
          setDiscoveryError("Sync failed: one or more endpoints returned error");
        }
      }

      setIsSyncing(false);
    };

  const handleSubmit = (e) => {
    e.preventDefault();
    navigate("/dashboard", { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-primary">
      <div className="fixed top-0 right-0 p-4 z-10">
        <button 
        className='text-text hover:text-text transition inline justify-end'
        onClick={handleLogout}>
          <i className="fa fa-sign-out fa-2x accentColor"></i>
        </button>
      </div>

      <div className="w-full max-w-5xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-text mb-2 drop-shadow">
            MetroEMS Dashboard
          </h1>
          <div className="text-text text-lg font-medium drop-shadow">
            Metro Element Management System
          </div>
        </div>

        <div className="flex justify-center">
          <form
            onSubmit={handleSubmit}
            className="bg-card backdrop-blur-md rounded-2xl shadow-2xl p-8 w-full max-w-md"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-text">Data Sync</h3>

              <button
                type="button"
                onClick={handleSyncAll}
                className="flex items-center gap-2 px-4 py-2 rounded-lg
                          bg-buttonPrimary hover:bg-blue-600
                          text-white text-sm font-semibold transition shadow-md"
              >
                <RefreshCw size={16} className={isSyncing ? "animate-spin" : ""} />
                {isSyncing ? "Syncing..." : "Sync"}
              </button>
              
            </div>
            <div className="flex justify-end">
            <h3 className="text-text text-sm">Last Sync Time : {checkSyncResult?.time || ""}</h3>
              </div>
            {discoveryError && (
              <div className="text-red-600 mb-4">
                {discoveryError}
              </div>
            )}

            {syncSuccess && (
              <div className="text-green-600 mb-4 font-semibold">
                Sync completed successfully!
              </div>
            )}

            <button
              type="submit"
              // disabled={!syncSuccess}
              disabled={checkSyncResult?.sync}
              className={`mt-8 w-full bg-buttonSecondary
                          hover:from-cyan-500 hover:to-blue-600
                          text-white font-semibold py-3 rounded-xl
                          transition disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              Next
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default SynicView;



