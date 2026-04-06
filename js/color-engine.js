/* ============================================
   Colorfaura 顏色萃取引擎
   ============================================
   負責：
   1. 從上傳的照片中萃取像素資料
   2. 分成 9 宮格區域分析
   3. 用 K-Means 找出每區的主色
   4. 將 RGB 映射到氣場顏色
   5. 計算脈輪啟動分數
   ============================================ */

const ColorEngine = {

  /* 分析照片入口 */
  analyze(imageElement) {
    // 1. 把圖片畫到 canvas 並縮小到 200x200
    const pixels = this._extractPixels(imageElement);

    // 2. 分成 9 宮格
    const zones = this._segmentZones(pixels, 200, 200);

    // 3. 每區找主色
    const zoneColors = {};
    for (const [zoneName, zonePixels] of Object.entries(zones)) {
      zoneColors[zoneName] = this._findDominantColors(zonePixels, 3);
    }

    // 4. 聚合為左/中/右/上/下
    const regions = this._aggregateRegions(zoneColors);

    // 5. 計算整體顏色分布
    const overall = this._computeOverall(regions);

    // 6. 計算脈輪分數
    const chakras = this._computeChakraScores(overall);

    // 7. 組裝報告資料
    return this._buildReport(regions, overall, chakras);
  },

  /* ---- 私有方法 ---- */

  /* 從圖片萃取像素，縮小到 200x200 */
  _extractPixels(img) {
    const canvas = document.createElement('canvas');
    const size = 200;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, size, size);
    return ctx.getImageData(0, 0, size, size);
  },

  /* 分成 3x3 = 9 宮格 */
  _segmentZones(imageData, w, h) {
    const data = imageData.data;
    const zoneW = Math.floor(w / 3);
    const zoneH = Math.floor(h / 3);

    const zoneNames = [
      ['topLeft', 'topCenter', 'topRight'],
      ['midLeft', 'midCenter', 'midRight'],
      ['botLeft', 'botCenter', 'botRight'],
    ];

    const zones = {};
    for (const row of zoneNames) {
      for (const name of row) {
        zones[name] = [];
      }
    }

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const r = data[i], g = data[i + 1], b = data[i + 2];

        // 轉 HSL
        const hsl = this._rgbToHsl(r, g, b);

        // 過濾黑色背景 (L < 12%) 和幾乎全黑的像素
        if (hsl.l < 12) continue;

        // 過濾非常暗的灰色 (S < 5% 且 L < 20%)
        if (hsl.s < 5 && hsl.l < 20) continue;

        const col = Math.min(Math.floor(x / zoneW), 2);
        const row = Math.min(Math.floor(y / zoneH), 2);
        const zoneName = zoneNames[row][col];

        zones[zoneName].push({ r, g, b, h: hsl.h, s: hsl.s, l: hsl.l });
      }
    }

    return zones;
  },

  /* 簡化版 K-Means 找主色 */
  _findDominantColors(pixels, k = 3) {
    if (pixels.length === 0) return [];
    if (pixels.length < k) k = pixels.length;

    // 初始化隨機中心
    const centroids = [];
    const used = new Set();
    for (let i = 0; i < k; i++) {
      let idx;
      do { idx = Math.floor(Math.random() * pixels.length); } while (used.has(idx));
      used.add(idx);
      centroids.push({ r: pixels[idx].r, g: pixels[idx].g, b: pixels[idx].b });
    }

    // 迭代 10 次
    for (let iter = 0; iter < 10; iter++) {
      const clusters = centroids.map(() => []);

      // 分配像素到最近的中心
      for (const px of pixels) {
        let minDist = Infinity;
        let minIdx = 0;
        for (let c = 0; c < centroids.length; c++) {
          const d = (px.r - centroids[c].r) ** 2 +
                    (px.g - centroids[c].g) ** 2 +
                    (px.b - centroids[c].b) ** 2;
          if (d < minDist) { minDist = d; minIdx = c; }
        }
        clusters[minIdx].push(px);
      }

      // 更新中心
      for (let c = 0; c < centroids.length; c++) {
        if (clusters[c].length === 0) continue;
        let sumR = 0, sumG = 0, sumB = 0;
        for (const px of clusters[c]) {
          sumR += px.r; sumG += px.g; sumB += px.b;
        }
        const n = clusters[c].length;
        centroids[c] = {
          r: Math.round(sumR / n),
          g: Math.round(sumG / n),
          b: Math.round(sumB / n),
        };
      }
    }

    // 重新分配以計算每個中心的佔比
    const clusterSizes = centroids.map(() => 0);
    for (const px of pixels) {
      let minDist = Infinity;
      let minIdx = 0;
      for (let c = 0; c < centroids.length; c++) {
        const d = (px.r - centroids[c].r) ** 2 +
                  (px.g - centroids[c].g) ** 2 +
                  (px.b - centroids[c].b) ** 2;
        if (d < minDist) { minDist = d; minIdx = c; }
      }
      clusterSizes[minIdx]++;
    }

    // 回傳主色（含比例）
    const total = pixels.length;
    const results = centroids.map((c, i) => {
      const hsl = this._rgbToHsl(c.r, c.g, c.b);
      const auraColor = this._mapToAuraColor(hsl);
      return {
        r: c.r, g: c.g, b: c.b,
        h: hsl.h, s: hsl.s, l: hsl.l,
        hex: this._rgbToHex(c.r, c.g, c.b),
        auraColor: auraColor,
        pct: Math.round((clusterSizes[i] / total) * 100),
      };
    });

    // 按佔比排序
    return results.sort((a, b) => b.pct - a.pct);
  },

  /* 聚合 9 宮格為 5 個區域 */
  _aggregateRegions(zoneColors) {
    const merge = (zoneNames) => {
      const all = [];
      for (const name of zoneNames) {
        all.push(...(zoneColors[name] || []));
      }
      // 聚合同色並重算比例
      const colorMap = {};
      let totalPct = 0;
      for (const c of all) {
        if (!c.auraColor) continue;
        if (!colorMap[c.auraColor]) {
          colorMap[c.auraColor] = { ...c, pct: 0 };
        }
        colorMap[c.auraColor].pct += c.pct;
        totalPct += c.pct;
      }
      // 正規化
      const result = Object.values(colorMap);
      if (totalPct > 0) {
        for (const c of result) {
          c.pct = Math.round((c.pct / totalPct) * 100);
        }
      }
      return result.sort((a, b) => b.pct - a.pct);
    };

    // 重要方位說明：
    // 照片右側 = 身體左側 = 進來的能量 (incoming)
    // 照片左側 = 身體右側 = 出去的能量 (outgoing)
    // 照片頂部 = 現在的意識 (present)
    return {
      incoming: merge(['topRight', 'midRight', 'botRight']),   // 照片右側 = 進來的能量
      center:   merge(['topCenter', 'midCenter', 'botCenter']), // 照片中央 = 當下意識
      outgoing: merge(['topLeft', 'midLeft', 'botLeft']),       // 照片左側 = 釋放的能量
      top:      merge(['topLeft', 'topCenter', 'topRight']),
      bottom:   merge(['botLeft', 'botCenter', 'botRight']),
    };
  },

  /* 計算整體顏色分布 */
  _computeOverall(regions) {
    const colorMap = {};
    const regionWeights = { incoming: 1, center: 1.2, outgoing: 1 };

    for (const [regionName, colors] of Object.entries(regions)) {
      if (regionName === 'top' || regionName === 'bottom') continue; // 避免重複計算
      const weight = regionWeights[regionName] || 1;
      for (const c of colors) {
        if (!c.auraColor) continue;
        if (!colorMap[c.auraColor]) {
          colorMap[c.auraColor] = { auraColor: c.auraColor, pct: 0, hex: c.hex };
        }
        colorMap[c.auraColor].pct += c.pct * weight;
      }
    }

    // 正規化
    const result = Object.values(colorMap);
    const total = result.reduce((sum, c) => sum + c.pct, 0);
    if (total > 0) {
      for (const c of result) {
        c.pct = Math.round((c.pct / total) * 100);
      }
    }
    return result.sort((a, b) => b.pct - a.pct);
  },

  /* 計算脈輪啟動分數 */
  _computeChakraScores(overallColors) {
    // 對應表：哪些氣場顏色對應哪個脈輪
    const chakraColorMap = {
      root:        ['red'],
      sacral:      ['orange'],
      solarPlexus: ['yellow', 'tan'],
      heart:       ['green', 'magenta'],
      throat:      ['blue'],
      thirdEye:    ['indigo'],
      crown:       ['violet', 'white'],
    };

    const scores = {};
    for (const [chakra, relatedColors] of Object.entries(chakraColorMap)) {
      let score = 0;
      for (const c of overallColors) {
        if (relatedColors.includes(c.auraColor)) {
          score += c.pct;
        }
      }
      // 限制在 0-100，並加一個基礎分（避免全 0）
      score = Math.min(100, Math.round(score * 2.5 + 5));
      const blocked = score < 15;
      scores[chakra] = { score, blocked };
    }

    return scores;
  },

  /* 組裝完整報告 */
  _buildReport(regions, overall, chakras) {
    const top3 = overall.slice(0, 3);
    const dominantColor = top3[0]?.auraColor || 'blue';

    // 找出較弱的脈輪
    const weakChakras = Object.entries(chakras)
      .filter(([, v]) => v.blocked)
      .map(([k]) => k);

    // 能量平衡分數：脈輪分數的標準差越小越平衡
    const scores = Object.values(chakras).map(c => c.score);
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    const variance = scores.reduce((sum, s) => sum + (s - avg) ** 2, 0) / scores.length;
    const balance = Math.max(0, Math.min(100, Math.round(100 - Math.sqrt(variance))));

    return {
      regions,
      overallColors: overall,
      chakras,
      dominantEnergy: dominantColor,
      incomingEnergy: regions.incoming[0]?.auraColor || dominantColor,
      outgoingEnergy: regions.outgoing[0]?.auraColor || dominantColor,
      presentEnergy: regions.center[0]?.auraColor || dominantColor,
      energyBalance: balance,
      weakChakras,
      top3,
    };
  },

  /* ---- 工具函式 ---- */

  _rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;

    if (max === min) {
      h = s = 0;
    } else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / d + 2) / 6; break;
        case b: h = ((r - g) / d + 4) / 6; break;
      }
    }

    return {
      h: Math.round(h * 360),
      s: Math.round(s * 100),
      l: Math.round(l * 100),
    };
  },

  _rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
  },

  _mapToAuraColor(hsl) {
    const { h, s, l } = hsl;

    // 白色判定：飽和度很低且亮度高
    if (s < 15 && l > 75) return 'white';

    // 棕褐色 Tan 判定：低飽和度 + 中等亮度 + 暖色調
    if (s >= 10 && s < 35 && l >= 30 && l <= 65 && h >= 20 && h <= 50) return 'tan';

    // 用 HUE_RANGES 映射
    for (const range of window.HUE_RANGES) {
      if (range.min <= range.max) {
        if (h >= range.min && h < range.max) return range.color;
      } else {
        // 跨 360 度的情況（紅色）
        if (h >= range.min || h < range.max) return range.color;
      }
    }

    return 'blue'; // fallback
  },
};

window.ColorEngine = ColorEngine;
