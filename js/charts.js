/* ============================================
   Colorfaura 圖表生成邏輯
   ============================================
   負責產生所有視覺化元素：
   - 氣場光環圖 (SVG 圓環)
   - 脈輪人體圖 (SVG)
   - 脈輪雷達圖 (Chart.js)
   - 顏色分布長條圖
   - 能量流向圖
   ============================================ */

const Charts = {

  /* --- A. 氣場光環圖 (Aura Ring) --- */
  renderAuraRing(containerId, overallColors) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const size = 240;
    const cx = size / 2;
    const cy = size / 2;
    const outerR = 105;
    const innerR = 70;

    let svg = `<svg viewBox="0 0 ${size} ${size}" class="aura-ring-svg">`;

    // 背景圓
    svg += `<circle cx="${cx}" cy="${cy}" r="${outerR + 8}" fill="none" stroke="rgba(255,255,255,0.03)" stroke-width="1"/>`;

    // 畫弧段
    let startAngle = -90; // 從頂部開始
    const colors = overallColors.filter(c => c.pct > 0);

    for (const c of colors) {
      const sweepAngle = (c.pct / 100) * 360;
      const endAngle = startAngle + sweepAngle;

      const auraData = window.AURA_COLORS[c.auraColor];
      const color = auraData ? auraData.hex : c.hex;

      const path = this._arcPath(cx, cy, outerR, innerR, startAngle, endAngle);
      svg += `<path d="${path}" fill="${color}" opacity="0.85">`;
      svg += `<animate attributeName="opacity" from="0" to="0.85" dur="1s" fill="freeze"/>`;
      svg += `</path>`;

      // 發光效果
      svg += `<path d="${path}" fill="${color}" opacity="0.3" filter="url(#glow)"/>`;

      startAngle = endAngle;
    }

    // 發光濾鏡
    svg += `<defs><filter id="glow"><feGaussianBlur stdDeviation="6" result="coloredBlur"/>`;
    svg += `<feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>`;
    svg += `</filter></defs>`;

    // 中心圓
    svg += `<circle cx="${cx}" cy="${cy}" r="${innerR - 5}" fill="${'var(--bg-primary)'}"/>`;
    svg += `<text x="${cx}" y="${cy - 6}" text-anchor="middle" fill="var(--text-muted)" font-size="10" letter-spacing="0.1em">YOUR</text>`;
    svg += `<text x="${cx}" y="${cy + 12}" text-anchor="middle" fill="var(--accent)" font-size="12" letter-spacing="0.15em" font-weight="500">AURA</text>`;

    svg += `</svg>`;

    container.innerHTML = svg;

    // 圖例
    this._renderLegend(container, overallColors);
  },

  _renderLegend(container, colors) {
    const legend = document.createElement('div');
    legend.className = 'aura-ring-legend';
    for (const c of colors) {
      if (c.pct < 3) continue;
      const auraData = window.AURA_COLORS[c.auraColor];
      if (!auraData) continue;
      legend.innerHTML += `
        <div class="legend-item">
          <span class="legend-dot" style="background:${auraData.hex}"></span>
          <span>${auraData.name} ${c.pct}%</span>
        </div>`;
    }
    container.appendChild(legend);
  },

  _arcPath(cx, cy, outerR, innerR, startDeg, endDeg) {
    const toRad = d => (d * Math.PI) / 180;
    const gap = 1; // 弧段間距

    const s = toRad(startDeg + gap / 2);
    const e = toRad(endDeg - gap / 2);
    const large = endDeg - startDeg > 180 ? 1 : 0;

    const x1 = cx + outerR * Math.cos(s);
    const y1 = cy + outerR * Math.sin(s);
    const x2 = cx + outerR * Math.cos(e);
    const y2 = cy + outerR * Math.sin(e);
    const x3 = cx + innerR * Math.cos(e);
    const y3 = cy + innerR * Math.sin(e);
    const x4 = cx + innerR * Math.cos(s);
    const y4 = cy + innerR * Math.sin(s);

    return `M ${x1} ${y1} A ${outerR} ${outerR} 0 ${large} 1 ${x2} ${y2}
            L ${x3} ${y3} A ${innerR} ${innerR} 0 ${large} 0 ${x4} ${y4} Z`;
  },

  /* --- B. 能量流向圖 --- */
  renderEnergyFlow(containerId, report) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const posData = window.AURA_POSITIONS;
    const sides = [
      { key: 'incoming', label: posData.photoRight.label, sublabel: posData.photoRight.sublabel, energy: report.incomingEnergy, desc: posData.photoRight.description, timeFrame: posData.photoRight.timeFrame },
      { key: 'center', label: posData.center.label, sublabel: posData.center.sublabel, energy: report.presentEnergy || report.dominantEnergy, desc: posData.center.description, timeFrame: posData.center.timeFrame },
      { key: 'outgoing', label: posData.photoLeft.label, sublabel: posData.photoLeft.sublabel, energy: report.outgoingEnergy, desc: posData.photoLeft.description, timeFrame: posData.photoLeft.timeFrame },
    ];

    let html = '<div class="energy-flow">';

    sides.forEach((side, i) => {
      const aura = window.AURA_COLORS[side.energy] || window.AURA_COLORS.blue;
      const meaningKey = side.key === 'incoming' ? 'incomingMeaning' :
                         side.key === 'outgoing' ? 'outgoingMeaning' : 'presentMeaning';

      html += `
        <div class="energy-column">
          <div class="energy-column-title">${side.label}</div>
          <div class="energy-column-subtitle">${side.sublabel}</div>
          <div class="energy-color-dot" style="background: linear-gradient(135deg, ${aura.gradient[0]}, ${aura.gradient[1]}); box-shadow: 0 0 20px ${aura.hex}40;"></div>
          <div class="energy-color-name">${aura.name}</div>
          <div class="energy-timeframe">${side.timeFrame}</div>
          <p>${aura[meaningKey]}</p>
        </div>`;

      if (i < 2) {
        html += `<div class="energy-arrow">→</div>`;
      }
    });

    html += '</div>';
    container.innerHTML = html;
  },

  /* --- C. 脈輪人體圖 --- */
  renderChakraBody(containerId, chakras) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // SVG 人體剪影 + 脈輪點
    const bodyW = 200;
    const bodyH = 380;

    let svg = `<svg viewBox="0 0 ${bodyW} ${bodyH}" class="chakra-body-svg-inner">`;

    // 簡約人體剪影
    svg += `
      <defs>
        <filter id="chakraGlow">
          <feGaussianBlur stdDeviation="8" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>

      <!-- 頭 -->
      <ellipse cx="100" cy="50" rx="28" ry="32" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="1.5"/>
      <!-- 脖子 -->
      <line x1="100" y1="82" x2="100" y2="100" stroke="rgba(255,255,255,0.08)" stroke-width="1.5"/>
      <!-- 身體 -->
      <path d="M 65 100 Q 60 180 65 280 L 80 350 M 135 100 Q 140 180 135 280 L 120 350" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="1.5"/>
      <!-- 肩膀 -->
      <path d="M 65 100 Q 40 105 25 140 M 135 100 Q 160 105 175 140" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="1.5"/>
      <!-- 手臂 -->
      <path d="M 25 140 L 15 230 M 175 140 L 185 230" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="1.5"/>
      <!-- 中軸線 -->
      <line x1="100" y1="35" x2="100" y2="340" stroke="rgba(255,255,255,0.03)" stroke-width="1" stroke-dasharray="4,4"/>
    `;

    // 畫脈輪點
    const chakraPositions = {
      crown:       { x: 100, y: 25 },
      thirdEye:    { x: 100, y: 48 },
      throat:      { x: 100, y: 95 },
      heart:       { x: 100, y: 145 },
      solarPlexus: { x: 100, y: 190 },
      sacral:      { x: 100, y: 235 },
      root:        { x: 100, y: 280 },
    };

    for (const [key, pos] of Object.entries(chakraPositions)) {
      const chakraInfo = window.CHAKRA_DATA[key];
      const score = chakras[key]?.score || 0;
      const blocked = chakras[key]?.blocked || false;
      const opacity = blocked ? 0.15 : Math.max(0.3, score / 100);
      const r = blocked ? 6 : 6 + (score / 100) * 6;

      svg += `
        <circle cx="${pos.x}" cy="${pos.y}" r="${r + 12}" fill="${chakraInfo.color}" opacity="${opacity * 0.15}" filter="url(#chakraGlow)"/>
        <circle cx="${pos.x}" cy="${pos.y}" r="${r}" fill="${chakraInfo.color}" opacity="${opacity}">
          ${!blocked ? `<animate attributeName="r" values="${r};${r + 3};${r}" dur="3s" repeatCount="indefinite"/>` : ''}
        </circle>
        <text x="${pos.x + 22}" y="${pos.y + 4}" fill="var(--text-muted)" font-size="9" opacity="0.6">${chakraInfo.name}</text>
      `;
    }

    svg += `</svg>`;

    // 脈輪列表
    let labelsHtml = '<div class="chakra-labels">';
    for (const [key, chakraInfo] of Object.entries(window.CHAKRA_DATA)) {
      const score = chakras[key]?.score || 0;
      const blocked = chakras[key]?.blocked || false;
      labelsHtml += `
        <div class="chakra-label-row">
          <div class="chakra-label-left">
            <span class="chakra-label-dot" style="background:${chakraInfo.color}; opacity:${blocked ? 0.3 : 1}"></span>
            <span class="chakra-label-name">${chakraInfo.name}${blocked ? ' ⚠️' : ''}</span>
          </div>
          <span class="chakra-label-score">${score}%</span>
        </div>`;
    }
    labelsHtml += '</div>';

    container.innerHTML = `
      <div class="chakra-body-container">
        <div class="chakra-body-svg">${svg}</div>
        ${labelsHtml}
      </div>`;
  },

  /* --- D. 脈輪雷達圖 (Chart.js) --- */
  renderRadarChart(canvasId, chakras) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || !window.Chart) return;

    const labels = Object.values(window.CHAKRA_DATA).map(c => c.name);
    const data = Object.keys(window.CHAKRA_DATA).map(k => chakras[k]?.score || 0);
    const colors = Object.values(window.CHAKRA_DATA).map(c => c.color);

    new Chart(canvas, {
      type: 'radar',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: 'rgba(201, 169, 110, 0.15)',
          borderColor: 'rgba(201, 169, 110, 0.6)',
          borderWidth: 2,
          pointBackgroundColor: colors,
          pointBorderColor: colors,
          pointRadius: 5,
          pointHoverRadius: 7,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: { display: false },
        },
        scales: {
          r: {
            beginAtZero: true,
            max: 100,
            ticks: {
              display: false,
              stepSize: 25,
            },
            grid: {
              color: 'rgba(255,255,255,0.06)',
            },
            angleLines: {
              color: 'rgba(255,255,255,0.06)',
            },
            pointLabels: {
              color: 'var(--text-secondary)',
              font: { size: 12, family: '-apple-system, BlinkMacSystemFont, sans-serif' },
            },
          },
        },
      },
    });
  },

  /* --- E. 顏色分布長條圖 --- */
  renderDistribution(containerId, overallColors) {
    const container = document.getElementById(containerId);
    if (!container) return;

    let html = '';
    for (const c of overallColors) {
      if (c.pct < 2) continue;
      const aura = window.AURA_COLORS[c.auraColor];
      if (!aura) continue;

      html += `
        <div class="distribution-bar-row reveal">
          <span class="distribution-label">${aura.name}</span>
          <div class="distribution-bar-bg">
            <div class="distribution-bar-fill" style="width: 0%; background: linear-gradient(90deg, ${aura.gradient[0]}, ${aura.gradient[1]});" data-width="${c.pct}%"></div>
          </div>
          <span class="distribution-pct">${c.pct}%</span>
        </div>`;
    }

    container.innerHTML = html;

    // 動畫延遲觸發
    requestAnimationFrame(() => {
      setTimeout(() => {
        container.querySelectorAll('.distribution-bar-fill').forEach(bar => {
          bar.style.width = bar.dataset.width;
        });
      }, 300);
    });
  },

  /* --- F. 顏色解讀卡片 --- */
  renderColorCards(containerId, report) {
    const container = document.getElementById(containerId);
    if (!container) return;

    let html = '';
    const topColors = report.overallColors.filter(c => c.pct >= 5);

    for (const c of topColors) {
      const aura = window.AURA_COLORS[c.auraColor];
      if (!aura) continue;

      // 判斷這個顏色主要出現在哪裡
      const positions = [];
      if (report.regions.incoming[0]?.auraColor === c.auraColor) positions.push('接收能量（照片右側）');
      if (report.regions.center[0]?.auraColor === c.auraColor) positions.push('當下意識（照片中央）');
      if (report.regions.outgoing[0]?.auraColor === c.auraColor) positions.push('投射能量（照片左側）');
      const posText = positions.length > 0 ? positions.join('、') : '整體散佈';

      html += `
        <div class="color-card reveal" style="border-left-color: ${aura.hex};">
          <div class="color-card-header">
            <div class="color-card-swatch" style="background: linear-gradient(135deg, ${aura.gradient[0]}, ${aura.gradient[1]});"></div>
            <div class="color-card-info">
              <h3>${aura.name} — ${aura.nameEn}</h3>
              <span class="color-card-position">${posText} · ${c.pct}%</span>
            </div>
          </div>
          <p class="color-card-meaning">${aura.meaning}</p>
          <div class="color-card-meta">
            <span class="color-card-tag">${aura.chakraName}</span>
            ${aura.yinYang ? `<span class="color-card-tag">${aura.yinYang}</span>` : ''}
          </div>
          <div class="color-card-aspects">
            <div class="color-card-aspect-row">
              <span class="aspect-label light">光明面</span>
              <span class="aspect-tags">${aura.lightAspects.slice(0, 4).join('、')}</span>
            </div>
            <div class="color-card-aspect-row">
              <span class="aspect-label shadow">陰影面</span>
              <span class="aspect-tags">${aura.shadowAspects.slice(0, 3).join('、')}</span>
            </div>
          </div>
        </div>`;
    }

    container.innerHTML = html;
  },

  /* --- G. 阻塞分析 --- */
  renderBlockages(containerId, report) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (report.weakChakras.length === 0) {
      container.innerHTML = `
        <div class="no-blockage reveal">
          <p>你的七大脈輪能量流通順暢，目前沒有明顯的能量阻塞。<br>持續保持覺知，讓能量自然流動。</p>
        </div>`;
      return;
    }

    let html = '';
    for (const chakraKey of report.weakChakras) {
      const chakraInfo = window.CHAKRA_DATA[chakraKey];
      // 找到對應的氣場顏色
      const colorKey = Object.entries(window.AURA_COLORS).find(([, v]) => v.chakra === chakraKey)?.[0];
      const aura = colorKey ? window.AURA_COLORS[colorKey] : null;

      html += `
        <div class="blockage-card reveal">
          <div class="blockage-header">
            <span class="blockage-indicator" style="background: ${chakraInfo.color};"></span>
            <h3>${chakraInfo.name}（${chakraInfo.nameEn}）— 能量較弱</h3>
          </div>
          <div class="blockage-body">
            <p>${aura ? aura.blocked : `${chakraInfo.name}的能量目前較為薄弱，可能需要特別關注 ${chakraInfo.desc} 方面的平衡。`}</p>
          </div>
        </div>`;
    }

    container.innerHTML = html;
  },

  /* --- H. 行動建議 --- */
  renderActions(containerId, report) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // 從前 2 主色 + 阻塞脈輪收集建議
    const actions = [];
    const seen = new Set();

    // 主色建議
    for (const c of report.top3.slice(0, 2)) {
      const aura = window.AURA_COLORS[c.auraColor];
      if (!aura) continue;
      for (const action of aura.actions) {
        if (!seen.has(action.title)) {
          actions.push(action);
          seen.add(action.title);
        }
      }
    }

    // 阻塞脈輪建議
    for (const chakraKey of report.weakChakras) {
      const colorKey = Object.entries(window.AURA_COLORS).find(([, v]) => v.chakra === chakraKey)?.[0];
      const aura = colorKey ? window.AURA_COLORS[colorKey] : null;
      if (aura) {
        for (const action of aura.actions.slice(0, 1)) {
          if (!seen.has(action.title)) {
            actions.push(action);
            seen.add(action.title);
          }
        }
      }
    }

    // 最多 5 個
    const finalActions = actions.slice(0, 5);

    let html = '';
    for (const action of finalActions) {
      html += `
        <div class="action-card reveal">
          <div class="action-icon">${action.icon}</div>
          <div class="action-content">
            <h3>${action.title}</h3>
            <p>${action.desc}</p>
          </div>
        </div>`;
    }

    container.innerHTML = html;
  },
};

window.Charts = Charts;
