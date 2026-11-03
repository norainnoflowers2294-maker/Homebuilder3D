import { FINISHES, ZONE_MATS, getTextureThumb, DESIGNER_COLORS } from './mats.js';

/**
 * Advanced 3D Color, Material & Texture Customization Studio
 */
export class MaterialStudio {
  constructor(app) {
    this.app = app;
    this.selectedItem = null;
    this.selectedSubmesh = null;
    this.currentHistory = [];
    this.historyIdx = -1;
    this.textureLibrary = this.loadTextureLibrary();
    this.palettes = this.loadPalettes();
    this.recents = this.loadRecents();
    this.presets = {
      matte:   { roughness: 0.92, metalness: 0.0,  clearcoat: 0.0 },
      glossy:  { roughness: 0.12, metalness: 0.05, clearcoat: 0.8 },
      satin:   { roughness: 0.40, metalness: 0.1,  clearcoat: 0.2 },
      velvet:  { roughness: 0.95, metalness: 0.0,  sheen: 0.9 },
      leather: { roughness: 0.65, metalness: 0.05, clearcoat: 0.15 },
      suede:   { roughness: 0.88, metalness: 0.0,  sheen: 0.6 },
      linen:   { roughness: 0.90, metalness: 0.0 },
      wood:    { roughness: 0.55, metalness: 0.0 },
      metal:   { roughness: 0.35, metalness: 0.85 },
      chrome:  { roughness: 0.08, metalness: 0.98, clearcoat: 1.0 },
      marble:  { roughness: 0.15, metalness: 0.05, clearcoat: 0.6 },
      glass:   { roughness: 0.05, transmission: 0.92, transparent: true, opacity: 0.35 }
    };
  }

  init() {
    this.panel = document.getElementById('matStudioPanel');
    if (!this.panel) return;
    this.bindEvents();
    this.renderPalettesList();
    this.renderTextureLibrary();
    this.renderRecents();
  }

  openFor(item, floorIdx) {
    this.selectedItem = { item, floorIdx };
    this.selectedSubmesh = null;
    this.initItemHistory(item);
    this.panel.classList.add('on');
    this.updatePartsTab();
    this.renderRecents();
    this.syncUIFromItem();
  }

  close() {
    if (this.panel) this.panel.classList.remove('on');
    this.selectedItem = null;
    this.selectedSubmesh = null;
  }

  applyColor(hexColor, opacity = 1.0, record = true) {
    if (!this.selectedItem) return;
    hexColor = this.normHex(hexColor);
    if (!hexColor) return;
    const { item, floorIdx } = this.selectedItem;
    this.recordHistory();
    if (!item.matOverrides) item.matOverrides = {};
    const partKey = this.selectedSubmesh || '__all__';
    if (!item.matOverrides[partKey]) item.matOverrides[partKey] = {};
    item.matOverrides[partKey].color = hexColor;
    item.matOverrides[partKey].opacity = opacity;
    this.app.view3d?.applyItemOverrides(item, floorIdx);
    this.app.saveState?.();
    if (record) this.recordRecent(hexColor);
  }

  normHex(v) {
    let h = String(v || '').trim().toLowerCase();
    if (!h) return null;
    if (h[0] !== '#') h = '#' + h;
    if (/^#[0-9a-f]{3}$/.test(h)) h = '#' + h[1] + h[1] + h[2] + h[2] + h[3] + h[3];
    return /^#[0-9a-f]{6}$/.test(h) ? h : null;
  }

  loadRecents() {
    try {
      const r = JSON.parse(localStorage.getItem('homecraft_recent_colors') || '[]');
      if (Array.isArray(r)) return r.filter(c => this.normHex(c)).slice(0, 12);
    } catch(e) {}
    return [];
  }
  recordRecent(hex) {
    hex = this.normHex(hex);
    if (!hex) return;
    this.recents = [hex, ...this.recents.filter(c => c !== hex)].slice(0, 12);
    try { localStorage.setItem('homecraft_recent_colors', JSON.stringify(this.recents)); } catch(e) {}
    this.renderRecents();
  }
  renderRecents() {
    const row = document.getElementById('matRecentSwatches');
    if (!row) return;
    row.innerHTML = '';
    if (!this.recents.length) {
      const d = document.createElement('div');
      d.className = 'dempty';
      d.style.cssText = 'padding:2px;font-size:11px;';
      d.textContent = 'No recent colors yet — pick one above.';
      row.appendChild(d);
      return;
    }
    this.recents.forEach(col => {
      const sw = document.createElement('div');
      sw.className = 'swatch';
      sw.style.backgroundColor = col;
      sw.title = col + ' — tap to apply';
      sw.onclick = () => {
        const cp = document.getElementById('matColorPicker');
        const hx = document.getElementById('matHexInput');
        if (cp) cp.value = col;
        if (hx) hx.value = col;
        this.applyColor(col);
      };
      row.appendChild(sw);
    });
  }

  applyFinish(presetName) {
    if (!this.selectedItem) return;
    const conf = this.presets[presetName];
    if (!conf) return;
    const { item, floorIdx } = this.selectedItem;
    this.recordHistory();
    if (!item.matOverrides) item.matOverrides = {};
    const partKey = this.selectedSubmesh || '__all__';
    if (!item.matOverrides[partKey]) item.matOverrides[partKey] = {};
    Object.assign(item.matOverrides[partKey], conf);
    this.app.view3d?.applyItemOverrides(item, floorIdx);
    this.app.saveState?.();
  }

  applyTexture(dataUrl, mappingConf = {}) {
    if (!this.selectedItem) return;
    const { item, floorIdx } = this.selectedItem;
    this.recordHistory();
    if (!item.matOverrides) item.matOverrides = {};
    const partKey = this.selectedSubmesh || '__all__';
    if (!item.matOverrides[partKey]) item.matOverrides[partKey] = {};
    item.matOverrides[partKey].textureUrl = dataUrl;
    item.matOverrides[partKey].repeatX = mappingConf.repeatX || 2;
    item.matOverrides[partKey].repeatY = mappingConf.repeatY || 2;
    item.matOverrides[partKey].rotation = mappingConf.rotation || 0;
    this.app.view3d?.applyItemOverrides(item, floorIdx);
    this.app.saveState?.();
  }

  updatePartsTab() {
    const list = document.getElementById('matPartsList');
    if (!list || !this.selectedItem) return;
    list.innerHTML = '';
    const rootObj = this.app.view3d?.findObject3D(this.selectedItem.item.id);
    const parts = new Set();
    if (rootObj) {
      rootObj.traverse(child => {
        if (child.isMesh && child.name) parts.add(child.name);
      });
    }

    const allBtn = document.createElement('button');
    allBtn.className = `btn small ${!this.selectedSubmesh ? 'primary' : ''}`;
    allBtn.textContent = 'Whole Object';
    allBtn.onclick = () => { this.selectedSubmesh = null; this.updatePartsTab(); };
    list.appendChild(allBtn);

    parts.forEach(name => {
      const b = document.createElement('button');
      b.className = `btn small ${this.selectedSubmesh === name ? 'primary' : ''}`;
      b.textContent = name.replace(/_/g, ' ');
      b.onclick = () => { this.selectedSubmesh = name; this.updatePartsTab(); };
      list.appendChild(b);
    });
  }

  initItemHistory(item) {
    this.currentHistory = [JSON.stringify(item.matOverrides || {})];
    this.historyIdx = 0;
  }
  recordHistory() {
    if (!this.selectedItem) return;
    const snap = JSON.stringify(this.selectedItem.item.matOverrides || {});
    this.currentHistory = this.currentHistory.slice(0, this.historyIdx + 1);
    this.currentHistory.push(snap);
    this.historyIdx++;
  }
  undo() {
    if (this.historyIdx > 0 && this.selectedItem) {
      this.historyIdx--;
      this.selectedItem.item.matOverrides = JSON.parse(this.currentHistory[this.historyIdx]);
      this.app.view3d?.applyItemOverrides(this.selectedItem.item, this.selectedItem.floorIdx);
      this.syncUIFromItem();
    }
  }
  redo() {
    if (this.historyIdx < this.currentHistory.length - 1 && this.selectedItem) {
      this.historyIdx++;
      this.selectedItem.item.matOverrides = JSON.parse(this.currentHistory[this.historyIdx]);
      this.app.view3d?.applyItemOverrides(this.selectedItem.item, this.selectedItem.floorIdx);
      this.syncUIFromItem();
    }
  }
  resetOriginal() {
    if (!this.selectedItem) return;
    this.recordHistory();
    this.selectedItem.item.matOverrides = {};
    this.app.view3d?.applyItemOverrides(this.selectedItem.item, this.selectedItem.floorIdx);
    this.syncUIFromItem();
  }

  handleTextureUpload(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target.result;
      const tex = { id: 'tex_' + Date.now(), name: file.name.replace(/\\.[^/.]+$/, ""), dataUrl };
      this.textureLibrary.push(tex);
      localStorage.setItem('homecraft_custom_textures', JSON.stringify(this.textureLibrary));
      this.renderTextureLibrary();
      this.applyTexture(dataUrl);
    };
    reader.readAsDataURL(file);
  }

  renderTextureLibrary() {
    const grid = document.getElementById('matTextureGrid');
    if (!grid) return;
    grid.innerHTML = '';
    
    // Ensure preview box exists
    let prevBox = document.getElementById('texHoverPreview');
    if (!prevBox) {
      prevBox = document.createElement('div');
      prevBox.id = 'texHoverPreview';
      prevBox.style.cssText = 'position:fixed;display:none;z-index:9999;pointer-events:none;background:#fffdf7;border:1.5px solid var(--gold);box-shadow:0 12px 32px rgba(26,22,17,0.22);border-radius:10px;padding:8px;text-align:center;width:150px;backdrop-filter:blur(8px);';
      document.body.appendChild(prevBox);
    }

    this.textureLibrary.forEach(tex => {
      const card = document.createElement('div');
      card.className = 'texCard';
      card.draggable = true;
      card.style.cssText = 'cursor:grab;position:relative;user-select:none;';
      card.innerHTML = `<img src="${tex.dataUrl}" alt="${tex.name}" draggable="false"><span style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${tex.name}</span><small style="font-size:9px;color:var(--mut);display:block;">Drag to apply</small>`;

      // Drag and drop onto 3D viewport or objects
      card.ondragstart = (e) => {
        card.style.opacity = '0.5';
        const payload = {
          type: 'texture',
          tex: tex.tex || tex.id,
          dataUrl: tex.dataUrl,
          name: tex.name
        };
        e.dataTransfer.setData('application/json', JSON.stringify(payload));
        e.dataTransfer.effectAllowed = 'copy';
      };
      card.ondragend = () => {
        card.style.opacity = '1';
        if (prevBox) prevBox.style.display = 'none';
      };

      // Hover texture preview
      card.onmouseenter = (e) => {
        prevBox.innerHTML = `
          <div style="width:130px;height:130px;border-radius:6px;overflow:hidden;margin:0 auto 6px;border:1px solid var(--line);background:#000;">
            <img src="${tex.dataUrl}" style="width:100%;height:100%;object-fit:cover;display:block;">
          </div>
          <b style="font-size:11.5px;color:var(--txt);display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${tex.name}</b>
          <div style="font-size:10px;color:var(--gold);font-weight:700;">Drag onto wall or object in 3D</div>
        `;
        prevBox.style.display = 'block';
        const rect = card.getBoundingClientRect();
        prevBox.style.left = Math.max(10, rect.left - 160) + 'px';
        prevBox.style.top = Math.max(10, rect.top - 20) + 'px';
      };
      card.onmouseleave = () => {
        if (prevBox) prevBox.style.display = 'none';
      };

      card.onclick = () => this.applyTexture(tex.dataUrl);
      grid.appendChild(card);
    });
  }

  loadTextureLibrary() {
    const builtIn = [...FINISHES, ...ZONE_MATS].map(m => ({
      id: m.id,
      tex: m.tex,
      name: m.name,
      dataUrl: getTextureThumb(m, 128)
    }));
    try {
      const customs = JSON.parse(localStorage.getItem('homecraft_custom_textures') || '[]');
      return [...customs, ...builtIn];
    } catch {
      return builtIn;
    }
  }

  loadPalettes() {
    return [
      { name: 'Warm Villa', colors: ['#e6c894', '#a85b3b', '#395b50', '#f4ede2', '#2c221e'] },
      { name: 'Modern Neutral', colors: ['#ffffff', '#222224', '#7d828a', '#c7a77b', '#f2f3f5'] },
      { name: 'Japandi Earth', colors: ['#e8e0d5', '#c4b5a0', '#8c7d6b', '#5c5247', '#2e2924'] },
      { name: 'Luxe Midnight', colors: ['#171b26', '#263447', '#425873', '#94adc9', '#dce7f2'] },
      { name: 'Tuscan Terracotta', colors: ['#f2e3d5', '#d99879', '#b35d3b', '#85371c', '#4a1e0f'] },
      { name: 'Parisian Chic', colors: ['#ffffff', '#e8dfd8', '#cca99c', '#73605b', '#2e2523'] }
    ];
  }
  renderPalettesList() {
    const cont = document.getElementById('matPalettesList');
    if (!cont) return;
    cont.innerHTML = '';
    this.palettes.forEach(p => {
      const wrap = document.createElement('div');
      wrap.className = 'paletteRow';
      wrap.innerHTML = `<div class="palHead"><b>${p.name}</b></div><div class="palSwatches"></div>`;
      const swRow = wrap.querySelector('.palSwatches');
      p.colors.forEach(col => {
        const sw = document.createElement('div');
        sw.className = 'swatch';
        sw.style.backgroundColor = col;
        sw.onclick = () => this.applyColor(col);
        swRow.appendChild(sw);
      });
      cont.appendChild(wrap);
    });
  }

  syncUIFromItem() {
    if (!this.selectedItem) return;
    const ov = this.selectedItem.item.matOverrides?.[this.selectedSubmesh || '__all__'] || {};
    const hex = document.getElementById('matHexInput');
    const cp = document.getElementById('matColorPicker');
    if (hex && ov.color) hex.value = ov.color;
    if (cp && ov.color) cp.value = ov.color;
  }

  bindEvents() {
    this.panel.querySelectorAll('.matTabBtn').forEach(btn => {
      btn.onclick = () => {
        this.panel.querySelectorAll('.matTabBtn').forEach(b => b.classList.remove('on'));
        this.panel.querySelectorAll('.matTabContent').forEach(c => c.classList.remove('on'));
        btn.classList.add('on');
        document.getElementById(btn.dataset.target)?.classList.add('on');
      };
    });
    document.getElementById('matStudioClose')?.addEventListener('click', () => this.close());
    const cp = document.getElementById('matColorPicker');
    const hex = document.getElementById('matHexInput');
    cp?.addEventListener('input', e => { if (hex) hex.value = e.target.value; this.applyColor(e.target.value, 1.0, false); });
    cp?.addEventListener('change', e => { this.applyColor(e.target.value, 1.0, true); });
    hex?.addEventListener('change', e => {
      const v = this.normHex(e.target.value);
      if (v) { if (cp) cp.value = v; e.target.value = v; this.applyColor(v); }
      else e.target.value = cp ? cp.value : '#b98a2e';
    });
    this.panel.querySelectorAll('[data-finish]').forEach(b => b.onclick = () => this.applyFinish(b.dataset.finish));
    document.getElementById('matTextureUploadIn')?.addEventListener('change', e => {
      if (e.target.files?.[0]) this.handleTextureUpload(e.target.files[0]);
    });
    document.getElementById('matUndoBtn')?.addEventListener('click', () => this.undo());
    document.getElementById('matRedoBtn')?.addEventListener('click', () => this.redo());
    document.getElementById('matResetBtn')?.addEventListener('click', () => this.resetOriginal());
  }
}