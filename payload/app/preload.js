'use strict'
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('bridge', {
  info: () => ipcRenderer.invoke('info'),
  assetUrl: (file) => ipcRenderer.invoke('assetUrl', file),
  turn: (payload) => ipcRenderer.invoke('turn', payload),
  status: () => ipcRenderer.invoke('status'),
  animList: () => ipcRenderer.invoke('animList'),
  animPoll: () => ipcRenderer.invoke('animPoll'),
  animSet: (name) => ipcRenderer.invoke('animSet', name),
  win: (action) => ipcRenderer.invoke('win', action),
  topState: () => ipcRenderer.invoke('topState'),
  saveAnchors: (data) => ipcRenderer.invoke('saveAnchors', data),
  bounds: () => ipcRenderer.invoke('bounds'),
})
