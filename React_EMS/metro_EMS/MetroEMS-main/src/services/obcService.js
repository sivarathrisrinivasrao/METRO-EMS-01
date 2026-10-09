// const DEFAULT_PORT = 8002;
const DEFAULT_PORT = localStorage.getItem('APP_PORT') ?? '8002';

//   console.log('gettheportCurrent port',port)
// const API_BASE_URL = 'http://localhost:'+port;

class ObcService {
  buildBaseUrl(ip) {
    if (!ip) throw new Error("IP required");
    return `http://localhost:${DEFAULT_PORT}`;
  }


    async safeFetch(url, { method = "GET", body } = {}) {
        const res = await fetch(url, {
        method,
        headers: {
             "Content-Type": "application/json"
        },
        body: body ? JSON.stringify(body) : undefined
        });
    
        if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
        }
    
        return res.json();
    }

  async healthCheck() {
    const url = `http://localhost:${DEFAULT_PORT}/health`;
    const resp = await this.safeFetch(url, { method: "GET" });
    return resp;
  }

  async isBackendAvailable() {
    try {
      const health = await this.healthCheck();
      const status = (health?.status || '').toString().toLowerCase();
      return status === 'healthy' || status === 'ok' || status === 'up';
    } catch (error) {
      return false;
    }
  }

  async checkBackendConnection() {
    return await this.isBackendAvailable();
}

async getDeviceSession(sessionId) {
  const response = await this.request(`/device-sessions/${sessionId}`);
  return response;
}

  
  async discoverOBC(ip) {
    const base = this.buildBaseUrl(ip);
    const resp = await this.safeFetch(`${base}/obc/${ip}/discovery`);
    return resp.data;
  }

    // async getObcConfig(ip) {
    //     const base = this.buildBaseUrl(ip);
    //     const url = `${base}/obc/${ip}/fetch`;
    
    //     const configResp = await this.safeFetch(url, {
    //     method: "POST",
    //     body: { rurl: "api/v1/config" }
    //     });
    
    //     const uptimeResp = await this.safeFetch(url, {
    //     method: "POST",
    //     body: { rurl: "api/v1/uptime" }
    //     });
    
    //     return {
    //     config: configResp?.data ?? null,
    //     uptime: uptimeResp?.data ?? null
    //     };
    // }

    async getObcConfig(ip) {
      const base = this.buildBaseUrl(ip);
      const url = `${base}/obc/${ip}/fetch`;

      const [configResp, uptimeResp] = await Promise.allSettled([
        this.safeFetch(url, { method: "POST", body: { rurl: "api/v1/config" } }),
        this.safeFetch(url, { method: "POST", body: { rurl: "api/v1/uptime" } }),
      ]);

      return {
        config: configResp.status === "fulfilled" ? configResp.value?.data : null,
        uptime: uptimeResp.status === "fulfilled" ? uptimeResp.value?.data : null
      };
    }


     async getObcDisk(ip) {
        const base = this.buildBaseUrl(ip);
        const url = `${base}/obc/${ip}/fetch`;
    
        const diskResp = await this.safeFetch(url, {
        method: "POST",
        body: { rurl: "api/v1/disk" }
        });
    
        return diskResp.data;
    }




    async getObcNetstats(ip) {
        const base = this.buildBaseUrl(ip);
        // const url = `${base}/obc/${ip}/fetch`;
        const url = `${base}/obc/${ip}/fetch`;

    
        const configResp = await this.safeFetch(url, {
        method: "POST",
        body: { rurl: "api/v1/netstats" }
        });
    
        return configResp.data;
    }


     async getServiceCheckStatus(ip) {
      if (!ip) throw new Error("IP required");
      
          const base = this.buildBaseUrl(ip);
          const url = `${base}/obc/${ip}/servicecheck`;
            const response = await fetch(url);
            const text = await response.text();
        return text ?? [];
      }

    async getFirmwareList() {
      const url = `http://localhost:${DEFAULT_PORT}/firmware/list`;
      const resp = await this.safeFetch(url);
      return resp?.files ?? [];
    }

    async pushFirmware(filename) {
      if (!filename) throw new Error("Filename required");
      const url = `http://localhost:${DEFAULT_PORT}/firmware/push/${filename}`;
      
      const resp = await this.safeFetch(url, { method: "GET" });
      return resp;
    }

    async getFirmwareFilePath(fileName) {
      if (!fileName) throw new Error("Filename required");
  
      const url = `http://localhost:${DEFAULT_PORT}/fetch/filePath/${fileName}`;
      const resp = await this.safeFetch(url);
      return resp?.filePath;
    }

    async copyFirmwareToDeviceScp({
      source_path,
      host,
      systemName,
      passWord,
      deviceType
    }) {
      const url = `http://localhost:${DEFAULT_PORT}/copy/scp`;
    
      if (!source_path || !host || !systemName || !passWord || !deviceType) {
        console.error("Missing required fields:", { source_path, host, systemName, passWord, deviceType });
        throw new Error("Cannot send request: missing required fields");
      }
    
      const payload = {
        source_path,
        host,
        systemName,
        passWord,
        deviceType
      };
          
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload)
        });
    
        console.log("Server response status:", response.status);
    
        let responseBody;
        try {
          responseBody = await response.json();
          console.log("Server response body:", responseBody);
        } catch (jsonErr) {
          responseBody = await response.text();
          console.log("Server response text:", responseBody);
        }
    
        if (!response.ok) {
          throw new Error(`Server returned ${response.status}: ${JSON.stringify(responseBody)}`);
        }
    
        return responseBody;
    
      } catch (err) {
        console.error("Firmware copy request failed:", err);
        throw err;
      }
    }

    async copyFirmwareToDevice({
      source_path,
      host,
      // systemName,
      // passWord,
      deviceType
    }) {
      const url = `http://localhost:${DEFAULT_PORT}/device/filecopy`;
    
      if (!source_path || !host || !deviceType) {
        console.error("Missing required fields:", { source_path, host, deviceType });
        throw new Error("Cannot send request: missing required fields");
      }
    
      const payload = {
        source_path,
        host,
        // systemName,
        // passWord,
        deviceType
      };
          
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload)
        });
    
        console.log("Server response status:", response.status);
    
        let responseBody;
        try {
          responseBody = await response.json();
          console.log("Server response body:", responseBody);
        } catch (jsonErr) {
          responseBody = await response.text();
          console.log("Server response text:", responseBody);
        }
    
        if (!response.ok) {
          throw new Error(`Server returned ${response.status}: ${JSON.stringify(responseBody)}`);
        }
    
        return responseBody;
    
      } catch (err) {
        console.error("Firmware copy request failed:", err);
        throw err;
      }
    }

    async getCurrentFirmware(ip) {
      if (!ip) throw new Error("IP required");
    
      const url = `http://localhost:${DEFAULT_PORT}/obc/currentfirmware/${ip}`;
      const resp = await this.safeFetch(url, { method: "GET" });
    
      return resp?.current_firmware ?? resp?.data?.current_firmware ?? "";
    }

    async setCurrentFirmware(ip, fileName) {
      if (!ip || !fileName) {
        throw new Error("IP and fileName required");
      }

      const url = `http://localhost:${DEFAULT_PORT}/obc/set/currentfirmware/${ip}/${fileName}`;

      return this.safeFetch(url, {
        method: "POST",
        body: {
          ip,
          fileName
        }
      });
    }

      async configSave(ip, quadData) {
        const url = `http://localhost:${DEFAULT_PORT}/obc/${ip}/setconfig`;
        
        const resp = await this.safeFetch(url, { 
          method: "POST",
          body: quadData
        });
        return resp;
      }

      async applyConfiguration(ip) {
        const url = `http://localhost:${DEFAULT_PORT}/obc/${ip}/reboot`;
        
        const resp = await this.safeFetch(url, { 
          method: "GET",
        });
        return resp;
      }
            

     async setPatchFile(ip, file) {
      if (!ip || !file) {
        throw new Error("IP and file required");
      }
          const formData = new FormData();
          formData.append("file", file);
                  for (let [key, value] of formData.entries()) {
            console.log(key, value);
          }
      const url = `http://localhost:${DEFAULT_PORT}/obc/${ip}/patch`;

      const res = await fetch(url, {
        method: "POST",
        body: formData
      });
      return res;
    }


    async firmwareUpgrade({ ip,fileName }) {
      if (!fileName ) {
        throw new Error("Missing required firmware upgrade parameters");
      }
    
      const url = `http://localhost:${DEFAULT_PORT}/obc/${ip}/firmware-update`;    
      const payload = {
        fileName,
      };
    
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
    
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
    
      return res.body;
    }
    

    async execTerminal({host, systemName, passWord, command,deviceType }) {
      if (!host || !systemName || !passWord || !command || !deviceType) {
        throw new Error("Missing required terminal fields");
      }
    
      const url = `http://localhost:${DEFAULT_PORT}/terminal/exec`;
    
      const payload = {
        host,
        passWord,
        systemName,
        command,
        deviceType
      };
    
      return this.safeFetch(url, {
        method: "POST",
        body: payload
      });
    }

     async getCurrentLogs(ip) {
    if (!ip) throw new Error("IP required");

    const base = this.buildBaseUrl(ip);
    const url = `${base}/obc/${ip}/cur/logs`;

    try {
      const resp = await this.safeFetch(url, { method: "GET" });
      return resp?.data ?? resp;
    } catch (err) {
      console.error(`Failed to fetch logs for ${ip}:`, err);
      return [];
    }
  }

  async getBackupLogs(ip) {
  if (!ip) throw new Error("IP required");

  const base = this.buildBaseUrl(ip);
  const url = `${base}/obc/${ip}/back/logs`;

  try {
    const resp = await this.safeFetch(url, { method: "GET" });
    return resp?.data ?? resp;
  } catch (err) {
    console.error(`Failed to fetch backup logs for ${ip}:`, err);
    return [];
  }
}

async discoverObc(ip) {
  if (!ip) throw new Error("IP required");

  const base = this.buildBaseUrl(ip);
  const url = `${base}/obc/${ip}/discovery`;

  const resp = await this.safeFetch(url, { method: "GET" });
  return resp;
}

}

export const obcService = new ObcService();
export default obcService;




