// 2D plan view: top-down canvas, pan/zoom, draw + select. XZ plane, +x right, +z DOWN on screen (map z to y).
import { defById } from './catalog.js';
import { thumbNow } from './thumbs.js';

function rRect(ctx, x, y, w, h, r) {
  if (ctx.roundRect) {
    ctx.roundRect(x, y, w, h, r);
  } else {
    const radius = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
    ctx.rect(x, y, w, h);
  }
}

// Procedural Architectural 2D Plan Symbols
function draw2DFurnitureSymbol(ctx, def, pw, pd, isSel) {
  const id = (def?.id || '').toLowerCase();
  const stroke = isSel ? '#b98a2e' : '#4a6fa5';
  const fill = isSel ? 'rgba(185,138,46,0.35)' : 'rgba(110,145,195,0.22)';
  const accent = isSel ? '#e9c766' : '#8fb5e0';

  ctx.strokeStyle = stroke;
  ctx.fillStyle = fill;
  ctx.lineWidth = isSel ? 2.2 : 1.4;

  // 1. CHAIRS & ARMCHAIRS
  if (id.includes('chair') || id.includes('armchair') || id.includes('babe') || id.includes('passion') || id.includes('pop')) {
    const armW = Math.max(3, pw * 0.18);
    const backD = Math.max(4, pd * 0.22);

    ctx.beginPath();
    rRect(ctx, -pw / 2, -pd / 2, pw, backD, 3);
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    rRect(ctx, -pw / 2, -pd / 2 + backD, armW, pd - backD, 3);
    rRect(ctx, pw / 2 - armW, -pd / 2 + backD, armW, pd - backD, 3);
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    rRect(ctx, -pw / 2 + armW + 1, -pd / 2 + backD + 1, pw - (armW * 2) - 2, pd - backD - 2, 4);
    ctx.fillStyle = accent;
    ctx.fill();
    ctx.stroke();
    return;
  }

  // 2. SOFAS & SECTIONALS
  if (id.includes('sofa') || id.includes('loveseat') || id.includes('sectional')) {
    const armW = Math.max(4, pw * 0.12);
    const backD = Math.max(5, pd * 0.24);

    ctx.beginPath();
    rRect(ctx, -pw / 2, -pd / 2, pw, backD, 4);
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    rRect(ctx, -pw / 2, -pd / 2 + backD, armW, pd - backD, 3);
    rRect(ctx, pw / 2 - armW, -pd / 2 + backD, armW, pd - backD, 3);
    ctx.fill();
    ctx.stroke();

    const numCushions = id.includes('sofa3') ? 3 : (id.includes('sectional') ? 3 : 2);
    const seatW = (pw - armW * 2 - 2) / numCushions;
    const seatD = pd - backD - 3;

    ctx.fillStyle = accent;
    for (let c = 0; c < numCushions; c++) {
      ctx.beginPath();
      rRect(ctx, -pw / 2 + armW + 1 + c * seatW, -pd / 2 + backD + 1.5, seatW - 1, seatD, 3);
      ctx.fill();
      ctx.stroke();
    }
    return;
  }

  // 3. BEDS
  if (id.includes('bed')) {
    ctx.beginPath();
    rRect(ctx, -pw / 2, -pd / 2, pw, pd * 0.15, 3);
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    rRect(ctx, -pw / 2 + 2, -pd / 2 + pd * 0.15, pw - 4, pd * 0.85 - 2, 4);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fill();
    ctx.stroke();

    const isDouble = pw > 50;
    const pilW = isDouble ? (pw - 12) / 2 : pw - 10;
    const pilH = pd * 0.22;
    ctx.fillStyle = '#fdfdfd';
    if (isDouble) {
      ctx.beginPath();
      rRect(ctx, -pw / 2 + 4, -pd / 2 + pd * 0.18, pilW, pilH, 3);
      rRect(ctx, pw / 2 - 4 - pilW, -pd / 2 + pd * 0.18, pilW, pilH, 3);
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.beginPath();
      rRect(ctx, -pilW / 2, -pd / 2 + pd * 0.18, pilW, pilH, 3);
      ctx.fill();
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.moveTo(-pw / 2 + 2, -pd / 2 + pd * 0.48);
    ctx.lineTo(pw / 2 - 2, -pd / 2 + pd * 0.48);
    ctx.strokeStyle = stroke;
    ctx.stroke();
    return;
  }

  // 4. TABLES & DESKS
  if (id.includes('dining') || id.includes('coffee') || id.includes('desk') || id.includes('table')) {
    if (id.includes('round')) {
      ctx.beginPath();
      ctx.arc(0, 0, Math.min(pw, pd) / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.beginPath();
      rRect(ctx, -pw / 2, -pd / 2, pw, pd, 4);
      ctx.fill();
      ctx.stroke();
      ctx.strokeRect(-pw / 2 + 3, -pd / 2 + 3, pw - 6, pd - 6);
    }
    return;
  }

  // 5. TOILETS
  if (id.includes('toilet')) {
    ctx.beginPath();
    rRect(ctx, -pw / 2, -pd / 2, pw, pd * 0.35, 3);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(0, pd * 0.15, pw * 0.36, pd * 0.32, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    return;
  }

  // 6. DEFAULT SYMBOL
  ctx.beginPath();
  rRect(ctx, -pw / 2, -pd / 2, pw, pd, 3);
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(-4, 0); ctx.lineTo(4, 0);
  ctx.moveTo(0, -4); ctx.lineTo(0, 4);
  ctx.strokeStyle = stroke;
  ctx.stroke();
}

export class View2D {
  constructor(canvas, app){
    this.cv=canvas; this.app=app;
    this.ctx=canvas.getContext('2d');
    this.bpImg=null; this.bpUrl='';
    this.cam={cx:0,cz:0,scale:60};
    this.showGrid=true;
    this.draft=[];
    this.roomDraft=[];
    this.meas=[];
    this.preview=null;
    this.pointers=new Map();
    this.lastPinch=0;
    this.downAt=0; this.downPos=null; this.moved=false;
    this._raf=0;
    this._thumbImgs=new Map();
    this.resize();
    new ResizeObserver(()=>this.resize()).observe(canvas.parentElement);
    this.bind();
  }

  resize(){
    const r=this.cv.parentElement.getBoundingClientRect();
    const dpr=Math.min(2.5, window.devicePixelRatio||1);
    this.cv.width=Math.max(2,Math.round(r.width*dpr));
    this.cv.height=Math.max(2,Math.round(r.height*dpr));
    this.dpr=dpr;
    this.request();
  }

  request(){ cancelAnimationFrame(this._raf); this._raf=requestAnimationFrame(()=>this.render()); }

  w2s(x,z){
    const r={w:this.cv.width/this.dpr,h:this.cv.height/this.dpr};
    return [ (x-this.cam.cx)*this.cam.scale + r.w/2, (z-this.cam.cz)*this.cam.scale + r.h/2 ];
  }

  s2w(px,py){
    const r=this.cv.getBoundingClientRect();
    const x=(px-r.left), y=(py-r.top);
    return { x:(x - r.width/2)/this.cam.scale + this.cam.cx, z:(y - r.height/2)/this.cam.scale + this.cam.cz };
  }

  snap(v){ const s=this.app.state.settings.snap||0.25; return Math.round(v/s)*s; }

  bind(){
    const cv=this.cv;
    cv.addEventListener('pointerdown',e=>{
      try{ cv.setPointerCapture(e.pointerId); }catch(err){}
      this.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
      this.downAt=performance.now(); this.downPos={x:e.clientX,y:e.clientY}; this.moved=false;
    });

    cv.addEventListener('pointermove',e=>{
      const prev=this.pointers.get(e.pointerId);
      if(prev){
        const dx=e.clientX-prev.x, dy=e.clientY-prev.y;
        this.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
        if(this.pointers.size===2){
          const pts=[...this.pointers.values()];
          const d=Math.hypot(pts[0].x-pts[1].x,pts[0].y-pts[1].y);
          if(this.lastPinch>0){
            const f=d/this.lastPinch;
            this.zoomAt((pts[0].x+pts[1].x)/2,(pts[0].y+pts[1].y)/2,f);
          }
          this.lastPinch=d; this.moved=true; return;
        }
        if(this.downPos && Math.hypot(e.clientX-this.downPos.x,e.clientY-this.downPos.y)>6) this.moved=true;
        this.handleDrag(e,dx,dy);
      } else {
        const w=this.s2w(e.clientX,e.clientY);
        this.preview=w;
        if(this.draft.length){
          const p0=this.draft[this.draft.length-1];
          const cur={x:this.snap(w.x), z:this.snap(w.z)};
          const fl=this.app.state.floors[this.app.state.activeFloor];
          this.checkSnapGuide(cur, p0, fl?.walls);
        } else {
          this.activeSnapGuide=null;
        }
        if(this.draft.length||this.roomDraft.length||this.meas.length) this.request();
      }
    });

    const up=e=>{
      this.pointers.delete(e.pointerId);
      if(this.pointers.size<2) this.lastPinch=0;
      if(this.pointers.size===0 && !this.moved){
        const w=this.s2w(e.clientX,e.clientY);
        this.app.tap2D(w.x,w.z);
      }
      if(this.pointers.size===0){
        if(this.moved&&this._drag&&(this._drag.kind==='item'||this._drag.kind==='wallmove'||this._drag.kind==='endpoint'||this._drag.kind==='zonemove'||this._drag.kind==='poolmove')) this.app.showCtxBar();
        if(this._drag&&this._drag.kind==='rect') this.app.finishRectTool(this._drag);
        this.downPos=null; this._drag=null; this.activeSnapGuide=null;
      }
    };
    cv.addEventListener('pointerup',up); cv.addEventListener('pointercancel',up);
    cv.addEventListener('wheel',e=>{ e.preventDefault(); const f=e.deltaY<0?1.12:0.89; this.zoomAt(e.clientX,e.clientY,f); },{passive:false});
  }

  checkSnapGuide(cur, anchor, walls, excludeWallId = null) {
    let guide = null;
    const thresh = 0.09;

    // 1. Check exact 90-degree orthogonal snap to anchor point (horizontal or vertical)
    if (anchor) {
      if (Math.abs(cur.x - anchor.x) < thresh) {
        guide = { axis: 'x', val: anchor.x, pt: cur, reason: '90°' };
      } else if (Math.abs(cur.z - anchor.z) < thresh) {
        guide = { axis: 'z', val: anchor.z, pt: cur, reason: '90°' };
      }
    }

    // 2. Check alignment with adjacent room corners
    if (!guide && walls) {
      for (const w of walls) {
        if (excludeWallId && w.id === excludeWallId) continue;
        for (const pt of [{x: w.x1, z: w.z1}, {x: w.x2, z: w.z2}]) {
          if (Math.abs(cur.x - pt.x) < thresh) {
            guide = { axis: 'x', val: pt.x, pt: cur, reason: 'corner', corner: pt };
            break;
          } else if (Math.abs(cur.z - pt.z) < thresh) {
            guide = { axis: 'z', val: pt.z, pt: cur, reason: 'corner', corner: pt };
            break;
          }
        }
        if (guide) break;
      }
    }

    if (guide) {
      const snapKey = guide.axis + '_' + guide.val.toFixed(2);
      if (this._lastSnapKey !== snapKey) {
        this._lastSnapKey = snapKey;
        this._snapPulseTime = performance.now();
        import('./sound.js').then(m => m.sound.playGoldenSnap()).catch(() => {});
      }
      this.activeSnapGuide = guide;
    } else {
      this._lastSnapKey = null;
      this.activeSnapGuide = null;
    }
    return guide;
  }

  zoomAt(cx,cy,f){
    const before=this.s2w(cx,cy);
    this.cam.scale=Math.min(220,Math.max(12,this.cam.scale*f));
    const after=this.s2w(cx,cy);
    this.cam.cx+=before.x-after.x; this.cam.cz+=before.z-after.z;
    this.request();
  }

  zoom(f){ const r=this.cv.getBoundingClientRect(); this.zoomAt(r.left+r.width/2,r.top+r.height/2,f); }

  fit(){
    const st=this.app.state, fl=st.floors[st.activeFloor]||st.floors[0];
    let minx=1e9,maxx=-1e9,minz=1e9,maxz=-1e9;
    const wb=fl?[...(fl.walls||[]),...(fl.items||[]).map(it=>({x1:it.x-1,x2:it.x+1,z1:it.z-1,z2:it.z+1}))]:[];
    for(const w of wb){
      for(const v of [w.x1,w.x2]) if(typeof v==='number'&&isFinite(v)){ minx=Math.min(minx,v); maxx=Math.max(maxx,v); }
      for(const v of [w.z1,w.z2]) if(typeof v==='number'&&isFinite(v)){ minz=Math.min(minz,v); maxz=Math.max(maxz,v); }
    }
    if(minx>maxx){ minx=-6;maxx=6;minz=-5;maxz=5; }
    const r=this.cv.getBoundingClientRect();
    const sx=r.width/(maxx-minx+3), sz=r.height/(maxz-minz+3);
    this.cam.scale=Math.min(160,Math.max(18,Math.min(sx,sz)));
    this.cam.cx=(minx+maxx)/2; this.cam.cz=(minz+maxz)/2;
    this.request();
  }

  handleDrag(e,dx,dy){
    const tool=this.app.tool;
    if(tool==='pan'){ this.cam.cx-=dx/this.cam.scale; this.cam.cz-=dy/this.cam.scale; this.request(); return; }

    if(tool==='zone'||tool==='patio'||tool==='pool'){
      if(!this._drag&&this.downPos){
        const w0=this.s2w(this.downPos.x,this.downPos.y);
        // no checkpoint here: finishRectTool() snapshots undo once the rect is committed
        this._drag={kind:'rect',tool,x0:this.snap(w0.x),z0:this.snap(w0.z),x1:this.snap(w0.x),z1:this.snap(w0.z)};
      }
      if(this._drag&&this._drag.kind==='rect'){
        const p=this.s2w(e.clientX,e.clientY);
        this._drag.x1=this.snap(p.x); this._drag.z1=this.snap(p.z);
        this.moved=true; this.request();
      }
      return;
    }

    if(tool==='paint'){
      const p=this.s2w(e.clientX,e.clientY);
      if(!this._drag||this._drag.kind!=='paint'){ this.app.checkpoint(); this._drag={kind:'paint'}; }
      const last=this._drag.last;
      if(!last||Math.hypot(p.x-last.x,p.z-last.z)>(this.app.brushSize||1)*0.4){
        this._drag.last={x:p.x,z:p.z};
        this.app.paintAt(p.x,p.z);
      }
      this.moved=true;
      return;
    }

    if(tool==='wall' && this.draft.length){
      this.preview=this.s2w(e.clientX,e.clientY);
      this.request(); return;
    }

    if(tool==='select'||tool==='move'){
      const quietDrag=true;
      if(!this._drag && this.downPos){
        const w0=this.s2w(this.downPos.x,this.downPos.y);
        const grabR=Math.max(0.3, 18/this.cam.scale);
        const ep=this.hitEndpoint(w0.x,w0.z,grabR);
        if(ep){
          this._drag={kind:'endpoint', wallId:ep.wall.id, end:ep.end, armed:true};
          this.app.select({type:'wall',id:ep.wall.id,floor:this.app.state.activeFloor},{quiet:quietDrag});
        } else {
          const it=this.hitItem(w0.x,w0.z);
          if(it){
            this.app.select({type:'item',id:it.id,floor:this.app.state.activeFloor},{quiet:quietDrag});
            if(it.locked){ this.app.notice('Locked — unlock in its panel to move'); this._drag={kind:'pan'}; }
            else this._drag={kind:'item', id:it.id, armed:true};
          } else {
            const w=this.hitWall(w0.x,w0.z);
            if(w){
              this.app.select({type:'wall',id:w.id,floor:this.app.state.activeFloor},{quiet:quietDrag});
              if(w.locked){ this.app.notice('Wall is locked — unlock in its panel to move'); this._drag={kind:'pan'}; }
              else this._drag={kind:'wallmove', id:w.id, armed:true};
            } else {
              const zn=this.hitZone(w0.x,w0.z);
              if(zn){ this.app.select({type:'zone',id:zn.id,floor:this.app.state.activeFloor},{quiet:quietDrag}); this._drag={kind:'zonemove',id:zn.id,armed:true}; }
              else {
                const pl=this.hitPool(w0.x,w0.z);
                if(pl){ this.app.select({type:'pool',id:pl.id,floor:this.app.state.activeFloor},{quiet:quietDrag}); this._drag={kind:'poolmove',id:pl.id,armed:true}; }
                else this._drag={kind:'pan'};
              }
            }
          }
        }
      }

      const d=this._drag;
      if(!d) return;
      if(d.kind==='pan'){
        this.cam.cx-=dx/this.cam.scale; this.cam.cz-=dy/this.cam.scale; this.request(); return;
      }

      if(d.armed){ this.app.checkpoint(); d.armed=false; }
      const fl=this.app.state.floors[this.app.state.activeFloor];

      if(d.kind==='item'){
        const it=fl.items.find(i=>i.id===d.id);
        if(it){
          const p=this.s2w(e.clientX,e.clientY);
          if(it.mount){
            const w=fl.walls.find(v=>v.id===it.mount.wallId);
            if(w){
              const L=Math.hypot(w.x2-w.x1,w.z2-w.z1)||1e-6;
              it.mount.along=Math.max(0,Math.min(L,((p.x-w.x1)*(w.x2-w.x1)+(p.z-w.z1)*(w.z2-w.z1))/L));
              this.app.afterGeometryChange(true);
              this.request();
              this.app.updateCtxLabel?.(it.mount.along.toFixed(2)+'m along wall');
            }
          } else if(it.on){
            const par=fl.items.find(v=>v.id===it.on.parentId);
            if(par){
              const pr=(par.rot||0)*Math.PI/180;
              const lx=p.x-(par.x||0), lz=p.z-(par.z||0);
              it.on.dx=lx*Math.cos(pr)+lz*Math.sin(pr);
              it.on.dz=-lx*Math.sin(pr)+lz*Math.cos(pr);
              this.app.afterGeometryChange(true);
              this.request();
              this.app.updateCtxLabel?.('on shelf');
            }
          } else {
            it.x=this.snap(it.x+dx/this.cam.scale); it.z=this.snap(it.z+dy/this.cam.scale);
            this.app.live(); this.request(); this.app.updateCtxLabel?.(it.x.toFixed(1)+', '+it.z.toFixed(1));
          }
        }
        return;
      }

      if(d.kind==='wallmove'){
        const w=fl.walls.find(v=>v.id===d.id); if(!w) return;
        const ox=dx/this.cam.scale, oz=dy/this.cam.scale;
        w.x1=this.snap(w.x1+ox); w.z1=this.snap(w.z1+oz);
        w.x2=this.snap(w.x2+ox); w.z2=this.snap(w.z2+oz);
        this.app.afterGeometryChange(true); this.request(); this.app.updateCtxLabel?.(Math.hypot(w.x2-w.x1,w.z2-w.z1).toFixed(2)+'m'); return;
      }

      if(d.kind==='zonemove'){
        const zn=(fl.zones||[]).find(v=>v.id===d.id); if(!zn) return;
        const ox=dx/this.cam.scale, oz=dy/this.cam.scale;
        zn.x0=this.snap(zn.x0+ox); zn.x1=this.snap(zn.x1+ox);
        zn.z0=this.snap(zn.z0+oz); zn.z1=this.snap(zn.z1+oz);
        this.app.live(); this.request(); return;
      }

      if(d.kind==='poolmove'){
        const p=(fl.pools||[]).find(v=>v.id===d.id); if(!p) return;
        p.x=this.snap(p.x+dx/this.cam.scale); p.z=this.snap(p.z+dy/this.cam.scale);
        this.app.live(); this.request(); return;
      }

      if(d.kind==='endpoint'){
        const w=fl.walls.find(v=>v.id===d.wallId); if(!w) return;
        const p=this.s2w(e.clientX,e.clientY);
        const nx=this.snap(p.x), nz=this.snap(p.z);
        const ox=d.end===1?w.x2:w.x1, oz=d.end===1?w.z2:w.z1;
        if(Math.hypot(nx-ox,nz-oz)<0.2) return;
        this.checkSnapGuide({x:nx,z:nz}, {x:ox,z:oz}, fl.walls, w.id);
        if(d.end===1){ w.x1=nx; w.z1=nz; } else { w.x2=nx; w.z2=nz; }
        this.app.afterGeometryChange(true); this.request(); this.app.updateCtxLabel?.(Math.hypot(w.x2-w.x1,w.z2-w.z1).toFixed(2)+'m'); return;
      }
      return;
    }

    if(this.moved){ this.cam.cx-=dx/this.cam.scale; this.cam.cz-=dy/this.cam.scale; this.request(); }
  }

  hitEndpoint(x,z,r=0.35){
    const fl=this.app.state.floors[this.app.state.activeFloor];
    for(let i=fl.walls.length-1;i>=0;i--){
      const w=fl.walls[i];
      if(w.locked) continue;
      if(Math.hypot(x-w.x1,z-w.z1)<r) return {wall:w,end:1};
      if(Math.hypot(x-w.x2,z-w.z2)<r) return {wall:w,end:2};
    }
    return null;
  }

  hitWall(x,z){
    const st=this.app.state, fl=st.floors[st.activeFloor];
    let best=null,bd=0.35;
    for(const w of fl.walls){
      const d=this.distSeg(x,z,w.x1,w.z1,w.x2,w.z2);
      if(d<bd){ bd=d; best=w; }
    }
    return best;
  }

  hitItem(x,z){
    const st=this.app.state, fl=st.floors[st.activeFloor];
    for(let i=fl.items.length-1;i>=0;i--){
      const it=fl.items[i];
      const def=defById(it.defId)||this.app.customDef(it.defId);
      const w=(def?.w||1)*(it.scale||1), d=(def?.d||1)*(it.scale||1);
      const dx=x-it.x, dz=z-it.z;
      const a=(-(it.rot||0))*Math.PI/180;
      const lx=dx*Math.cos(a)-dz*Math.sin(a), lz=dx*Math.sin(a)+dz*Math.cos(a);
      if(Math.abs(lx)<w/2+0.15 && Math.abs(lz)<d/2+0.15) return it;
    }
    return null;
  }

  hitOpening(x,z){
    const st=this.app.state, fl=st.floors[st.activeFloor];
    const wall=this.hitWall(x,z);
    if(!wall) return null;
    const L=Math.hypot(wall.x2-wall.x1,wall.z2-wall.z1)||1e-6;
    const t=((x-wall.x1)*(wall.x2-wall.x1)+(z-wall.z1)*(wall.z2-wall.z1))/(L*L);
    let best=null,bd=1e9;
    for(const o of fl.openings.filter(o=>o.wallId===wall.id)){
      const cx=wall.x1+(wall.x2-wall.x1)*o.at, cz=wall.z1+(wall.z2-wall.z1)*o.at;
      const d=Math.hypot(x-cx,z-cz);
      if(d<bd){bd=d;best=o;}
    }
    if(best && bd<Math.max(0.6,best.w/2+0.2)) return best;
    return null;
  }

  hitZone(x,z){
    const fl=this.app.state.floors[this.app.state.activeFloor];
    for(let i=(fl.zones||[]).length-1;i>=0;i--){
      const zn=fl.zones[i];
      if(x>Math.min(zn.x0,zn.x1)-0.1&&x<Math.max(zn.x0,zn.x1)+0.1&&z>Math.min(zn.z0,zn.z1)-0.1&&z<Math.max(zn.z0,zn.z1)+0.1) return zn;
    }
    return null;
  }

  hitPool(x,z){
    const fl=this.app.state.floors[this.app.state.activeFloor];
    for(let i=(fl.pools||[]).length-1;i>=0;i--){
      const p=fl.pools[i];
      const dx=x-p.x, dz=z-p.z, a=-(p.rot||0)*Math.PI/180;
      const lx=dx*Math.cos(a)-dz*Math.sin(a), lz=dx*Math.sin(a)+dz*Math.cos(a);
      if(Math.abs(lx)<p.w/2+0.6&&Math.abs(lz)<p.d/2+0.6) return p;
    }
    return null;
  }

  distSeg(px,pz,x1,z1,x2,z2){
    const dx=x2-x1,dz=z2-z1; const L2=dx*dx+dz*dz||1e-9;
    let t=((px-x1)*dx+(pz-z1)*dz)/L2; t=Math.max(0,Math.min(1,t));
    return Math.hypot(px-(x1+dx*t),pz-(z1+dz*t));
  }

  render(){
    const ctx=this.ctx, dpr=this.dpr;
    const W=this.cv.width,H=this.cv.height;
    ctx.save(); ctx.scale(dpr,dpr);
    const rw=W/dpr,rh=H/dpr;
    ctx.clearRect(0,0,rw,rh);
    const st=this.app.state; if(!st||!Array.isArray(st.floors)||!st.floors.length){ ctx.restore(); return; }
    // self-heal: a non-finite camera blanks the whole plan — refit instead
    if(!isFinite(this.cam.cx)||!isFinite(this.cam.cz)||!isFinite(this.cam.scale)||this.cam.scale<=0){
      this.cam.cx=0; this.cam.cz=0; this.cam.scale=60;
      ctx.restore(); this.fit(); return;
    }
    const fl=st.floors[st.activeFloor]||st.floors[0];
    if(!fl){ ctx.restore(); return; }
    const walls=fl.walls||[], items=fl.items||[], openings=fl.openings||[];

    const bp=st.blueprint;
    if(bp&&bp.visible!==false&&bp.dataUrl){
      if(this.bpUrl!==bp.dataUrl){ this.bpUrl=bp.dataUrl; this.bpImg=new Image(); this.bpImg.onload=()=>this.request(); this.bpImg.src=bp.dataUrl; }
      if(this.bpImg&&this.bpImg.complete&&this.bpImg.naturalWidth){
        const [ux0,uy0]=this.w2s(bp.cx-bp.w/2,bp.cz-bp.d/2);
        const [ux1,uy1]=this.w2s(bp.cx+bp.w/2,bp.cz+bp.d/2);
        ctx.save(); ctx.globalAlpha=bp.opacity??0.55;
        ctx.drawImage(this.bpImg,ux0,uy0,ux1-ux0,uy1-uy0); ctx.restore();
      }
    }

    if(this.showGrid){
      const step=1;
      ctx.lineWidth=1;
      const x0=this.cam.cx-rw/2/this.cam.scale, x1=this.cam.cx+rw/2/this.cam.scale;
      const z0=this.cam.cz-rh/2/this.cam.scale, z1=this.cam.cz+rh/2/this.cam.scale;
      const gx0=Math.floor(x0/step)*step, gx1=Math.ceil(x1/step)*step;
      const gz0=Math.floor(z0/step)*step, gz1=Math.ceil(z1/step)*step;
      for(let x=gx0;x<=gx1;x+=step){
        const [sx]=this.w2s(x,0);
        ctx.strokeStyle=(Math.round(x)%5===0)?'rgba(146,124,74,.30)':'rgba(146,124,74,.13)';
        ctx.beginPath(); ctx.moveTo(sx,0); ctx.lineTo(sx,rh); ctx.stroke();
      }
      for(let z=gz0;z<=gz1;z+=step){
        const [,sy]=this.w2s(0,z);
        ctx.strokeStyle=(Math.round(z)%5===0)?'rgba(146,124,74,.30)':'rgba(146,124,74,.13)';
        ctx.beginPath(); ctx.moveTo(0,sy); ctx.lineTo(rw,sy); ctx.stroke();
      }
      const [ox,oy]=this.w2s(0,0);
      ctx.strokeStyle='rgba(146,124,74,.55)'; ctx.beginPath(); ctx.moveTo(ox-8,oy); ctx.lineTo(ox+8,oy); ctx.moveTo(ox,oy-8); ctx.lineTo(ox,oy+8); ctx.stroke();
    }

    {
      const s=fl.slab||{w:12,d:10,cx:0,cz:0};
      const [ax,ay]=this.w2s(s.cx-s.w/2,s.cz-s.d/2);
      const [bx,by]=this.w2s(s.cx+s.w/2,s.cz+s.d/2);
      ctx.fillStyle='rgba(185,138,46,.10)';
      ctx.fillRect(ax,ay,bx-ax,by-ay);
      ctx.strokeStyle='rgba(185,138,46,.45)'; ctx.setLineDash([6,5]); ctx.lineWidth=1.2;
      ctx.strokeRect(ax,ay,bx-ax,by-ay); ctx.setLineDash([]);
      ctx.fillStyle='#8a8172'; ctx.font='11px system-ui';
      ctx.fillText(`${s.w.toFixed(1)} × ${s.d.toFixed(1)} m`, ax+6, ay+14);
    }

    const sel=this.app.sel;

    if(fl.paints) for(const p of fl.paints){
      const [px,py]=this.w2s(p.x,p.z);
      const r=Math.max(3,(p.r||1)*this.cam.scale);
      ctx.fillStyle='rgba(120,200,130,.25)';
      ctx.beginPath(); ctx.arc(px,py,r,0,7); ctx.fill();
      ctx.strokeStyle='rgba(120,200,130,.5)'; ctx.lineWidth=1;
      ctx.beginPath(); ctx.arc(px,py,r,0,7); ctx.stroke();
    }

    if(fl.zones) for(const z of fl.zones){
      const [ax,ay]=this.w2s(Math.min(z.x0,z.x1),Math.min(z.z0,z.z1));
      const [bx,by]=this.w2s(Math.max(z.x0,z.x1),Math.max(z.z0,z.z1));
      const isSel=sel&&sel.type==='zone'&&sel.id===z.id;
      ctx.fillStyle=isSel?'rgba(185,138,46,.30)':'rgba(190,170,130,.28)';
      ctx.fillRect(ax,ay,bx-ax,by-ay);
      ctx.strokeStyle=isSel?'#ffffff':'#b98a2e'; ctx.lineWidth=isSel?2.5:1.5;
      ctx.strokeRect(ax,ay,bx-ax,by-ay);
      ctx.fillStyle=isSel?'#ffffff':'#6b5f45';
      ctx.font='600 10px system-ui'; ctx.textAlign='center';
      ctx.fillText((this.app.zoneName?this.app.zoneName(z):'surface'),(ax+bx)/2,(ay+by)/2);
    }

    if(fl.pools) for(const p of fl.pools){
      const [cx,cy]=this.w2s(p.x,p.z);
      const isSel=sel&&sel.type==='pool'&&sel.id===p.id;
      ctx.save(); ctx.translate(cx,cy); ctx.rotate((p.rot||0)*Math.PI/180);
      const pw=p.w*this.cam.scale, pd=p.d*this.cam.scale;
      ctx.fillStyle='rgba(120,110,88,.30)';
      ctx.fillRect(-pw/2-8,-pd/2-8,pw+16,pd+16);
      ctx.fillStyle=isSel?'rgba(185,138,46,.35)':'rgba(140,190,235,.75)';
      if(p.shape==='oval'||p.shape==='kidney'){
        ctx.beginPath(); ctx.ellipse(0,0,pw/2,pd/2,0,0,7); ctx.fill();
        if(p.shape==='kidney'){ ctx.beginPath(); ctx.ellipse(pw*0.2,0,pw*0.31,pd*0.45,0,0,7); ctx.fill(); }
      } else ctx.fillRect(-pw/2,-pd/2,pw,pd);
      ctx.strokeStyle=isSel?'#b98a2e':'#5b9bd5'; ctx.lineWidth=isSel?3:2.5;
      if(p.shape==='oval'||p.shape==='kidney'){ ctx.beginPath(); ctx.ellipse(0,0,pw/2+3,pd/2+3,0,0,7); ctx.stroke(); }
      else ctx.strokeRect(-pw/2-3,-pd/2-3,pw+6,pd+6);
      ctx.restore();
      ctx.font='12px system-ui'; ctx.textAlign='center';
      ctx.fillStyle='#33475e'; ctx.fillText('POOL',cx,cy-2);
      if(isSel){ ctx.font='600 10px system-ui'; ctx.fillStyle='#7a5f14'; ctx.fillText(p.shape+' pool',cx,cy+pd/2+12); }
    }

    if(fl.rooms?.length){
      ctx.font='700 12px system-ui'; ctx.textAlign='center'; ctx.textBaseline='middle';
      for(const r of fl.rooms){
        const [rx,ry]=this.w2s(r.x,r.z);
        const tw=ctx.measureText(r.name||'Room').width;
        ctx.fillStyle='rgba(124,92,255,.18)';
        ctx.beginPath(); rRect(ctx, rx-tw/2-8,ry-11,tw+16,22,9); ctx.fill();
        ctx.strokeStyle='rgba(124,92,255,.6)'; ctx.lineWidth=1;
        ctx.beginPath(); rRect(ctx, rx-tw/2-8,ry-11,tw+16,22,9); ctx.stroke();
        ctx.fillStyle='#5b4bc4'; ctx.fillText(r.name||'Room',rx,ry+1);
      }
    }

    for(const it of items){
      if(!isFinite(it.x)||!isFinite(it.z)) continue;
      const def=defById(it.defId)||this.app.customDef(it.defId);
      const w=(def?.w||1)*(it.scale||1), d=(def?.d||1)*(it.scale||1);
      const [cx,cy]=this.w2s(it.x,it.z);
      const isSel=sel&&sel.type==='item'&&sel.id===it.id;

      if(it.on){
        ctx.font=`${Math.max(11,Math.min(17,this.cam.scale*0.28))}px system-ui`;
        ctx.textAlign='center'; ctx.textBaseline='middle';
        if(isSel){ ctx.strokeStyle='#b98a2e'; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(cx,cy,10,0,7); ctx.stroke(); }
        ctx.fillStyle='#4d4638'; ctx.fillText((((def?.name||it.defId||'?')+'').trim().charAt(0)||'?').toUpperCase(),cx,cy-2);
        continue;
      }

      ctx.save();
      ctx.translate(cx,cy);
      ctx.rotate((it.rot||0)*Math.PI/180);
      const pw=w*this.cam.scale, pd=d*this.cam.scale;

      draw2DFurnitureSymbol(ctx, def, pw, pd, isSel);

      ctx.fillStyle=isSel?'#b98a2e':'#4a6fa5';
      ctx.fillRect(-pw*0.15,-pd/2-2,pw*0.3,3);
      ctx.restore();

      if(it.locked){ ctx.font='12px system-ui'; ctx.textAlign='right'; ctx.fillText('L',cx+pw/2-1,cy-pd/2+11); ctx.textAlign='center'; }
      if(it.mount){ ctx.font='10px system-ui'; ctx.textAlign='left'; ctx.fillText('W',cx-pw/2-2,cy-pd/2+2); ctx.textAlign='center';
        if(isSel){ ctx.font='600 10px system-ui'; ctx.fillStyle='#7a5f14'; ctx.fillText('h '+(it.mount.y||0).toFixed(2)+'m',cx,cy-pd/2-8); } }
      if(isSel||this.cam.scale>55){
        ctx.font='600 10px system-ui'; ctx.fillStyle=isSel?'#b98a2e':'#33475e';
        ctx.fillText((def?.name||it.defId).slice(0,18),cx,cy+Math.max(12,pd/2+8));
      }
    }

    for(const w of walls){
      if(!isFinite(w.x1)||!isFinite(w.z1)||!isFinite(w.x2)||!isFinite(w.z2)) continue;
      const [ax,ay]=this.w2s(w.x1,w.z1), [bx,by]=this.w2s(w.x2,w.z2);
      const isSel=sel&&sel.type==='wall'&&sel.id===w.id;
      const tpx=Math.max(4,(w.t||0.15)*this.cam.scale);
      ctx.lineCap='round';
      ctx.strokeStyle=isSel?'#b98a2e':'#3a352c';
      ctx.lineWidth=tpx+ (isSel?3:2);
      ctx.globalAlpha=1;
      ctx.beginPath(); ctx.moveTo(ax,ay); ctx.lineTo(bx,by); ctx.stroke();
      ctx.strokeStyle=isSel?'#7a5f14':'#a09a8c';
      ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(ax,ay); ctx.lineTo(bx,by); ctx.stroke();

      if(w.finish||w.split){
        const fc=(w.split?.bottom?.color)||(w.finish?.color)||'#c9a86a';
        ctx.strokeStyle=fc; ctx.lineWidth=2; ctx.globalAlpha=0.9;
        ctx.beginPath(); ctx.moveTo(ax,ay); ctx.lineTo(bx,by); ctx.stroke(); ctx.globalAlpha=1;
        if(w.split){ const tc=(w.split.top?.color)||'#8a8172';
          ctx.strokeStyle=tc; ctx.lineWidth=1.2; ctx.setLineDash([5,4]);
          ctx.beginPath(); ctx.moveTo(ax,ay); ctx.lineTo(bx,by); ctx.stroke(); ctx.setLineDash([]); }
      }

      for(const [px,py] of [[ax,ay],[bx,by]]){ ctx.fillStyle=isSel?'#b98a2e':'#8f887a'; ctx.beginPath(); ctx.arc(px,py,isSel?5:3.4,0,7); ctx.fill(); }
      if(w.locked){ ctx.font='12px system-ui'; ctx.textAlign='left'; ctx.textBaseline='middle'; ctx.fillText('L',ax+6,ay-10); }

      if(isSel){
        const L=Math.hypot(w.x2-w.x1,w.z2-w.z1);
        ctx.font='700 12px system-ui'; const mx=(ax+bx)/2,my=(ay+by)/2;
        const txt=L.toFixed(2)+' m';
        const tw=ctx.measureText(txt).width;
        ctx.fillStyle='rgba(5,10,20,.85)'; ctx.strokeStyle='#ffffff';
        ctx.beginPath(); rRect(ctx, mx-tw/2-6,my-22,tw+12,20,8); ctx.fill(); ctx.stroke();
        ctx.fillStyle='#fff'; ctx.textAlign='center'; ctx.fillText(txt,mx,my-8);
      }
    }

    for(const o of openings){
      if(!o||!isFinite(o.at)) continue;
      const wall=walls.find(w=>w.id===o.wallId); if(!wall) continue;
      const cx=wall.x1+(wall.x2-wall.x1)*o.at, cz=wall.z1+(wall.z2-wall.z1)*o.at;
      const [sx,sy]=this.w2s(cx,cz);
      const ang=Math.atan2(wall.z2-wall.z1,wall.x2-wall.x1);
      const len=o.w*this.cam.scale;
      const isSel=sel&&sel.type==='opening'&&sel.id===o.id;
      ctx.save(); ctx.translate(sx,sy); ctx.rotate(ang);

      ctx.fillStyle='#3a352c';
      ctx.fillRect(-len/2,-7,len,14);
      if(o.kind==='door'){
        ctx.strokeStyle=isSel?'#b98a2e':'#8f887a'; ctx.lineWidth=isSel?3:2;
        ctx.strokeRect(-len/2,-7,len,14);
        ctx.beginPath(); ctx.arc(-len/2,0,len, -Math.PI/2, 0); ctx.stroke();
      } else if(o.kind==='window'){
        ctx.strokeStyle=isSel?'#b98a2e':'#8f887a'; ctx.lineWidth=isSel?3:2;
        ctx.strokeRect(-len/2,-6,len,12);
        ctx.beginPath(); ctx.moveTo(-len/2,0); ctx.lineTo(len/2,0); ctx.stroke();
      } else {
        ctx.strokeStyle=isSel?'#b98a2e':'#8f887a'; ctx.setLineDash([4,3]); ctx.lineWidth=2;
        ctx.strokeRect(-len/2,-7,len,14); ctx.setLineDash([]);
      }
      ctx.restore();
    }

    if(this.draft.length){
      ctx.strokeStyle='#b98a2e'; ctx.lineWidth=3; ctx.setLineDash([8,6]);
      ctx.beginPath();
      this.draft.forEach((p,i)=>{ const [sx,sy]=this.w2s(p.x,p.z); if(i===0)ctx.moveTo(sx,sy); else ctx.lineTo(sx,sy); });
      if(this.preview){ const [sx,sy]=this.w2s(this.snap(this.preview.x),this.snap(this.preview.z)); ctx.lineTo(sx,sy); }
      ctx.stroke(); ctx.setLineDash([]);
      for(const p of this.draft){ const [sx,sy]=this.w2s(p.x,p.z); ctx.fillStyle='#b98a2e'; ctx.beginPath(); ctx.arc(sx,sy,5,0,7); ctx.fill(); }

      if(this.preview&&this.draft.length){
        const l=this.draft[this.draft.length-1];
        const L=Math.hypot(this.snap(this.preview.x)-l.x,this.snap(this.preview.z)-l.z);
        ctx.font='700 12px system-ui';
        const [sx,sy]=this.w2s(this.snap(this.preview.x),this.snap(this.preview.z));
        ctx.fillStyle='#0b111c'; const t=L.toFixed(2)+' m • tap to add, ✓ to finish';
        const tw=ctx.measureText(t).width;
        ctx.fillStyle='rgba(5,10,20,.9)'; ctx.beginPath(); rRect(ctx, sx+10,sy-30,tw+12,20,8); ctx.fill();
        ctx.fillStyle='#fff'; ctx.textAlign='left'; ctx.fillText(t,sx+16,sy-16);
      }
    }

    if(this.roomDraft.length){
      const a=this.roomDraft[0];
      const b=this.roomDraft[1]||this.preview||a;
      const [ax,ay]=this.w2s(Math.min(a.x,b.x),Math.min(a.z,b.z));
      const [bx,by]=this.w2s(Math.max(a.x,b.x),Math.max(a.z,b.z));
      ctx.fillStyle='rgba(255,255,255,.15)'; ctx.fillRect(ax,ay,bx-ax,by-ay);
      ctx.strokeStyle='#b98a2e'; ctx.lineWidth=2; ctx.setLineDash([8,6]);
      ctx.strokeRect(ax,ay,bx-ax,by-ay); ctx.setLineDash([]);
      const wdt=Math.abs(b.x-a.x).toFixed(1), dpt=Math.abs(b.z-a.z).toFixed(1);
      ctx.font='700 12px system-ui'; ctx.fillStyle='#7a5f14'; ctx.textAlign='center';
      ctx.fillText(`${wdt} × ${dpt} m`,(ax+bx)/2,(ay+by)/2);
    }

    if(this.meas.length){
      ctx.strokeStyle='#b98a2e'; ctx.lineWidth=2.5; ctx.setLineDash([6,4]);
      ctx.beginPath();
      this.meas.forEach((p,i)=>{ const [sx,sy]=this.w2s(p.x,p.z); if(i===0)ctx.moveTo(sx,sy); else ctx.lineTo(sx,sy); });
      if(this.meas.length===1&&this.preview){ const [sx,sy]=this.w2s(this.preview.x,this.preview.z); ctx.lineTo(sx,sy); }
      ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle='#b98a2e';
      for(const p of this.meas){ const [sx,sy]=this.w2s(p.x,p.z); ctx.beginPath(); ctx.arc(sx,sy,5,0,7); ctx.fill(); }
      if(this.meas.length===2){
        const [a,b]=this.meas;
        const [mx,my]=this.w2s((a.x+b.x)/2,(a.z+b.z)/2);
        const t=Math.hypot(b.x-a.x,b.z-a.z).toFixed(2)+' m';
        ctx.font='700 13px system-ui';
        const tw=ctx.measureText(t).width;
        ctx.fillStyle='rgba(5,10,20,.9)'; ctx.beginPath(); rRect(ctx, mx-tw/2-8,my-30,tw+16,22,9); ctx.fill();
        ctx.fillStyle='#b98a2e'; ctx.textAlign='center'; ctx.fillText(t,mx,my-14);
      }
    }

    if(this._drag&&this._drag.kind==='rect'){
      const d=this._drag;
      const [ax,ay]=this.w2s(Math.min(d.x0,d.x1),Math.min(d.z0,d.z1));
      const [bx,by]=this.w2s(Math.max(d.x0,d.x1),Math.max(d.z0,d.z1));
      ctx.fillStyle=d.tool==='pool'?'rgba(140,190,235,.4)':'rgba(185,138,46,.16)';
      ctx.fillRect(ax,ay,bx-ax,by-ay);
      ctx.strokeStyle=d.tool==='pool'?'#5b9bd5':'#b98a2e'; ctx.lineWidth=2; ctx.setLineDash([8,6]);
      ctx.strokeRect(ax,ay,bx-ax,by-ay); ctx.setLineDash([]);
      ctx.font='700 12px system-ui'; ctx.fillStyle='#7a5f14'; ctx.textAlign='center';
      ctx.fillText(Math.abs(d.x1-d.x0).toFixed(1)+' × '+Math.abs(d.z1-d.z0).toFixed(1)+' m',(ax+bx)/2,(ay+by)/2);
    }

    if(this.activeSnapGuide){
      const g = this.activeSnapGuide;
      const pulseAge = performance.now() - (this._snapPulseTime || 0);
      const isPulse = pulseAge <= 40;
      if (isPulse) setTimeout(() => this.request(), 45);

      ctx.save();
      // Laser guideline
      ctx.strokeStyle = isPulse ? 'rgba(233, 199, 102, 0.95)' : 'rgba(185, 138, 46, 0.55)';
      ctx.lineWidth = isPulse ? 2.2 : 1.2;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      if(g.axis === 'x'){
        const [sx] = this.w2s(g.val, 0);
        ctx.moveTo(sx, 0); ctx.lineTo(sx, rh);
      } else {
        const [, sy] = this.w2s(0, g.val);
        ctx.moveTo(0, sy); ctx.lineTo(rw, sy);
      }
      ctx.stroke();

      // Golden target pulse point
      const pt = g.pt || (this.preview ? {x: this.snap(this.preview.x), z: this.snap(this.preview.z)} : null);
      if(pt){
        const [px, py] = this.w2s(pt.x, pt.z);
        ctx.setLineDash([]);
        ctx.fillStyle = isPulse ? 'rgba(233, 199, 102, 0.8)' : 'rgba(185, 138, 46, 0.3)';
        ctx.strokeStyle = isPulse ? '#f5d57f' : '#b98a2e';
        ctx.lineWidth = isPulse ? 2.5 : 1.5;
        ctx.beginPath();
        ctx.arc(px, py, isPulse ? 9 : 5.5, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
      }
      ctx.restore();
    }

    ctx.restore();
  }
}
