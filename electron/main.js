const { app, BrowserWindow,Menu } = require('electron');
const path = require('path');

const args = process.argv.slice(1);

const portArg = args.find(a => a.startsWith('--Port='));
const port = portArg ? portArg.split('=')[1] :'';
console.log('ojjoojoj',args);
console.log('lplplsdfsdfsd',portArg);

console.log('lplpl',port);


function createWindow() {
  const win = new BrowserWindow({
    width: 1920,
    height: 1080,
    show: false,
    backgroundColor: '#ffffff',
    icon: path.join(__dirname, 'build-assets/logo192.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      additionalArguments: [`--Port=${port}`]
    },
  });

  if (process.env.NODE_ENV === 'development') {
    win.loadURL('http://localhost:3000');
    //  win.webContents.openDevTools();
  } else {
     //const indexPath = path.join(__dirname, 'build', 'index.html');
     win.loadFile(path.join(__dirname, 'build', 'index.html'));
      // win.webContents.openDevTools();
    //win.loadFile(path.join(__dirname, '../React_EMS/metro_EMS/MetroEMS-main/build/index.html'));
  }

    win.once('ready-to-show', () => {
      win.show();
    });

   win.webContents.on('did-finish-load', () => {
    win.webContents.send('set-port', port);
  });
}



// console.log('Command-line arguments:', process.argv);
// const args = process.argv.slice(1); // skip exe path
// console.log(args); // [ '--mode=debug', '--user=admin' ]

// // parse arguments
// const modeArg = args.find(a => a.startsWith('--port='));
// const mode = modeArg ? modeArg.split('=')[1] : '8002';
// console.log('Port:', mode);

// app.whenReady().then(() => {
//   Menu.setApplicationMenu(null);
//   createWindow();
// });

app.whenReady().then(() => {
  app.setAppUserModelId("com.metro.ems");
  Menu.setApplicationMenu(null);
  createWindow();
});
