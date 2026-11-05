'use strict'
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('bridge', {
  info: () => ipcRenderer.invoke('info'),
  assetUrl: (file) => ipcRenderer.invoke('assetUrl', file),
  turn: (payload) => ipcRenderer.invoke('turn', payload),
  status: () => ipcRenderer.invoke('status'),
  animList: () => ipcRenderer.invoke('animList'),
  animPoll: () => ipcRenderer.invoke('animPoll'),
  win: (action) => ipcRenderer.invoke('win', action),
  bounds: () => ipcRenderer.invoke('bounds'),
})
