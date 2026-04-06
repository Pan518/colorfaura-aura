/* ============================================
   Colorfaura 主程式流程控制
   ============================================
   控制三個畫面的切換和整體流程：
   1. 上傳頁 → 2. 分析動畫 → 3. 報告
   ============================================ */

const App = {
  userName: '',
  reportData: null,

  init() {
    this._setupUpload();
    this._setupScrollReveal();
  },

  /* --- 畫面切換 --- */
  showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const target = document.getElementById(screenId);
    if (target) {
      target.classList.add('active');
      window.scrollTo(0, 0);
    }
  },

  /* --- 上傳功能 --- */
  _setupUpload() {
    const zone = document.getElementById('upload-zone');
    const input = document.getElementById('upload-input');
    const nameInput = document.getElementById('name-input');

    if (!zone || !input) return;

    // 點擊上傳
    zone.addEventListener('click', () => input.click());

    // 拖放
    zone.addEventListener('dragover', (e) => {
      e.preventDefault();
      zone.classList.add('dragover');
    });
    zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.classList.remove('dragover');
      if (e.dataTransfer.files.length > 0) {
        this._handleFile(e.dataTransfer.files[0]);
      }
    });

    // 檔案選擇
    input.addEventListener('change', () => {
      if (input.files.length > 0) {
        this._handleFile(input.files[0]);
      }
    });

    // 姓名
    if (nameInput) {
      nameInput.addEventListener('input', () => {
        this.userName = nameInput.value.trim();
      });
    }
  },

  _handleFile(file) {
    if (!file.type.startsWith('image/')) {
      alert('請上傳圖片檔案');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => this._startAnalysis(img, e.target.result);
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  },

  /* --- 分析流程 --- */
  _startAnalysis(img, dataUrl) {
    // 切到分析畫面
    this.showScreen('analyzing-screen');

    // 顯示上傳的照片
    const scanPhoto = document.getElementById('scan-photo');
    if (scanPhoto) scanPhoto.src = dataUrl;

    // 劇場式 loading 步驟
    const steps = document.querySelectorAll('.scan-step');
    let currentStep = 0;

    // 實際分析（幾乎瞬間完成）
    let analysisResult = null;
    try {
      analysisResult = window.ColorEngine.analyze(img);
    } catch (err) {
      console.error('分析錯誤:', err);
      alert('照片分析時發生錯誤，請重新上傳。');
      this.showScreen('upload-screen');
      return;
    }

    this.reportData = analysisResult;

    // 步驟動畫（每步 800ms）
    const advanceStep = () => {
      if (currentStep > 0 && steps[currentStep - 1]) {
        steps[currentStep - 1].classList.remove('active');
        steps[currentStep - 1].classList.add('done');
      }
      if (currentStep < steps.length) {
        steps[currentStep].classList.add('active');
        currentStep++;
        setTimeout(advanceStep, 800);
      } else {
        // 全部完成，切到報告
        setTimeout(() => this._renderReport(dataUrl), 600);
      }
    };

    // 開始動畫
    setTimeout(advanceStep, 400);
  },

  /* --- 渲染報告 --- */
  _renderReport(photoUrl) {
    const report = this.reportData;
    if (!report) return;

    const name = this.userName || '你';

    // --- Hero 區域 ---
    // 背景漸層
    const bg = document.getElementById('report-hero-bg');
    if (bg) {
      const c1 = window.AURA_COLORS[report.dominantEnergy]?.hex || '#4a90d9';
      const c2 = window.AURA_COLORS[report.top3[1]?.auraColor]?.hex || '#a855f7';
      bg.style.background = `radial-gradient(ellipse at 30% 40%, ${c1}80, transparent 60%),
                              radial-gradient(ellipse at 70% 60%, ${c2}60, transparent 60%)`;
    }

    // 標題
    const titleEl = document.getElementById('report-name');
    if (titleEl) titleEl.textContent = name;

    // 日期
    const dateEl = document.getElementById('report-date');
    if (dateEl) {
      const now = new Date();
      dateEl.textContent = `${now.getFullYear()} / ${String(now.getMonth() + 1).padStart(2, '0')} / ${String(now.getDate()).padStart(2, '0')}`;
    }

    // 主色圓圈
    const colorsEl = document.getElementById('dominant-colors');
    if (colorsEl) {
      let html = '';
      for (const c of report.top3) {
        const aura = window.AURA_COLORS[c.auraColor];
        if (!aura) continue;
        html += `
          <div class="dominant-color-item">
            <div class="dominant-color-circle" style="background: linear-gradient(135deg, ${aura.gradient[0]}, ${aura.gradient[1]}); box-shadow: 0 0 24px ${aura.hex}40;"></div>
            <span class="dominant-color-label">${aura.name}</span>
            <span class="dominant-color-pct">${c.pct}%</span>
          </div>`;
      }
      colorsEl.innerHTML = html;
    }

    // 一句話摘要
    const summaryEl = document.getElementById('hero-summary');
    if (summaryEl) {
      const c1 = window.AURA_COLORS[report.top3[0]?.auraColor];
      const c2 = window.AURA_COLORS[report.top3[1]?.auraColor];
      if (c1 && c2) {
        const template = window.SUMMARY_TEMPLATES[Math.floor(Math.random() * window.SUMMARY_TEMPLATES.length)];
        summaryEl.textContent = template
          .replace('{color1}', c1.name)
          .replace('{color2}', c2.name)
          .replace('{keyword1}', c1.keywords[0])
          .replace('{keyword2}', c2.keywords[0]);
      }
    }

    // --- 各區塊圖表 ---
    Charts.renderAuraRing('aura-ring', report.overallColors);
    Charts.renderEnergyFlow('energy-flow', report);
    Charts.renderChakraBody('chakra-body', report.chakras);
    Charts.renderRadarChart('radar-chart', report.chakras);
    Charts.renderDistribution('distribution', report.overallColors);
    Charts.renderColorCards('color-cards', report);
    Charts.renderBlockages('blockages', report);
    Charts.renderActions('actions', report);

    // 切到報告畫面
    this.showScreen('report-screen');

    // 觸發滾動動畫
    this._setupScrollReveal();

    // 分布長條圖動畫
    setTimeout(() => {
      document.querySelectorAll('.distribution-bar-fill').forEach(bar => {
        bar.style.width = bar.dataset.width;
      });
    }, 500);
  },

  /* --- 滾動顯現動畫 --- */
  _setupScrollReveal() {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
        }
      });
    }, {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px',
    });

    // 觀察所有 .reveal 元素
    setTimeout(() => {
      document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
    }, 100);
  },

  /* --- 分享截圖 --- */
  async shareReport() {
    const btn = document.getElementById('share-btn');
    if (btn) {
      btn.textContent = '正在生成...';
      btn.disabled = true;
    }

    try {
      // 使用 html2canvas 截取報告
      if (window.html2canvas) {
        const reportEl = document.getElementById('report-screen');
        const canvas = await html2canvas(reportEl, {
          backgroundColor: '#0a0a0f',
          scale: 2,
          useCORS: true,
        });

        // 嘗試使用 Web Share API（手機）
        if (navigator.share && navigator.canShare) {
          canvas.toBlob(async (blob) => {
            const file = new File([blob], 'colorfaura-report.png', { type: 'image/png' });
            try {
              await navigator.share({
                title: 'Colorfaura 氣場能量報告',
                files: [file],
              });
            } catch {
              // 使用者取消分享
              this._downloadImage(canvas);
            }
          });
        } else {
          this._downloadImage(canvas);
        }
      }
    } catch (err) {
      console.error('截圖錯誤:', err);
      alert('截圖生成失敗，請直接截圖保存。');
    } finally {
      if (btn) {
        btn.textContent = '儲存 / 分享報告';
        btn.disabled = false;
      }
    }
  },

  _downloadImage(canvas) {
    const link = document.createElement('a');
    link.download = 'colorfaura-report.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  },
};

// 啟動
document.addEventListener('DOMContentLoaded', () => App.init());

window.App = App;
