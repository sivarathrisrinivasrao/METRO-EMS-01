// API Service for MetroEMS Backend Integration
// Handles all communication with the FastAPI backend

// Allow overriding the backend URL via environment variable
// e.g., set REACT_APP_API_BASE=http://localhost:8002 for the updated backend
const port = localStorage.getItem('APP_PORT') ?? '8002';

//   console.log('gettheportCurrent port',port)
const API_BASE_URL = 'http://localhost:'+port;
// const API_BASE_URL = process.env.REACT_APP_API_BASE || 'http://localhost:8002';

class EncoderService {
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
    async discoverDevices(deviceType = 'encoder', opts = {}) {
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

   


    async discoverRadioDevices(deviceType = 'encoder', opts = {}) {
        const payload = { device_type: deviceType };

        if (opts.ip) payload.ip = opts.ip;
        if (opts.ips) payload.ips = opts.ips;

        const response = await this.request('/radio/discover', {
            method: 'POST',
            body: JSON.stringify(payload)
        });

        if (!response || response.error) {
            throw new Error(response?.error || "Discovery failed");
        }

        return response;
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

     async getConfigDownload(ip) {
        return await this.request(`/encoder/${ip}/downloadconfig`, {
            method: 'GET',
        });
    }

     async configUpload(ip) {
        return await this.request(`/encoder/${ip}/uploadconfig`, {
            method: 'POST',
            body: JSON.stringify({  })
        });
    }

    async getDeviceLogs(sessionId) {
        return await this.request(`/ops/${sessionId}/logs`);
    }

    async getDevicePorts(sessionId) {
        return await this.request(`/ops/${sessionId}/ports`);
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
    async isBackendAvailable() {
        try {
            const health = await this.healthCheck();
            return health.status === 'healthy';
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
    async getDeviceConfiguration(sessionId) {
        try {
            const response = await this.request(`/device-sessions/${sessionId}/configuration`);
            return response;
        } catch (error) {
            console.warn('Failed to get device configuration:', error);
            return null;
        }
    }

     async firmwareUpgrade(
        { ip},
        onStatus
      ) {
        const url = `${API_BASE_URL}/encoder/${ip}/firmware-update`;
      
        const res = await fetch(url, {
          method: "POST",
          headers: {
            ...(this.token && { Authorization: `Bearer ${this.token}` }),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ip}),
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

    async updateDeviceConfiguration(sessionId, config) {
        const response = await this.request(`/device-sessions/${sessionId}/configuration`, {
            method: 'PUT',
            body: JSON.stringify(config)
        });
        return response;
    }

    // Device Monitoring Methods
    async getDeviceMonitoring(sessionId) {
        try {
            const response = await this.request(`/device-sessions/${sessionId}/monitoring`);
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
    // async getDeviceLogsEnhanced(sessionId) {
    //     try {
    //         const response = await this.request(`/device-sessions/${sessionId}/logs`);
    //         return response;
    //     } catch (error) {
    //         console.warn('Failed to get device logs:', error);
    //         return [];
    //     }
    // }  


    // Device Logs Methods (by IP)
    async getDeviceLogsEnhanced(ip) {
        if (!ip) return []; // safety check

        try {
            const response = await this.request(`/encoder/${ip}/logs`);
            return response;
        } catch (error) {
            console.warn('Failed to get encoder logs for IP', ip, error);
            return [];
        }
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



     async getCurrentFirmware(targetSessionId) {
        if (!targetSessionId) throw new Error("sessionId required");

        return await this.request(`/radio/${targetSessionId}/current-firmware`, {
            method: "GET"
        });
    }

    
}

// Create and export a singleton instance
const encoderService = new EncoderService();

export { encoderService };
export default encoderService;