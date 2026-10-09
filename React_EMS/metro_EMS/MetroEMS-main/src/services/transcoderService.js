const DEFAULT_PORT = localStorage.getItem('APP_PORT') ?? '8002';

//   console.log('gettheportCurrent port',port)
// const API_BASE_URL = 'http://localhost:'+port;

// const DEFAULT_PORT = 8002;

class TranscoderService {

  

  parseSSE(text) {
  const lines = text.split(/\r?\n/);
  let event = null;
  let data = "";

  for (let line of lines) {
    if (line.startsWith("event:")) {
      event = line.replace("event:", "").trim();
    }

    if (line.startsWith("data:")) {
      data += line.replace("data:", "").trim();
    }
  }

  if (!event && !data) return null;

  // convert python style quotes to JSON
  try {
    const fixed = data.replace(/'/g, '"');
    data = JSON.parse(fixed);
  } catch {
    // keep raw string
  }

  return { event, data };
}
  
  

  buildBaseUrl(ip) {
    if (!ip) throw new Error("IP required");
    return `http://localhost:${DEFAULT_PORT}`;
  }

  async safeFetch(url, { method = "GET", body } = {}) {
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  // async discoverTranscoder(ip) {
  //   const base = this.buildBaseUrl(ip);
  //   const resp = await this.safeFetch(`${base}/transcoder/${ip}/discovery`);
  //   return resp?.data ?? {};
  // }

  async discoverTranscoder(ip) {
  if (!ip) throw new Error("IP required");

  const base = this.buildBaseUrl(ip);
  const url = `${base}/transcoder/${ip}/discovery`;

  const resp = await this.safeFetch(url, { method: "GET" });
  return resp;
}

  // async getTranscoderConfig(ip) {
  //   const base = this.buildBaseUrl(ip);
  //   const url = `${base}/transcoder/${ip}/fetch`;

  //   const configResp = await this.safeFetch(url, {
  //     method: "POST",
  //     body: { rurl: "api/v1/config" }
  //   });

  //   const uptimeResp = await this.safeFetch(url, {
  //     method: "POST",
  //     body: { rurl: "api/v1/uptime" }
  //   });

  //   const tempResp = await this.safeFetch(url, {
  //     method: "POST",
  //     body: { rurl: "api/v1/temp" }
  //   });

  //   return {
  //     config: configResp?.data ?? null,
  //     uptime: uptimeResp?.data ?? null,
  //     temp: tempResp?.data?.temp ?? null
  //   };
  // }


    async startMediaTranscoder(ip,value) {
    const base = this.buildBaseUrl(ip);
    const url = `${base}/mediamtx/${ip}/${value}`;
    const resp = await this.safeFetch(url,{ method: "POST" });
    return resp?.data ?? {};

  }

  async stopMediaTranscoder(ip,value) {
    const base = this.buildBaseUrl(ip);
    const url = `${base}/mediamtx/${ip}/${value}`;
    const resp = await this.safeFetch(url,{ method: "POST" });
    return resp?.data ?? {};

  }

  async getTranscoderConfig(ip) {
  const base = this.buildBaseUrl(ip);
  const url = `${base}/transcoder/${ip}/fetch`;

  const [configResp, uptimeResp, tempResp] = await Promise.allSettled([
    this.safeFetch(url, { method: "POST", body: { rurl: "api/v1/config" } }),
    this.safeFetch(url, { method: "POST", body: { rurl: "api/v1/uptime" } }),
    this.safeFetch(url, { method: "POST", body: { rurl: "api/v1/temp" } }),
  ]);

  return {
    config: configResp.status === "fulfilled" ? configResp.value?.data : null,
    uptime: uptimeResp.status === "fulfilled" ? uptimeResp.value?.data : null,
    temp: tempResp.status === "fulfilled" ? uptimeResp.value?.data?.temp : null,
  };
}



        async getTranscoderNetstats(ip) {
          if (!ip) throw new Error("IP required");
      
          const base = this.buildBaseUrl(ip);
          const url = `${base}/transcoder/${ip}/fetch`;
      
          const netResp = await this.safeFetch(url, {
              method: "POST",
              body: { rurl: "api/v1/netstats" }
          });
      
          const tempResp = await this.safeFetch(url, {
              method: "POST",
              body: { rurl: "api/v1/temp" }
          });
      
          const cpuResp = await this.safeFetch(url, {
              method: "POST",
              body: { rurl: "api/v1/cpu" }
          });
          return {
              ...netResp.data,
              temperature: Number(tempResp.data?.temp ?? 0),
              cpu: Number(cpuResp.data?.cpu ?? 0)
          };
      }

      async getServiceCheckStatus(ip) {
      if (!ip) throw new Error("IP required");
      
          const base = this.buildBaseUrl(ip);
          const url = `${base}/transcoder/${ip}/servicecheck`;
            const response = await fetch(url);
            const text = await response.text();
        return text ?? [];
      }

      //   async getCamStatus(ip,name) {
      // if (!ip) throw new Error("IP required");
      
      //     const base = this.buildBaseUrl(ip);
      //     const url = `${base}/transcoder/${ip}/cameraping/${name}`;
      //       const response = await fetch(url);
      //       const text = await response.text();
      //   return text ?? [];
      // }


     async getCamStatus(ip, name) {
  if (!ip) throw new Error("IP required");

  const base = this.buildBaseUrl(ip);
  const url = `${base}/transcoder/${ip}/cameraping/${name}`;

  const response = await fetch(url);
  const text = await response.text();

  // Extract the "data:" line
  const dataLine = text
    .split("\n")
    .find(line => line.startsWith("data:"));

  if (!dataLine) throw new Error("Invalid response format");

  // Remove "data: " and convert single quotes to double quotes
  const jsonString = dataLine
    .replace("data: ", "")
    .replace(/'/g, '"');

  const parsed = JSON.parse(jsonString);

  const pingValue = parsed?.data?.[name] || null;

  return {
    camera: parsed.name,
    status: pingValue ? "success" : "failure",
    value: pingValue
  };
}



      async getFirmwareList() {
        const url = `http://localhost:${DEFAULT_PORT}/firmware/list`;
        const resp = await this.safeFetch(url);
        return resp?.files ?? [];
      }

      // async getCurrentFirmware(ip) {
      //   if (!ip) throw new Error("IP required");
      
      //   const url = `http://localhost:${DEFAULT_PORT}/transcoder/currentfirmware/${ip}`;
      //   const resp = await this.safeFetch(url, { method: "GET" });
      
      //   return resp?.currentFirmware || resp?.firmware || resp?.data?.current || resp?.data?.firmware || "";
      // }
      
      async getCurrentFirmware(ip) {
        if (!ip) throw new Error("IP required");
      
        const url = `http://localhost:${DEFAULT_PORT}/transcoder/currentfirmware/${ip}`;
        const resp = await this.safeFetch(url, { method: "GET" });
      
        return resp?.current_firmware ?? resp?.data?.current_firmware ?? "";
      }
      
      
        async setCurrentFirmware(ip, fileName) {
          if (!ip || !fileName) {
            throw new Error("IP and fileName required");
          }

          const url = `http://localhost:${DEFAULT_PORT}/transcoder/set/currentfirmware/${ip}/${fileName}`;

          return this.safeFetch(url, {
            method: "POST",
            body: {
              ip,
              fileName
            }
          });
        }

          async quadAPICall(ip, quadData) {
        const url = `http://localhost:${DEFAULT_PORT}/transcoder/${ip}/setconfig/Quad`;
        
        const resp = await this.safeFetch(url, { 
          method: "POST",
          body: {values : quadData}
        });
        return resp;
      }

        async rTSPAPICall(ip, rtspData) {
        const url = `http://localhost:${DEFAULT_PORT}/transcoder/${ip}/setconfig/RSTPURL`;
        
        const resp = await this.safeFetch(url, { 
          method: "POST",
          body: {values : rtspData}
        });
        return resp;
      }

        async applyConfiguration(ip) {
        const url = `http://localhost:${DEFAULT_PORT}/transcoder/${ip}/reboot`;
        
        const resp = await this.safeFetch(url, { 
          method: "GET",
        });
        return resp;
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


    async firmwareUpgrade({ ip, fileName, onEvent, onError }) {
      if (!ip || !fileName) throw new Error("Missing required parameters");
    
      const url = `http://localhost:${DEFAULT_PORT}/transcoder/${ip}/firmware-update`;
    
      fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream"
        },
        body: JSON.stringify({ fileName })
      })
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
    
          const reader = res.body.getReader();
          const decoder = new TextDecoder("utf-8");
          let buffer = "";
    
          const read = () => {
            reader.read().then(({ value, done }) => {
              if (done) return;
    
              buffer += decoder.decode(value, { stream: true });
    
              const parts = buffer.split(/\r?\n\r?\n/);
              buffer = parts.pop();
    
              for (const part of parts) {
                const payload = this.parseSSE(part);
                if (payload) onEvent?.(payload);
              }
    
              read();
            }).catch(err => onError?.(err));
          };
    
          read();
        })
        .catch(err => onError?.(err));
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

  async getTranscoderLogs(ip) {
    if (!ip) throw new Error("IP required");

    const base = this.buildBaseUrl(ip);
    const url = `${base}/transcoder/${ip}/logs`;

    const resp = await fetch(url);

    return await resp.json();
  }
    
}

export const transcoderService = new TranscoderService();
export default transcoderService;
