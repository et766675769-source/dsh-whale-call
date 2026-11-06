// 房间物体标注（百分比坐标，相对房间层 0~100）
//   rect   ：物体包围盒 [左, 上, 宽, 高]
//   anchor ：落脚点 [x, y]——角色站/坐/用的位置
// 未标注的房间留空对象，后续用调试模式补。
window.ROOM_ANCHORS = {
  'v2-blue-cozy': {
    objects: {
      window: { rect: [16, 5, 33, 36], anchor: [32, 40] },
      bed: { rect: [10, 36, 48, 32], anchor: [34, 60] },
      riceCooker: { rect: [68, 28, 10, 9], anchor: [73, 40] },
      desk: { rect: [62, 30, 32, 20], anchor: [78, 52] },
      rug: { rect: [32, 64, 47, 22], anchor: [55, 76] },
      shelf: { rect: [44, 8, 20, 52], anchor: [54, 62] },
      door: { rect: [0, 28, 7, 42], anchor: [4, 55] }
    }
  },
  'v1-blue-calm': { objects: {} },
  'v3-blue-detail': { objects: {} },
  'w1-warm-wood': { objects: {} },
  'n1-neon-cyber': { objects: {} },
  'l1-bright-nordic': { objects: {} }
}
