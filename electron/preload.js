const { contextBridge, ipcRenderer } = require('electron');


ipcRenderer.on('set-port', (event, port) => {
  console.log("Port received in preload:", port);  // ✅ This prints in Electron console
});

const args = process.argv;
const portArg = args.find(a => a.startsWith('--Port='));
const port = portArg ? portArg.split('=')[1] : '8002';

console.log("Port in preload:", port);

contextBridge.exposeInMainWorld('electronAPI', {
  sendMessage: (msg) => ipcRenderer.send('message', msg),
    // getArgs: () => process.argv.slice(1),
    getPort: () => port
    

    // onSetPort: (callback) => ipcRenderer.on('set-port', (event, port) =>  {
    //   console.log("Port forwarded to React:", port);  // optional
    //   callback(port);
    // })
});

