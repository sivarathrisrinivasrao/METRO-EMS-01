import React, { useState } from 'react';
// import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import Dashboard from './components/Dashboard';
import DeviceManagement from './components/DeviceManagement';
import DeviceSummary from './components/DeviceSummary';
import StationView from './components/Stationview';
import TrainView from './components/trainview';
import Troubleshoot from './components/TroubleShootTranscoder';
import TroubleshootTranscoder from './components/TroubleShootTranscoder';
import TroubleshootObc from './components/ObcTroubleShoot';
import TroubleshootStationRadios from './components/StationRadiosTroubleShoot';
import TroubleshootTrainRadios from './components/TrainRadiosTroubleShoot';
import SynicView from './components/Synicview';
import TroubleshootEncoder from './components/EncoderTroubleShoot';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Settings from './components/setting';

function App() {
  const [authenticated, setAuthenticated] = useState(
    sessionStorage.getItem('demo_auth') === 'true'
  );

  const handleLoginSuccess = () => {
    sessionStorage.setItem('demo_auth', 'true');
    setAuthenticated(true);
  };

  return (
    <Router>
      <Routes>
        <Route
          path="/"
          element={<LoginPage onLoginSuccess={handleLoginSuccess} />}
        />

       <Route
          path="/synicview"
          element={
            authenticated ? <SynicView /> : <Navigate to="/" replace />
          }
        />

        <Route
          path="/dashboard"
          element={
            authenticated ? <Dashboard /> : <Navigate to="/" replace />
          }
        />
          <Route
          path="/stationview"
          element={
            authenticated ? <StationView /> : <Navigate to="/" replace />
          }
        />
         <Route
          path="/trainview"
          element={
            authenticated ? <TrainView/> : <Navigate to="/" replace />
          }
        />
       <Route
          path="/device/:type/:id"
          element={
            authenticated ? <DeviceManagement  /> : <Navigate to="/" replace />
          }
        />
        
        {/* <Route path="/device/:category/:id" element={<DeviceSummary />} /> */}
        <Route path="/obc/troubleshoot"  element={
    authenticated ? <TroubleshootObc /> : <Navigate to="/" replace />
  } />

        <Route path="/transcoder/troubleshoot" element={<TroubleshootTranscoder />} />

      

        {/* <Route path="/station-radios/troubleshoot" element={<TroubleshootStationRadios />} /> */}
        <Route
  path="/station-radios/troubleshoot"
  element={
    <TroubleshootStationRadios
      key={Math.random()}
    />
  }
/>

        <Route path="/train-radios/troubleshoot" element={<TroubleshootTrainRadios />} />

         <Route path="/encoder/troubleshoot" element={<TroubleshootEncoder />} />

            <Route path="/settings" element={<Settings />} />



        
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;