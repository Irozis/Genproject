const { app, BrowserWindow, shell } = require('electron')
const path = require('node:path')
const { pathToFileURL } = require('node:url')

const APP_TITLE = 'Ad Layout Generator'
const DEV_SERVER_URL = 'http://localhost:5173'

function getAppUrl() {
  if (!app.isPackaged) {
    return DEV_SERVER_URL
  }

  return pathToFileURL(path.join(__dirname, '..', 'dist', 'index.html')).toString()
}

function isAppUrl(targetUrl) {
  let parsed

  try {
    parsed = new URL(targetUrl)
  } catch {
    return false
  }

  if (!app.isPackaged) {
    return parsed.origin === DEV_SERVER_URL
  }

  return parsed.protocol === 'file:'
}

function openExternal(targetUrl) {
  if (targetUrl.startsWith('http://') || targetUrl.startsWith('https://')) {
    shell.openExternal(targetUrl)
    return true
  }

  return false
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 720,
    title: APP_TITLE,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (openExternal(url)) {
      return { action: 'deny' }
    }

    return { action: isAppUrl(url) ? 'allow' : 'deny' }
  })

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (isAppUrl(url)) {
      return
    }

    event.preventDefault()
    openExternal(url)
  })

  mainWindow.loadURL(getAppUrl())
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
