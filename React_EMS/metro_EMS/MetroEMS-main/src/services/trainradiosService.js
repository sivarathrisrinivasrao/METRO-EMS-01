// API Service for MetroEMS Backend Integration
// Handles all communication with the FastAPI backend

// Allow overriding the backend URL via environment variable
// e.g., set REACT_APP_API_BASE=http://localhost:8002 for the updated backend
const port = localStorage.getItem('APP_PORT') ?? '8002';

  console.log('gettheportCurrent port',port)
const API_BASE_URL = 'http://localhost:'+port;

// const API_BASE_URL = process.env.REACT_APP_API_BASE || 'http://localhost:8002';

class TrainRadiosService {
    constructor() {
        this.token = localStorage.getItem('metroems_token');
        this.baseHeaders = {
            'Content-Type': 'application/json',
        };
    }

    // Set authentication token
    setToken(token) {
        this.token = token;
        localStorage.setItem('metroems_token', token);
    }

    // Get authorization headers
    getAuthHeaders() {
        return {
            ...this.baseHeaders,
            ...(this.token && { 'Authorization': `Bearer ${this.token}` })
        };
    }

    // Generic API request handler
    async request(endpoint, options = {}) {
        const url = `${API_BASE_URL}${endpoint}`;
        const config = {
            headers: this.getAuthHeaders(),
            ...options
        };

        try {
            const response = await fetch(url, config);
            
            if (!response.ok) {
                if (response.status === 401) {
                    // Token expired or invalid
                    this.clearToken();
                    throw new Error('Authentication required');
                }
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                return await response.json();
            }
            
            return await response.text();
        } catch (error) {
            console.error(`API request failed for ${endpoint}:`, error);
            throw error;
        }
    }

    // Clear authentication token
    clearToken() {
        this.token = null;
        localStorage.removeItem('metroems_token');
    }

    // Authentication methods
    async login(username, password) {
        const response = await this.request('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ username, password })
        });
        
        if (response.token) {
            this.setToken(response.token);
        }
        
        return response;
    }

    async getLicenseStatus() {
        return await this.request('/license/status');
    }

    // Device discovery methods
    async getDeviceTypes() {
        return await this.request('/wizard/device-types');
    }


    // Discover devices by Train ID
    async discoverTrain(trainId) {
        return await this.request(`/train/${trainId}`, {
          method: "POST"
        });
      }
      

    async discoverDevices(deviceType = 'train_radio', opts = {}) {
        // opts: { ip, ips, community, version, port }
        const payload = { device_type: deviceType,port:161,version:"2c"};
        if (opts.ip) payload.ip = opts.ip;
        if (opts.ips) payload.ips = opts.ips;
        if (opts.community) payload.community = opts.community;
        if (opts.version) payload.version = opts.version;
        if (opts.port) payload.port = opts.port;
        return await this.request('/wizard/discover', {
            method: 'POST',
            body: JSON.stringify(payload)
        });
    }

     async discoverRadioDevices(deviceType = 'train_radio', opts = {}) {
        // opts: { ip, ips, community, version, port }
        const payload = { device_type: deviceType};
        if (opts.ip) payload.ip = opts.ip;
        if (opts.ips) payload.ips = opts.ips;
        // if (opts.community) payload.community = opts.community;
        // if (opts.version) payload.version = opts.version;
        // if (opts.port) payload.port = opts.port;
        return await this.request('/radio/discover', {
            method: 'POST',
            body: JSON.stringify(payload)
        });
    }

    async identifyDevice(ip) {
        return await this.request('/wizard/identify', {
            method: 'POST',
            body: JSON.stringify({ ip })
        });
    }

    async startSession(ip, deviceType, user, opts = {}) {
        const payload = { ip, device_type: deviceType, user };
        if (opts.community) payload.community = opts.community;
        if (opts.version) payload.version = opts.version;
        if (opts.port) payload.port = opts.port;
        if (opts.oid) payload.oid = opts.oid;
        return await this.request('/session/start', {
            method: 'POST',
            body: JSON.stringify(payload)
        });
    }

    async getSessionSummary(sessionId) {
        return await this.request(`/session/${sessionId}/summary`);
    }

    // Device operations
    async getDeviceConfig(sessionId) {
        return await this.request(`/ops/${sessionId}/config`);
    }

    async setDeviceConfig(sessionId, config) {
        return await this.request(`/ops/${sessionId}/config`, {
            method: 'POST',
            body: JSON.stringify({ config })
        });
    }

    async getDeviceLogs(sessionId) {
        return await this.request(`/ops/${sessionId}/logs`);
    }

    async getDevicePorts(sessionId) {
        return await this.request(`/ops/${sessionId}/ports`);
    }


    async getFirmwareList() {
        return await this.request('/firmware/list');
      }

    async pushFirmware(filename) {
    if (!filename) throw new Error("Filename required");
    
    return await this.request(`/firmware/push/${filename}`, {
        method: 'GET'
    });
    }


    async getFirmwareFilePath(fileName) {
        if (!fileName) throw new Error("fileName required");
      
        return await this.request(`/fetch/filePath/${encodeURIComponent(fileName)}`);
      }

      async firmwareUpgrade(
        { targetSessionId, ip, fileName, fileType = 2, opType = 3 },
        onStatus
      ) {
        const url = `${API_BASE_URL}/radio/${targetSessionId}/firmware-update`;
      
        const res = await fetch(url, {
          method: "POST",
          headers: {
            ...(this.token && { Authorization: `Bearer ${this.token}` }),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ip, fileName, fileType, opType }),
        });
      
        if (!res.ok) {
          throw new Error(`Firmware upgrade failed (${res.status})`);
        }
      
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
      
        let completed = false;
      
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
      
          buffer += decoder.decode(value, { stream: true });
      
          const events = buffer.split(/\r?\n\r?\n/);
          buffer = events.pop();
      
          for (const eventBlock of events) {
            if (!eventBlock.trim()) continue;
      
            const lines = eventBlock.split(/\r?\n/);
      
            let eventType = null;
            let dataValue = null;
      
            for (const line of lines) {
              if (line.startsWith("event:")) {
                eventType = line.replace("event:", "").trim();
              }
              if (line.startsWith("data:")) {
                dataValue = line.replace("data:", "").trim();
              }
            }
      
            if (eventType === "status") {
              onStatus?.(dataValue);
            }
      
            if (eventType === "completed") {
              completed = true;
              onStatus?.(dataValue || "Firmware upgrade completed successfully");
            }
          }
        }
      
        if (!completed) {
          throw new Error("Firmware upgrade did not complete properly");
        }
      
        return true;
      }

      async getCurrentFirmware(targetSessionId) {
        if (!targetSessionId) throw new Error("sessionId required");

        return await this.request(`/radio/${targetSessionId}/current-firmware`, {
            method: "GET"
        });
    }


    async fileCopy(serverFilePath) {
        if (!serverFilePath) throw new Error("serverFilePath is required");
    
        return await this.request("/device/filecopy", {
            method: "POST",
            body: JSON.stringify({ source_path: serverFilePath })
        });
    }

    async uploadFirmware(sessionId, file) {
        const formData = new FormData();
        formData.append('file', file);

        return await this.request(`/ops/${sessionId}/firmware`, {
            method: 'POST',
            headers: {
                ...(this.token && { 'Authorization': `Bearer ${this.token}` })
                // Don't set Content-Type for FormData, let browser set it
            },
            body: formData
        });
    }

    // Health check
    async healthCheck() {
        try {
            return await this.request('/health');
        } catch (error) {
            return { status: 'error', message: error.message };
        }
    }

    // Utility method to check if backend is available
    // async isBackendAvailable() {
    //     try {
    //         const health = await this.healthCheck();
    //         return health.status === 'healthy';
    //     } catch (error) {
    //         return false;
    //     }
    // }

    async isBackendAvailable() {
        try {
            const health = await this.healthCheck();
            const status = (health?.status || '').toString().toLowerCase();
            return status === 'healthy' || status === 'ok' || status === 'up';
        } catch (error) {
            return false;
        }
    }

    // Backend connection check (alias for consistency)
    async checkBackendConnection() {
        return await this.isBackendAvailable();
    }

    // Device Session Management (for DeviceManagement component)
    async getDeviceSession(sessionId) {
        const response = await this.request(`/device-sessions/${sessionId}`);
        return response;
    }

    // Device Configuration Methods
    async getDeviceConfiguration(targetSessionId) {
        try {
            const response = await this.request(`/device-sessions/${targetSessionId}/configuration`);
            return response;
        } catch (error) {
            console.warn('Failed to get device configuration:', error);
            return null;
        }
    }


     async updateDeviceConfiguration(targetSessionId, config) {
        const response = await this.request(`/device-sessions/${targetSessionId}/configuration`, {
            method: 'PUT',
            body: JSON.stringify(config)
        });
        return response;
    }

    async applyCommit(targetSessionId) {

        try {
            const response = await this.request(`/radio/${targetSessionId}/commit`);
            return response;
        } catch (error) {
            console.warn('Failed to get device configuration:', error);
            return null;
        }
    }


    async radioServiceCheck(sessionId) {
        if (!sessionId) throw new Error("sessionId required");
        return await this.request(`/radio/servicecheck/${sessionId}`, {
            method: "GET"
        });
        }




    async applyConfiguration(targetSessionId) {
        try {
            const response = await this.request(`/radio/${targetSessionId}/reboot`);
            return response;
        } catch (error) {
            console.warn('Failed to get device configuration:', error);
            return null;
        }
    }

    // Device Monitoring Methods
    async getDeviceMonitoring(targetSessionId) {
        try {
            const response = await this.request(`/device-sessions/${targetSessionId}/monitoring`);
            return response;
        } catch (error) {
            console.warn('Failed to get device monitoring data:', error);
            return null;
        }
    }

    // Refresh summary (re-poll OIDs)
    async refreshSession(sessionId) {
        return await this.request(`/session/${sessionId}/refresh`, { method: 'POST' });
    }

    // Device Logs Methods (enhanced)
    async getDeviceLogsEnhanced(sessionId) {
        try {
            const response = await this.request(`/device-sessions/${sessionId}/logs`);
            return response;
        } catch (error) {
            console.warn('Failed to get device logs:', error);
            return [];
        }
    }  
}

// Create and export a singleton instance
const trainradiosService = new TrainRadiosService();

export { trainradiosService };
export default trainradiosService;