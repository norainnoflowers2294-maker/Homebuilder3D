import { MaterialStudio } from './material_studio.js';
// HomeCraft 3D app orchestrator
import { blankState, demoState, loadState, saveState, loadCustom, saveCustom, uid, floorBaseY, floorTopY, nextFloorRise, defaultFloor, normalizeState, resolveAttachments, roomRectAt, wallsInRect, projectOnWall, wallLen, shelfStackTop, currentProjectState, listProjectsMeta, createProject, renameProject, duplicateProject, deleteProject, loadProjectState, setCurrentPid } from './store.js';
import { getCatalog, defById, CATEGORIES } from './catalog.js';
import { requestThumb, thumbCached } from './thumbs.js';
import { FINISHES, FINISH_MAP, ZONE_MATS, ZONE_MAP, POOL_WATERS, POOL_WATER_MAP, getTextureThumb, DESIGNER_COLORS } from './mats.js';
import { POOL_SHAPES, shelfSlots } from './catalog_extra.js';
import { View2D } from './view2d.js';
import { View3D } from './view3d.js';
import { initDrive } from './drive.js';
import { initDropbox } from './dropbox.js';
import { initBackendUI } from '../supabase/ui.js';
import { googleAuth } from './google_auth.js';
import { sound } from './sound.js';
import { OPENROUTER_MODELS, getBlueprintModel, setBlueprintModel, testOpenRouterConnection, fetchOpenRouterModels, generateOpenRouterText, analyzeBlueprintImage } from './openrouter.js';

const $=s=>document.querySelector(s);
function toast(m,ms=2200){ const t=$('#toast'); t.textContent=m; t.style.display='block'; clearTimeout(t._h); t._h=setTimeout(()=>t.style.display='none',ms); }
// ---------- monochrome icon system (inline Lucide SVGs, no post-processing) ----------
const _iconMiss=new Set();
function icon(n, cls){
  try{
    const L=window.lucide; if(!L||!L.icons) return '';
    const key=String(n).split('-').map(s=>s?s[0].toUpperCase()+s.slice(1):'').join('');
    const def=L.icons[key]||L.icons[key+'Icon'];
    if(!def){ if(!_iconMiss.has(n)){ _iconMiss.add(n); console.warn('icon missing',n); } return ''; }
    const step=def, tag=step[0], attrs=step[1], kids=step[2];
    const at=Object.entries(attrs||{}).map(kv=>kv[0]+'="'+String(kv[1]).replace(/"/g,'')+'"').join(' ');
    const ch=(kids||[]).map(k=>'<'+k[0]+' '+Object.entries(k[1]||{}).map(kv=>kv[0]+'="'+String(kv[1]).replace(/"/g,'')+'"').join(' ')+'/>').join('');
    return '<svg xmlns="http://www.w3.org/2000/svg" '+at+' class="ic'+(cls?' '+cls:'')+'" aria-hidden="true">'+ch+'</svg>';
  }catch(e){ return ''; }
}
function refreshIcons(){ try{ window.lucide&&window.lucide.createIcons(); }catch(e){} }
const CAT_ICON={structure:'brick-wall',walldecor:'image',flooring:'layers',shelving:'library',decor:'sparkles',plants:'sprout',lighting:'lamp',kitchen:'cooking-pot',dining:'utensils',pantry:'package',bedroom:'bed-double',bath:'bath',living:'sofa',chairs:'armchair',glam:'gem',billiard:'circle-dot',bar:'martini',pools:'waves',patios:'tent',land:'tree-pine',outdoor:'sun',custom:'package'};
function catIcon(c){ return CAT_ICON[c]||'box'; }
const CAT_DESC={structure:'Walls, stairs, railings, fireplaces, columns.',textures:'Floor, patio and terrain finishes — tap a card, then tap or drag to apply.',walldecor:'Art, mirrors, clocks, TV — tap a wall to hang.',flooring:'Tap a room to fill it, or drag a rectangle.',shelving:'Bookcases and shelf units — drag decor onto shelves.',decor:'Small objects — many sit on shelves and tables.',plants:'Greenery, trees and planters, indoor and out.',lighting:'Lamps and ceiling lights — tap one in 3D to toggle.',kitchen:'Counters, appliances and storage.',dining:'Tables and sideboards — chairs live under Sitting chairs.',pantry:'Storage, cabinets and organizers.',bedroom:'Beds, wardrobes, dressers, nightstands.',bath:'Tubs, showers, toilets and vanities.',living:'Couches, sofas, loveseats and recliners, plus media units and rugs.',chairs:'Barstools & stools, dining, sitting, vanity and rocking chairs.',glam:'Statement pieces with shine.',billiard:'Game tables and seating.',bar:'Bars and cabinets — stools live under Sitting chairs.',pools:'Tap or drag — water, lights, extras in Properties.',patios:'Tap ground or drag — pergolas, kitchens, gates.',land:'Rocks, beds, fountains and accents.',outdoor:'Loungers, dining sets, shade and storage.',custom:'Your uploaded 3D models, with AI thumbnails.'};
function swIcon(m){ if(!m) return '';
  if(m.base) return '<span class="dot" style="background:'+m.base+'"></span>';
  if(m.icon) return icon(m.icon);
  return ''; }

class App {
  constructor(){
    const boot=currentProjectState(loadState()||demoState());
    this.projectId=boot.pid;
    this.state=normalizeState(boot.state)||demoState();
    this.custom=loadCustom();
    this.tool='select';
    this.pendingDef=null;
    this.sel=null; // {type:'wall'|'opening'|'item'|'slab'|'zone'|'pool', id, floor}
    this.mode='2d';
    this.undoStack=[]; this.redoStack=[];
    this.view2d=null; this.view3d=null;
    this._renderGrid=null;
    // decor upgrade presets
    this.zonePreset={mat:'oak',color:'#ffffff',angle:0,scale:1.2};
    this.patioPreset={mat:'patio_stone',color:'#ffffff',angle:0,scale:1.2};
    this.poolPreset={shape:'rect',water:'aqua',coping:'#e8e2d4',depth:1.4,lights:false,cover:false,steps:true,ladder:true,board:false,fountain:false};
    this.paintPreset={mat:'grass'};
    this.brushSize=1.2;
    this.styleClip=null;
    this.roomDesigns=this.loadRooms();
    this.veraPhotos=[];
  }
  loadRooms(){ try{ return JSON.parse(localStorage.getItem('homecraft3d.rooms.v1')||'{}'); }catch(e){ return {}; } }
  saveRooms(){ try{ localStorage.setItem('homecraft3d.rooms.v1',JSON.stringify(this.roomDesigns)); }catch(e){} }
  resolveAll(){
    try{ for(const fl of this.state.floors) resolveAttachments(fl,(it)=>this.defOf(it)); }catch(e){}
  }
  afterGeometryChange(){
    // walls/items moved: recompute attached poses, then sync views (undo already checkpointed)
    this.resolveAll();
    this.live();
  }
  zoneName(z){ return (z.mat&&ZONE_MAP[z.mat]&&ZONE_MAP[z.mat].name)||'surface'; }
  customById(id){ return this.custom.find(c=>c.id===id)||null; }
  customDef(customId){
    const c=typeof customId==='string'?this.customById(customId.replace(/^custom:/,''))||this.customById(customId):null;
    if(!c) return null;
    return { id:'custom:'+c.id, cat:'custom', name:c.name, icon:'', w:c.w||1, d:c.d||1, h:c.h||1, thumb:c.thumb||null, sub:c.sub||'', desc:c.desc||'' };
  }
  defOf(item){
    if(!item) return null;
    return defById(item.defId)||(item.customId?this.customDef(item.customId):item.defId?.startsWith('custom:')?this.customDef(item.defId):null);
  }

  dirty(save=true){
    this.resolveAll();
    if(save){
      this.pushUndo();
      clearTimeout(this._s);
      this._s=setTimeout(()=>{
        saveState(this.state);
        this.updateUndoRedoUI();
      },300);
    }
    this.view2d?.request();
    this.view3d?.rebuild();
  }
  live(){
    this.resolveAll();
    clearTimeout(this._s);
    this._s=setTimeout(()=>{
      saveState(this.state);
      this.updateUndoRedoUI();
    },500);
    this.view2d?.request();
    if(this.view3d?.rebuildSoon) this.view3d.rebuildSoon(); else this.view3d?.rebuild();
  }
  saveState(){
    saveState(this.state);
    this.updateUndoRedoUI();
  }
  pushUndo(){
    try{
      this.undoStack.push(JSON.stringify(this.state));
      if(this.undoStack.length>60) this.undoStack.shift();
      this.redoStack.length=0;
      this.updateUndoRedoUI();
    }catch(e){}
  }
  checkpoint(){ this.pushUndo(); } // snapshot for undo at drag start (autosave happens via live())
  notice(m){ toast(m); }
  doUndo(){
    if(!this.undoStack.length){ toast('Nothing to undo'); return; }
    this.redoStack.push(JSON.stringify(this.state));
    this.state=normalizeState(JSON.parse(this.undoStack.pop()))||this.state;
    this.sel=null; this.view2d.draft=[];
    saveState(this.state); this.syncAll();
    this.updateUndoRedoUI();
    toast('Undone');
  }
  doRedo(){
    if(!this.redoStack.length){ toast('Nothing to redo'); return; }
    this.undoStack.push(JSON.stringify(this.state));
    this.state=normalizeState(JSON.parse(this.redoStack.pop()))||this.state;
    this.sel=null; saveState(this.state); this.syncAll();
    this.updateUndoRedoUI();
    toast('Redone');
  }

  updateUndoRedoUI(){
    const uBtn = document.getElementById('undoBtnTop');
    const rBtn = document.getElementById('redoBtnTop');
    const fuBtn = document.getElementById('floatingUndoBtn');
    const frBtn = document.getElementById('floatingRedoBtn');

    const hasU = !!(this.undoStack && this.undoStack.length > 0);
    const hasR = !!(this.redoStack && this.redoStack.length > 0);

    for(const btn of [uBtn, fuBtn]){
      if(!btn) continue;
      btn.removeAttribute('disabled');
      btn.style.pointerEvents = 'auto';
      btn.classList.toggle('active', hasU);
      btn.classList.toggle('disabled', !hasU);
      btn.style.opacity = hasU ? '1' : '0.42';
      btn.title = hasU ? `Undo (1-tap, ${this.undoStack.length} step${this.undoStack.length>1?'s':''})` : 'Undo (nothing to undo)';
    }

    for(const btn of [rBtn, frBtn]){
      if(!btn) continue;
      btn.removeAttribute('disabled');
      btn.style.pointerEvents = 'auto';
      btn.classList.toggle('active', hasR);
      btn.classList.toggle('disabled', !hasR);
      btn.style.opacity = hasR ? '1' : '0.42';
      btn.title = hasR ? `Redo (1-tap, ${this.redoStack.length} step${this.redoStack.length>1?'s':''})` : 'Redo (tap arrow to redo)';
    }

    const badge = document.getElementById('saveStatusTxt');
    if(badge){
      badge.textContent = 'Autosaved';
    }
  }

  applyTextureToTarget(sel, data){
    if(!sel || !data) return;
    const fl = this.state.floors[sel.floor ?? this.state.activeFloor] || this.curFloor();
    if(!fl) return;

    if(sel.type === 'wall'){
      const w = fl.walls.find(v => v.id === sel.id);
      if(!w) return;
      if(w.locked){ toast('Wall is locked — unlock to edit'); return; }
      this.pushUndo();
      const scope = this._finishScope || 'wall';
      const walls = this.wallsForScope(fl, w, scope);
      const isColor = !!data.hex;
      if(isColor){
        for(const ww of walls){
          ww.color = data.hex;
          ww.finish = { ...(ww.finish||{}), tex:'wallpaint', color:data.hex };
          delete ww.finish.textureUrl;
        }
      } else if(data.dataUrl){
        for(const ww of walls) ww.finish={tex:'wallpaint',color:'#ffffff',textureUrl:data.dataUrl};
      } else {
        const texKey = data.tex || data.id || 'wallpaint';
        for(const ww of walls) ww.finish = { tex: texKey, color: data.base || '#ffffff' };
      }
      saveState(this.state);
      this.syncAll();
      sound.playStoneTap();
      toast(`Applied ${data.name} to ${scope === 'wall' ? 'wall' : scope}`);
    } else if(sel.type === 'slab' || sel.type === 'zone'){
      this.pushUndo();
      const texKey = data.tex || data.id;
      if(data.dataUrl) fl.customTextureUrl=data.dataUrl;
      else { delete fl.customTextureUrl; fl.finish = texKey || 'oak'; }
      saveState(this.state);
      this.syncAll();
      sound.playFloorWhoosh();
      toast(`Applied ${data.name} to floor`);
    } else if(sel.type === 'item'){
      const it = fl.items.find(v => v.id === sel.id);
      if(!it) return;
      if(it.locked){ toast('Item is locked — unlock to edit'); return; }
      this.pushUndo();
      if(!it.matOverrides) it.matOverrides = {};
      const partKey = '__all__';
      if(!it.matOverrides[partKey]) it.matOverrides[partKey] = {};
      if(data.hex){
        it.matOverrides[partKey].color = data.hex;
      } else if(data.dataUrl){
        it.matOverrides[partKey].textureUrl = data.dataUrl;
      } else if(data.tex){
        it.matOverrides[partKey].textureUrl = getTextureThumb(data, 256);
      }
      saveState(this.state);
      this.syncAll();
      sound.playStoneTap();
      toast(`Applied ${data.name} to ${it.name || 'object'}`);
    }
  }

  armTextureForApply(item, thumbUrl){
    this.activeTexture = item;
    const hud = document.getElementById('activeTexHUD');
    if(hud){
      hud.hidden = false;
      const th = document.getElementById('activeTexThumb');
      if(th) th.src = thumbUrl || getTextureThumb(item, 80);
      const nm = document.getElementById('activeTexName');
      if(nm) nm.textContent = item.name;
    }
    toast(`Active: ${item.name} — Tap any wall, floor, or object to apply`);
  }

  curFloor(){ return this.state.floors[this.state.activeFloor]; }

  select(sel,opts={}){
    // normalize floor
    if(sel && sel.floor==null) sel.floor=this.state.activeFloor;
    this.sel=sel;
    this.view2d?.request();
    this.view3d?.highlight();
    if(opts.quiet) return; // mid-drag: never touch panels or toolbars
    if(!sel){ this._panelForce=false; this.hideCtxBar(); this.refreshSelPanel(); return; }
    this.showCtxBar();
    this.refreshSelPanel();
  }

  showCtxBar(){
    const bar=document.querySelector('#ctxBar'); if(!bar) return;
    const s=this.sel;
    if(!s){ bar.classList.remove('on'); return; }
    const fl=this.state.floors[s.floor]||this.curFloor();
    const B=(id,icon,title,cls='')=>`<button data-b="${id}" title="${title}" class="${cls}">${icon}</button>`;
    let label='', btns='';
    const pinBtn=B('pin',icon('pin'),'Pin toolbar',this.ctxPinned?'on':'');
    const closeBtn=B('close',icon('x'),'Close');
    if(s.type==='wall'){
      const w=fl.walls.find(v=>v.id===s.id); if(!w){ bar.classList.remove('on'); return; }
      const L=Math.hypot(w.x2-w.x1,w.z2-w.z1).toFixed(2);
      label=`<span class="lbl" id="ctxLbl">${icon('brick-wall')} ${L}m${w.locked?' '+icon('lock'):''}</span>`;
      btns=B('props',icon('sliders-horizontal'),'Edit properties')+B('lock',w.locked?icon('lock-open'):icon('lock'),w.locked?'Unlock':'Lock')+B('dup',icon('copy'),'Duplicate')+B('split',icon('scissors'),'Split')+B('del',icon('trash-2'),'Delete','danger')+pinBtn+closeBtn;
    } else if(s.type==='opening'){
      const o=fl.openings.find(v=>v.id===s.id); if(!o){ bar.classList.remove('on'); return; }
      label=`<span class="lbl" id="ctxLbl">${o.kind==='door'?icon('door-open')+' Door':o.kind==='window'?icon('app-window')+' Window':icon('square')+' Arch'} ${o.w.toFixed(2)}m</span>`;
      btns=B('props',icon('sliders-horizontal'),'Edit properties')+B('del',icon('trash-2'),'Delete','danger')+pinBtn+closeBtn;
    } else if(s.type==='item'){
      const it=fl.items.find(v=>v.id===s.id); if(!it){ bar.classList.remove('on'); return; }
      const def=this.defOf(it)||{name:it.defId,cat:'custom'};
      label=`<span class="lbl" id="ctxLbl">${icon(catIcon(def.cat||'custom'))} ${(def.name||'').slice(0,16)}${it.locked?' '+icon('lock'):''}</span>`;
      btns=((def.ix&&def.ix.length)?B('use',icon('power'),'Use / toggle'):'')+B('props',icon('sliders-horizontal'),'Edit properties')+B('rot',icon('rotate-cw'),'Rotate 45°')+B('lock',it.locked?icon('lock-open'):icon('lock'),it.locked?'Unlock':'Lock')+B('dup',icon('copy'),'Duplicate')+B('del',icon('trash-2'),'Delete','danger')+pinBtn+closeBtn;
    } else if(s.type==='slab'){
      label=`<span class="lbl" id="ctxLbl">${icon('layers')} Slab</span>`;
      btns=B('props',icon('sliders-horizontal'),'Slab settings')+pinBtn+closeBtn;
    } else if(s.type==='zone'){
      const zn=(fl.zones||[]).find(v=>v.id===s.id); if(!zn){ bar.classList.remove('on'); return; }
      label=`<span class="lbl" id="ctxLbl">${icon('paint-roller')} ${this.zoneName(zn)}</span>`;
      btns=B('props',icon('sliders-horizontal'),'Edit surface')+B('dup',icon('copy'),'Duplicate')+B('del',icon('trash-2'),'Delete','danger')+pinBtn+closeBtn;
    } else if(s.type==='pool'){
      const p=(fl.pools||[]).find(v=>v.id===s.id); if(!p){ bar.classList.remove('on'); return; }
      label=`<span class="lbl" id="ctxLbl">${icon('waves')} ${p.shape} pool</span>`;
      btns=B('props',icon('sliders-horizontal'),'Edit pool')+B('dup',icon('copy'),'Duplicate')+B('del',icon('trash-2'),'Delete','danger')+pinBtn+closeBtn;
    } else { bar.classList.remove('on'); return; }
    bar.innerHTML=label+btns;
    bar.classList.add('on');
    bar.querySelectorAll('button').forEach(b=>b.onclick=()=>this.ctxAction(b.dataset.b));
  }
  hideCtxBar(){ if(!this.ctxPinned) document.querySelector('#ctxBar')?.classList.remove('on'); }
  updateCtxLabel(t){ const l=document.querySelector('#ctxLbl'); if(l) l.textContent=t; }
  ctxAction(a){
    const s=this.sel; if(!s) return;
    const fl=this.state.floors[s.floor]||this.curFloor();
    if(a==='close'){ this._panelForce=false; this.select(null); return; }
    if(a==='pin'){ this.ctxPinned=!this.ctxPinned; this.showCtxBar(); return; }
    if(a==='props'){ this._panelForce=true; this.refreshSelPanel(); return; }
    if(s.type==='wall'){
      const w=fl.walls.find(v=>v.id===s.id); if(!w) return;
      if(a==='lock'){ w.locked=!w.locked; saveState(this.state); this.syncAll(); this.showCtxBar(); }
      if(a==='dup'){ this.pushUndo(); fl.walls.push({...w,locked:false,id:uid('w'),x1:w.x1+0.5,x2:w.x2+0.5}); saveState(this.state); this.syncAll(); }
      if(a==='split'){ if(w.locked){ toast('Unlock the wall to split it'); return; } this.pushUndo(); const mx=(w.x1+w.x2)/2,mz=(w.z1+w.z2)/2; const w2={...w,id:uid('w'),x1:mx,z1:mz}; w.x2=mx; w.z2=mz; fl.walls.push(w2); saveState(this.state); this.syncAll(); }
      if(a==='del') this.deleteWall(w);
    } else if(s.type==='opening'){
      const o=fl.openings.find(v=>v.id===s.id); if(!o) return;
      if(a==='del') this.deleteOpening(o);
    } else if(s.type==='item'){
      const it=fl.items.find(v=>v.id===s.id); if(!it) return;      if(a==='lock'){ it.locked=!it.locked; saveState(this.state); this.syncAll(); this.showCtxBar(); }
      if(a==='rot'){ if(it.locked){ toast('Item is locked'); return; } this.pushUndo(); it.rot=((it.rot||0)+45)%360; saveState(this.state); this.syncAll(); this.showCtxBar(); }
      if(a==='use'){ const df=app.defOf(it); const tag=df&&df.ix&&df.ix[0]&&df.ix[0].tag; if(tag&&!it.locked){ app.view3d.toggleIx(it,tag); this.showCtxBar(); } else toast(it.locked?'Item is locked':'Nothing to toggle on this piece'); return; }
      if(a==='dup'){ this.pushUndo(); fl.items.push({...it,locked:false,id:uid('i'),x:+(it.x+0.5).toFixed(3)}); saveState(this.state); this.syncAll(); }
      if(a==='del') this.deleteItem(it);
    } else if(s.type==='zone'){
      const zn=(fl.zones||[]).find(v=>v.id===s.id); if(!zn) return;
      if(a==='dup'){ this.pushUndo(); fl.zones.push({...zn,id:uid('z'),x0:zn.x0+0.5,x1:zn.x1+0.5}); saveState(this.state); this.syncAll(); }
      if(a==='del') this.deleteZone(zn);
    } else if(s.type==='pool'){
      const p=(fl.pools||[]).find(v=>v.id===s.id); if(!p) return;
      if(a==='dup'){ this.pushUndo(); fl.pools.push({...p,id:uid('p'),x:+(p.x+1).toFixed(2)}); saveState(this.state); this.syncAll(); }
      if(a==='del') this.deletePool(p);
    }
  }

  // ---------- 2D taps ----------
  tap2D(x,z){
    const v=this.view2d;
    const sx=v.snap(x), sz=v.snap(z);
    if(this.tool==='wall'){
      v.draft.push({x:sx,z:sz});
      v.preview=null; v.request(); this.refreshSelPanel(); return;
    }
    if(this.tool==='furniture' && this.pendingDef){
      this.placeFurniture(sx,sz);
      return;
    }
    if(this.tool==='zone'||this.tool==='patio'){
      // tap = fill the tapped room; drag = custom rectangle (handled on release)
      const fl=this.curFloor();
      const rect=roomRectAt(fl,x,z,fl.slab);
      if(!rect){ toast('Tap inside a room to fill it — or drag a rectangle'); return; }
      const preset=this.tool==='zone'?this.zonePreset:this.patioPreset;
      this.pushUndo();
      fl.zones=fl.zones||[];
      const zn={id:uid('z'),x0:+(rect.x0+0.06).toFixed(2),z0:+(rect.z0+0.06).toFixed(2),x1:+(rect.x1-0.06).toFixed(2),z1:+(rect.z1-0.06).toFixed(2),
        mat:preset.mat,color:preset.color,angle:preset.angle||0,scale:preset.scale||1.2};
      if(zn.x1-zn.x0<0.3||zn.z1-zn.z0<0.3){ toast('Room too small'); return; }
      fl.zones.push(zn);
      saveState(this.state); this.syncAll();
      this.select({type:'zone',id:zn.id,floor:this.state.activeFloor});
      toast('Surface filled — drag to resize, Properties for options');
      return;
    }
    if(this.tool==='pool'){
      this.placePool(sx,sz);
      return;
    }
    if(this.tool==='paint'){
      this.paintAt(x,z);
      return;
    }
    if(this.tool==='door'||this.tool==='window'||this.tool==='opening'){
      const wall=v.hitWall(x,z);
      if(!wall){ toast('Tap a wall to add '+(this.tool==='opening'?'arch':this.tool)); return; }
      this.addOpening(wall,x,z,this.tool==='opening'?'arch':this.tool);
      return;
    }
    if(this.tool==='delete'||this.tool==='erase'){
      const it=v.hitItem(x,z); if(it){ if(it.locked){ this.select({type:'item',id:it.id,floor:this.state.activeFloor}); toast('Locked — unlock in its panel to delete'); } else this.deleteItem(it); return; }
      const op=v.hitOpening(x,z); if(op){ const wall=this.curFloor().walls.find(w=>w.id===op.wallId); if(wall?.locked){ toast('That wall is locked'); } else this.deleteOpening(op); return; }
      const w=v.hitWall(x,z); if(w){ if(w.locked){ this.select({type:'wall',id:w.id,floor:this.state.activeFloor}); toast('Wall is locked — unlock in its panel to edit'); } else this.deleteWall(w); return; }
      return;
    }
    if(this.tool==='room'){
      const sx=v.snap(x), sz=v.snap(z);
      v.roomDraft.push({x:sx,z:sz});
      if(v.roomDraft.length>=2){ const [a,b]=v.roomDraft; v.roomDraft=[]; this.makeRoom(a,b); }
      else { this.updateCtxLabel('tap opposite corner'); toast('Room: tap the opposite corner'); }
      v.request(); return;
    }
    if(this.tool==='measure'){
      const sx=v.snap(x), sz=v.snap(z);
      if(v.meas.length>=2) v.meas=[];
      v.meas.push({x:sx,z:sz});
      if(v.meas.length===2){ const [a,b]=v.meas; toast(Math.hypot(b.x-a.x,b.z-a.z).toFixed(2)+' m'); }
      v.request(); return;
    }
    if(this.tool==='floor'){
      this._panelForce=true;
      this.sel={type:'slab',id:'slab',floor:this.state.activeFloor};
      this.view2d?.request(); this.view3d?.highlight();
      this.showCtxBar(); this.refreshSelPanel();
      return;
    }
    if(this.tool==='ceiling'){
      const fl=this.curFloor();
      fl.ceil=fl.ceil||{on:false,color:'#f5f2ea'};
      fl.ceil.on=!fl.ceil.on;
      this.pushUndo(); saveState(this.state); this.syncAll();
      toast(fl.ceil.on?'Ceiling on for '+fl.name+' (see 3D)':'Ceiling off for '+fl.name);
      return;
    }
    // select
    const it=v.hitItem(x,z);
    if(it){ this.select({type:'item',id:it.id,floor:this.state.activeFloor}); return; }
    const op=v.hitOpening(x,z);
    if(op){ this.select({type:'opening',id:op.id,floor:this.state.activeFloor}); return; }
    const w=v.hitWall(x,z);
    if(w){ this.select({type:'wall',id:w.id,floor:this.state.activeFloor}); return; }
    const zn=v.hitZone(x,z);
    if(zn){ this.select({type:'zone',id:zn.id,floor:this.state.activeFloor}); return; }
    const pl=v.hitPool(x,z);
    if(pl){ this.select({type:'pool',id:pl.id,floor:this.state.activeFloor}); return; }
    this.select(null);
  }
  tap3DEmpty(){
    if((this.tool==='furniture'&&this.pendingDef)||this.tool==='zone'||this.tool==='patio'||this.tool==='pool'||this.tool==='paint'){ /* placing — keep */ return; }
    // if wall draft ignore
    this.select(null);
  }

  // ---- decor placement: floor / wall-mounted / shelf ----
  slotList(def){
    if(!def) return [];
    if(def.shelves&&def.shelves.length) return def.shelves.map(s=>({y:s.y,w:s.w||def.w*0.9,d:s.d||def.d*0.9,dx:s.dx||0,dz:s.dz||0}));
    if(def.noTop) return [];
    return [{y:def.h,w:def.w*0.92,d:def.d*0.92,dx:0,dz:0,top:true}];
  }
  placeFurniture(x,z){
    const fl=this.curFloor();
    const def=this.pendingDef;
    if(!def) return;
    if(def.wallMount){ this.attachWallDecor(def,x,z); return; }
    if(def.shelfable){
      const parent=this.view2d.hitItem(x,z);
      if(parent&&this.slotList(this.defOf(parent)).length){ this.attachShelf(def,parent); return; }
      // else fall through to floor placement
    }
    this.pushUndo();
    let it;
    if(def.cat==='custom'||def.id.startsWith('custom:')){
      const cid=def.id.replace(/^custom:/,'');
      const crec=this.customById(cid);
      it={id:uid('i'),defId:'__custom',customId:cid,x,z,rot:crec?.rotY||0,scale:1};
    } else {
      it={id:uid('i'),defId:def.id,x,z,rot:0,scale:1};
    }
    fl.items.push(it);
    if(it.defId==='stairs_straight'){
      // auto-resize: land on the floor above
      it.rise=nextFloorRise(this.state,this.state.activeFloor);
      const above=this.state.floors[this.state.activeFloor+1]?.name;
      saveState(this.state);
      this.select({type:'item',id:it.id,floor:this.state.activeFloor},{quiet:true});
      this.showCtxBar();
      this.view2d.request(); this.view3d.rebuild();
      sound.playWoodTock();
      toast(`Stairs placed — rise auto-set to ${it.rise.toFixed(2)} m${above?` to reach ${above}`:' (add a floor above to connect it)'}`);
      return;
    }
    saveState(this.state);
    this.select({type:'item',id:it.id,floor:this.state.activeFloor},{quiet:true});
    this.showCtxBar();
    this.view2d.request(); this.view3d.rebuild();
    sound.playWoodTock();
    toast(def.name+' placed'+(def.shelfable?' — tap a shelf/bookcase to put it on shelves':' — tap to place more, switch tools to stop'));
  }
  // Re-fit every (unlocked) staircase to the floor above it. Called when floors
  // are added/removed or wall heights change; onlyMissing migrates older saves.
  fitStairs(onlyMissing=false){
    const st=this.state; let changed=false;
    st.floors.forEach((fl,fi)=>{
      const rise=nextFloorRise(st,fi);
      for(const it of fl.items){
        if(it.defId!=='stairs_straight'||it.locked) continue;
        if(onlyMissing&&it.rise!=null) continue;
        if(it.rise!==rise){ it.rise=rise; changed=true; }
      }
    });
    return changed;
  }
  nearestWall(fl,x,z,maxD=1.2){
    let best=null,bd=maxD;
    for(const w of fl.walls){
      const dx=x-(w.x1+w.x2)/2, dz=z-(w.z1+w.z2)/2;
      const L=wallLen(w);
      // perpendicular distance
      const t=((x-w.x1)*(w.x2-w.x1)+(z-w.z1)*(w.z2-w.z1))/(L*L||1e-9);
      const tc=Math.max(0,Math.min(1,t));
      const d=Math.hypot(x-(w.x1+(w.x2-w.x1)*tc),z-(w.z1+(w.z2-w.z1)*tc));
      if(d<bd){ bd=d; best=w; }
    }
    return best;
  }
  attachWallDecor(def,x,z,floorIdx){
    const fi=floorIdx==null?this.state.activeFloor:floorIdx;
    const fl=this.state.floors[fi];
    const w=this.nearestWall(fl,x,z,1.5);
    if(!w){ toast('Tap closer to a wall to hang '+def.name); return; }
    if(w.locked){ toast('That wall is locked — unlock it first'); return; }
    const pr=projectOnWall(w,x,z);
    this.pushUndo();
    const it={id:uid('i'),defId:def.id,x,z,rot:0,scale:1,
      mount:{wallId:w.id,along:pr.along,y:def.mountH||1.6,side:pr.side}};
    fl.items.push(it);
    this.resolveAll();
    saveState(this.state); this.syncAll();
    this.select({type:'item',id:it.id,floor:fi});
    sound.playWoodTock();
    toast(def.name+' hung — drag along the wall, Properties for height');
  }
  attachShelf(def,parent,dx,dz,shelfIdx,floorIdx){
    const fi=floorIdx==null?this.state.activeFloor:floorIdx;
    const fl=this.state.floors[fi];
    let p=typeof parent==='string'?fl.items.find(v=>v.id===parent):parent;
    if(!p){ toast('Shelf not found'); return; }
    // stacking goes on the same furniture shelf (never chains of children)
    if(p.on){ const g=fl.items.find(v=>v.id===p.on.parentId); if(g) p=g; }
    const slots=this.slotList(this.defOf(p));
    if(!slots.length){ toast('Nothing to put things on there — try a shelf, table or bookcase'); return; }
    const scale=1;
    const cw=(def.w||0.3)*scale, cd=(def.d||0.3)*scale;
    // pick first fitting slot (prefer real shelves over table tops when small)
    const ordered=slots.map((s,i)=>({s,i})).sort((a,b)=>{
      const fa=(cw<=a.s.w+0.05&&cd<=a.s.d+0.05)?0:1, fb=(cw<=b.s.w+0.05&&cd<=b.s.d+0.05)?0:1;
      if(fa!==fb) return fa-fb;
      return (a.s.top?1:0)-(b.s.top?1:0);
    });
    let chosen=null;
    for(const {s,i} of ordered){
      if(cw>s.w+0.05||cd>s.d+0.05) continue;
      const px=dx!=null?dx:0, pz=dz!=null?dz:0;
      for(const it2 of fl.items) it2._defCache=this.defOf(it2);
      const r=shelfStackTop(fl,p.id,i,px,pz,def,scale,null);
      for(const it2 of fl.items) delete it2._defCache;
      if(r.blocked) continue;
      chosen={slot:i,top:r.top,dx:px,dz:pz};
      break;
    }
    if(!chosen){ toast('Doesn\'t fit / occupied — try a bigger shelf or move things'); return; }
    this.pushUndo();
    const it={id:uid('i'),defId:def.id,x:p.x,z:p.z,rot:p.rot||0,scale:1,
      on:{parentId:p.id,shelf:chosen.slot,dx:chosen.dx,dz:chosen.dz,top:chosen.top}};
    fl.items.push(it);
    this.resolveAll();
    saveState(this.state); this.syncAll();
    this.select({type:'item',id:it.id,floor:fi});
    sound.playWoodTock();
    toast(def.name+' placed on shelf — drag to rearrange, Properties for shelf and position');
  }
  // ---- pools / paint / rect tools ----
  placePool(x,z,preset){
    const fl=this.curFloor();
    const ps=preset||this.poolPreset;
    this.pushUndo();
    fl.pools=fl.pools||[];
    const p={id:uid('p'),x:+x.toFixed(2),z:+z.toFixed(2),w:4,d:3,rot:0,
      shape:ps.shape||'rect',depth:ps.depth||1.4,water:ps.water||'aqua',coping:ps.coping||'#e8e2d4',
      lights:!!ps.lights,cover:!!ps.cover,steps:ps.steps!==false,ladder:ps.ladder!==false,
      board:!!ps.board,fountain:!!ps.fountain};
    if(p.shape==='square'){ p.w=3.2; p.d=3.2; }
    if(p.shape==='oval'){ p.w=4.5; p.d=3; }
    if(p.shape==='kidney'){ p.w=5; p.d=3.2; }
    if(p.shape==='plunge'){ p.w=2.6; p.d=2.2; p.depth=1.2; }
    if(p.shape==='above'){ p.w=4; p.d=3; p.depth=1.2; }
    fl.pools.push(p);
    saveState(this.state); this.syncAll();
    this.select({type:'pool',id:p.id,floor:this.state.activeFloor});
    toast('Pool placed — drag to move, Properties for shape, water and lights');
  }
  paintAt(x,z){
    const fl=this.curFloor();
    fl.paints=fl.paints||[];
    const last=fl.paints[fl.paints.length-1];
    if(last&&Math.hypot(last.x-x,last.z-z)<this.brushSize*0.35) return;
    const p={x:+x.toFixed(2),z:+z.toFixed(2),r:this.brushSize,mat:this.paintPreset.mat,color:this.paintPreset.color||'#ffffff'};
    fl.paints.push(p);
    if(fl.paints.length>500) fl.paints.splice(0,fl.paints.length-500);
    this.live();
  }
  finishRectTool(drag){
    const fl=this.curFloor();
    const x0=Math.min(drag.x0,drag.x1), x1=Math.max(drag.x0,drag.x1);
    const z0=Math.min(drag.z0,drag.z1), z1=Math.max(drag.z0,drag.z1);
    if(x1-x0<0.3||z1-z0<0.3){ toast('Drag a bigger area'); this.view2d.request(); return; }
    if(drag.tool==='pool'){
      this.pushUndo();
      fl.pools=fl.pools||[];
      const ps=this.poolPreset;
      const p={id:uid('p'),x:+((x0+x1)/2).toFixed(2),z:+((z0+z1)/2).toFixed(2),
        w:+(x1-x0).toFixed(2),d:+(z1-z0).toFixed(2),rot:0,
        shape:ps.shape||'rect',depth:ps.depth||1.4,water:ps.water||'aqua',coping:ps.coping||'#e8e2d4',
        lights:!!ps.lights,cover:!!ps.cover,steps:ps.steps!==false,ladder:ps.ladder!==false,
        board:!!ps.board,fountain:!!ps.fountain};
      fl.pools.push(p);
      saveState(this.state); this.syncAll();
      this.select({type:'pool',id:p.id,floor:this.state.activeFloor});
      toast('Pool drawn — Properties for shape, water and lights');
      return;
    }
    // zone / patio
    const preset=drag.tool==='zone'?this.zonePreset:this.patioPreset;
    this.pushUndo();
    fl.zones=fl.zones||[];
    const zn={id:uid('z'),x0:+x0.toFixed(2),z0:+z0.toFixed(2),x1:+x1.toFixed(2),z1:+z1.toFixed(2),
      mat:preset.mat,color:preset.color||'#ffffff',angle:preset.angle||0,scale:preset.scale||1.2};
    fl.zones.push(zn);
    saveState(this.state); this.syncAll();
    this.select({type:'zone',id:zn.id,floor:this.state.activeFloor});
    toast('Surface drawn — drag to move, Properties for material');
  }
  // ---- 3D placement: tap into the live room ----
  placeAt3D(px,py){
    const v=this.view3d;
    if(!v||!v.ready) return;
    const {hits}=v.raycastAt(px,py);
    if(!hits.length) return;
    const st=this.state;
    const selOf=h=>v.selOf(h.object);
    const groundHit=()=>{
      // The floor picker is authoritative in multi-storey homes.
      const fi=Math.max(0,Math.min(st.floors.length-1,Number(st.activeFloor)||0));
      const hit=hits.find(h=>{ const f=selOf(h); return f&&(f.sel.type==='slab'||f.sel.type==='zone')&&f.sel.floor===fi; })||hits[0];
      return {x:hit.point.x,z:hit.point.z,floor:fi};
    };
    if(this.tool==='paint'){ const g=groundHit(); this.paintAt(g.x,g.z); return; }
    if(this.tool==='zone'||this.tool==='patio'){
      const g=groundHit();
      const fl=st.floors[g.floor]||this.curFloor();
      const rect=roomRectAt(fl,g.x,g.z,fl.slab);
      const preset=this.tool==='zone'?this.zonePreset:this.patioPreset;
      this.pushUndo();
      fl.zones=fl.zones||[];
      let zn;
      if(rect&&Math.min(rect.x1-rect.x0,rect.z1-rect.z0)>0.6){
        zn={id:uid('z'),x0:+(rect.x0+0.06).toFixed(2),z0:+(rect.z0+0.06).toFixed(2),x1:+(rect.x1-0.06).toFixed(2),z1:+(rect.z1-0.06).toFixed(2),
          mat:preset.mat,color:preset.color||'#ffffff',angle:preset.angle||0,scale:preset.scale||1.2};
      } else {
        zn={id:uid('z'),x0:+(g.x-1.5).toFixed(2),z0:+(g.z-1.5).toFixed(2),x1:+(g.x+1.5).toFixed(2),z1:+(g.z+1.5).toFixed(2),
          mat:preset.mat,color:preset.color||'#ffffff',angle:preset.angle||0,scale:preset.scale||1.2};
      }
      fl.zones.push(zn);
      st.activeFloor=st.floors.indexOf(fl);
      saveState(st); this.syncAll();
      this.select({type:'zone',id:zn.id,floor:st.activeFloor});
      return;
    }
    if(this.tool==='pool'){
      const g=groundHit();
      st.activeFloor=g.floor;
      this.placePool(g.x,g.z);
      return;
    }
    const def=this.pendingDef;
    if(!def) return;
    if(def.wallMount){
      let found=null;
      for(const h of hits){ const f=selOf(h); if(f&&f.sel.type==='wall'){ found={f,point:h.point}; break; } }
      if(!found){ toast('Tap a wall to hang '+def.name+' (you can orbit while placing)'); return; }
      const fi=found.f.floor, fl=st.floors[fi];
      const w=fl.walls.find(v=>v.id===found.f.sel.id);
      if(!w) return;
      if(w.locked){ toast('That wall is locked'); return; }
      const pr=projectOnWall(w,found.point.x,found.point.z);
      const topY=(fl.slab?.thick||0.25);
      const baseY=floorBaseY(st,fi);
      this.pushUndo();
      const it={id:uid('i'),defId:def.id,x:found.point.x,z:found.point.z,rot:0,scale:1,
        mount:{wallId:w.id,along:pr.along,y:Math.max(0.3,found.point.y-baseY-topY),side:pr.side}};
      fl.items.push(it);
      st.activeFloor=fi;
      this.resolveAll();
      saveState(st); this.syncAll();
      this.select({type:'item',id:it.id,floor:fi});
      return;
    }
    if(def.shelfable){
      for(const h of hits){
        const f=selOf(h);
        if(f&&f.sel.type==='item'){
          const fl=st.floors[f.sel.floor];
          const p=fl.items.find(v=>v.id===f.sel.id);
          if(p&&this.slotList(this.defOf(p)).length){
            st.activeFloor=f.sel.floor;
            this.attachShelf(def,p,null,null,null,f.sel.floor);
            return;
          }
        }
      }
    }
    const g=groundHit();
    st.activeFloor=g.floor;
    this.placeFurniture(g.x,g.z);
  }

  addOpening(wall,x,z,kind){
    if(wall.locked){ this.select({type:'wall',id:wall.id,floor:this.state.activeFloor}); toast('Wall is locked — unlock to add openings'); return; }
    const L=Math.hypot(wall.x2-wall.x1,wall.z2-wall.z1)||1e-6;
    let at=((x-wall.x1)*(wall.x2-wall.x1)+(z-wall.z1)*(wall.z2-wall.z1))/(L*L);
    at=Math.max(0.08,Math.min(0.92,at));
    this.pushUndo();
    const fl=this.curFloor();
    const o={id:uid('o'),wallId:wall.id,at,w:kind==='door'?0.95:1.4,h:kind==='door'?2.1:1.15,sill:kind==='door'?0:0.9,kind,color:kind==='door'?'#8a5a33':'#9fc7ff'};
    fl.openings.push(o);
    saveState(this.state); this.view2d.request(); this.view3d.rebuild();
    this.select({type:'opening',id:o.id,floor:this.state.activeFloor},{quiet:true});
    this.showCtxBar();
    toast((kind==='door'?'Door':kind==='window'?'Window':'Arch')+' added — drag in panel to resize');
  }
  makeRoom(a,b){
    const x0=Math.min(a.x,b.x),x1=Math.max(a.x,b.x),z0=Math.min(a.z,b.z),z1=Math.max(a.z,b.z);
    if(x1-x0<0.5||z1-z0<0.5){ toast('Room too small'); return; }
    this.pushUndo();
    const fl=this.curFloor();
    const h=this.state.settings.wallHeightDefault||fl.wallHeight||2.7;
    const t=this.state.settings.wallThickness||0.15;
    fl.walls.push(
      {id:uid('w'),x1:x0,z1:z0,x2:x1,z2:z0,h,t,color:'#e8e4da'},
      {id:uid('w'),x1:x1,z1:z0,x2:x1,z2:z1,h,t,color:'#e8e4da'},
      {id:uid('w'),x1:x1,z1:z1,x2:x0,z2:z1,h,t,color:'#e8e4da'},
      {id:uid('w'),x1:x0,z1:z1,x2:x0,z2:z0,h,t,color:'#e8e4da'},
    );
    saveState(this.state); this.syncAll(); toast('Room added ('+(x1-x0).toFixed(1)+'×'+(z1-z0).toFixed(1)+'m)');
  }
  armStairs(){
    import('./catalog.js').then(m=>{
      const def=m.defById('stairs_straight');
      if(!def){ toast('Stairs unavailable'); return; }
      this.pendingDef=def; this.tool='furniture';
      buildTools();
      document.querySelector('#drawerTools [data-tool="stairs"]')?.classList.add('on');
      toast('Stairs: tap the plan to place');
      this._panelForce=false; this.showCtxBarPlace(); this.refreshSelPanel();
    });
  }
  showCtxBarPlace(){
    const bar=document.querySelector('#ctxBar'); if(!bar||!this.pendingDef) return;
    const d=this.pendingDef;
    bar.innerHTML=`<span class="lbl">${d.name} — tap plan to place</span><button data-b="cancel" title="Cancel">${icon('x')}</button>`;
    bar.classList.add('on');
    bar.querySelector('[data-b="cancel"]').onclick=()=>{ this.pendingDef=null; this.tool='select'; buildTools(); bar.classList.remove('on'); this.refreshSelPanel(); };
  }
  openSettings(){ app.syncSettingsUI?.(); app.syncBpUI?.(); document.querySelector('#settingsVeil')?.classList.add('on'); }
  setCatalogVisible(v){
    if(v){ openDrawer('L',true); }
    else { openDrawer('L',false); openDrawer('R',false); }
  }
  setFocus(v){
    document.body.classList.toggle('focus',v);
    setTimeout(()=>{ this.view2d.resize(); this.view3d.resize(); },60);
  }
  setLayout(mode){
    try{ localStorage.setItem('hc.layout',mode); }catch(e){}
    this.applyLayout();
  }
  applyLayout(){
    let pref='auto';
    try{ pref=localStorage.getItem('hc.layout')||'auto'; }catch(e){}
    const land=window.matchMedia?.('(orientation: landscape)').matches;
    const ls=pref==='landscape'||(pref==='auto'&&land&&window.innerHeight<620);
    document.body.classList.toggle('ls',!!ls);
    setTimeout(()=>{ this.view2d.resize(); this.view3d.resize(); },60);
  }
  deleteWall(w){
    if(w.locked){ toast('Wall is locked — unlock it first'); return; }
    this.pushUndo();
    const fl=this.curFloor();
    // wall decor mounted here drops to the floor where it hangs
    for(const it of fl.items){ if(it.mount&&it.mount.wallId===w.id){ delete it.mount; it.y=0; } }
    fl.walls=fl.walls.filter(v=>v.id!==w.id);
    fl.openings=fl.openings.filter(o=>o.wallId!==w.id);
    if(this.sel?.id===w.id) this.sel=null;
    saveState(this.state); this.syncAll(); toast('Wall deleted');
  }
  deleteOpening(o){
    const fl=this.curFloor();
    const wall=fl.walls.find(w=>w.id===o.wallId);
    if(wall?.locked){ toast('That wall is locked — unlock it first'); return; }
    this.pushUndo();
    fl.openings=fl.openings.filter(v=>v.id!==o.id);
    if(this.sel?.id===o.id) this.sel=null;
    saveState(this.state); this.syncAll(); toast('Opening deleted');
  }
  deleteItem(it){
    if(it.locked){ toast('Locked — unlock it first'); return; }
    this.pushUndo();
    const fl=this.curFloor();
    // shelf children riding on it drop to the floor where they sit
    for(const ch of fl.items){ if(ch.on&&ch.on.parentId===it.id){ delete ch.on; ch.y=0; } }
    fl.items=fl.items.filter(v=>v.id!==it.id);
    if(this.sel?.id===it.id) this.sel=null;
    saveState(this.state); this.syncAll(); toast('Removed');
  }
  deleteZone(zn){
    this.pushUndo();
    const fl=this.curFloor();
    fl.zones=(fl.zones||[]).filter(v=>v.id!==zn.id);
    if(this.sel?.id===zn.id) this.sel=null;
    saveState(this.state); this.syncAll(); toast('Surface removed');
  }
  deletePool(p){
    this.pushUndo();
    const fl=this.curFloor();
    fl.pools=(fl.pools||[]).filter(v=>v.id!==p.id);
    if(this.sel?.id===p.id) this.sel=null;
    saveState(this.state); this.syncAll(); toast('Pool removed');
  }

  // ---- wall finishes / styles / room designs ----
  applyWallFinish(w,finish,split){
    if(finish) w.finish={tex:finish.tex||finish,color:finish.color};
    else delete w.finish;
    if(split===null) delete w.split;
    else if(split) w.split=JSON.parse(JSON.stringify(split));
  }
  finishWalls(walls,finish,split){
    this.pushUndo();
    for(const w of walls) this.applyWallFinish(w,finish,split);
    saveState(this.state); this.syncAll();
    sound.playStoneTap();
    toast('Finish applied to '+(walls.length>1?walls.length+' walls':'wall'));
  }
  wallsForScope(fl,w,scope){
    if(scope==='wall'||!w) return w?[w]:[];
    const rect=roomRectAt(fl,(w.x1+w.x2)/2,(w.z1+w.z2)/2,fl.slab);
    if(scope==='room') return rect?wallsInRect(fl,rect):[w];
    if(scope==='floor') return fl.walls;
    if(scope==='house'){ const out=[]; for(const f of this.state.floors) out.push(...f.walls); return out; }
    return [w];
  }
  copyStyle(){
    const s=this.sel; if(!s) return;
    const fl=this.state.floors[s.floor]||this.curFloor();
    if(s.type==='wall'){
      const w=fl.walls.find(v=>v.id===s.id); if(!w) return;
      this.styleClip={kind:'wall',color:w.color,finish:w.finish?{...w.finish}:null,split:w.split?JSON.parse(JSON.stringify(w.split)):null};
      toast('Style copied — select another wall, Properties, Paste style');
    } else if(s.type==='item'){
      const it=fl.items.find(v=>v.id===s.id); if(!it) return;
      this.styleClip={kind:'item',color:it.color,scale:it.scale,rot:it.rot};
      toast('Style copied — select another item, Properties, Paste style');
    }
  }
  pasteStyle(){
    const s=this.sel; if(!s||!this.styleClip) return;
    const clip=this.styleClip;
    const fl=this.state.floors[s.floor]||this.curFloor();
    if(s.type==='wall'&&clip.kind==='wall'){
      const w=fl.walls.find(v=>v.id===s.id); if(!w) return;
      this.pushUndo();
      w.color=clip.color; this.applyWallFinish(w,clip.finish,clip.split===null?null:(clip.split||undefined));
      if(clip.split===null) delete w.split;
      saveState(this.state); this.syncAll(); toast('Style pasted');
    } else if(s.type==='item'&&clip.kind==='item'){
      const it=fl.items.find(v=>v.id===s.id); if(!it) return;
      this.pushUndo();
      if(clip.color) it.color=clip.color; else delete it.color;
      if(clip.scale) it.scale=clip.scale;
      saveState(this.state); this.syncAll(); toast('Style pasted');
    } else toast('Copy a matching style first (wall ↔ wall, item ↔ item)');
  }
  roomRectHere(){
    const s=this.sel;
    const fl=s?this.state.floors[s.floor]:this.curFloor();
    let x=null,z=null;
    if(s){
      if(s.type==='item'){ const it=fl.items.find(v=>v.id===s.id); if(it){ x=it.x; z=it.z; } }
      if(s.type==='wall'){ const w=fl.walls.find(v=>v.id===s.id); if(w){ x=(w.x1+w.x2)/2; z=(w.z1+w.z2)/2; } }
    }
    if(x==null){ x=this.view2d.cam.cx; z=this.view2d.cam.cz; }
    return {fl,rect:roomRectAt(fl,x,z,fl.slab)};
  }
  saveRoomDesign(name){
    const {fl,rect}=this.roomRectHere();
    if(!rect){ toast('No room found here — tap inside a room first'); return; }
    const items=fl.items.filter(it=>it.x>rect.x0&&it.x<rect.x1&&it.z>rect.z0&&it.z<rect.z1)
      .map(it=>JSON.parse(JSON.stringify(it)));
    const walls=wallsInRect(fl,rect).map(w=>({find:w.id,finish:w.finish?{...w.finish}:null,split:w.split?JSON.parse(JSON.stringify(w.split)):null,color:w.color}));
    this.roomDesigns[name]={items,walls,savedAt:Date.now()};
    this.saveRooms(); toast('Room design "'+name+'" saved');
  }
  applyRoomDesign(name){
    const d=this.roomDesigns[name]; if(!d) return;
    const {fl,rect}=this.roomRectHere();
    if(!rect){ toast('No room found here — tap inside a room first'); return; }
    this.pushUndo();
    fl.items=fl.items.filter(it=>!(it.x>rect.x0&&it.x<rect.x1&&it.z>rect.z0&&it.z<rect.z1));
    for(const it of d.items){ const c=JSON.parse(JSON.stringify(it)); c.id=uid('i'); fl.items.push(c); }
    for(const sw of (d.walls||[])){
      const w=fl.walls.find(v=>v.id===sw.find)||wallsInRect(fl,rect)[0];
      if(w) this.applyWallFinish(w,sw.finish,sw.split===null?null:(sw.split||undefined));
    }
    this.resolveAll();
    saveState(this.state); this.syncAll(); toast('Design "'+name+'" applied');
  }
  resetRoom(){
    const {fl,rect}=this.roomRectHere();
    if(!rect){ toast('No room found here'); return; }
    if(!confirm('Reset this room? Removes its furniture/decor and wall finishes.')) return;
    this.pushUndo();
    fl.items=fl.items.filter(it=>!(it.x>rect.x0&&it.x<rect.x1&&it.z>rect.z0&&it.z<rect.z1));
    for(const w of wallsInRect(fl,rect)){ delete w.finish; delete w.split; }
    saveState(this.state); this.syncAll(); toast('Room reset');
  }

  switchProject(id){
    const st=loadProjectState(id);
    if(!st){ toast('Could not open that house'); return; }
    saveState(this.state);
    this.projectId=id; setCurrentPid(id);
    this.state=normalizeState(st)||st; this.undoStack=[]; this.redoStack=[];
    this.select(null); this.view2d.draft=[];
    saveState(this.state); this.syncAll(); this.view2d.fit();
    this.renderProjects(); toast('Opened '+(this.projectName()));
  }
  projectName(){ const m=listProjectsMeta(); return (m&&m.meta[this.projectId]&&m.meta[this.projectId].name)||'My House'; }
  renderProjects(){
    const el=$('#projList'); if(!el) return;
    const m=listProjectsMeta();
    if(!m){ el.innerHTML='<div class="sub">No houses yet.</div>'; return; }
    el.innerHTML='';
    for(const id of m.order){
      const meta=m.meta[id]; if(!meta) continue;
      const d=new Date(meta.updatedAt||Date.now());
      const row=document.createElement('div');
      row.className='rowBtns'; row.style.marginBottom='6px';
      row.innerHTML=`<span style="flex:1;font-size:12px;${id===this.projectId?'font-weight:700':''}">${icon(id===this.projectId?'house':'archive')} ${meta.name.replace(/</g,'&lt;')} <small style="color:var(--mut)">${d.toLocaleDateString()} ${d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</small></span>`;
      const mk=(label,title,fn,cls)=>{ const b=document.createElement('button'); b.className='btn small'+(cls||''); b.innerHTML=label; b.title=title; b.onclick=fn; row.appendChild(b); return b; };
      if(id!==this.projectId) mk('Open','Open this house',()=>this.switchProject(id),' primary');
      mk(icon('pencil'),'Rename',()=>{
        const n=prompt('Rename house:',meta.name);
        if(n&&n.trim()){ renameProject(id,n.trim()); saveState(this.state); this.renderProjects(); }
      });
      mk(icon('copy'),'Duplicate',()=>{ const nid=duplicateProject(id); if(nid){ this.renderProjects(); toast('Duplicated as '+(listProjectsMeta().meta[nid].name)); } });
      if(m.order.length>1&&id!==this.projectId) mk(icon('trash-2'),'Delete',()=>{
        if(!confirm('Delete "'+meta.name+'" permanently? Export first if needed.')) return;
        if(deleteProject(id)){ this.renderProjects(); toast('House deleted'); }
      },' danger');
      el.appendChild(row);
    }
    const cur=$('#projCur'); if(cur) cur.textContent='Current: '+this.projectName();
  }
  newProject(kind){
    const base=kind==='demo'?demoState():blankState();
    const id=createProject(kind==='demo'?'Demo Villa':'House '+((listProjectsMeta()?.order.length||0)+1),base);
    this.projectId=id;
    this.state=base; this.undoStack=[]; this.redoStack=[];
    this.select(null); this.view2d.draft=[];
    saveState(this.state); this.syncAll(); this.view2d.fit();
    $('#menuVeil').classList.remove('on');
    this.renderProjects();
  }
  syncAll(){
    this.resolveAll();
    this.renderFloorSel(); this.renderFloorList();
    this.view2d.request(); this.view3d.rebuild(); this.refreshSelPanel();
  }
}

// ---------- boot ----------
const app=new App();
window.app=app;

const TOOLS=[
  {id:'select',icon:'mouse-pointer-2',name:'Select'},
  {id:'move',icon:'move',name:'Move'},
  {id:'wall',icon:'brick-wall',name:'Wall'},
  {id:'room',icon:'house',name:'Room'},
  {id:'door',icon:'door-open',name:'Door'},
  {id:'window',icon:'app-window',name:'Window'},
  {id:'floor',icon:'layers',name:'Floor'},
  {id:'zone',icon:'paint-roller',name:'Surface'},
  {id:'patio',icon:'fence',name:'Patio'},
  {id:'pool',icon:'waves',name:'Pool'},
  {id:'paint',icon:'sprout',name:'Terrain'},
  {id:'ceiling',icon:'square',name:'Ceil'},
  {id:'stairs',icon:'trending-up',name:'Stairs'},
  {id:'measure',icon:'ruler',name:'Measure'},
  {id:'pan',icon:'hand',name:'Pan'},
  {id:'undo',icon:'undo-2',name:'Undo'},
  {id:'redo',icon:'redo-2',name:'Redo'},
  {id:'delete',icon:'trash-2',name:'Delete'},
  {id:'settings',icon:'sliders-horizontal',name:'Settings'},
];

const FURNISH_CATS=['living','chairs','bedroom','kitchen','dining','pantry','bath','walldecor','shelving','decor','lighting','plants','glam','billiard','bar','custom'];
// Drawer sort order (user-specified): groups render in this sub order, then by name.
const SUB_ORDER={
  living:['Couches','Sofas','Loveseats','Recliners'],
  chairs:['Barstools & stools','Dining chairs','Sitting chairs','Vanity chairs','Rocking chairs'],
};
function subRank(cat,sub){
  const order=SUB_ORDER[cat];
  if(!order) return sub?50:100;
  if(!sub) return 999;
  const i=order.indexOf(sub);
  return i<0?50:i;
}
function sortDrawerDefs(defs,cat){
  const order=SUB_ORDER[cat];
  if(cat){
    return [...defs].sort((a,b)=>subRank(cat,a.sub)-subRank(cat,b.sub)||String(a.name||'').localeCompare(String(b.name||'')));
  }
  if(!order) return [...defs].sort((a,b)=>String(a.name||'').localeCompare(String(b.name||'')));
  return [...defs].sort((a,b)=>subRank(cat,a.sub)-subRank(cat,b.sub)||String(a.name||'').localeCompare(String(b.name||'')));
}
function sortSearchDefs(defs){
  const ci={}; FURNISH_CATS.forEach((c,i)=>ci[c]=i);
  return [...defs].sort((a,b)=>((ci[a.cat]??99)-(ci[b.cat]??99))||subRank(a.cat,a.sub)-subRank(b.cat,b.sub)||String(a.name||'').localeCompare(String(b.name||'')));
}
function drawGroupedGrid(defs,cat,emptyText){
  const order=SUB_ORDER[cat];
  if(!order||!defs.some(d=>d.sub&&order.includes(d.sub))) return drawItemGrid(sortDrawerDefs(defs,cat),emptyText);
  const sorted=sortDrawerDefs(defs,cat);
  const wrap=document.createElement('div');
  const bySub=new Map(); const rest=[];
  for(const d of sorted){
    if(d.sub&&order.includes(d.sub)){ if(!bySub.has(d.sub)) bySub.set(d.sub,[]); bySub.get(d.sub).push(d); }
    else rest.push(d);
  }
  for(const s of order){
    const arr=bySub.get(s); if(!arr||!arr.length) continue;
    const lab=document.createElement('div'); lab.className='drSecLab'; lab.textContent=s.toUpperCase(); wrap.appendChild(lab);
    wrap.appendChild(drawItemGrid(arr,''));
  }
  if(rest.length){
    const lab=document.createElement('div'); lab.className='drSecLab'; lab.textContent='MORE'; wrap.appendChild(lab);
    wrap.appendChild(drawItemGrid(rest,''));
  }
  if(!wrap.children.length) return drawItemGrid([],emptyText);
  return wrap;
}
const BUILD_CATS=['structure','flooring','pools','patios','land','outdoor'];

function openDrawer(side,on){
  const el=side==='L'?document.querySelector('#drawerL'):side==='R'?document.querySelector('#drawerR'):document.querySelector('#drawerTex');
  if(!el) return;
  if(on===undefined||on===null) on=!el.classList.contains('on');
  el.classList.toggle('on',!!on);
  if(side==='Tex' && on){
    renderTextureStudioDrawer();
  }
  const btn=side==='L'?document.querySelector('#drawerLBtn'):side==='R'?document.querySelector('#drawerRBtn'):document.querySelector('#drawerTexBtn');
  if(btn) btn.classList.toggle('on',!!on);
  if(on){
    if(side!=='L') openDrawer('L',false);
    if(side!=='R') openDrawer('R',false);
    if(side!=='Tex') openDrawer('Tex',false);
  }
}

function renderTextureStudioDrawer(){
  const body = document.getElementById('drawerTexBody');
  if (!body) return;
  body.innerHTML = '';
  const uploadRow=document.createElement('div');
  uploadRow.innerHTML='<button class="btn primary" type="button" id="uploadSurfaceTextureBtn">Upload your own texture / pattern</button><input id="uploadSurfaceTextureInput" type="file" accept="image/png,image/jpeg,image/webp" hidden>';
  body.appendChild(uploadRow);
  const loadCustomSurfaceTextures=()=>{ try{ app.customSurfaceTextures=JSON.parse(localStorage.getItem('homecraft_surface_textures')||'[]'); }catch(e){ app.customSurfaceTextures=[]; } };
  loadCustomSurfaceTextures();
  const allItems = [
    ...FINISHES.map(f => ({ ...f, kind: 'finish', type: 'texture', sub: 'Wall finish' })),
    ...ZONE_MATS.map(m => ({ ...m, kind: m.kind, type: 'texture', sub: m.kind === 'floor' ? 'Flooring' : m.kind === 'patio' ? 'Patio' : 'Outdoor terrain' })),
    ...DESIGNER_COLORS.map(c => ({ ...c, type: 'color', kind: 'color', sub: 'Designer Paint Color' })),
    ...(app.customSurfaceTextures||[]).map(t=>({...t,kind:'custom',type:'texture',sub:'Your uploaded pattern'}))
  ];

  const search = (document.getElementById('drawerTexSearch')?.value || '').toLowerCase().trim();
  const activeChip = document.querySelector('#texChipsBar .fchip.on')?.dataset.texcat || 'all';

  const filtered = allItems.filter(item => {
    if (search) {
      const matchName = item.name.toLowerCase().includes(search);
      const matchSub = (item.sub || '').toLowerCase().includes(search);
      const matchId = (item.id || '').toLowerCase().includes(search);
      if (!matchName && !matchSub && !matchId) return false;
    }
    if (activeChip === 'all') return true;
    if (activeChip === 'wall') return item.kind === 'finish' && !item.id.startsWith('wp_');
    if (activeChip === 'wallpaper') return item.id.startsWith('wp_');
    if (activeChip === 'floor') return item.kind === 'floor';
    if (activeChip === 'wood') return item.tex?.includes('wood') || item.tex?.includes('oak') || item.tex?.includes('walnut') || item.tex?.includes('herring') || item.tex?.includes('chevron') || item.name.toLowerCase().includes('wood');
    if (activeChip === 'stone') return item.tex?.includes('tile') || item.tex?.includes('marble') || item.tex?.includes('granite') || item.tex?.includes('stone') || item.name.toLowerCase().includes('tile');
    if (activeChip === 'outdoor') return item.kind === 'patio' || item.kind === 'terrain';
    if (activeChip === 'color') return item.type === 'color';
    return true;
  });

  const grid = document.createElement('div');
  grid.className = 'itemGrid';

  filtered.forEach(item => {
    const card = document.createElement('button');
    const isArmed = app.activeTexture && (app.activeTexture.id === item.id || app.activeTexture.tex === item.tex);
    card.className = 'icard' + (isArmed ? ' on' : '');
    card.draggable = true;

    const thumbUrl = item.dataUrl || getTextureThumb(item, 100);
    card.innerHTML = `
      <span class="im" style="background:#eee;position:relative;overflow:hidden;">
        <img src="${thumbUrl}" alt="${item.name}" draggable="false" style="width:100%;height:100%;object-fit:cover;display:block;">
      </span>
      <span class="dnm">${item.name}</span>
      <span class="dsz">${item.sub || 'Texture'}</span>
    `;

    // Drag and drop onto surfaces
    card.ondragstart = (e) => {
      card.style.opacity = '0.5';
      const payload = {
        type: item.type || 'texture',
        tex: item.tex || item.id,
        id: item.id,
        name: item.name,
        base: item.base || item.hex,
        hex: item.hex,
        kind: item.kind,
        dataUrl: thumbUrl
      };
      e.dataTransfer.setData('application/json', JSON.stringify(payload));
      e.dataTransfer.effectAllowed = 'copy';
    };
    card.ondragend = () => { card.style.opacity = '1'; };

    // Tap-to-apply (arms texture and opens HUD)
    card.onclick = () => {
      app.armTextureForApply(item, thumbUrl);
      document.querySelectorAll('#drawerTexBody .icard.on').forEach(c => c.classList.remove('on'));
      card.classList.add('on');
    };

    grid.appendChild(card);
  });

  body.appendChild(grid);
  const uploadBtn=document.getElementById('uploadSurfaceTextureBtn');
  const uploadInput=document.getElementById('uploadSurfaceTextureInput');
  if(uploadBtn&&uploadInput){
    uploadBtn.onclick=()=>uploadInput.click();
    uploadInput.onchange=()=>{
      const file=uploadInput.files?.[0]; if(!file) return;
      const reader=new FileReader();
      reader.onload=()=>{
        const entry={id:'usertex_'+Date.now(),name:file.name.replace(/\\.[^.]+$/,''),dataUrl:String(reader.result),base:'#ffffff'};
        app.customSurfaceTextures=app.customSurfaceTextures||[];
        app.customSurfaceTextures.push(entry);
        try{ localStorage.setItem('homecraft_surface_textures',JSON.stringify(app.customSurfaceTextures)); }
        catch(e){ app.customSurfaceTextures.pop(); toast('Image is too large to save. Try a smaller texture image.'); return; }
        renderTextureStudioDrawer(); toast('Texture saved. Tap it, then tap a wall, floor or object.');
      };
      reader.readAsDataURL(file); uploadInput.value='';
    };
  }
}

function customCardDefs(){
  return app.custom.map(c=>({id:'custom:'+c.id,cat:'custom',name:c.name,icon:'',w:c.w||1,d:c.d||1,h:c.h||1,thumb:c.thumb||null,sub:c.sub||'',desc:c.desc||''}));
}

function filterDefs(defs,q,f){
  let out=defs;
  const qq=(q||'').trim().toLowerCase();
  if(qq) out=out.filter(d=>((d.name||'')+' '+(d.cat||'')+' '+(d.sub||'')).toLowerCase().includes(qq));
  if(f==='wall') out=out.filter(d=>d.wallMount);
  if(f==='shelf') out=out.filter(d=>d.shelfable||(d.shelves&&d.shelves.length));
  return out;
}

function icardHTML(def){
  const flags=(def.wallMount?icon('image','flag'):'')+(def.shelfable?icon('sparkles','flag'):'')+((def.shelves&&def.shelves.length)?icon('library','flag'):'');
  const _th=thumbCached(def);
  return '<span class="im"><span class="ph"></span><img alt=""'+(_th?' src="'+_th+'"':'')+'></span><span class="dnm">'+def.name+flags+'</span><span class="dsz">'+def.w+'×'+def.d+'×'+def.h+'m'+(def.sub?' • '+def.sub:'')+'</span>';
}

function armCatalogDef(def,card){
  app.pendingDef=def; app.tool='furniture'; buildTools();
  document.querySelectorAll('.icard.on').forEach(c=>c.classList.remove('on'));
  if(card) card.classList.add('on');
  if(def.wallMount) toast(def.name+': tap a WALL in 2D or 3D to hang it • arrows show placement');
  else if(def.shelfable) toast(def.name+': tap floor to place, or tap a shelf/table/bookcase to put it on');
  else if(def.shelves&&def.shelves.length) toast(def.name+': place it, then drag Decor items onto its shelves');
  else toast(def.name+': tap the plan (2D) or the room (3D) to place');
  app.hideCtxBar(); app.showCtxBarPlace(); app.refreshSelPanel();
}

function drawItemGrid(defs,emptyText){
  if(!defs.length){ const d=document.createElement('div'); d.className='dempty'; d.textContent=emptyText||'Nothing here yet.'; return d; }
  const grid=document.createElement('div'); grid.className='itemGrid';
  for(const def of defs){
    const card=document.createElement('button');
    card.className='icard'+(app.pendingDef?.id===def.id&&app.tool==='furniture'?' on':'');
    card.innerHTML=icardHTML(def);
    const _im=card.querySelector('img'); if(_im&&!_im.getAttribute('src')) requestThumb(def,_im);
    card.onclick=()=>armCatalogDef(def,card);
    grid.appendChild(card);
  }
  return grid;
}

function drawCatTiles(side,cats,byId,names){
  const grid=document.createElement('div'); grid.className='catGrid';
  for(const id of cats){
    const n=id==='custom'?app.custom.length:id==='textures'?ZONE_MATS.length:((byId[id]||[]).length);
    const t=document.createElement('button');
    t.className='ctile';
    t.innerHTML=icon(names[id]?names[id].icon:'box')+'<span>'+(names[id]?names[id].name:id)+'</span><small>'+n+' items</small>';
    t.onclick=()=>{ if(side==='L') app._catL=id; else app._catR=id; app._renderGrid&&app._renderGrid(); };
    grid.appendChild(t);
  }
  return grid;
}

function drawBack(side,label){
  const b=document.createElement('button');
  b.className='dback';
  b.innerHTML=icon('arrow-left')+'<span>'+label+'</span>';
  b.onclick=()=>{ if(side==='L') app._catL=null; else app._catR=null; app._renderGrid&&app._renderGrid(); };
  return b;
}

function textureCardHTML(m){
  const kindName=m.kind==='patio'?'Patio':m.kind==='terrain'?'Terrain':'Floor';
  return '<span class="im" style="background:'+(m.base||'#f0e8d5')+'"><span style="font-size:30px;line-height:76px">'+(m.icon||'🎨')+'</span></span><span class="dnm">'+m.name+'</span><span class="dsz">'+kindName+' texture</span>';
}
function texActive(m){
  return (m.kind==='patio'&&app.tool==='patio'&&app.patioPreset.mat===m.id)||
    (m.kind==='terrain'&&app.tool==='paint'&&app.paintPreset.mat===m.id)||
    (m.kind!=='patio'&&m.kind!=='terrain'&&app.tool==='zone'&&app.zonePreset.mat===m.id);
}
function drawTextureGrid(mats){
  const grid=document.createElement('div'); grid.className='itemGrid';
  for(const m of mats){
    const card=document.createElement('button');
    card.className='icard'+(texActive(m)?' on':'');
    card.innerHTML=textureCardHTML(m);
    card.onclick=()=>armTexture(m,card);
    grid.appendChild(card);
  }
  return grid;
}
function armTexture(m,card){
  app.pendingDef=null;
  if(m.kind==='patio'){ app.patioPreset={...app.patioPreset,mat:m.id}; app.tool='patio'; }
  else if(m.kind==='terrain'){ app.paintPreset={mat:m.id}; app.tool='paint'; }
  else { app.zonePreset={...app.zonePreset,mat:m.id,color:'#ffffff'}; app.tool='zone'; }
  document.querySelectorAll('.icard.on').forEach(c=>c.classList.remove('on'));
  if(card) card.classList.add('on');
  buildTools();
  if(app.tool==='zone') toast(m.name+': tap a room or drag a rectangle. Materials in the panel.',3200);
  if(app.tool==='patio') toast(m.name+': tap ground or drag — pergola, kitchen, gate.',3200);
  if(app.tool==='paint') toast(m.name+': drag to paint • brush size in panel.',3200);
  app.hideCtxBar(); renderDrawers(); app.refreshSelPanel();
}
function armPoolShape(sh,card){
  app.pendingDef=null; app.poolPreset={...app.poolPreset,shape:sh.id};
  app.tool='pool';
  document.querySelectorAll('.icard.on').forEach(c=>c.classList.remove('on'));
  if(card) card.classList.add('on');
  buildTools(); toast(sh.name+' pool: tap or drag — water, lights and depth in panel.'); renderDrawers(); app.refreshSelPanel();
}
function drawPresetCards(body,catId){
  // material/shape presets as 2-column cards (same card language as items)
  if(catId==='pools'){
    const grid=document.createElement('div'); grid.className='itemGrid';
    for(const sh of POOL_SHAPES){
      const card=document.createElement('button');
      card.className='icard'+(app.tool==='pool'&&app.poolPreset.shape===sh.id?' on':'');
      card.innerHTML='<span class="im" style="display:flex;align-items:center;justify-content:center"><span style="color:var(--gold);display:inline-flex;transform:scale(1.7)">'+icon(sh.icon)+'</span></span><span class="dnm">'+sh.name+'</span><span class="dsz">tap / drag</span>';
      card.onclick=()=>armPoolShape(sh,card);
      grid.appendChild(card);
    }
    body.appendChild(grid);
    return;
  }
  const kind=catId==='flooring'?'floor':catId==='patios'?'patio':catId==='land'?'terrain':null;
  if(!kind) return;
  body.appendChild(drawTextureGrid(ZONE_MATS.filter(m=>m.kind===kind)));
}

function renderDrawers(){
  const list=getCatalog().list;
  const byId=list.reduce((m,d)=>{ (m[d.cat]=m[d.cat]||[]).push(d); return m; },{});
  const names={}; for(const c of CATEGORIES) names[c.id]=c; names.custom={id:'custom',name:'My Models',icon:'package'};
  names.textures={id:'textures',name:'Textures',icon:'palette'};
  const BUILD_TILES=BUILD_CATS.concat(['textures']);
  // ---- LEFT: build (tools live above in #drawerTools; categories + textures below) ----
  const L=document.querySelector('#drawerLBody');
  if(L){
    L.innerHTML='';
    for(const [cid,cat] of [['fBAll',null],['fBOut','outdoor'],['fBTex','textures']]){ const ce=document.querySelector('#'+cid); if(ce) ce.classList.toggle('on',(app._catL||null)===cat); }
    const q=(app._qb||'').trim().toLowerCase();
    if(q){
      let defs=[]; for(const c of BUILD_CATS) defs=defs.concat(byId[c]||[]);
      defs=filterDefs(defs,q,'all');
      const tm=ZONE_MATS.filter(m=>((m.name||'')+' '+m.id).toLowerCase().includes(q));
      if(!defs.length&&!tm.length){
        const d=document.createElement('div'); d.className='dempty'; d.textContent='No matches — try another search.'; L.appendChild(d);
      } else {
        if(defs.length) L.appendChild(drawItemGrid(defs,''));
        if(tm.length){
          const lab=document.createElement('div'); lab.className='drSecLab'; lab.textContent='TEXTURES'; L.appendChild(lab);
          L.appendChild(drawTextureGrid(tm));
        }
      }
    } else if(app._catL&&(BUILD_CATS.includes(app._catL)||app._catL==='textures')){
      L.appendChild(drawBack('L',names[app._catL]?names[app._catL].name:app._catL));
      const sub=document.createElement('div'); sub.className='dsub'; sub.textContent=CAT_DESC[app._catL]||''; L.appendChild(sub);
      if(app._catL==='textures') L.appendChild(drawTextureGrid(ZONE_MATS));
      else {
        drawPresetCards(L,app._catL);
        const defs=byId[app._catL]||[];
        // preset-only sections (flooring/pools/...) hide the item grid when empty
        if(defs.length||!['flooring','pools','patios','land'].includes(app._catL)) L.appendChild(drawItemGrid(defs,'Nothing here yet.'));
      }
    } else L.appendChild(drawCatTiles('L',BUILD_TILES,byId,names));
  }
  // ---- RIGHT: furnish ----
  const R=document.querySelector('#drawerRBody');
  if(R){
    R.innerHTML='';
    const q=(app._q||'').trim().toLowerCase();
    if(q){
      let defs=[]; for(const c of FURNISH_CATS) defs=defs.concat(c==='custom'?customCardDefs():(byId[c]||[]));
      R.appendChild(drawItemGrid(sortSearchDefs(filterDefs(defs,q,app._f||'all')),'No matches — try another search.'));
    } else if(app._catR&&FURNISH_CATS.includes(app._catR)){
      R.appendChild(drawBack('R',names[app._catR]?names[app._catR].name:app._catR));
      const sub=document.createElement('div'); sub.className='dsub'; sub.textContent=CAT_DESC[app._catR]||''; R.appendChild(sub);
      let defs=app._catR==='custom'?customCardDefs():(byId[app._catR]||[]);
      defs=filterDefs(defs,'',app._f||'all');
      if(!defs.length&&app._catR==='custom'){
        const d=document.createElement('div'); d.className='dempty';
        d.textContent='No uploads yet — Menu → Upload 3D mesh. AI names it, thumbnails it, and it places in 2D + 3D.';
        R.appendChild(d);
      } else R.appendChild(drawGroupedGrid(defs,app._catR,'Nothing here yet.'));
    } else R.appendChild(drawCatTiles('R',FURNISH_CATS,byId,names));
  }
}

function buildTools(){
  const el=document.querySelector('#drawerTools');
  if(el){
    el.innerHTML='';
    for(const t of TOOLS){
      const b=document.createElement('button');
      b.className='dtool'+(app.tool===t.id?' on':'');
      b.dataset.tool=t.id;
      b.title=t.name;
      b.innerHTML=icon(t.icon)+'<span>'+t.name+'</span>';
      b.onclick=()=>{
        if(t.id==='undo'){ app.doUndo(); return; }
        if(t.id==='redo'){ app.doRedo(); return; }
        if(t.id==='settings'){ app.openSettings(); return; }
        if(t.id==='stairs'){ app.armStairs(); return; }
        app.tool=t.id;
        if(t.id!=='furniture') app.pendingDef=null;
        buildTools();
        if(t.id==='wall') toast('Tap points to draw walls. Finish in the panel');
        if(t.id==='room') toast('Room: tap one corner, then the opposite corner');
        if(t.id==='measure') toast('Measure: tap two points');
        if(t.id==='floor') toast('Floor: tap anywhere to edit the slab');
        if(t.id==='zone') toast('Surface: tap a room or drag a rectangle. Materials in the panel.', 3200);
        if(t.id==='patio') toast('Patio: tap ground or drag a rectangle. Works in 3D too.', 3200);
        if(t.id==='pool') toast('Pool: tap or drag. Shape, water and lights in the panel.', 3200);
        if(t.id==='paint') toast('Terrain: drag to paint grass, mulch, gravel. Brush size in the panel.', 3200);
        if(t.id==='ceiling') toast('Ceiling: tap to toggle the ceiling on this floor');
        if(t.id==='delete') toast('Tap walls, openings or furniture to delete');
        if(t.id==='move') toast('Move: drag anything. No menus will pop up.');
        app.hideCtxBar(); app.refreshSelPanel();
      };
      el.appendChild(b);
    }
  }
  refreshToolboxHighlight();
}

function buildTabs(){
  app._q=app._q||''; app._f=app._f||'all'; app._qb=app._qb||'';
  app._catL=app._catL||null; app._catR=app._catR||null;
  app._renderGrid=renderDrawers;
  renderDrawers();
}

function refreshToolboxHighlight(){
  document.querySelectorAll('#drawerTools .dtool').forEach(b=>b.classList.toggle('on',b.dataset.tool===app.tool));
}

function swGrid(items,cur,key){
  return `<div class="fgrid">`+items.map(m=>`<button class="fsw${cur===m[key||'id']?' on':''}" data-sw="${m[key||'id']}" title="${m.name}">${swIcon(m)}<span>${m.name}</span></button>`).join('')+`</div>`;
}
function swName(items,id){ const m=items.find(v=>v.id===id); return m?m.name:''; }

app.refreshSelPanel=function(){
  const p=$('#selPanel');
  const v=app.view2d;
  // wall draft panel takes precedence
  if(v&&v.draft.length){
    p.classList.add('on');
    p.innerHTML=`<h4>${icon('brick-wall')} Drawing wall (${v.draft.length} pts)</h4><div class="sub">Tap plan to add points. Snap ${(app.state.settings.snap*100)|0}cm.</div>
      <div class="rowBtns">
        <button class="btn primary" id="wDone">${icon('check')} Finish</button>
        <button class="btn" id="wUndoPt">⌫ Undo point</button>
        <button class="btn danger" id="wCancel">${icon('x')} Cancel</button>
      </div>`;
    $('#wDone').onclick=()=>{
      if(v.draft.length<2){ toast('Need at least 2 points'); return; }
      app.pushUndo();
      const fl=app.curFloor();
      const h=app.state.settings.wallHeightDefault||fl.wallHeight||2.7;
      const t=app.state.settings.wallThickness||0.15;
      for(let i=0;i<v.draft.length-1;i++){
        const a=v.draft[i],b=v.draft[i+1];
        if(Math.hypot(b.x-a.x,b.z-a.z)<0.05) continue;
        fl.walls.push({id:uid('w'),x1:+a.x.toFixed(3),z1:+a.z.toFixed(3),x2:+b.x.toFixed(3),z2:+b.z.toFixed(3),h,t,color:'#e8e4da'});
      }
      v.draft=[]; saveState(app.state); app.syncAll(); toast('Wall added');
    };
    $('#wUndoPt').onclick=()=>{ v.draft.pop(); v.request(); app.refreshSelPanel(); };
    $('#wCancel').onclick=()=>{ v.draft=[]; v.request(); app.refreshSelPanel(); };
    return;
  }
  // pending furniture panel
  if(app.tool==='furniture'&&app.pendingDef&&!app.sel){
    p.classList.add('on');
    const d=app.pendingDef;
    p.innerHTML=`<h4>${icon(catIcon(d.cat||'custom'))} ${d.name} — ${d.w}×${d.d}×${d.h}m</h4><div class="sub">Tap the 2D plan to place. Works in 3D too.</div>
      <div class="rowBtns">
        <button class="btn primary" id="pHere">${icon('plus')} Place at center</button>
        <button class="btn" id="pCancel">${icon('x')} Cancel</button>
      </div>`;
    $('#pHere').onclick=()=>{ const c={x:app.view2d.cam.cx,z:app.view2d.cam.cz}; app.placeFurniture(app.view2d.snap(c.x),app.view2d.snap(c.z)); };
    $('#pCancel').onclick=()=>{ app.pendingDef=null; app.tool='select'; buildTools(); app.refreshSelPanel(); };
    return;
  }
  const s=app.sel;
  // surfacing / pool / terrain tool panels (shown when nothing is selected)
  if(!s&&['zone','patio','pool','paint'].includes(app.tool)){
    const fl=app.curFloor();
    p.classList.add('on');
    if(app.tool==='zone'||app.tool==='patio'){
      const isPatio=app.tool==='patio';
      const preset=isPatio?app.patioPreset:app.zonePreset;
      const mats=ZONE_MATS.filter(m=>isPatio?m.kind==='patio':m.kind==='floor');
      p.innerHTML=`<h4>${isPatio?icon('fence')+' Patio':icon('paint-roller')+' Flooring'} • ${swName(ZONE_MATS,preset.mat)}</h4><div class="sub">${isPatio?'Tap ground or drag a rectangle. Pergolas & kitchens live in the Patios tab.':'Tap a room to fill it, or drag a rectangle. Different rooms can differ.'}</div>
        ${swGrid(mats,preset.mat)}
        <label class="f">Direction <input type="range" id="tAng" min="0" max="90" step="5" value="${preset.angle||0}"> <b>${preset.angle||0}°</b></label>
        <label class="f">Tile size <input type="range" id="tSc" min="0.4" max="4" step="0.2" value="${preset.scale||1.2}"> <b>${(preset.scale||1.2).toFixed(1)}m</b></label>
        <label class="f">Tint <input type="color" id="tC" value="${toColor(preset.color||'#ffffff')}"></label>
        <div class="rowBtns"><button class="btn small" id="tFill">Fill room</button><button class="btn small" id="tAll">Whole floor</button><button class="btn small danger" id="tClear">Clear</button><button class="btn small" id="tX">Close</button></div>`;
      p.querySelectorAll('[data-sw]').forEach(b=>b.onclick=()=>{ preset.mat=b.dataset.sw; preset.color='#ffffff'; queueSave(); app.refreshSelPanel(); });
      $('#tAng').oninput=e=>{ preset.angle=+e.target.value; e.target.nextElementSibling.textContent=preset.angle+'°'; };
      $('#tSc').oninput=e=>{ preset.scale=+e.target.value; e.target.nextElementSibling.textContent=preset.scale.toFixed(1)+'m'; };
      $('#tC').oninput=e=>{ preset.color=e.target.value; };
      $('#tFill').onclick=()=>{
        const rect=roomRectAt(fl,app.view2d.cam.cx,app.view2d.cam.cz,fl.slab);
        if(!rect){ toast('Pan to a room first'); return; }
        app.pushUndo(); fl.zones=fl.zones||[];
        fl.zones.push({id:uid('z'),x0:+(rect.x0+0.06).toFixed(2),z0:+(rect.z0+0.06).toFixed(2),x1:+(rect.x1-0.06).toFixed(2),z1:+(rect.z1-0.06).toFixed(2),mat:preset.mat,color:preset.color||'#ffffff',angle:preset.angle||0,scale:preset.scale||1.2});
        saveState(app.state); app.syncAll(); toast('Room filled');
      };
      $('#tAll').onclick=()=>{
        const sl=fl.slab||{w:12,d:10,cx:0,cz:0};
        app.pushUndo(); fl.zones=fl.zones||[];
        fl.zones.push({id:uid('z'),x0:+(sl.cx-sl.w/2+0.05).toFixed(2),z0:+(sl.cz-sl.d/2+0.05).toFixed(2),x1:+(sl.cx+sl.w/2-0.05).toFixed(2),z1:+(sl.cz+sl.d/2-0.05).toFixed(2),mat:preset.mat,color:preset.color||'#ffffff',angle:preset.angle||0,scale:preset.scale||1.2});
        saveState(app.state); app.syncAll(); toast('Whole floor covered');
      };
      $('#tClear').onclick=()=>{ if(!fl.zones?.length){ toast('No surfaces'); return; } if(!confirm('Remove all surfaces on '+fl.name+'?')) return; app.pushUndo(); fl.zones=[]; saveState(app.state); app.syncAll(); };
      $('#tX').onclick=()=>{ app.tool='select'; buildTools(); app.refreshSelPanel(); };
      return;
    }
    if(app.tool==='pool'){
      const ps=app.poolPreset;
      p.innerHTML=`<h4>${icon('waves')} Pool • ${swName(POOL_SHAPES,ps.shape)}</h4><div class="sub">Tap or drag a rectangle in 2D, or tap the ground in 3D. Select the pool and open Properties for full options.</div>
        ${swGrid(POOL_SHAPES,ps.shape)}
        <div class="sub">Water: ${(POOL_WATER_MAP[ps.water]||{}).name||''}</div>
        ${swGrid(POOL_WATERS,ps.water)}
        <label class="f">Depth <input type="range" id="pDep" min="0.6" max="3" step="0.1" value="${ps.depth||1.4}"> <b>${(ps.depth||1.4).toFixed(1)}m</b></label>
        <label class="f">Coping <input type="color" id="pCop" value="${toColor(ps.coping||'#e8e2d4')}"></label>
        <div class="rowBtns"><button class="btn small" id="pFeat">Extras: ${[ps.lights&&'lights',ps.fountain&&'fountain',ps.cover&&'cover',ps.board&&'diving'].filter(Boolean).join(', ')||'none'}</button><button class="btn small" id="pX">Close</button></div>`;
      p.querySelectorAll('[data-sw]').forEach(b=>b.onclick=()=>{
        if(POOL_SHAPES.find(x=>x.id===b.dataset.sw)) ps.shape=b.dataset.sw; else ps.water=b.dataset.sw;
        queueSave(); app.refreshSelPanel();
      });
      $('#pDep').oninput=e=>{ ps.depth=+e.target.value; e.target.nextElementSibling.textContent=ps.depth.toFixed(1)+'m'; };
      $('#pCop').oninput=e=>{ ps.coping=e.target.value; };
      $('#pFeat').onclick=()=>{
        ps.lights=!ps.lights;
        if(ps.lights){ ps.fountain=true; }
        queueSave(); app.refreshSelPanel();
        toast(ps.lights?'Lights and fountain on for next pools':'Extras off');
      };
      $('#pX').onclick=()=>{ app.tool='select'; buildTools(); app.refreshSelPanel(); };
      return;
    }
    if(app.tool==='paint'){
      const mats=ZONE_MATS.filter(m=>m.kind==='terrain');
      p.innerHTML=`<h4>${icon('sprout')} Terrain • ${swName(ZONE_MATS,app.paintPreset.mat)}</h4><div class="sub">Drag on the plan or the 3D ground to paint.</div>
        ${swGrid(mats,app.paintPreset.mat)}
        <label class="f">Brush <input type="range" id="bSz" min="0.4" max="4" step="0.2" value="${app.brushSize}"> <b>${app.brushSize.toFixed(1)}m</b></label>
        <div class="rowBtns"><button class="btn small danger" id="bClear">Clear paints</button><button class="btn small" id="bX">Close</button></div>`;
      p.querySelectorAll('[data-sw]').forEach(b=>b.onclick=()=>{ app.paintPreset.mat=b.dataset.sw; app.refreshSelPanel(); });
      $('#bSz').oninput=e=>{ app.brushSize=+e.target.value; e.target.nextElementSibling.textContent=app.brushSize.toFixed(1)+'m'; };
      $('#bClear').onclick=()=>{ if(!fl.paints?.length){ toast('Nothing painted'); return; } app.pushUndo(); fl.paints=[]; saveState(app.state); app.syncAll(); };
      $('#bX').onclick=()=>{ app.tool='select'; buildTools(); app.refreshSelPanel(); };
      return;
    }
  }
  if(!s){ p.classList.remove('on'); p.innerHTML=''; document.body.classList.remove('has-sel-panel'); return; }
  if(!app._panelForce){ p.classList.remove('on'); document.body.classList.remove('has-sel-panel'); return; } // full editor opens only via Properties
  const fl=app.state.floors[s.floor]||app.curFloor();
  p.classList.add('on');
  document.body.classList.add('has-sel-panel');
  if(s.type==='slab'){
    const sl=fl.slab||{w:12,d:10,cx:0,cz:0};
    p.innerHTML=`<h4>${icon('layers')} Floor slab • ${fl.name}</h4><div class="sub">Plate the house sits on. Finish shows in 3D.</div>
      <label class="f">Width <input type="number" id="sW" step="0.5" min="4" value="${sl.w}"> m</label>
      <label class="f">Depth <input type="number" id="sD" step="0.5" min="4" value="${sl.d}"> m</label>
      <label class="f">Center X <input type="number" id="sX" step="0.5" value="${sl.cx||0}"></label>
      <label class="f">Center Z <input type="number" id="sZ" step="0.5" value="${sl.cz||0}"></label>
      <label class="f">Finish <select id="sF"><option value="wood">Wood</option><option value="tile">Tile</option><option value="carpet">Carpet</option><option value="concrete">Concrete</option></select></label>
      <button class="btn small primary" id="sOpenTexMenu" type="button" style="width:100%;margin:6px 0;display:flex;align-items:center;justify-content:center;gap:6px;"><i data-lucide="palette"></i> All Textures &amp; Colors Menu</button>
      <h4>${icon('house')} Room designs</h4>
      <div class="sub">Save the room at the screen center (furniture + wall finishes), re-apply it anywhere, or reset the room.</div>
      <div class="rowBtns"><input id="rName" placeholder="Design name" style="flex:1;background:#0b111c;color:var(--txt);border:1px solid var(--line);border-radius:9px;padding:7px 9px;font-size:12px"><button class="btn small primary" id="rSave">${icon('save')} Save</button></div>
      <div id="rList" style="margin:6px 0"></div>
      <div class="rowBtns"><button class="btn small danger" id="rReset">${icon('rotate-ccw')} Reset this room</button></div>
      <div class="rowBtns"><button class="btn" id="sFit">${icon('frame')} Fit to house</button><button class="btn" id="sXb">Close</button></div>`;
    $('#sF').value=fl.finish||'wood';
    $('#sOpenTexMenu').onclick=()=>openDrawer('Tex',true);
    $('#sW').onchange=e=>{ sl.w=Math.max(4,+e.target.value||12); saveState(app.state); app.syncAll(); };
    $('#sD').onchange=e=>{ sl.d=Math.max(4,+e.target.value||10); saveState(app.state); app.syncAll(); };
    $('#sX').onchange=e=>{ sl.cx=+e.target.value||0; saveState(app.state); app.syncAll(); };
    $('#sZ').onchange=e=>{ sl.cz=+e.target.value||0; saveState(app.state); app.syncAll(); };
    $('#sF').onchange=e=>{ fl.finish=e.target.value; saveState(app.state); app.syncAll(); };
    $('#sFit').onclick=()=>document.querySelector('#fitSlabBtn')?.click();
    $('#sXb').onclick=()=>{ app._panelForce=false; app.select(null); };
    const renderRooms=()=>{
      const el=$('#rList'); if(!el) return; el.innerHTML='';
      const names=Object.keys(app.roomDesigns||{});
      if(!names.length){ el.innerHTML='<div class="sub">No saved designs yet.</div>'; return; }
      for(const n of names){
        const row=document.createElement('div');
        row.className='rowBtns'; row.style.marginBottom='6px';
        row.innerHTML=`<span style="flex:1;font-size:12px">${icon('house')} ${n} <small style="color:var(--mut)">(${(app.roomDesigns[n].items||[]).length} items)</small></span>`;
        const ap=document.createElement('button'); ap.className='btn small'; ap.textContent='Apply';
        ap.onclick=()=>app.applyRoomDesign(n);
        const del=document.createElement('button'); del.className='btn small danger'; del.innerHTML=icon('trash-2'); del.title='Delete';
        del.onclick=()=>{ delete app.roomDesigns[n]; app.saveRooms(); renderRooms(); };
        row.append(ap,del); el.appendChild(row);
      }
    };
    renderRooms();
    $('#rSave').onclick=()=>{ const n=($('#rName').value||'').trim()||('Design '+(Object.keys(app.roomDesigns).length+1)); app.saveRoomDesign(n); renderRooms(); };
    $('#rReset').onclick=()=>app.resetRoom();
    return;
  }
  if(s.type==='wall'){
    const w=fl.walls.find(v=>v.id===s.id); if(!w){ app.sel=null; p.classList.remove('on'); return; }
    const L=Math.hypot(w.x2-w.x1,w.z2-w.z1).toFixed(2);
    const curTex=w.finish?.tex||null;
    if(!app._finishScope) app._finishScope='wall';
    p.innerHTML=`<h4>${icon('brick-wall')} Wall • ${L} m ${w.locked?icon('lock'):''}</h4><div class="sub">${w.locked?'This wall is <b>locked</b> — unlock to edit.':'Drag the wall or its round endpoints in 2D to resize the room.'}</div>
      <label class="f">Height <input type="range" id="wH" min="0.5" max="5" step="0.1" value="${w.h||2.7}" ${w.locked?'disabled':''}> <b id="wHv">${(w.h||2.7).toFixed(1)}m</b></label>
      <div class="rowBtns"><button class="btn small" id="wHalf" ${w.locked?'disabled':''}>Set half wall (1.1m)</button><button class="btn small" id="wFull" ${w.locked?'disabled':''}>Full height</button></div>
      <label class="f">Thick <input type="range" id="wT" min="0.05" max="0.5" step="0.01" value="${w.t||0.15}" ${w.locked?'disabled':''}> <b id="wTv">${(w.t||0.15).toFixed(2)}m</b></label>
      <label class="f">Color <input type="color" id="wC" value="${toColor(w.color)}" ${w.locked?'disabled':''}></label>
      <button class="btn small primary" id="wOpenTexMenu" type="button" style="width:100%;margin:6px 0;display:flex;align-items:center;justify-content:center;gap:6px;"><i data-lucide="palette"></i> All Textures &amp; Colors Menu</button>
      <h4>${icon('paint-roller')} Finish • ${curTex?swName(FINISHES,curTex):'plain paint'}</h4>
      <div class="sub">Tap a finish — it applies to the scope below. Two-tone splits upper + lower.</div>
      ${swGrid(FINISHES,curTex,'tex')}
      <label class="f">Tint <input type="color" id="wFC" value="${toColor(w.finish?.color||'#ffffff')}" ${w.locked?'disabled':''}> <button class="btn small" id="wFClear">plain</button></label>
      <div class="sub">Apply to:</div>
      <div class="rowBtns">${['wall','room','floor','house'].map(sc=>`<button class="btn small${app._finishScope===sc?' primary':''}" data-scope="${sc}">${sc==='wall'?'This wall':sc==='room'?'Room':sc==='floor'?'Floor':'House'}</button>`).join('')}</div>
      <h4>Two-tone split ${w.split?'• ON':''}</h4>
      ${w.split?`<label class="f">Split height <input type="range" id="wSH" min="0.3" max="${Math.max(1,(w.h||2.7)-0.3)}" step="0.05" value="${w.split.h}"> <b>${w.split.h.toFixed(2)}m</b></label>
      <div class="sub">Upper: ${swName(FINISHES,w.split.top?.tex)}</div>${swGrid(FINISHES,w.split.top?.tex,'tex').replaceAll('data-sw=','data-top=')}
      <div class="sub">Lower: ${swName(FINISHES,w.split.bottom?.tex)}</div>${swGrid(FINISHES,w.split.bottom?.tex,'tex').replaceAll('data-sw=','data-bot=')}
      <div class="rowBtns"><button class="btn small danger" id="wSplitOff">Remove split</button></div>`
      :`<div class="rowBtns"><button class="btn small" id="wSplitOn" ${w.locked?'disabled':''}>Add split</button></div>`}
      <div class="rowBtns"><button class="btn" id="wLock">${w.locked?icon('lock-open')+' Unlock':icon('lock')+' Lock'}</button><button class="btn" id="wCopy">${icon('copy')} Copy style</button><button class="btn" id="wPaste" ${app.styleClip?.kind==='wall'?'':'disabled'}>${icon('paint-roller')} Paste style</button></div>
      <div class="rowBtns"><button class="btn" id="wSplit">${icon('scissors')} Split</button><button class="btn" id="wDup">${icon('copy')} Duplicate</button><button class="btn danger" id="wDel">Delete</button><button class="btn" id="wX">Close</button></div>`;
    $('#wOpenTexMenu').onclick=()=>openDrawer('Tex',true);
    const scopeWalls=()=>app.wallsForScope(fl,w,app._finishScope);
    p.querySelectorAll('[data-scope]').forEach(b=>b.onclick=()=>{ app._finishScope=b.dataset.scope; app.refreshSelPanel(); });
    p.querySelectorAll('[data-sw]').forEach(b=>b.onclick=()=>{
      if(w.locked){ toast('Unlock it first'); return; }
      const F=FINISH_MAP[b.dataset.sw]||FINISHES.find(f=>f.tex===b.dataset.sw);
      if(!F) return;
      app.finishWalls(scopeWalls(),{tex:F.tex,color:'#ffffff'},undefined);
    });
    p.querySelectorAll('[data-top]').forEach(b=>b.onclick=()=>{ const F=FINISH_MAP[b.dataset.top]||FINISHES.find(f=>f.tex===b.dataset.top); if(!F) return; app.pushUndo(); w.split.top={tex:F.tex,color:'#ffffff'}; saveState(app.state); app.syncAll(); });
    p.querySelectorAll('[data-bot]').forEach(b=>b.onclick=()=>{ const F=FINISH_MAP[b.dataset.bot]||FINISHES.find(f=>f.tex===b.dataset.bot); if(!F) return; app.pushUndo(); w.split.bottom={tex:F.tex,color:'#ffffff'}; saveState(app.state); app.syncAll(); });
    $('#wFC').oninput=e=>{ if(w.locked) return; app.pushUndo(); const t=w.finish?.tex||'wallpaint'; for(const ww of scopeWalls()) ww.finish={tex:t,color:e.target.value}; saveState(app.state); app.syncAll(); };
    $('#wFClear').onclick=()=>{ if(w.locked) return; app.pushUndo(); for(const ww of scopeWalls()) delete ww.finish; saveState(app.state); app.syncAll(); };
    const wSH=$('#wSH'); if(wSH) wSH.oninput=e=>{ w.split.h=+e.target.value; e.target.nextElementSibling.textContent=w.split.h.toFixed(2)+'m'; app.dirty(false); app.view2d.request(); app.view3d.rebuild(); queueSave(); };
    const wSO=$('#wSplitOn'); if(wSO) wSO.onclick=()=>{ app.pushUndo(); w.split={h:1.2,top:{tex:'wallpaint',color:'#ffffff'},bottom:{tex:'mat_wainscot',color:'#ffffff'}}; saveState(app.state); app.syncAll(); };
    const wSOff=$('#wSplitOff'); if(wSOff) wSOff.onclick=()=>{ app.pushUndo(); delete w.split; saveState(app.state); app.syncAll(); };
    $('#wCopy').onclick=()=>app.copyStyle();
    $('#wPaste').onclick=()=>app.pasteStyle();
    $('#wLock').onclick=()=>{ w.locked=!w.locked; saveState(app.state); app.syncAll(); toast(w.locked?'Wall locked — it can’t be moved or deleted':'Wall unlocked'); };
    const setWallHeight=value=>{ if(w.locked) return; app.pushUndo(); w.h=value; $('#wH').value=value; $('#wHv').textContent=value.toFixed(1)+'m'; app.view2d.request(); app.view3d.rebuild(); queueSave(); };
    $('#wHalf').onclick=()=>setWallHeight(1.1);
    $('#wFull').onclick=()=>setWallHeight(app.state.settings.wallHeightDefault||fl.wallHeight||2.7);
    $('#wH').oninput=e=>{ w.h=+e.target.value; $('#wHv').textContent=(+e.target.value).toFixed(1)+'m'; app.dirty(false); app.view2d.request(); app.view3d.rebuild(); queueSave(); };
    $('#wT').oninput=e=>{ w.t=+e.target.value; $('#wTv').textContent=(+e.target.value).toFixed(2)+'m'; app.dirty(false); app.view2d.request(); app.view3d.rebuild(); queueSave(); };
    $('#wC').oninput=e=>{ w.color=e.target.value; if(w.finish) w.finish.color=e.target.value; app.dirty(false); app.view2d.request(); app.view3d.rebuild(); queueSave(); };
    $('#wDel').onclick=()=>app.deleteWall(w);
    $('#wSplit').onclick=()=>{ if(w.locked){ toast('Unlock the wall to split it'); return; } app.pushUndo(); const mx=(w.x1+w.x2)/2,mz=(w.z1+w.z2)/2;
      const w2={...w,id:uid('w'),x1:mx,z1:mz}; w.x2=mx; w.z2=mz; fl.walls.push(w2);
      saveState(app.state); app.syncAll(); };
    $('#wDup').onclick=()=>{ app.pushUndo(); fl.walls.push({...w,locked:false,id:uid('w'),x1:w.x1+0.5,x2:w.x2+0.5}); saveState(app.state); app.syncAll(); };
    $('#wX').onclick=()=>{ app._panelForce=false; app.select(null); };
  } else if(s.type==='opening'){
    const o=fl.openings.find(v=>v.id===s.id); if(!o){ app.sel=null; p.classList.remove('on'); return; }
    const oWallLocked=fl.walls.find(v=>v.id===o.wallId)?.locked;
    const dis=oWallLocked?'disabled':'';
    p.innerHTML=`<h4>${o.kind==='door'?icon('door-open')+' Door':o.kind==='window'?icon('app-window')+' Window':icon('square')+' Arch'}</h4><div class="sub">${oWallLocked?'Its wall is <b>locked</b> — unlock the wall to edit.':'Tap position is along its wall.'}</div>
      <label class="f">Type <select id="oK" ${dis}><option value="door">Door</option><option value="window">Window</option><option value="arch">Arch / opening</option></select></label>
      <label class="f">Width <input type="range" id="oW" min="0.4" max="3" step="0.05" value="${o.w}" ${dis}> <b>${o.w.toFixed(2)}m</b></label>
      <label class="f">Height <input type="range" id="oH" min="0.5" max="2.6" step="0.05" value="${o.h}" ${dis}> <b>${o.h.toFixed(2)}m</b></label>
      <label class="f">Sill <input type="range" id="oS" min="0" max="1.5" step="0.05" value="${o.sill}" ${dis}> <b>${o.sill.toFixed(2)}m</b></label>
      <label class="f">Along wall <input type="range" id="oA" min="0.05" max="0.95" step="0.01" value="${o.at}" ${dis}></label>
      <div class="rowBtns"><button class="btn danger" id="oDel">Delete</button><button class="btn" id="oX">Close</button></div>`;
    $('#oK').value=o.kind;
    $('#oK').onchange=e=>{ app.pushUndo(); o.kind=e.target.value; if(o.kind==='door'){o.sill=0;o.h=2.1;} if(o.kind==='window'&&o.sill===0)o.sill=0.9; saveState(app.state); app.syncAll(); };
    $('#oW').oninput=e=>{ o.w=+e.target.value; e.target.nextElementSibling.textContent=o.w.toFixed(2)+'m'; liveR(); };
    $('#oH').oninput=e=>{ o.h=+e.target.value; e.target.nextElementSibling.textContent=o.h.toFixed(2)+'m'; liveR(); };
    $('#oS').oninput=e=>{ o.sill=+e.target.value; e.target.nextElementSibling.textContent=o.sill.toFixed(2)+'m'; liveR(); };
    $('#oA').oninput=e=>{ o.at=+e.target.value; liveR(); };
    function liveR(){ app.view2d.request(); app.view3d.rebuild(); queueSave(); }
    $('#oDel').onclick=()=>app.deleteOpening(o);
    $('#oX').onclick=()=>{ app._panelForce=false; app.select(null); };
  } else if(s.type==='item'){
    const it=fl.items.find(v=>v.id===s.id); if(!it){ app.sel=null; p.classList.remove('on'); return; }
    const def=app.defOf(it)||{name:it.defId,cat:'custom',w:1,d:1,h:1};
    const wall=it.mount?fl.walls.find(v=>v.id===it.mount.wallId):null;
    const parent=it.on?fl.items.find(v=>v.id===it.on.parentId):null;
    const pdef=parent?app.defOf(parent):null;
    const slots=pdef?app.slotList(pdef):[];
    let attachHTML='';
    if(it.mount&&wall){
      const wl=wallLen(wall);
      attachHTML=`<h4>${icon('image')} On wall</h4>
      <div class="sub">Drag in 2D to slide along the wall • 3D drag works too.</div>
      <label class="f">Height <input type="range" id="mY" min="0.2" max="${(wall.h||2.7).toFixed(1)}" step="0.05" value="${it.mount.y}"> <b>${it.mount.y.toFixed(2)}m</b></label>
      <label class="f">Along wall <input type="range" id="mA" min="0" max="${wl.toFixed(2)}" step="0.05" value="${it.mount.along}"> <b>${it.mount.along.toFixed(2)}m</b></label>
      <div class="rowBtns"><button class="btn small" id="mCenter">Center</button><button class="btn small" id="mFlip">${icon('arrow-left-right')} Other side</button><button class="btn small" id="mDrop">${icon('arrow-down')} To floor</button></div>`;
    } else if(it.on&&parent){
      attachHTML=`<h4>${icon('sparkles')} On shelf • ${pdef?.name||'shelf'}</h4>
      <div class="sub">Drag in 2D to rearrange • exact spot is saved.</div>
      <label class="f">Shelf <select id="sShelf">${slots.map((sl,i)=>`<option value="${i}"${i===(it.on.shelf||0)?' selected':''}>${sl.top?'top surface':'shelf '+(i+1)} • ${sl.w.toFixed(1)}×${sl.d.toFixed(1)}m</option>`).join('')}</select></label>
      <label class="f">Left–right <input type="range" id="sDx" min="${(-(slots[it.on.shelf||0]?.w||1)/2).toFixed(2)}" max="${((slots[it.on.shelf||0]?.w||1)/2).toFixed(2)}" step="0.02" value="${it.on.dx||0}"> <b>${(it.on.dx||0).toFixed(2)}m</b></label>
      <label class="f">Fwd–back <input type="range" id="sDz" min="${(-(slots[it.on.shelf||0]?.d||1)/2).toFixed(2)}" max="${((slots[it.on.shelf||0]?.d||1)/2).toFixed(2)}" step="0.02" value="${it.on.dz||0}"> <b>${(it.on.dz||0).toFixed(2)}m</b></label>
      <div class="rowBtns"><button class="btn small" id="sDrop">${icon('arrow-down')} To floor</button></div>`;
    }
    let stairsHTML='';
    if(def.id==='stairs_straight'){
      const rise=+(it.rise??nextFloorRise(app.state,s.floor));
      stairsHTML=`<label class="f">Rise to next floor <input type="range" id="iRise" min="1.5" max="5" step="0.05" value="${rise}" ${it.locked?'disabled':''}> <b id="iRiseV">${rise.toFixed(2)}m</b></label>
      <div class="rowBtns"><button class="btn small" id="iRiseAuto" ${it.locked?'disabled':''}>${icon('wand')} Auto-fit to floor above</button></div>`;
    }
    p.innerHTML=`<h4>${icon(catIcon(def.cat||'custom'))} ${def.name} ${it.locked?icon('lock'):''}</h4><div class="sub">${def.w}×${def.d}×${def.h} m • floor: ${fl.name}${it.locked?'<br>This item is <b>locked</b> — unlock to move it.':''}${it.mount?' • wall-mounted':''}${it.on?' • on a shelf':''}</div>
      ${attachHTML}
      <label class="f">Rotate <input type="range" id="iR" min="0" max="360" step="5" value="${(it.rot||0+360)%360}" ${it.locked?'disabled':''}> <b id="iRv">${it.rot||0}°</b></label>
      <div class="rowBtns"><button class="btn small" data-r="45" ${it.locked?'disabled':''}>${icon('rotate-cw')} 45°</button><button class="btn small" data-r="90" ${it.locked?'disabled':''}>${icon('rotate-cw')} 90°</button><button class="btn small" data-f="-1" ${it.locked?'disabled':''}>${icon('arrow-left-right')} Flip</button></div>
      <label class="f">Size <input type="range" id="iS" min="0.5" max="2.5" step="0.05" value="${it.scale||1}" ${it.locked?'disabled':''}> <b id="iSv">${(it.scale||1).toFixed(2)}×</b></label>
      <label class="f">Tint <input type="color" id="iC" value="${toColor(it.color||'#ffffff')}" ${it.locked?'disabled':''}> <button class="btn small" id="iClear" ${it.locked?'disabled':''}>reset</button></label>
      ${stairsHTML}
      <div class="rowBtns"><button class="btn" id="iLock">${it.locked?icon('lock-open')+' Unlock':icon('lock')+' Lock'}</button><button class="btn" id="iDup">${icon('copy')} Duplicate</button><button class="btn" id="iUp" ${it.locked?'disabled':''}>${icon('arrow-up')} Send upstairs</button><button class="btn danger" id="iDel">Delete</button><button class="btn" id="iX">Close</button></div>
      <div class="rowBtns"><button class="btn small" id="iCopy">${icon('copy')} Copy style</button><button class="btn small" id="iPaste" ${app.styleClip?.kind==='item'?'':'disabled'}>🎨 Paste style</button><button class="btn small" id="iStudio">${icon('palette')} Customize</button></div>`;
    $('#iLock').onclick=()=>{ it.locked=!it.locked; saveState(app.state); app.syncAll(); toast(it.locked?'Locked — it can’t be moved':'Unlocked'); };
    $('#iR').oninput=e=>{ it.rot=+e.target.value; $('#iRv').textContent=it.rot+'°'; app.view2d.request(); app.view3d.rebuild(); queueSave(); };
    p.querySelectorAll('[data-r]').forEach(b=>b.onclick=()=>{ app.pushUndo(); it.rot=((it.rot||0)+ +b.dataset.r)%360; saveState(app.state); app.syncAll(); });
    p.querySelector('[data-f]').onclick=()=>{ app.pushUndo(); it.rot=((it.rot||0)+180)%360; saveState(app.state); app.syncAll(); };
    $('#iS').oninput=e=>{ it.scale=+e.target.value; $('#iSv').textContent=(+e.target.value).toFixed(2)+'×'; app.view2d.request(); app.view3d.rebuild(); queueSave(); };
    $('#iC').oninput=e=>{ it.color=e.target.value; app.view2d.request(); app.view3d.rebuild(); queueSave(); };
    $('#iClear').onclick=()=>{ delete it.color; saveState(app.state); app.syncAll(); };
    const iRise=$('#iRise'); if(iRise) iRise.oninput=e=>{ it.rise=+e.target.value; $('#iRiseV').textContent=it.rise.toFixed(2)+'m'; app.view3d.rebuild(); queueSave(); };
    const iRiseAuto=$('#iRiseAuto'); if(iRiseAuto) iRiseAuto.onclick=()=>{ app.pushUndo(); it.rise=nextFloorRise(app.state,s.floor); saveState(app.state); app.syncAll(); toast('Stairs auto-fit: rise '+it.rise.toFixed(2)+' m'); };
    $('#iDup').onclick=()=>{ app.pushUndo();
      const c={...it,locked:false,id:uid('i'),x:+(it.x+0.5).toFixed(3)};
      if(c.mount) c.mount={...c.mount,along:c.mount.along+0.3};
      if(c.on) c.on={...c.on,dx:(c.on.dx||0)+0.1,top:0};
      fl.items.push(c); saveState(app.state); app.syncAll(); };
    $('#iUp').onclick=()=>{
      if(app.state.activeFloor>=app.state.floors.length-1){ toast('Already on top floor — add a floor first'); return; }
      app.pushUndo();
      fl.items=fl.items.filter(v=>v.id!==it.id);
      app.state.floors[app.state.activeFloor+1].items.push(it);
      app.select(null); saveState(app.state); app.syncAll(); toast('Moved to '+(app.state.floors[app.state.activeFloor+1]?.name||'upper'));
    };
    $('#iDel').onclick=()=>app.deleteItem(it);
    $('#iX').onclick=()=>{ app._panelForce=false; app.select(null); };
    $('#iCopy').onclick=()=>app.copyStyle();
    $('#iPaste').onclick=()=>app.pasteStyle();
    $('#iStudio').onclick=()=>app.matStudio?.openFor(it, s.floor);
    const mY=$('#mY'); if(mY) mY.oninput=e=>{ it.mount.y=+e.target.value; e.target.nextElementSibling.textContent=it.mount.y.toFixed(2)+'m'; app.dirty(false); app.view2d.request(); app.view3d.rebuild(); queueSave(); };
    const mA=$('#mA'); if(mA) mA.oninput=e=>{ it.mount.along=+e.target.value; e.target.nextElementSibling.textContent=it.mount.along.toFixed(2)+'m'; app.dirty(false); app.view2d.request(); app.view3d.rebuild(); queueSave(); };
    const mC=$('#mCenter'); if(mC) mC.onclick=()=>{ const w=fl.walls.find(v=>v.id===it.mount.wallId); if(w){ app.pushUndo(); it.mount.along=wallLen(w)/2; saveState(app.state); app.syncAll(); } };
    const mF=$('#mFlip'); if(mF) mF.onclick=()=>{ app.pushUndo(); it.mount.side=-(it.mount.side||1); saveState(app.state); app.syncAll(); };
    const mD=$('#mDrop'); if(mD) mD.onclick=()=>{ app.pushUndo(); delete it.mount; it.y=0; saveState(app.state); app.syncAll(); };
    const sS=$('#sShelf'); if(sS) sS.onchange=e=>{ app.pushUndo(); it.on.shelf=+e.target.value; it.on.top=0; saveState(app.state); app.syncAll(); };
    const sDx=$('#sDx'); if(sDx) sDx.oninput=e=>{ it.on.dx=+e.target.value; e.target.nextElementSibling.textContent=it.on.dx.toFixed(2)+'m'; app.dirty(false); app.view2d.request(); app.view3d.rebuild(); queueSave(); };
    const sDz=$('#sDz'); if(sDz) sDz.oninput=e=>{ it.on.dz=+e.target.value; e.target.nextElementSibling.textContent=it.on.dz.toFixed(2)+'m'; app.dirty(false); app.view2d.request(); app.view3d.rebuild(); queueSave(); };
    const sD=$('#sDrop'); if(sD) sD.onclick=()=>{ app.pushUndo(); delete it.on; it.y=0; saveState(app.state); app.syncAll(); };
  } else if(s.type==='zone'){
    const zn=(fl.zones||[]).find(v=>v.id===s.id); if(!zn){ app.sel=null; p.classList.remove('on'); return; }
    const cx=(zn.x0+zn.x1)/2, cz=(zn.z0+zn.z1)/2, zw=Math.abs(zn.x1-zn.x0), zd=Math.abs(zn.z1-zn.z0);
    p.innerHTML=`<h4>${icon('paint-roller')} Surface • ${app.zoneName(zn)}</h4><div class="sub">Drag in 2D to move • size below • material shows in 3D with direction + scale.</div>
      <label class="f">Material <select id="zM">${ZONE_MATS.map(m=>`<option value="${m.id}"${zn.mat===m.id?' selected':''}>${m.name}</option>`).join('')}</select></label>
      <button class="btn small primary" id="zOpenTexMenu" type="button" style="width:100%;margin:6px 0;display:flex;align-items:center;justify-content:center;gap:6px;"><i data-lucide="palette"></i> All Textures &amp; Colors Menu</button>
      <label class="f">Tint <input type="color" id="zC" value="${toColor(zn.color||'#ffffff')}"></label>
      <label class="f">Direction <input type="range" id="zA" min="0" max="90" step="5" value="${zn.angle||0}"> <b>${zn.angle||0}°</b></label>
      <label class="f">Tile size <input type="range" id="zS" min="0.4" max="4" step="0.2" value="${zn.scale||1.2}"> <b>${(zn.scale||1.2).toFixed(1)}m</b></label>
      <label class="f">Width <input type="range" id="zW" min="0.5" max="20" step="0.1" value="${zw}"> <b>${zw.toFixed(1)}m</b></label>
      <label class="f">Depth <input type="range" id="zD" min="0.5" max="20" step="0.1" value="${zd}"> <b>${zd.toFixed(1)}m</b></label>
      <div class="rowBtns"><button class="btn" id="zDup">⧉ Duplicate</button><button class="btn danger" id="zDel">Delete</button><button class="btn" id="zX">Close</button></div>`;
    $('#zOpenTexMenu').onclick=()=>openDrawer('Tex',true);
    $('#zM').onchange=e=>{ app.pushUndo(); zn.mat=e.target.value; zn.color='#ffffff'; saveState(app.state); app.syncAll(); };
    $('#zC').oninput=e=>{ zn.color=e.target.value; app.dirty(false); app.view2d.request(); app.view3d.rebuild(); queueSave(); };
    $('#zA').oninput=e=>{ zn.angle=+e.target.value; e.target.nextElementSibling.textContent=zn.angle+'°'; app.dirty(false); app.view2d.request(); app.view3d.rebuild(); queueSave(); };
    $('#zS').oninput=e=>{ zn.scale=+e.target.value; e.target.nextElementSibling.textContent=zn.scale.toFixed(1)+'m'; app.dirty(false); app.view2d.request(); app.view3d.rebuild(); queueSave(); };
    $('#zW').oninput=e=>{ const w2=+e.target.value/2; zn.x0=+(cx-w2).toFixed(2); zn.x1=+(cx+w2).toFixed(2); e.target.nextElementSibling.textContent=(+e.target.value).toFixed(1)+'m'; app.dirty(false); app.view2d.request(); app.view3d.rebuild(); queueSave(); };
    $('#zD').oninput=e=>{ const d2=+e.target.value/2; zn.z0=+(cz-d2).toFixed(2); zn.z1=+(cz+d2).toFixed(2); e.target.nextElementSibling.textContent=(+e.target.value).toFixed(1)+'m'; app.dirty(false); app.view2d.request(); app.view3d.rebuild(); queueSave(); };
    $('#zDup').onclick=()=>{ app.pushUndo(); fl.zones.push({...zn,id:uid('z'),x0:zn.x0+0.5,x1:zn.x1+0.5}); saveState(app.state); app.syncAll(); };
    $('#zDel').onclick=()=>app.deleteZone(zn);
    $('#zX').onclick=()=>{ app._panelForce=false; app.select(null); };
  } else if(s.type==='pool'){
    const pl=(fl.pools||[]).find(v=>v.id===s.id); if(!pl){ app.sel=null; p.classList.remove('on'); return; }
    p.innerHTML=`<h4>${icon('waves')} Pool • ${swName(POOL_SHAPES,pl.shape)}</h4><div class="sub">Drag in 2D to move • tap water in 3D to select here.</div>
      <label class="f">Shape <select id="pSh">${POOL_SHAPES.map(x=>`<option value="${x.id}"${pl.shape===x.id?' selected':''}>${x.name}</option>`).join('')}</select></label>
      <label class="f">Water <select id="pW">${POOL_WATERS.map(x=>`<option value="${x.id}"${pl.water===x.id?' selected':''}>${x.name}</option>`).join('')}</select></label>
      <label class="f">Coping <input type="color" id="pC" value="${toColor(pl.coping||'#e8e2d4')}"></label>
      <label class="f">Depth <input type="range" id="pDp" min="0.6" max="3" step="0.1" value="${pl.depth||1.4}"> <b>${(pl.depth||1.4).toFixed(1)}m</b></label>
      <label class="f">Width <input type="range" id="pWw" min="1.5" max="12" step="0.1" value="${pl.w}"> <b>${pl.w.toFixed(1)}m</b></label>
      <label class="f">Length <input type="range" id="pDd" min="1.5" max="12" step="0.1" value="${pl.d}"> <b>${pl.d.toFixed(1)}m</b></label>
      <label class="f">Rotate <input type="range" id="pR" min="0" max="180" step="5" value="${pl.rot||0}"> <b>${pl.rot||0}°</b></label>
      <div class="rowBtns">
        <button class="btn small${pl.lights?' primary':''}" id="pLi">${icon('lightbulb')} Lights</button>
        <button class="btn small${pl.fountain?' primary':''}" id="pFo">${icon('droplets')} Fountain</button>
        <button class="btn small${pl.cover?' primary':''}" id="pCo">${icon('shield')} Cover</button>
      </div>
      <div class="rowBtns">
        <button class="btn small${pl.steps!==false?' primary':''}" id="pSt">${icon('trending-up')} Steps</button>
        <button class="btn small${pl.ladder!==false?' primary':''}" id="pLa">${icon('trending-up')} Ladder</button>
        <button class="btn small${pl.board?' primary':''}" id="pBo">Diving board</button>
      </div>
      <div class="rowBtns"><button class="btn" id="pDup">⧉ Duplicate</button><button class="btn danger" id="pDel">Delete</button><button class="btn" id="pX">Close</button></div>`;
    $('#pSh').onchange=e=>{ app.pushUndo(); pl.shape=e.target.value; saveState(app.state); app.syncAll(); };
    $('#pW').onchange=e=>{ app.pushUndo(); pl.water=e.target.value; saveState(app.state); app.syncAll(); };
    $('#pC').oninput=e=>{ pl.coping=e.target.value; app.dirty(false); app.view2d.request(); app.view3d.rebuild(); queueSave(); };
    $('#pDp').oninput=e=>{ pl.depth=+e.target.value; e.target.nextElementSibling.textContent=pl.depth.toFixed(1)+'m'; app.dirty(false); app.view2d.request(); app.view3d.rebuild(); queueSave(); };
    $('#pWw').oninput=e=>{ pl.w=+e.target.value; e.target.nextElementSibling.textContent=pl.w.toFixed(1)+'m'; app.dirty(false); app.view2d.request(); app.view3d.rebuild(); queueSave(); };
    $('#pDd').oninput=e=>{ pl.d=+e.target.value; e.target.nextElementSibling.textContent=pl.d.toFixed(1)+'m'; app.dirty(false); app.view2d.request(); app.view3d.rebuild(); queueSave(); };
    $('#pR').oninput=e=>{ pl.rot=+e.target.value; e.target.nextElementSibling.textContent=pl.rot+'°'; app.dirty(false); app.view2d.request(); app.view3d.rebuild(); queueSave(); };
    const tog=(id,key)=>{ $(id).onclick=()=>{ app.pushUndo(); pl[key]=key==='steps'||key==='ladder'?!(pl[key]!==false):!pl[key]; saveState(app.state); app.syncAll(); }; };
    tog('#pLi','lights'); tog('#pFo','fountain'); tog('#pCo','cover'); tog('#pSt','steps'); tog('#pLa','ladder'); tog('#pBo','board');
    $('#pDup').onclick=()=>{ app.pushUndo(); fl.pools.push({...pl,id:uid('p'),x:+(pl.x+1).toFixed(2)}); saveState(app.state); app.syncAll(); };
    $('#pDel').onclick=()=>app.deletePool(pl);
    $('#pX').onclick=()=>{ app._panelForce=false; app.select(null); };
  }
};
let _qs=null;
function queueSave(){ clearTimeout(_qs); _qs=setTimeout(()=>saveState(app.state),500); }
function toColor(c){ if(!c) return '#ffffff'; if(/^#[0-9a-f]{6}$/i.test(c)) return c; const m=new Option().style; m.color=c; return '#ffffff'; }

// floors
function renderFloorSel(){
  const sel=$('#floorSel'); sel.innerHTML='';
  app.state.floors.forEach((f,i)=>{
    const o=document.createElement('option'); o.value=String(i); o.textContent=f.name;
    sel.appendChild(o);
  });
  sel.value=String(Math.max(0,Math.min(app.state.floors.length-1,app.state.activeFloor||0)));
  $('#floorName2d').textContent=app.curFloor().name;
  $('#floorName3d').textContent=app.curFloor().name;
  $('#wallHInput').value=app.state.settings.wallHeightDefault;
  $('#wallTInput').value=app.state.settings.wallThickness;
  $('#slabW').value=app.curFloor().slab?.w||12;
  $('#slabD').value=app.curFloor().slab?.d||10;
}
app.renderFloorSel=renderFloorSel;
function renderFloorList(){
  const el=$('#floorList'); if(!el) return; el.innerHTML='';
  app.state.floors.forEach((f,i)=>{
    const row=document.createElement('div');
    row.style.cssText='display:flex;gap:8px;align-items:center;background:#131c2e;border:1px solid var(--line);border-radius:12px;padding:8px;margin-bottom:8px;'+(i===app.state.activeFloor?';border-color:var(--acc)':'');
    row.innerHTML=`<b style="flex:1;font-size:13px">${icon(i===0?'layers':'building-2')} ${i+1}. <span data-n>${f.name}</span><br><small style="color:var(--mut)">${f.walls.length} walls • ${f.items.length} items • ${f.wallHeight.toFixed(1)}m</small></b>`;
    const go=document.createElement('button'); go.className='btn small'; go.textContent=i===app.state.activeFloor?'● current':'Edit'; go.onclick=()=>{ app.state.activeFloor=i; saveState(app.state); app.select(null); app.view2d.fit(); app.syncAll(); $('#floorVeil').classList.remove('on'); };
    const rn=document.createElement('button'); rn.className='btn small'; rn.innerHTML=icon('pencil'); rn.title='Rename floor'; rn.onclick=()=>{ const n=prompt('Floor name',f.name); if(n){ app.pushUndo(); f.name=n.slice(0,30); saveState(app.state); app.syncAll(); } };
    const del=document.createElement('button'); del.className='btn small danger'; del.innerHTML=icon('trash-2'); del.title='Delete floor'; del.onclick=()=>{ if(app.state.floors.length<=1){ toast('Need at least one floor'); return; } if(!confirm('Delete '+f.name+'?')) return; app.pushUndo(); app.state.floors.splice(i,1); app.state.activeFloor=Math.max(0,Math.min(app.state.activeFloor,app.state.floors.length-1)); app.fitStairs(); saveState(app.state); app.syncAll(); };
    row.append(go,rn,del); el.appendChild(row);
  });
}
app.renderFloorList=renderFloorList;
app.syncAll=function(){ app.resolveAll(); renderFloorSel(); renderFloorList(); app.view2d.request(); app.view3d.rebuild(); if(!app.sel) app.hideCtxBar(); else if(!app._draggingPanel) app.showCtxBar(); app.refreshSelPanel(); };

// uploads v2: single models + ZIP archives, review modal, kv overflow storage
async function customBytes(rec){
  if(rec.dataUrl){
    try{ return Uint8Array.from(atob(rec.dataUrl.split(',')[1]),c=>c.charCodeAt(0)); }catch(e){ return null; }
  }
  if(rec.kvKey){
    try{
      const kv=globalThis.root?.kv; if(!kv) return null;
      const v=await kv.models.get(rec.kvKey);
      if(!v) return null;
      return v instanceof Uint8Array?v:new Uint8Array(v);
    }catch(e){ return null; }
  }
  return null;
}
async function persistBytes(key,bytes){
  if(bytes.length<=700*1024){
    let s=''; const CH=0x8000;
    for(let i=0;i<bytes.length;i+=CH) s+=String.fromCharCode.apply(null,bytes.subarray(i,i+CH));
    return {dataUrl:'data:model/octet-stream;base64,'+btoa(s)};
  }
  const kv=globalThis.root?.kv;
  if(!kv) throw new Error('Model is '+(bytes.length/1048576).toFixed(1)+'MB — too big for this device\'s local storage.');
  await kv.models.set(key,bytes instanceof Uint8Array?bytes:new Uint8Array(bytes));
  return {kvKey:key};
}
function setUploadStatus(t){ const el=$('#upStatus'); if(el) el.innerHTML=t; }
function openUploadReview(){
  $('#upSave').style.display='';
  const btn=$('#upSave'); if(btn) btn.disabled=false;
  $('#upPrev').hidden=true; $('#upPrev').removeAttribute('src');
  $('#upMeta').textContent=''; $('#upWarn').innerHTML='';
  for(const id of ['upName','upSub','upRoom','upDesc']) $('#'+id).value='';
  setUploadStatus('<div class="spin" style="margin:8px auto"></div>Reading file…');
  $('#menuVeil').classList.remove('on');
  $('#uploadVeil').classList.add('on');
}
function fillUploadReview(res){
  const up=app._upload; if(!up) return;
  if(res.thumb){ const img=$('#upPrev'); img.src=res.thumb; img.hidden=false; }
  setUploadStatus('Review — adjust anything, then save.');
  const bits=[res.srcFile+' ('+res.srcExt.toUpperCase()+')',res.dims.w+'×'+res.dims.d+'×'+res.dims.h+' m',res.meshes+' parts',Math.round(res.tris/100)/10+'k tris'];
  if(res.texFiles?.length) bits.push(res.texFiles.length+' texture'+(res.texFiles.length>1?'s':'')+' linked');
  if(res.mtlFile) bits.push('materials: '+res.mtlFile);
  if(res.optimized) bits.push('optimized GLB '+(res.optimized.length/1024).toFixed(0)+'KB');
  $('#upMeta').textContent=bits.join(' • ')+' • '+res.ms+'ms';
  $('#upWarn').innerHTML=(res.warnings||[]).map(w=>'<div><b>Note:</b> '+w.replace(/</g,'&lt;')+'</div>').join('');
  $('#upName').value=res.baseName;
  const g=up.guess||{};
  $('#upCat').value=g.cat||'decor';
  $('#upRoom').value=g.room||'Living room';
  $('#upW').value=res.dims.w; $('#upD').value=res.dims.d; $('#upH').value=res.dims.h;
  $('#upRot').value='0';
}
async function handleMeshFile(file){
  if(!file) return;
  openUploadReview();
  try{
    const imp=await import('./importer.js?v=20261103e');
    const res=await imp.importModelFile(file,app.view3d.THREE,p=>setUploadStatus('<div class="spin" style="margin:8px auto"></div>'+p));
    app._upload={file,res,imp,guess:imp.guessFromName(res.baseName)};
    fillUploadReview(res);
    aiIdentifyUpload(true); // silent auto-run; fills fields when done
  }catch(err){
    console.warn('import fail',err);
    setUploadStatus('Could not import.<br>'+String(err.message||err).replace(/</g,'&lt;'));
    $('#upSave').style.display='none';
  }
}
async function aiIdentifyUpload(silent){
  const up=app._upload;
  if(!up?.res) return;
  if(!silent) setUploadStatus('<div class="spin" style="margin:8px auto"></div>AI is looking at your model…');
  try{
    const gen=generateOpenRouterText;
    let blob=null;
    if(up.res.thumb) blob=await (await fetch(up.res.thumb)).blob();
    const cats=(await import('./catalog.js')).CATEGORIES.map(c=>c.id).filter(c=>c!=='custom').join(', ');
    const prompt='You are a furniture cataloguer for a home-design app. Look at this 3D model preview render and return STRICT JSON only (no markdown, no commentary): {"name":"short product name","category":"one of: '+cats+'","subcategory":"short","room":"best room","description":"one sentence"}. File was named "'+up.res.baseName+'". If unsure, guess the closest furniture category.';
    const out=blob?((await analyzeBlueprintImage(blob,prompt)).text):await gen(prompt);
    const raw=typeof out==='string'?out:(out?.text||out?.content||JSON.stringify(out));
    const m=String(raw).match(/\{[\s\S]*\}/);
    if(!m) throw new Error('bad AI reply');
    const j=JSON.parse(m[0]);
    if(j.name&&$('#upName')&&!$('#upName').dataset.touched) $('#upName').value=String(j.name).slice(0,40);
    if(j.category){ const c=String(j.category).toLowerCase(); const opt=[...$('#upCat').options].find(o=>o.value===c); if(opt) $('#upCat').value=c; }
    if(j.subcategory&&$('#upSub')&&!$('#upSub').dataset.touched) $('#upSub').value=String(j.subcategory).slice(0,30);
    if(j.room&&$('#upRoom')&&!$('#upRoom').dataset.touched) $('#upRoom').value=String(j.room).slice(0,30);
    if(j.description&&$('#upDesc')) $('#upDesc').value=String(j.description).slice(0,120);
    if(!silent){ toast('AI filled in the details — review and save'); fillUploadReviewKeep(); }
    else if(up.res) setUploadStatus('Review — adjust anything, then save. AI suggestions applied.');
  }catch(err){
    console.warn('ai identify fail',err);
    if(!silent){ toast('AI identify failed — fill in manually'); setUploadStatus('Review — adjust anything, then save.'); }
  }
}
function fillUploadReviewKeep(){ /* status already updated by caller */ }
function refreshDesignRoom(){
  const {fl,rect}=app.roomRectHere();
  const el=$('#designRoom');
  if(!rect){ el.textContent='No room at screen center — pan to a room first.'; return null; }
  const items=fl.items.filter(it=>it.x>rect.x0&&it.x<rect.x1&&it.z>rect.z0&&it.z<rect.z1);
  el.textContent=`Room ${(rect.x1-rect.x0).toFixed(1)}×${(rect.z1-rect.z0).toFixed(1)} m on ${fl.name} — ${items.length} item(s), ${wallsInRect(fl,rect).length} wall(s). Style it without losing anything.`;
  return {fl,rect,items};
}
function designCatalogList(){
  // compact "id:name WxD" for the AI; custom models too
  const parts=getCatalog().list.map(d=>`${d.id}:${d.name} ${d.w}x${d.d}`).join('; ');
  const customs=app.custom.map(c=>`custom:${c.id}:${c.name} ${c.w}x${c.d}`).join('; ');
  return customs?parts+'; '+customs:parts;
}
async function draftRoomDesign(){
  const ctx=refreshDesignRoom();
  if(!ctx){ toast('Pan to a room first'); return; }
  const {fl,rect,items}=ctx;
  const style=$('#designStyle').value||'Cozy';
  $('#designStatus').textContent='AI is designing… (up to about a minute)';
  $('#designOut').innerHTML='';
  $('#designPlace').hidden=true; $('#designPaint').hidden=true;
  app._design=null;
  try{
    const gen=generateOpenRouterText;
    const cx=(rect.x0+rect.x1)/2, cz=(rect.z0+rect.z1)/2;
    const W=rect.x1-rect.x0, D=rect.z1-rect.z0;
    const wallFin=[...new Set(wallsInRect(fl,rect).map(w=>w.finish?.tex||'plain '+w.color))].slice(0,4).join(', ');
    const prompt=`You are an interior designer for a home-design app. Style: ${style}. Room ${W.toFixed(1)}x${D.toFixed(1)}m (center ${cx.toFixed(1)},${cz.toFixed(1)}), walls: ${wallFin||'plain'}. Existing items (KEEP all): ${items.map(i=>app.defOf(i)?.name||i.defId).join(', ')||'none'}.
Catalog (use EXACT ids): ${designCatalogList()}
Return STRICT JSON only: {"palette":["#hex","#hex","#hex"],"wallColor":"#hex","advice":"2-3 sentences","items":[{"id":"exact catalog id","dx":m,"dz":m,"note":"short"}]} where dx/dz are meters from room center, 2-6 items that fit with walkways. Only ids from the catalog. JSON only.`;
    const out=await gen(prompt);
    const raw=typeof out==='string'?out:(out?.text||out?.content||JSON.stringify(out));
    const m=String(raw).match(/\{[\s\S]*\}/);
    if(!m) throw new Error('AI returned no JSON');
    const j=JSON.parse(m[0]);
    if(!Array.isArray(j.items)||!j.items.length) throw new Error('AI suggested no items');
    // validate ids now (placement validated at apply time against live state)
    const valid=[];
    for(const s of j.items.slice(0,8)){
      const def=s.id?.startsWith('custom:')?app.customDef(s.id):defById(s.id);
      if(!def){ console.warn('design: unknown id',s.id); continue; }
      valid.push({id:s.id,dx:+s.dx||0,dz:+s.dz||0,note:String(s.note||'').slice(0,60)});
    }
    if(!valid.length) throw new Error('AI item ids did not match the catalog — retry');
    app._design={rect:{...rect},cx,cz,W,D,fl:fl.id,palette:(j.palette||[]).slice(0,3),wallColor:j.wallColor,advice:String(j.advice||'').slice(0,400),items:valid};
    const pal=(app._design.palette||[]).map(c=>`<span style="display:inline-block;width:22px;height:22px;border-radius:6px;background:${c};border:1px solid var(--line);margin-right:4px" title="${c}"></span>`).join('');
    $('#designOut').innerHTML=`<div class="sub">${pal}</div><p>${app._design.advice.replace(/</g,'&lt;')}</p>`+
      valid.map(v=>`<div class="sub"><b>${(v.id.startsWith('custom:')?app.customDef(v.id)?.name:v.id)||v.id}</b> ${v.note.replace(/</g,'&lt;')}</div>`).join('');
    $('#designStatus').textContent='Design ready — placing adds items, never removes.';
    $('#designPlace').hidden=false;
    if(/^#[0-9a-f]{6}$/i.test(app._design.wallColor||'')) $('#designPaint').hidden=false;
  }catch(err){
    console.warn('design fail',err);
    $('#designStatus').textContent='Error: '+String(err.message||err).slice(0,200);
  }
}
function designFreeSpot(fl,rect,x,z,w,d){
  const inside=(x,z)=>x-w/2>rect.x0+0.05&&x+w/2<rect.x1-0.05&&z-d/2>rect.z0+0.05&&z+d/2<rect.z1-0.05;
  const clear=(x,z)=>!fl.items.some(it=>{
    const dd=app.defOf(it)||{w:0.6,d:0.6};
    return Math.abs(it.x-x)<(w+ (dd.w||0.6))/2+0.25&&Math.abs(it.z-z)<(d+(dd.d||0.6))/2+0.25;
  });
  if(inside(x,z)&&clear(x,z)) return {x,z};
  for(let r=0.5;r<Math.max(rect.x1-rect.x0,rect.z1-rect.z0);r+=0.5)
    for(let a=0;a<12;a++){
      const cx2=x+Math.cos(a/12*6.283)*r, cz2=z+Math.sin(a/12*6.283)*r;
      if(inside(cx2,cz2)&&clear(cx2,cz2)) return {x:+cx2.toFixed(2),z:+cz2.toFixed(2)};
    }
  return null;
}
function applyDesignItems(){
  const dsgn=app._design;
  if(!dsgn?.items?.length){ toast('Get a design first'); return; }
  const fl=app.state.floors[app.state.activeFloor];
  const rect=dsgn.rect;
  // sanity: same floor shape as designed
  app.pushUndo();
  let placed=0, skipped=0;
  for(const s of dsgn.items){
    const def=s.id.startsWith('custom:')?app.customDef(s.id):defById(s.id);
    if(!def){ skipped++; continue; }
    if(def.wallMount||def.shelfable){ skipped++; continue; } // floor pass only; wall/shelf pieces stay suggestions
    const spot=designFreeSpot(fl,rect,dsgn.cx+s.dx,dsgn.cz+s.dz,def.w||0.6,def.d||0.6);
    if(!spot){ skipped++; continue; }
    const it={id:uid('i'),defId:s.id.startsWith('custom:')?'__custom':s.id,x:spot.x,z:spot.z,rot:0,scale:1};
    if(s.id.startsWith('custom:')) it.customId=s.id.replace(/^custom:/,'');
    fl.items.push(it); placed++;
  }
  app.resolveAll();
  saveState(app.state); app.syncAll();
  toast(placed?`Placed ${placed} item(s)${skipped?` (${skipped} skipped — no free space or wall/shelf pieces)`:''}`:'No free space for suggested items — clear a spot and retry');
  $('#designVeil').classList.remove('on');
}
function applyDesignPalette(){
  const dsgn=app._design;
  if(!dsgn?.wallColor||!/^#[0-9a-f]{6}$/i.test(dsgn.wallColor)){ toast('No valid palette color'); return; }
  const fl=app.state.floors[app.state.activeFloor];
  const walls=wallsInRect(fl,dsgn.rect);
  if(!walls.length){ toast('Room walls not found'); return; }
  if(!confirm(`Paint ${walls.length} wall(s) ${dsgn.wallColor}? Finishes are kept, color changes.`)) return;
  app.pushUndo();
  for(const w of walls) w.color=dsgn.wallColor;
  saveState(app.state); app.syncAll();
  toast('Palette applied to room walls');
}
async function draftVeraPrompt(){
  const desc=($('#veraDesc').value||'').trim();
  if(!desc&&!app.veraPhotos.length){ toast('Describe your furniture first (or add a photo)'); return; }
  const tips=$('#veraTips');
  tips.textContent='AI is drafting your Vera prompt…';
  try{
    const gen=generateOpenRouterText;
    const base='You are a 3D-model prompt engineer for EvolveLAB Veras (turns images/descriptions into textured 3D meshes). The user wants custom furniture for a home-design app (units: meters, game-ready, centered, upright, clean quad-ish topology, PBR textures, no background, no people, single object).\nUser description: '+(desc||'(see reference photos)')+'\nReturn STRICT JSON only (no markdown): {"prompt":"one rich paragraph Vera prompt: object, materials, colors, proportions in meters, style, details, studio lighting","negative":"things to avoid: text, watermark, people, extra objects, blurry, broken geometry","settings":"recommended Vera settings in one line","importTips":"one line: export as GLB under ~20MB, then import via the app\'s Upload 3D mesh"}';
    let out;
    if(app.veraPhotos.length){
      const parts=[base];
      for(const f of app.veraPhotos.slice(0,3)) parts.push(f);
      try{ out=(await analyzeBlueprintImage(app.veraPhotos[0],parts.join('\n\n'))).text; }
      catch(e){ console.warn('reference-photo analysis failed',e); throw e; }
    } else out=await gen(base);
    const raw=typeof out==='string'?out:(out?.text||out?.content||JSON.stringify(out));
    const m=String(raw).match(/\{[\s\S]*\}/);
    if(!m) throw new Error('bad AI reply');
    const j=JSON.parse(m[0]);
    $('#veraPrompt').value=String(j.prompt||'').slice(0,1200);
    $('#veraNeg').value=String(j.negative||'').slice(0,500);
    tips.textContent='Settings: '+(j.settings||'')+'\n'+(j.importTips||'Export GLB from Vera\u2019s, then use “I have the file — import it”.');
    $('#veraOut').hidden=false;
    toast('Prompt ready — copy it, generate the model, import it back');
  }catch(err){
    console.warn('vera draft fail',err);
    tips.textContent='AI drafting failed — describe it again or type your own prompt below, then open Vera\u2019s.';
    $('#veraOut').hidden=false;
  }
}
function uniqueCustomName(name){
  const taken=new Set(app.custom.map(c=>String(c.name||'').toLowerCase()));
  if(!taken.has(name.toLowerCase())) return name;
  let i=2; while(taken.has((name+' ('+i+')').toLowerCase())) i++;
  return name+' ('+i+')';
}
async function modelFileHash(file){
  const bytes=await file.arrayBuffer();
  if(globalThis.crypto?.subtle){
    const digest=await crypto.subtle.digest('SHA-256',bytes);
    return Array.from(new Uint8Array(digest)).map(x=>x.toString(16).padStart(2,'0')).join('');
  }
  return file.name.toLowerCase()+'|'+file.size+'|'+file.lastModified;
}
async function bulkUploadModels(fileList){
  const files=Array.from(fileList||[]).filter(f=>/\.(glb|gltf|obj|fbx|stl|3ds|zip)$/i.test(f.name));
  if(!files.length){ toast('Choose supported 3D files first'); return; }
  $('#uploadVeil').classList.add('on'); $('#menuVeil').classList.remove('on');
  $('#bulkMeshFiles').value='';
  let added=0, skipped=0, failed=0;
  const seen=new Set(app.custom.map(c=>c.fileHash).filter(Boolean));
  for(let i=0;i<files.length;i++){
    const file=files[i];
    try{
      setUploadStatus('<div class="spin" style="margin:8px auto"></div>Bulk upload '+(i+1)+' of '+files.length+': '+file.name.replace(/</g,'&lt;'));
      const hash=await modelFileHash(file);
      const already=app.custom.some(c=>c.fileHash===hash || (!c.fileHash&&String(c.origName||'').toLowerCase()===file.name.toLowerCase()));
      if(seen.has(hash)||already){ skipped++; continue; }
      const imp=await import('./importer.js?v=20261103e');
      const res=await imp.importModelFile(file,app.view3d.THREE,()=>{});
      const guess=imp.guessFromName(res.baseName)||{};
      const id=uid('m'), fmt=res.optimized?'glb':res.srcExt;
      const body=await persistBytes(id+'_body',res.optimized||res.originalBytes);
      const dims=res.dims||{w:1,d:1,h:1};
      const rec={id,name:uniqueCustomName(res.baseName||file.name.split('.').slice(0,-1).join('.')),fmt,
        cat:guess.cat||'decor',sub:guess.sub||'',room:guess.room||'Living room',
        desc:'Imported 3D model',w:+dims.w||1,d:+dims.d||1,h:+dims.h||1,
        rotY:0,thumb:res.thumb||null,fileHash:hash,origName:file.name,fileBytes:file.size,sx:1,sy:1,sz:1};
      Object.assign(rec,body);
      if(res.optimized){
        try{ const orig=await persistBytes(id+'_orig',res.originalBytes); rec.origFmt=res.srcExt; if(orig.dataUrl) rec.origDataUrl=orig.dataUrl; else rec.origKvKey=orig.kvKey; }catch(e){}
      }
      if(!res.optimized&&res.allFiles?.length>1){
        rec.sidecars=[]; rec.srcFile=res.srcFile;
        for(const f of res.allFiles){ try{ const p=await persistBytes(id+'_s_'+f.base.toLowerCase().replace(/[^a-z0-9._-]+/g,'_'),f.bytes); rec.sidecars.push({base:f.base,...p}); }catch(e){} }
        if(!rec.sidecars.length) delete rec.sidecars;
      }
      app.custom.push(rec); seen.add(hash); added++;
      saveCustom(app.custom);
      await app.loadCustomTemplate(rec);
    }catch(err){ failed++; console.warn('bulk model import failed',file.name,err); }
  }
  saveCustom(app.custom); app._renderGrid?.();
  setUploadStatus('Bulk upload finished: '+added+' added, '+skipped+' duplicates skipped, '+failed+' failed. Models were sorted into suggested categories. You can close this window.');
  toast(added+' models added · '+skipped+' duplicates skipped');
}
async function saveUploadReview(){
  const up=app._upload; if(!up?.res) return;
  const btn=$('#upSave'); btn.disabled=true;
  try{
    setUploadStatus('<div class="spin" style="margin:8px auto"></div>Saving to your personal catalog…');
    const name=uniqueCustomName(($('#upName').value||'').trim()||up.res.baseName);
    const w=+Math.max(0.1,+$('#upW').value||up.res.dims.w).toFixed(2);
    const d=+Math.max(0.1,+$('#upD').value||up.res.dims.d).toFixed(2);
    const h=+Math.max(0.1,+$('#upH').value||up.res.dims.h).toFixed(2);
    const id=uid('m');
    const useBytes=up.res.optimized||up.res.originalBytes;
    const fmt=up.res.optimized?'glb':up.res.srcExt;
    const body=await persistBytes(id+'_body',useBytes);
    const rec={id,name,fmt,cat:$('#upCat').value||'decor',sub:($('#upSub').value||'').slice(0,30),
      room:($('#upRoom').value||'').slice(0,30),desc:($('#upDesc').value||'').slice(0,120),
      w,d,h,rotY:+$('#upRot').value||0,thumb:up.res.thumb||null,
      sx:+(w/up.res.dims.w).toFixed(3),sy:+(h/up.res.dims.h).toFixed(3),sz:+(d/up.res.dims.d).toFixed(3)};
    Object.assign(rec,body);
    if(up.res.optimized){
      // preserve the original file alongside the optimized copy
      try{
        const o=await persistBytes(id+'_orig',up.res.originalBytes);
        rec.origFmt=up.res.srcExt; rec.origName=up.res.srcFile;
        if(o.dataUrl) rec.origDataUrl=o.dataUrl; else rec.origKvKey=o.kvKey;
      }catch(e){ console.warn('original keep fail',e); }
    } else { rec.origFmt=fmt; rec.origName=up.res.srcFile; }
    if(!up.res.optimized&&up.res.allFiles.length>1){
      // optimizer failed: preserve every supporting file so textures/materials survive
      rec.sidecars=[]; rec.srcFile=up.res.srcFile;
      for(const f of up.res.allFiles){
        try{ const p=await persistBytes(id+'_s_'+f.base.toLowerCase().replace(/[^a-z0-9._-]+/g,'_'),f.bytes); rec.sidecars.push({base:f.base,...p}); }
        catch(e){ console.warn('sidecar keep fail',f.base,e); }
      }
      if(!rec.sidecars.length) delete rec.sidecars;
    }
    const hash=await modelFileHash(up.file);
    if(app.custom.some(c=>c.fileHash===hash || (!c.fileHash&&String(c.origName||'').toLowerCase()===up.file.name.toLowerCase()))){
      toast('That model is already in My Models'); btn.disabled=false; return;
    }
    rec.fileHash=hash; rec.origName=up.file.name; rec.fileBytes=up.file.size;
    app.custom.push(rec); saveCustom(app.custom);
    await app.loadCustomTemplate(rec);
    app._renderGrid?.();
    app.pendingDef={id:'custom:'+id,cat:'custom',name:rec.name,icon:'',w:rec.w,d:rec.d,h:rec.h};
    app.tool='furniture';
    try{ refreshToolboxHighlight(); }catch(e){}
    $('#uploadVeil').classList.remove('on');
    app._upload=null;
    toast(name+' saved to My Models — tap plan to place');
    app.refreshSelPanel();
  }catch(err){
    console.warn('save upload fail',err);
    setUploadStatus('Save failed: '+String(err.message||err).replace(/</g,'&lt;'));
  }
  btn.disabled=false;
}
app.loadCustomTemplate=async function(rec){
  if(!rec||!app.view3d?.ready) return;
  if(app.view3d.templateCache.has('c:'+rec.id)) return;
  try{
    const THREE=app.view3d.THREE;
    let obj=null;
    if(rec.sidecars){
      // optimizer failed at import: rebuild from preserved original + sidecars
      const imp=await import('./importer.js?v=20261103e');
      const files=[];
      for(const s of rec.sidecars){
        const b=s.dataUrl?Uint8Array.from(atob(s.dataUrl.split(',')[1]),c=>c.charCodeAt(0)):await customBytes({kvKey:s.kvKey});
        if(b) files.push({path:s.base,base:s.base,ext:s.base.split('.').pop().toLowerCase(),bytes:b});
      }
      const primary=files.find(f=>f.base===rec.srcFile)||files.find(f=>['glb','gltf','obj','fbx'].includes(f.ext));
      if(primary) obj=await imp.loadModelFromFiles(primary,files,THREE);
    } else {
      const bytes=await customBytes(rec);
      if(!bytes) throw new Error('model data missing');
      const ab=bytes.buffer.slice(0);
      if(rec.fmt==='glb'||rec.fmt==='gltf'){
        const { GLTFLoader }=await import('https://esm.sh/three@0.160.0/examples/jsm/loaders/GLTFLoader.js');
        const loader=new GLTFLoader();
        const gltf=await new Promise((res,rej)=>loader.parse(ab,'',res,rej));
        obj=gltf.scene;
      } else if(rec.fmt==='obj'){
        const { OBJLoader }=await import('https://esm.sh/three@0.160.0/examples/jsm/loaders/OBJLoader.js');
        const txt=new TextDecoder().decode(bytes);
        obj=new OBJLoader().parse(txt);
      } else if(rec.fmt==='fbx'){
        const { FBXLoader }=await import('https://esm.sh/three@0.160.0/examples/jsm/loaders/FBXLoader.js');
        obj=new FBXLoader().parse(ab,'');
      } else if(rec.fmt==='stl'){
        const { STLLoader }=await import('https://esm.sh/three@0.160.0/examples/jsm/loaders/STLLoader.js');
        const geo=new STLLoader().parse(ab);
        geo.computeVertexNormals();
        obj=new THREE.Group();
        obj.add(new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color:0xbfae94,roughness:0.8})));
      } else if(rec.fmt==='3ds'){
        const { TDSLoader }=await import('https://esm.sh/three@0.160.0/examples/jsm/loaders/TDSLoader.js');
        obj=new TDSLoader().parse(ab,'');
      }
    }
    if(obj){
      // normalize: center + footprint
      const box=new THREE.Box3().setFromObject(obj);
      const size=new THREE.Vector3(); box.getSize(size);
      const ctr=new THREE.Vector3(); box.getCenter(ctr);
      obj.position.sub(ctr); obj.position.y+=size.y/2;
      // auto-scale if absurd (>8m) down to 2m max dim
      const maxDim=Math.max(size.x,size.y,size.z);
      if(maxDim>8){ const s=2/maxDim; obj.scale.setScalar(s); size.multiplyScalar(s); }
      if(!rec.w||!rec.d||!rec.h){ rec.w=+Math.max(0.3,size.x).toFixed(2); rec.d=+Math.max(0.3,size.z).toFixed(2); rec.h=+Math.max(0.2,size.y).toFixed(2); saveCustom(app.custom); }
      app.view3d.templateCache.set('c:'+rec.id,obj);
      app.view3d.rebuild();
    }
  }catch(e){ console.warn('custom load fail',e); toast('Could not load model (try .glb, .zip, or .fbx)'); }
};

// ---------- design assistant (chat panel + shortcuts into existing AI tools) ----------
function asAdd(who,html,plain){
  const m=$('#asMsgs'); if(!m) return null;
  const d=document.createElement('div'); d.className='asMsg '+who;
  if(who==='ai'&&!plain) d.innerHTML=html; else d.textContent=html;
  m.appendChild(d); m.scrollTop=m.scrollHeight; return d;
}
function asHello(){
  asAdd('ai','I can answer questions about your design, or open a tool. Try a shortcut below.');
  const c=$('#asChips'); if(!c||c.children.length) return;
  const items=[
    ['house','Describe a house',()=>$('#aiBtn').click()],
    ['armchair','Design this room',()=>$('#designBtn').click()],
    ['palette','Create furniture',()=>$('#veraBtn').click()],
    ['message-circle','Building tips',()=>{ const i=$('#asInput'); i.value='How do I build walls, place doors, and furnish a room?'; i.focus(); asAsk(); }],
  ];
  for(const it of items){ const b=document.createElement('button'); b.innerHTML=icon(it[0])+'<span></span>'; b.lastChild.textContent=it[1]; b.onclick=()=>{ $('#asPanel').classList.remove('on'); $('#asBtn').classList.remove('on'); it[2](); }; c.appendChild(b); }
}
async function asAsk(){
  const inp=$('#asInput'); const q=(inp.value||'').trim(); if(!q) return; inp.value='';
  asAdd('me',q,true);
  const typing=asAdd('ai','<span class="typingDots"><span></span><span></span><span></span></span>');
  const btn=$('#asSend'); if(btn) btn.disabled=true;
  try{
    const st=app.state, fl=st.floors[st.activeFloor]||{};
    const ctx='House "'+app.projectName()+'": '+st.floors.length+' floor(s). Current floor "'+(fl.name||'')+'": '+(fl.walls||[]).length+' walls, '+(fl.openings||[]).length+' openings, '+(fl.items||[]).length+' furniture items, '+((fl.zones||[]).length)+' surfaces, '+((fl.pools||[]).length)+' pools.';
    const gen=generateOpenRouterText;
    const ans=await gen({instruction:'You are the HomeCraft 3D in-app design assistant. Answer briefly (2-5 sentences, plain text, no emoji). App context: '+ctx+'\nUser question: '+q});
    typing.textContent=String((ans&&ans.text)||ans||'');
  }catch(e){ typing.textContent='The assistant is unavailable right now. Try Room AI Designer or Help in the menu.'; }
  if(btn) btn.disabled=false;
}

// Google Sign-In & Profile UI handling
function initGoogleAuthUI(){
  const loggedOutBlock = $('#settingsGoogleLoggedOut');
  const loggedInBlock = $('#settingsGoogleLoggedIn');
  const nameEl = $('#settingsUserName');
  const emailEl = $('#settingsUserEmail');
  const avatarEl = $('#settingsUserAvatar');
  const signOutBtn = $('#settingsSignOutBtn');
  const signInBtn = $('#settingsSignInBtn');
  const autoGoogleBtn = $('#autoLoginGoogleBtn');
  const autoGuestBtn = $('#autoLoginGuestBtn');

  function updateSettingsUI(user){
    if(user && user.email){
      if(loggedOutBlock) loggedOutBlock.style.display = 'none';
      if(loggedInBlock) loggedInBlock.style.display = 'flex';
      if(nameEl) nameEl.textContent = user.name || user.email;
      if(emailEl) emailEl.textContent = user.email;
      if(avatarEl){
        if(user.picture){
          avatarEl.src = user.picture;
          avatarEl.style.display = 'block';
        } else {
          avatarEl.style.display = 'none';
        }
      }
    } else {
      if(loggedOutBlock) loggedOutBlock.style.display = 'flex';
      if(loggedInBlock) loggedInBlock.style.display = 'none';
    }
    refreshIcons();
  }

  googleAuth.onAuth(updateSettingsUI);

  // Settings Log out button
  if(signOutBtn){
    signOutBtn.onclick = async ()=>{
      const u = googleAuth.getUser();
      if(confirm(`Are you sure you want to log out from ${u?.email || 'your Google account'}?`)){
        await googleAuth.signOut();
        toast('Logged out from Google account');
        updateSettingsUI(null);
      }
    };
  }

  // Settings Sign in button
  if(signInBtn){
    signInBtn.onclick = async ()=>{
      toast('Opening Google Sign-In…');
      try {
        const u = await googleAuth.signIn();
        toast(`Signed in as ${u.name || u.email}`);
      } catch(err) {
        if(String(err?.message||err).includes('cancelled')){
          toast('Sign-in cancelled');
        } else {
          toast(`Sign-in error: ${err.message||err}`);
        }
      }
    };
  }

  // Auto-login prompt buttons
  if(autoGoogleBtn){
    autoGoogleBtn.onclick = async ()=>{
      toast('Opening Google Sign-In…');
      try {
        const u = await googleAuth.signIn();
        $('#autoLoginVeil').classList.remove('on');
        toast(`Welcome, ${u.name || u.email}!`);
      } catch(err) {
        if(String(err?.message||err).includes('cancelled')){
          toast('Sign-in cancelled');
        } else {
          toast(`Sign-in error: ${err.message||err}`);
        }
      }
    };
  }

  if(autoGuestBtn){
    autoGuestBtn.onclick = ()=>{
      $('#autoLoginVeil').classList.remove('on');
      sessionStorage.setItem('h3d_guest_choice', '1');
      toast('Continuing as guest (offline mode)');
    };
  }

  // Automatically ask the user to log in if not signed in
  const savedUser = googleAuth.getUser();
  if(!savedUser && !sessionStorage.getItem('h3d_guest_choice')){
    setTimeout(()=>{
      if(!googleAuth.getUser()){
        $('#autoLoginVeil').classList.add('on');
      }
    }, 280);
  }
}

// wire UI
function wire(){
  const topUndo=$('#undoBtnTop'), floatUndo=$('#floatingUndoBtn');
  const topRedo=$('#redoBtnTop'), floatRedo=$('#floatingRedoBtn');

  function triggerUndo(e){
    if(e){ e.preventDefault(); e.stopPropagation(); }
    app.doUndo();
  }
  function triggerRedo(e){
    if(e){ e.preventDefault(); e.stopPropagation(); }
    app.doRedo();
  }

  for(const btn of [topUndo, floatUndo]){
    if(!btn) continue;
    btn.style.pointerEvents = 'auto';
    btn.addEventListener('click', triggerUndo);
    btn.addEventListener('pointerdown', (e) => {
      btn.style.transform = 'scale(0.86)';
      setTimeout(() => { btn.style.transform = ''; }, 140);
    });
  }

  for(const btn of [topRedo, floatRedo]){
    if(!btn) continue;
    btn.style.pointerEvents = 'auto';
    btn.addEventListener('click', triggerRedo);
    btn.addEventListener('pointerdown', (e) => {
      btn.style.transform = 'scale(0.86)';
      setTimeout(() => { btn.style.transform = ''; }, 140);
    });
  }

  // Draggable floating dock
  const dock = $('#floatingUndoRedo');
  if(dock){
    let isDragging = false, startX = 0, startY = 0, origLeft = 0, origTop = 0, moved = false;
    dock.addEventListener('pointerdown', (e) => {
      if(e.target.closest('button')) return; // buttons tap cleanly
      isDragging = true; moved = false;
      startX = e.clientX; startY = e.clientY;
      const r = dock.getBoundingClientRect();
      origLeft = r.left; origTop = r.top;
      try{ dock.setPointerCapture(e.pointerId); }catch(_){}
    });
    dock.addEventListener('pointermove', (e) => {
      if(!isDragging) return;
      const dx = e.clientX - startX, dy = e.clientY - startY;
      if(Math.hypot(dx, dy) > 4) moved = true;
      if(moved){
        dock.style.left = Math.max(10, Math.min(window.innerWidth - 86, origLeft + dx)) + 'px';
        dock.style.top = Math.max(10, Math.min(window.innerHeight - 48, origTop + dy)) + 'px';
        dock.style.right = 'auto'; dock.style.bottom = 'auto';
      }
    });
    const stopDrag = (e) => {
      if(isDragging){
        isDragging = false;
        try{ dock.releasePointerCapture(e.pointerId); }catch(_){}
      }
    };
    dock.addEventListener('pointerup', stopDrag);
    dock.addEventListener('pointercancel', stopDrag);
  }

  const texB=$('#drawerTexBtn'); if(texB) texB.onclick=()=>openDrawer('Tex');
  const texC=$('#drawerTexClose'); if(texC) texC.onclick=()=>openDrawer('Tex',false);
  const texS=$('#drawerTexSearch'); if(texS) texS.oninput=()=>renderTextureStudioDrawer();
  document.querySelectorAll('#texChipsBar .fchip').forEach(chip=>{
    chip.onclick=()=>{
      document.querySelectorAll('#texChipsBar .fchip').forEach(c=>c.classList.remove('on'));
      chip.classList.add('on');
      renderTextureStudioDrawer();
    };
  });
  const atDone=$('#activeTexDone'); if(atDone) atDone.onclick=()=>{ app.activeTexture=null; const h=$('#activeTexHUD'); if(h) h.hidden=true; };
  const atScope=$('#activeTexScope'); if(atScope) atScope.onchange=e=>{ app._finishScope=e.target.value; };

  $('#drawerLBtn').onclick=()=>openDrawer('L');
  $('#drawerRBtn').onclick=()=>openDrawer('R');
  $('#mode2dBtn').onclick=()=>setMode('2d');
  $('#mode3dBtn').onclick=()=>setMode('3d');
  const ambBtn=$('#ambienceBtn');
  if(ambBtn){
    ambBtn.onclick=()=>{
      const isPlaying=sound.toggleAmbience();
      ambBtn.classList.toggle('on', isPlaying);
      toast(isPlaying?'Soothing ambience active (summer breeze & warmth)':'Soothing ambience paused');
    };
  }
  $('#floorSel').onchange=e=>{ sound.playFloorWhoosh(); app.state.activeFloor=+e.target.value; app.select(null); app.view2d.draft=[]; saveState(app.state); app.syncAll(); };
  $('#floorAddBtn').onclick=()=>addFloor();
  $('#addFloorBtn').onclick=()=>addFloor();
  $('#floorMenuBtn').onclick=()=>{ renderFloorList(); $('#floorVeil').classList.add('on'); };
  $('#closeFloorBtn').onclick=()=>$('#floorVeil').classList.remove('on');
  $('#dupFloorBtn').onclick=()=>{
    sound.playFloorWhoosh();
    app.pushUndo();
    const src=app.curFloor();
    const cp=JSON.parse(JSON.stringify(src)); cp.id=uid('f'); cp.name=src.name+' copy';
    cp.walls.forEach(w=>{ const old=w.id; w.id=uid('w'); cp.openings.filter(o=>o.wallId===old).forEach(o=>o.wallId=w.id); });
    cp.openings.forEach(o=>o.id=uid('o')); cp.items.forEach(i=>i.id=uid('i'));
    app.state.floors.splice(app.state.activeFloor+1,0,cp);
    app.state.activeFloor++; saveState(app.state); app.syncAll(); toast('Duplicated as '+cp.name);
  };
  $('#menuBtn').onclick=()=>{ app.renderProjects(); $('#menuVeil').classList.add('on'); };
  $('#aiBtn').onclick=async ()=>{
    $('#menuVeil').classList.remove('on');
    toast('Loading AI builder…');
    try{
      const m=await import('./blueprint.js');
      if(!app.aiBuilder) app.aiBuilder=new m.AIBuilder(app);
      app.aiBuilder.open();
    }catch(err){ console.warn(err); toast('AI builder failed to load'); }
  };
  $('#aiCloseBtn').onclick=()=>$('#aiVeil').classList.remove('on');
  $('#drawerLSearch').oninput=e=>{ app._qb=e.target.value; app._renderGrid&&app._renderGrid(); };
  $('#drawerRSearch').oninput=e=>{ app._q=e.target.value; app._renderGrid&&app._renderGrid(); };
  const saveBtnTop=$('#saveBtnTop'); if(saveBtnTop) saveBtnTop.onclick=()=>$('#saveBtn').click();
  $('#asBtn').onclick=()=>{ const p=$('#asPanel'); const on=!p.classList.contains('on'); p.classList.toggle('on',on); $('#asBtn').classList.toggle('on',on); if(on&&!$('#asMsgs').children.length) asHello(); };
  $('#asClose').onclick=()=>{ $('#asPanel').classList.remove('on'); $('#asBtn').classList.remove('on'); };
  $('#asForm').onsubmit=e=>{ e.preventDefault(); asAsk(); };
  $('#drawerLSearch').value=app._qb||''; $('#drawerRSearch').value=app._q||'';
  for(const ff of [['fBAll',null],['fBOut','outdoor'],['fBTex','textures']]){ const fb=$('#'+ff[0]); if(fb) fb.onclick=()=>{ app._catL=ff[1]; app._renderGrid&&app._renderGrid(); }; }
  for(const ff of [['fAll','all'],['fWall','wall'],['fShelf','shelf']]){ const fb=$('#'+ff[0]); if(fb) fb.onclick=()=>{ app._f=ff[1]; for(const gg of [['fAll','all'],['fWall','wall'],['fShelf','shelf']]){ const el2=$('#'+gg[0]); if(el2) el2.classList.toggle('on',gg[1]===ff[1]); } app._renderGrid&&app._renderGrid(); }; }
  $('#focusBtn').onclick=()=>app.setFocus(true);
  $('#exitFocusBtn').onclick=()=>app.setFocus(false);
  $('#focusCatBtn').onclick=()=>{ app.setFocus(false); openDrawer('L',true); };
  $('#drawerLClose').onclick=()=>openDrawer('L',false);
  $('#drawerRClose').onclick=()=>openDrawer('R',false);
  document.querySelector('#views').addEventListener('pointerdown',e=>{ if(e.target&&e.target.tagName==='CANVAS'){ openDrawer('L',false); openDrawer('R',false); openDrawer('Tex',false); } });
  $('#closeSettingsBtn').onclick=()=>$('#settingsVeil').classList.remove('on');
  window.matchMedia?.('(orientation: landscape)').addEventListener?.('change',()=>app.applyLayout());
  $('#closeMenuBtn').onclick=()=>$('#menuVeil').classList.remove('on');
  $('#helpBtn').onclick=()=>{ $('#menuVeil').classList.remove('on'); $('#helpVeil').classList.add('on'); };
  $('#closeHelpBtn').onclick=()=>$('#helpVeil').classList.remove('on');
  $('#zoomInBtn').onclick=()=>app.view2d.zoom(1.25);
  $('#zoomOutBtn').onclick=()=>app.view2d.zoom(0.8);
  $('#fitBtn').onclick=()=>app.view2d.fit();
  $('#gridBtn').onclick=e=>{ app.view2d.showGrid=!app.view2d.showGrid; e.currentTarget.classList.toggle('on',!app.view2d.showGrid); app.view2d.request(); };
  $('#orbitBtn').onclick=()=>{ app.view3d.setPreset('orbit'); $('#orbitBtn').classList.add('on'); $('#walkBtn').classList.remove('on'); $('#walkStick').classList.remove('on'); };
  $('#walkBtn').onclick=()=>{ app.view3d.setPreset('walk'); $('#walkBtn').classList.add('on'); $('#orbitBtn').classList.remove('on'); $('#walkStick').classList.add('on'); toast('Walk: joystick to move, drag to look, WASD on desktop'); };
  $('#topBtn').onclick=()=>{ app.view3d.setPreset('top'); $('#orbitBtn').classList.add('on'); $('#walkBtn').classList.remove('on'); $('#walkStick').classList.remove('on'); toast('Top view — ceilings & roof hidden'); };
  $('#dollBtn').onclick=()=>{ app.view3d.setPreset('dollhouse'); $('#orbitBtn').classList.add('on'); $('#walkBtn').classList.remove('on'); $('#walkStick').classList.remove('on'); toast('Dollhouse view'); };
  $('#extBtn').onclick=()=>{ app.view3d.setPreset('exterior'); $('#orbitBtn').classList.add('on'); $('#walkBtn').classList.remove('on'); $('#walkStick').classList.remove('on'); toast('Exterior view'); };
  $('#layersBtn').onclick=e=>{ app.view3d.showAll=!app.view3d.showAll; app.view3d.setShowAll(app.view3d.showAll); e.currentTarget.classList.toggle('on',!app.view3d.showAll); toast(app.view3d.showAll?'Showing all floors':'Current floor only'); };
  $('#shadeBtn').onclick=e=>{ const v=!app.view3d.shadows; app.view3d.setShadows(v); e.currentTarget.classList.toggle('on',v); };
  $('#saveBtn').onclick=()=>{ saveState(app.state); saveCustom(app.custom); $('#saveState').textContent='Saved '+new Date().toLocaleTimeString(); toast('Saved on this device'); };
  try{ initDrive(app,toast); }catch(e){ console.warn('drive init failed',e); }
  try{ initDropbox(app,toast); }catch(e){ console.warn('dropbox init failed',e); }
  try{ initBackendUI(app,toast); }catch(e){ console.warn('backend init failed',e); }
  $('#exportBtn').onclick=()=>{
    const blob=new Blob([JSON.stringify({state:app.state,customMeta:app.custom.map(c=>({...c,dataUrl:c.dataUrl.slice(0,64)+'…'}))},null,1)],{type:'application/json'});
    // full export with meshes:
    const full=new Blob([JSON.stringify({state:app.state,custom:app.custom})],{type:'application/json'});
    const a=document.createElement('a'); a.href=URL.createObjectURL(full); a.download='homecraft-house.json'; a.click();
    setTimeout(()=>URL.revokeObjectURL(a.href),4000);
  };
  $('#importBtn').onclick=()=>$('#importFile').click();
  $('#importFile').onchange=async e=>{
    const f=e.target.files[0]; if(!f) return;
    try{ const j=JSON.parse(await f.text()); if(j.state&&j.state.floors){ app.pushUndo(); normalizeState(j.state); app.state=j.state; if(j.custom) { app.custom=j.custom; saveCustom(app.custom);} saveState(app.state); app.syncAll(); toast('House imported'); } else toast('Not a HomeCraft file'); }
    catch(err){ toast('Import failed'); }
    e.target.value='';
  };
  $('#shotBtn').onclick=()=>{
    $('#menuVeil').classList.remove('on');
    if(app.mode==='3d'){ const url=app.view3d.screenshot(); if(url){ const a=document.createElement('a'); a.href=url; a.download='homecraft-3d.png'; a.click(); } }
    else { const url=app.view2d.cv.toDataURL('image/png'); const a=document.createElement('a'); a.href=url; a.download='homecraft-plan.png'; a.click(); }
  };
  $('#uploadBtn').onclick=()=>$('#meshFile').click();
  $('#lockAllBtn').onclick=()=>{ let n=0; for(const f of app.state.floors) for(const w of f.walls){ if(!w.locked){ w.locked=true; n++; } }
    saveState(app.state); app.syncAll(); toast(n?`Locked ${n} wall${n>1?'s':''} on all floors`:'Already all locked'); };
  $('#unlockAllBtn').onclick=()=>{ let n=0; for(const f of app.state.floors) for(const w of f.walls){ if(w.locked){ delete w.locked; n++; } }
    saveState(app.state); app.syncAll(); toast(n?`Unlocked ${n} wall${n>1?'s':''}`:'Nothing locked'); };  $('#meshFile').onchange=e=>{ handleMeshFile(e.target.files[0]); e.target.value=''; };
  // upload review modal
  { const sel=$('#upCat');
    if(sel&&!sel.options.length){ import('./catalog.js').then(m=>{ for(const c of m.CATEGORIES){ if(c.id==='custom') continue; const o=document.createElement('option'); o.value=c.id; o.textContent=c.name; sel.appendChild(o); } sel.value='decor'; }); } }
  for(const id of ['upName','upSub','upRoom']) $('#'+id).addEventListener('input',e=>{ e.target.dataset.touched='1'; });
  $('#upAI').onclick=()=>aiIdentifyUpload(false);
  $('#upCancel').onclick=()=>{ app._upload=null; $('#uploadVeil').classList.remove('on'); };
  const bulkBtn=$('#upBulkBtn'), bulkInput=$('#bulkMeshFiles');
  if(bulkBtn&&bulkInput){ bulkBtn.onclick=()=>bulkInput.click(); bulkInput.onchange=e=>{ if(e.target.files?.length) bulkUploadModels(e.target.files); }; }
  $('#upSave').onclick=saveUploadReview;
  // ---- Room AI designer ----
  $('#designBtn').onclick=()=>{ $('#menuVeil').classList.remove('on'); refreshDesignRoom(); $('#designVeil').classList.add('on'); };
  $('#designClose').onclick=()=>$('#designVeil').classList.remove('on');
  $('#designGo').onclick=draftRoomDesign;
  $('#designPlace').onclick=applyDesignItems;
  $('#designPaint').onclick=applyDesignPalette;
  // ---- AI furniture creator (Vera's workflow) ----
  $('#veraBtn').onclick=()=>{ $('#menuVeil').classList.remove('on'); $('#veraVeil').classList.add('on'); };
  $('#veraClose').onclick=()=>$('#veraVeil').classList.remove('on');
  $('#veraPhotosBtn').onclick=()=>$('#veraFiles').click();
  $('#veraFiles').onchange=e=>{
    for(const f of e.target.files){
      if(app.veraPhotos.length>=3){ toast('Up to 3 reference photos'); break; }
      if(!f.type.startsWith('image/')) continue;
      app.veraPhotos.push(f);
    }
    e.target.value='';
    $('#veraPhotoN').textContent=app.veraPhotos.length?app.veraPhotos.length+' photo(s) attached':'';
    const th=$('#veraThumbs'); th.innerHTML='';
    for(const f of app.veraPhotos){
      const img=document.createElement('img');
      img.src=URL.createObjectURL(f);
      img.style.cssText='width:64px;height:64px;object-fit:cover;border-radius:8px;border:1px solid var(--line)';
      th.appendChild(img);
    }
  };
  $('#veraDraft').onclick=draftVeraPrompt;
  const copyTxt=(id,what)=>{ const t=$('#'+id).value||''; if(!t){ toast('Nothing to copy yet'); return; }
    if(navigator.clipboard?.writeText) navigator.clipboard.writeText(t).then(()=>toast(what+' copied — paste it into Vera\u2019s')).catch(()=>toast('Copy failed — long-press to copy'));
    else toast('Long-press the text to copy'); };
  $('#veraCopyP').onclick=()=>copyTxt('veraPrompt','Prompt');
  $('#veraCopyN').onclick=()=>copyTxt('veraNeg','Negative prompt');
  $('#veraGo').onclick=()=>window.open('https://veras.evolvelab.io','_blank');
  $('#veraBack').onclick=()=>{ $('#veraVeil').classList.remove('on'); $('#meshFile').click(); };
  $('#newHouseBtn').onclick=()=>{ if(!confirm('Create a new empty house project? Your current house stays saved.'))return; app.newProject('blank'); };
  // OpenRouter model preference is stored on this device and used by blueprint AI calls.
  const aiModelSel=$('#openRouterModelSel'), aiModelStatus=$('#openRouterModelStatus'), aiModelTest=$('#openRouterTestBtn');
  if(aiModelSel){
    aiModelSel.innerHTML='<option value="'+getBlueprintModel()+'">Loading free models…</option>';
    fetchOpenRouterModels().then(models=>{
      aiModelSel.innerHTML=models.map(m=>'<option value="'+m.id+'">'+m.label+' · Free</option>').join('');
      aiModelSel.value=getBlueprintModel();
      if(!models.some(m=>m.id===aiModelSel.value)){ const opt=document.createElement('option'); opt.value=getBlueprintModel(); opt.textContent=getBlueprintModel()+' · Saved selection'; aiModelSel.prepend(opt); }
      if(aiModelStatus) aiModelStatus.textContent=models.length+' free OpenRouter models loaded. Selected model is used by HomeCraft AI text tools and blueprint analysis.';
    }).catch(err=>{ if(aiModelStatus) aiModelStatus.textContent='Could not load model list: '+String(err.message||err); });
    aiModelSel.onchange=()=>{
      const selected=setBlueprintModel(aiModelSel.value);
      if(aiModelStatus) aiModelStatus.textContent='Saved. New HomeCraft AI requests will use '+(OPENROUTER_MODELS.find(m=>m.id===selected)?.label||selected)+'.';
      toast('OpenRouter model saved');
    };
  }
  if(aiModelTest) aiModelTest.onclick=async()=>{
    aiModelTest.disabled=true; aiModelTest.textContent='Testing…';
    if(aiModelStatus) aiModelStatus.textContent='Checking the selected model through your secure Supabase connection…';
    try{
      const result=await testOpenRouterConnection(aiModelSel?.value||getBlueprintModel());
      if(aiModelStatus) aiModelStatus.textContent='Connected. Model replied successfully: '+(result.model||getBlueprintModel());
      toast('OpenRouter connection works');
    }catch(err){
      if(aiModelStatus) aiModelStatus.textContent='Test failed: '+String(err.message||err).slice(0,220);
      toast('OpenRouter test failed');
    }finally{ aiModelTest.disabled=false; aiModelTest.textContent='Test selected model'; }
  };

  $('#demoHouseBtn').onclick=()=>{ if(!confirm('Create a demo villa project? Your current house stays saved.'))return; app.newProject('demo'); };
  $('#snapSel').onchange=e=>{ app.state.settings.snap=+e.target.value; $('#snapVal').textContent=Math.round(app.state.settings.snap*100)+'cm'; queueSave(); };
  const snap2=$('#snapSel2'); if(snap2){ snap2.value=String(app.state.settings.snap||0.25); snap2.onchange=e=>{ app.state.settings.snap=+e.target.value; $('#snapSel').value=e.target.value; $('#snapVal').textContent=Math.round(app.state.settings.snap*100)+'cm'; queueSave(); }; }
  const wh2=$('#wallHInput2'); if(wh2){ wh2.value=app.state.settings.wallHeightDefault; wh2.onchange=e=>{ app.state.settings.wallHeightDefault=+e.target.value||2.7; app.curFloor().wallHeight=+e.target.value||2.7; app.fitStairs(); $('#wallHInput').value=e.target.value; queueSave(); app.view3d.rebuild(); }; }
  const wt2=$('#wallTInput2'); if(wt2){ wt2.value=app.state.settings.wallThickness; wt2.onchange=e=>{ app.state.settings.wallThickness=+e.target.value||0.15; $('#wallTInput').value=e.target.value; queueSave(); }; }
  const qS=$('#qSel'), lS=$('#lightSel'), bR=$('#brightR'), wR=$('#warmR'), shS=$('#shadSel'), rfS=$('#roofSel');
  const gfx=()=>{ const s=app.state.settings;
    if(qS) qS.value=s.quality||'medium';
    if(lS) lS.value=s.lighting||'day';
    if(bR) bR.value=s.brightness??1;
    if(wR) wR.value=s.warmth??0.35;
    if(shS) shS.value=(s.shadows??false)?'on':'off';
    const aQ2=$('#autoQSel'); if(aQ2) aQ2.value=(s.autoQuality===false)?'off':'on';
    if(rfS){ let top=null; for(let i=app.state.floors.length-1;i>=0;i--) if(app.state.floors[i].walls.length){ top=app.state.floors[i]; break; } rfS.value=(top?.roof?.on===false)?'off':'on'; }
  };
  app.syncSettingsUI=gfx;
  if(qS) qS.onchange=e=>{ const s=app.state.settings; s.quality=e.target.value; app.view3d.effQ=null; import('./mats.js').then(M=>{ s.shadows=M.QUALITY[s.quality]?.sunShadow??s.shadows; if(shS) shS.value=s.shadows?'on':'off'; }).catch(()=>{}); queueSave(); app.view3d.applyGraphics(); app.view3d.rebuild(); toast('Quality: '+e.target.value); };
  const aQ=$('#autoQSel'); if(aQ){ aQ.value=(app.state.settings.autoQuality===false)?'off':'on'; aQ.onchange=e=>{ app.state.settings.autoQuality=e.target.value==='on'; queueSave(); toast('Auto quality: '+e.target.value); }; }
  if(lS) lS.onchange=e=>{ app.state.settings.lighting=e.target.value; queueSave(); app.view3d.applyGraphics(); };
  if(bR) bR.oninput=e=>{ app.state.settings.brightness=+e.target.value; app.view3d.applyGraphics(); };
  if(bR) bR.onchange=()=>queueSave();
  if(wR) wR.oninput=e=>{ app.state.settings.warmth=+e.target.value; app.view3d.applyGraphics(); };
  if(wR) wR.onchange=()=>queueSave();
  if(shS) shS.onchange=e=>{ app.view3d.setShadows(e.target.value==='on'); };
  if(rfS) rfS.onchange=e=>{ const on=e.target.value==='on'; for(let i=app.state.floors.length-1;i>=0;i--){ const fl=app.state.floors[i]; if(fl.walls.length){ fl.roof=fl.roof||{}; fl.roof.on=on; break; } } app.pushUndo(); queueSave(); app.view3d.rebuild(); };
  const bpV=$('#bpVis'), bpO=$('#bpOp');
  app.syncBpUI=()=>{ const bp=app.state.blueprint;
    if(bpV) bpV.value=(bp&&bp.visible===false)?'off':'on';
    if(bpO) bpO.value=bp?.opacity??0.55;
  };
  if(bpV) bpV.onchange=e=>{ if(!app.state.blueprint){ toast('No plan uploaded yet — open Menu, AI House Builder'); return; } app.state.blueprint.visible=e.target.value==='on'; queueSave(); app.view2d.request(); };
  if(bpO) bpO.oninput=e=>{ if(app.state.blueprint){ app.state.blueprint.opacity=+e.target.value; app.view2d.request(); } };
  if(bpO) bpO.onchange=()=>queueSave();
  $('#wallHInput').onchange=e=>{ app.state.settings.wallHeightDefault=+e.target.value||2.7; app.curFloor().wallHeight=+e.target.value||2.7; app.fitStairs(); queueSave(); app.view3d.rebuild(); };
  $('#wallTInput').onchange=e=>{ app.state.settings.wallThickness=+e.target.value||0.15; queueSave(); };
  $('#slabW').onchange=e=>{ app.curFloor().slab.w=Math.max(4,+e.target.value||12); queueSave(); app.view2d.request(); app.view3d.rebuild(); };
  $('#slabD').onchange=e=>{ app.curFloor().slab.d=Math.max(4,+e.target.value||10); queueSave(); app.view2d.request(); app.view3d.rebuild(); };
  $('#fitSlabBtn').onclick=()=>{
    app.pushUndo();
    const fl=app.curFloor();
    let x0=1e9,x1=-1e9,z0=1e9,z1=-1e9;
    for(const w of fl.walls){ x0=Math.min(x0,w.x1,w.x2); x1=Math.max(x1,w.x1,w.x2); z0=Math.min(z0,w.z1,w.z2); z1=Math.max(z1,w.z1,w.z2); }
    if(x0>x1){ toast('Draw some walls first'); return; }
    const m=1.2; // margin
    fl.slab.w=+Math.max(4,(x1-x0)+m*2).toFixed(1);
    fl.slab.d=+Math.max(4,(z1-z0)+m*2).toFixed(1);
    fl.slab.cx=+((x0+x1)/2).toFixed(2); fl.slab.cz=+((z0+z1)/2).toFixed(2);
    saveState(app.state); app.syncAll(); toast('Slab fitted: '+fl.slab.w+'×'+fl.slab.d+'m');
  };
  // joystick
  const stick=$('#walkStick'),knob=$('#stickKnob');
  let sj=null;
  const setKnob=(dx,dy)=>{ knob.style.transform=`translate(${dx}px,${dy}px)`; };
  stick.addEventListener('pointerdown',e=>{ sj={id:e.pointerId,cx:e.clientX,cy:e.clientY}; stick.setPointerCapture(e.pointerId); });
  stick.addEventListener('pointermove',e=>{
    if(!sj||e.pointerId!==sj.id) return;
    let dx=e.clientX-sj.cx,dy=e.clientY-sj.cy;
    const m=Math.hypot(dx,dy),max=34;
    if(m>max){ dx*=max/m; dy*=max/m; }
    setKnob(dx,dy);
    app.view3d.walk.joy.x=dx/max; app.view3d.walk.joy.y=dy/max;
  });
  const endJ=e=>{ if(sj&&e.pointerId===sj.id){ sj=null; setKnob(0,0); app.view3d.walk.joy.x=0; app.view3d.walk.joy.y=0; } };
  stick.addEventListener('pointerup',endJ); stick.addEventListener('pointercancel',endJ);
  // veils close on backdrop tap
  document.querySelectorAll('.veil').forEach(v=>v.addEventListener('pointerdown',e=>{ if(e.target===v) v.classList.remove('on'); }));
}
function addFloor(){
  sound.playFloorWhoosh();
  app.pushUndo();
  const idx=app.state.floors.length;
  const nf=defaultFloor(idx===0?'Ground Floor':`Floor ${idx+1}`,idx);
  nf.slab={...(app.state.floors[idx-1]?.slab||{w:12,d:10,cx:0,cz:0,thick:0.25})};
  nf.wallHeight=app.state.settings.wallHeightDefault||2.7;
  // copy outer walls footprint as starter
  const prev=app.state.floors[idx-1];
  if(prev){ nf.walls=prev.walls.map(w=>({...w,id:uid('w')})); }
  app.state.floors.push(nf); app.state.activeFloor=idx;
  app.fitStairs();
  saveState(app.state); app.syncAll(); toast(nf.name+' added');
}
async function setMode(m){
  if(app.mode!==m) sound.playFloorWhoosh();
  app.mode=m;
  $('#mode2dBtn').classList.toggle('on',m==='2d');
  $('#mode3dBtn').classList.toggle('on',m==='3d');
  $('#view2dWrap').hidden=m!=='2d';
  $('#view3dWrap').hidden=m!=='3d';
  if(m==='3d'){
    if(!app.view3d.ready && app.ensure3D) await app.ensure3D();
    if(app.view3d.ready){ app.view3d.resize(); app.view3d.rebuild(); }
  }
  else app.view2d.resize();
}

// ---------- init ----------
async function boot(){
  buildTools(); buildTabs(); wire(); initGoogleAuthUI(); refreshIcons();
  app.updateUndoRedoUI();
  try{ const dl=localStorage.getItem('hc.drawerL'), dr=localStorage.getItem('hc.drawerR'); openDrawer('L',dl==null?window.innerWidth>900:dl==='1'); openDrawer('R',dr==='1'); }catch(e){ openDrawer('L',window.innerWidth>900); }
  renderFloorSel(); renderFloorList();
  $('#snapVal').textContent=Math.round((app.state.settings.snap||0.25)*100)+'cm';
  $('#snapSel').value=String(app.state.settings.snap||0.25);
  app.view2d=new View2D($('#planCanvas'),app);
  app.view2d.fit();
  app.resolveAll(); // recompute wall/shelf attachments for older saves
  if(app.fitStairs(true)) saveState(app.state); // size stairs saved before auto-rise existed
  app.view3d=new View3D($('#gl'),app);
  app.view3d.showAll=app.state.settings.showAll3D!==false;
  app.applyLayout();

  app._renderGrid?.();
  try{ app.matStudio=new MaterialStudio(app); app.matStudio.init(); }catch(e){ console.warn('studio init fail',e); }

  // Instant app boot: hide loader immediately so 2D plan is usable instantly
  const bootEl = $('#boot');
  if(bootEl) bootEl.style.display='none';
  app.refreshSelPanel();

  // Defer the heavy WebGL renderer, environment map and 3D asset setup
  // until the user first opens 3D mode. The 2D builder is ready immediately.
  app._init3DPromise = null;
  app.ensure3D = () => {
    if(app.view3d.ready) return Promise.resolve();
    if(!app._init3DPromise){
      app._init3DPromise = (async()=>{
        try{
          await app.view3d.init(m=>{});
          for(const c of app.custom){ try{ await app.loadCustomTemplate(c); }catch(e){} }
        }catch(e){
          console.warn('3D initialization note',e);
          app._init3DPromise = null;
          toast('3D view could not load. Check your connection and try again.');
        }
      })();
    }
    return app._init3DPromise;
  };

  window.addEventListener('resize',()=>{ app.view2d.resize(); app.view3d.resize(); });
  // keyboard
  window.addEventListener('keydown',e=>{
    if(e.target.tagName==='INPUT'||e.target.tagName==='SELECT'||e.target.tagName==='TEXTAREA') return;
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){ e.preventDefault(); app.doUndo(); }
    if(e.key==='Escape'){ if(app.view2d.draft.length){ app.view2d.draft=[]; app.view2d.request(); app.refreshSelPanel(); } else if(app.view2d.roomDraft.length||app.view2d.meas.length){ app.view2d.roomDraft=[]; app.view2d.meas=[]; app.view2d.request(); } else app.select(null); }
    if(e.key==='Enter'&&app.view2d.draft.length){ document.querySelector('#wDone')?.click(); }
  });
  toast('Welcome to Home Design 3D');
}
boot().catch(err=>{
  console.error('HomeCraft startup failed:',err);
  const overlay=document.querySelector('#boot');
  const message=document.querySelector('#bootMsg');
  if(message) message.textContent='Startup error: '+String(err&&err.message||err||'Unknown error')+'. Please reload the app.';
  if(overlay) overlay.style.display='flex';
});
