// 房间物体标注（百分比坐标，相对房间层 0~100）
//   rect   ：物体包围盒 [左, 上, 宽, 高]
//   anchor ：落脚点 [x, y]——角色站/坐/用的位置
// 这些是初值（按图估算），可用调试模式拖动 / 方向键微调后重新导出。
window.ROOM_ANCHORS = {
  'v2-blue-cozy': {
    objects: {
      window: { rect: [16, 5, 32, 36], anchor: [32, 42] },
      bed: { rect: [12, 38, 44, 32], anchor: [33, 62] },
      desk: { rect: [64, 35, 34, 27], anchor: [78, 56] },
      riceCooker: { rect: [91, 47, 7, 8], anchor: [93, 56] },
      rug: { rect: [33, 66, 45, 20], anchor: [55, 76] },
      shelf: { rect: [48, 6, 24, 40], anchor: [58, 50] },
      nightstand: { rect: [46, 44, 12, 14], anchor: [50, 54] }
    }
  },
  'v1-blue-calm': {
    objects: {
      window: { rect: [6, 4, 46, 42], anchor: [28, 44] },
      bed: { rect: [8, 40, 44, 30], anchor: [30, 62] },
      desk: { rect: [60, 36, 34, 20], anchor: [78, 56] },
      riceCooker: { rect: [84, 40, 9, 8], anchor: [88, 50] },
      rug: { rect: [30, 66, 42, 20], anchor: [50, 76] },
      shelf: { rect: [46, 10, 16, 40], anchor: [55, 54] }
    }
  },
  'v3-blue-detail': {
    objects: {
      window: { rect: [8, 4, 42, 40], anchor: [28, 42] },
      bed: { rect: [6, 38, 44, 28], anchor: [28, 58] },
      desk: { rect: [58, 30, 36, 22], anchor: [76, 50] },
      riceCooker: { rect: [80, 34, 9, 8], anchor: [84, 44] },
      rug: { rect: [34, 62, 40, 20], anchor: [54, 72] },
      shelf: { rect: [44, 8, 14, 38], anchor: [52, 50] }
    }
  },
  'w1-warm-wood': {
    objects: {
      window: { rect: [36, 8, 34, 38], anchor: [52, 44] },
      bed: { rect: [8, 42, 44, 28], anchor: [30, 62] },
      desk: { rect: [52, 40, 32, 20], anchor: [68, 58] },
      riceCooker: { rect: [66, 22, 8, 8], anchor: [70, 32] },
      rug: { rect: [28, 66, 44, 20], anchor: [50, 76] },
      shelf: { rect: [0, 20, 18, 46], anchor: [10, 50] }
    }
  },
  'n1-neon-cyber': {
    objects: {
      window: { rect: [42, 6, 50, 48], anchor: [66, 44] },
      bed: { rect: [6, 44, 40, 26], anchor: [26, 62] },
      desk: { rect: [50, 40, 34, 20], anchor: [66, 58] },
      riceCooker: { rect: [74, 44, 9, 8], anchor: [78, 54] },
      rug: { rect: [36, 66, 36, 18], anchor: [54, 74] },
      shelf: { rect: [4, 14, 16, 40], anchor: [12, 46] }
    }
  },
  'l1-bright-nordic': {
    objects: {
      window: { rect: [42, 4, 34, 40], anchor: [58, 42] },
      bed: { rect: [6, 44, 42, 28], anchor: [28, 62] },
      desk: { rect: [56, 34, 36, 22], anchor: [74, 54] },
      riceCooker: { rect: [80, 46, 9, 8], anchor: [84, 56] },
      rug: { rect: [30, 66, 40, 20], anchor: [50, 76] },
      shelf: { rect: [10, 20, 14, 30], anchor: [17, 44] }
    }
  }
}