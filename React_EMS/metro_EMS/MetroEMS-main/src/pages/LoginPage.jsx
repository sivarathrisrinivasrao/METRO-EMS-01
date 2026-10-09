import React, { useEffect, useState } from 'react';
import { Shield, User, Lock, CheckCircle, AlertCircle, Loader } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import apiService from '../services/apiService';

const LoginPage = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [loginImg,setLoginImg] = useState(null);
  const navigate = useNavigate();


// const args = window.electronAPI.getArgs();
// console.log('arc',args)


// useEffect(() => {
//     if (window.electronAPI) {
//       window.electronAPI.onSetPort((port) => {
//         localStorage.setItem('APP_PORT', port);
//         console.log("Port received:", port);
//       });
//     }
//   }, []);

useEffect(() => {
    let port = "8002";
  if (window.electronAPI) {
     port = window.electronAPI.getPort();
    localStorage.setItem('APP_PORT', port);
    console.log("Port received:", port);
  }
}, []);

  const port = localStorage.getItem('APP_PORT') ?? '8002';

  console.log('poppopppop',port)

  const handleLogin = async (e) => {
    
    e.preventDefault();
    setError("");

    if (!username.trim() || !password.trim()) {
      setError("Please enter username and password");
      return;
    }

    try {
      setLoading(true);

      const response = await fetch("http://localhost:"+port+"/auth/set", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          username,
          password
        })
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || "Login failed");
      }

      const data = await response.json();

      if (data.token) {
        localStorage.setItem("authToken", data.token);
      }

      onLoginSuccess();
      navigate("/synicview", { replace: true });

    } catch (err) {
      setError(err.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center relative"
      style={{
        backgroundImage: `url("http://localhost:${port}/images/login.png")`,
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
       
             {/* <img  src={require('../assets/images/Emslogin.png')} alt="login" className="absolute inset-0 w-full h-full object-cover" /> */}

      {/* <img  src="./Emslogin.png" alt="login" className="absolute inset-0 w-full h-full object-cover" /> */}
      <div className="absolute inset-0"></div>

      <div className="relative z-10 mr-[450px] mt-[20px] px-8 py-10 w-full max-w-md flex flex-col items-center">
        
        <div className="flex justify-center mb-6">
          {/* <div className="bg-blue-600 p-4 rounded-full shadow-lg">
            <Shield className="text-white w-8 h-8" />
          </div> */}
        </div>

        {/* <h1 className="text-2xl font-bold text-white mb-1">MetroEMS</h1>
        <div className="text-blue-100 mb-8">
          Metro Element Management System
        </div> */}

        {error && (
          <div className="w-full mb-4 p-3 bg-red-500/20 border border-red-500 rounded-md flex items-center gap-2">
            <AlertCircle size={16} className="text-red-400" />
            <span className="text-black-400 text-sm">{error}</span>
          </div>
        )}

        <form className="w-full space-y-5" onSubmit={handleLogin}>
          
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-black-400">
              <User size={18} />
            </span>
            <input
              id="username"
              name="username"
              autoComplete="username"
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="Username"
              className="w-full pl-10 pr-3 py-3 rounded-md  text-black-100 placeholder-black-300 focus:outline-none focus:ring-2 focus:ring-black-400 font-semibold"
            />
          </div>

          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-black-400">
              <Lock size={18} />
            </span>
            <input
              id="password"
              name="password"
              autoComplete="current-password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full pl-10 pr-3 py-3 rounded-md  text-black-100 placeholder-black-300 focus:outline-none focus:ring-2 focus:ring-black-400 font-semibold"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-blue-700 text-white py-3 rounded-md font-semibold hover:bg-blue-800 transition shadow disabled:opacity-60"
          >
            {loading ? (
              <>
                <Loader className="animate-spin" size={18} />
                Logging in...
              </>
            ) : (
              <>
                <CheckCircle size={20} />
                Login
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
