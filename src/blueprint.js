// AI blueprint → editable house shell wizard.
import { uid } from './store.js';

const PROMPT = `You are an architectural plan digitizer. The attached image (LAST item) is a house floor plan or blueprint.
Return STRICT JSON only — no markdown fences, no commentary:
{"units":"m","scale_m_per_pixel":<best estimate, e.g. from a scale bar, a dimension label, or a standard 0.9m interior door>,
"walls":[{"x1":px,"z1":px,"x2":px,"z2":px}],
"openings":[{"wall":<wall index>,"at":0.0-1.0,"w":m,"h":m,"sill":m,"kind":"door|window|arch"}],
"rooms":[{"name":str,"x":px,"z":px,"w":px,"d":px}],
"uncertain":[{"type":"wall|opening|room|scale","ref":<index or -1>,"note":str}]}
Rules: pixel origin = image TOP-LEFT, +x right, +z DOWN (image row). Trace wall CENTERLINES as straight segments; split walls at every junction/corner. Include exterior + interior walls, garage, hallways. Doors = gaps with swing arcs (h~2.1, sill 0). Windows = thin parallel lines (h~1.2, sill~0.9). Ignore furniture, text, dimension lines. Room x/z = box CENTER, w/d = box size in px. If the scale is unclear, estimate from a standard interior door (0.9m wide) and flag it in uncertain. Output JSON only.`;

const ROOM_PROMPT = `You are an architectural plan digitizer. The attached image (LAST item) is a CROPPED region of a house floor plan. Coordinates are pixels relative to THIS crop (origin top-left, +x right, +z down).
Return STRICT JSON only: {"walls":[{"x1":px,"z1":px,"x2":px,"z2":px}],"openings":[],"uncertain":[]}
Trace wall centerlines; split at junctions. Extend segments that touch the crop edge all the way TO the edge. Ignore furniture/text. Output JSON only.`;

function el(id){ return document.querySelector(id); }
function toast(m){ const t=el('#toast'); if(!t) return; t.textContent=m; t.style.display='block'; clearTimeout(t._h); t._h=setTimeout(()=>t.style.display='none',2600); }

async function fileToImage(file){
  if(/\.pdf$/i.test(file.name)||file.type==='application/pdf'){
    const pdfjs=await import('https://esm.sh/pdfjs-dist@4.2.67/build/pdf.mjs');
    pdfjs.GlobalWorkerOptions.workerSrc='https://esm.sh/pdfjs-dist@4.2.67/build/pdf.worker.mjs';
    const buf=await file.arrayBuffer();
    const pdf=await pdfjs.getDocument({data:buf}).promise;
    const page=await pdf.getPage(1);
    const v0=page.getViewport({scale:1});
    const sc=Math.min(3, 1600/v0.width);
    const vp=page.getViewport({scale:sc});
    const cv=document.createElement('canvas'); cv.width=Math.round(vp.width); cv.height=Math.round(vp.height);
    await page.render({canvasContext:cv.getContext('2d'),viewport:vp}).promise;
    return cv;
  }
  const url=URL.createObjectURL(file);
  try{
    const img=await new Promise((res,rej)=>{ const i=new Image(); i.onload=()=>res(i); i.onerror=rej; i.src=url; });
    const sc=Math.min(1, 1600/Math.max(img.naturalWidth,img.naturalHeight));
    const cv=document.createElement('canvas');
    cv.width=Math.max(1,Math.round(img.naturalWidth*sc)); cv.height=Math.max(1,Math.round(img.naturalHeight*sc));
    cv.getContext('2d').drawImage(img,0,0,cv.width,cv.height);
    return cv;
  } finally { setTimeout(()=>URL.revokeObjectURL(url),4000); }
}
function canvasBlob(cv,type='image/jpeg',q=0.9){ return new Promise(r=>cv.toBlob(r,type,q)); }

export class AIBuilder {
  constructor(app){ this.app=app; this.reset(); }
  reset(){ this.cv=null; this.blob=null; this.data=null; this.skipW=new Set(); this.skipO=new Set(); this.cropCache={}; }

  open(){ this.reset(); this.stepUpload(); el('#aiVeil').classList.add('on'); }
  box(html){ el('#aiSteps').innerHTML=html; try{ window.lucide&&window.lucide.createIcons(); }catch(e){} }

  stepUpload(){
    this.box(`<h3>Step 1 — Upload blueprint <i style="opacity:.6">or</i> describe</h3>
      <p>PNG, JPG, WEBP or PDF (first page). Scanned plans and screenshots both work.</p>
      <div class="stepBtns"><button class="btn primary" id="aiPick"><i data-lucide="upload"></i>Choose file</button></div>
      <div id="aiPrevWrap"></div>
      <h3 style="margin-top:10px">Or describe a house</h3>
      <p>E.g. “2-bed bungalow, open living-kitchen, 10×8m, front door south, patio doors to garden”.</p>
      <textarea id="aiDesc" rows="3" style="width:100%;background:#0b111c;color:var(--txt);border:1px solid var(--line);border-radius:9px;padding:7px 9px;font-size:13px" placeholder="Describe rooms, sizes, doors…" class="txtInput"></textarea>
      <div class="stepBtns"><button class="btn" id="aiDescGo"><i data-lucide="sparkles"></i>Design from description</button></div>`);
    el('#aiPick').onclick=()=>el('#aiFile').click();
    el('#aiDescGo').onclick=()=>this.stepDescribe();
    el('#aiFile').onchange=async e=>{
      const f=e.target.files[0]; e.target.value=''; if(!f) return;
      el('#aiPrevWrap').innerHTML='<p>Reading file…</p>';
      try{
        this.cv=await fileToImage(f);
        this.blob=await canvasBlob(this.cv, 'image/jpeg', 0.9);
        this.fileName=f.name;
        const url=URL.createObjectURL(this.blob);
        el('#aiPrevWrap').innerHTML=`<img class="aiPrev" src="${url}"><p>${f.name} — ${this.cv.width}×${this.cv.height}px</p>
          <div class="stepBtns"><button class="btn primary" id="aiGo"><i data-lucide="scan"></i>Analyze with AI</button></div>`;
        el('#aiGo').onclick=()=>this.stepAnalyze();
      }catch(err){ console.warn(err); el('#aiPrevWrap').innerHTML=`<p class="warn">Could not read that file.${/pdf/i.test(f.name)?' PDF export as PNG and retry.':''}</p>`; }
    };
  }

  async stepAnalyze(){
    this.box(`<h3>Step 2 — AI analysis</h3><p id="aiStat">Contacting AI… (up to ~1 min)</p><div class="spin"></div>`);
    const t0=Date.now();
    const tick=setInterval(()=>{ const s=el('#aiStat'); if(s) s.textContent=`Analyzing blueprint… ${Math.round((Date.now()-t0)/1000)}s`; },1000);
    try{
      const gen=globalThis.root?.generateText;
      if(!gen) throw new Error('AI plugin not ready — reload and retry');
      if(!(this.blob instanceof Blob)||!/^image\/(png|jpeg|webp)$/.test(this.blob.type)) throw new Error('Plan image missing — re-upload the file (PNG/JPG/WEBP/PDF).');
      const res=await gen({instruction:[PROMPT,this.blob]});
      const txt=String(res?.text??res);
      clearInterval(tick);
      const m=txt.match(/\{[\s\S]*\}/);
      if(!m) throw new Error('AI returned no JSON. Raw: '+txt.slice(0,300));
      this.data=JSON.parse(m[0]);
      if(!Array.isArray(this.data.walls)) throw new Error('AI JSON has no walls array');
      this.data.openings=this.data.openings||[]; this.data.rooms=this.data.rooms||[]; this.data.uncertain=this.data.uncertain||[];
      this.stepScale();
    }catch(err){
      clearInterval(tick); console.warn(err);
      this.box(`<h3>Step 2 — AI analysis</h3><p class="warn">Analysis failed: ${String(err.message||err).slice(0,300)}</p>
        <div class="stepBtns"><button class="btn primary" id="aiRetry"><i data-lucide="rotate-cw"></i>Retry</button><button class="btn" id="aiBack1"><i data-lucide="arrow-left"></i>Re-upload</button></div>`);
      el('#aiRetry').onclick=()=>this.stepAnalyze();
      el('#aiBack1').onclick=()=>this.stepUpload();
    }
  }

  async stepDescribe(){
    const desc=(el('#aiDesc')?.value||'').trim();
    if(desc.length<10){ toast('Describe the house in a sentence or two first'); return; }
    this.box(`<h3>Step 2 — AI designing</h3><p id="aiStat">Designing your house… (up to ~1 min)</p><div class="spin"></div>`);
    try{
      const gen=globalThis.root?.generateText;
      if(!gen) throw new Error('AI plugin not ready — reload and retry');
      const prompt=`You are an architect producing a starter house shell for a home-design app. User description: "${desc.replace(/"/g,'')}"
Return STRICT JSON only (no markdown, no commentary):
{"walls":[{"x1":m,"z1":m,"x2":m,"z2":m}],"openings":[{"wall":<wall index>,"at":0.0-1.0,"w":m,"h":m,"sill":m,"kind":"door|window|arch"}],"rooms":[{"name":str,"x":m,"z":m}],"uncertain":[]}
Rules: meters, any origin (top-down, +x right, +z down). Exterior rectangle + interior divisions for the requested rooms. Split walls at every junction/corner. Exterior doors w=0.9-1.6 h=2.1 sill=0 kind=door; windows w=1.2-1.8 h=1.2 sill=0.9; room doorways w=0.9 h=2.1 sill=0. 3-16 walls. Room x/z = center. Output JSON only.`;
      const res=await gen(prompt);
      const m=String(res?.text??res).match(/\{[\s\S]*\}/);
      if(!m) throw new Error('AI returned no JSON. Raw: '+String(res?.text??res).slice(0,200));
      const j=JSON.parse(m[0]);
      if(!Array.isArray(j.walls)||j.walls.length<3) throw new Error('AI drew fewer than 3 walls — describe rooms and sizes more concretely');
      // validate + clamp to sane meters
      const num=v=>typeof v==='number'&&isFinite(v)?v:NaN;
      j.walls=j.walls.filter(w=>[num(w.x1),num(w.z1),num(w.x2),num(w.z2)].every(isFinite)).slice(0,60)
        .map(w=>({x1:+w.x1.toFixed(2),z1:+w.z1.toFixed(2),x2:+w.x2.toFixed(2),z2:+w.z2.toFixed(2)}));
      if(j.walls.length<3) throw new Error('AI wall numbers were invalid — try again');
      j.openings=(Array.isArray(j.openings)?j.openings:[]).filter(o=>o&&j.walls[o.wall]).slice(0,40)
        .map(o=>({wall:o.wall|0,at:Math.max(0.05,Math.min(0.95,+o.at||0.5)),w:+Math.max(0.4,+o.w||1).toFixed(2),h:+o.h||(o.kind==='door'?2.1:1.15),sill:o.sill??(o.kind==='door'?0:0.9),kind:['door','window','arch'].includes(o.kind)?o.kind:'door'}));
      j.rooms=(Array.isArray(j.rooms)?j.rooms:[]).slice(0,20).map(r=>({name:String(r.name||'Room').slice(0,24),x:+num(r.x)||0,z:+num(r.z)||0}));
      j.uncertain=[];
      this.data=j;
      this.data.scale_m_per_pixel=1; // already meters
      this.fileName='described house';
      this.stepScale();
    }catch(err){
      console.warn(err);
      this.box(`<h3>Step 2 — AI designing</h3><p class="warn">Design failed: ${String(err.message||err).slice(0,300)}</p>
        <div class="stepBtns"><button class="btn primary" id="aiRetryD"><i data-lucide="rotate-cw"></i>Retry</button><button class="btn" id="aiBackD"><i data-lucide="arrow-left"></i>Back</button></div>`);
      el('#aiRetryD').onclick=()=>this.stepDescribe();
      el('#aiBackD').onclick=()=>this.stepUpload();
    }
  }

  pxExtents(){
    let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;
    for(const w of this.data.walls){ x0=Math.min(x0,w.x1,w.x2); y0=Math.min(y0,w.z1,w.z2); x1=Math.max(x1,w.x1,w.x2); y1=Math.max(y1,w.z1,w.z2); }
    return {x0,y0,x1,y1};
  }

  stepScale(){
    const mpp=this.data.scale_m_per_pixel||0.02;
    const e=this.pxExtents();
    const aiW=((e.x1-e.x0)*mpp), aiD=((e.y1-e.y0)*mpp);
    const unc=this.data.uncertain.filter(u=>u.type==='scale');
    this.box(`<h3>Step 3 — Scale & measurements</h3>
      ${unc.length?`<p class="warn">AI is unsure about scale: ${unc.map(u=>u.note).join(' ')||'no scale reference found'}</p>`:`<p>AI estimated scale from the plan.</p>`}
      <p>Detected: <b>${this.data.walls.length} walls</b>, <b>${this.data.openings.length} openings</b>, <b>${this.data.rooms.length} rooms</b>. AI footprint ≈ ${aiW.toFixed(1)} × ${aiD.toFixed(1)} m.</p>
      <label class="f">Outer width, known (m) <input type="number" id="aiW" step="0.1" min="2" value="${aiW.toFixed(1)}"></label>
      <label class="f">Wall height (m) <input type="number" id="aiH" step="0.1" min="2" max="5" value="${this.app.state.settings.wallHeightDefault||2.7}"></label>
      <label class="f">Wall thickness (m) <input type="number" id="aiT" step="0.01" min="0.05" max="0.5" value="${this.app.state.settings.wallThickness||0.15}"></label>
      <label class="f">Current floor has ${this.app.curFloor().walls.length} walls <select id="aiMode"><option value="replace">Replace them</option><option value="add">Keep + add alongside</option></select></label>
      <div class="stepBtns"><button class="btn primary" id="aiRev">Review<i data-lucide="arrow-right"></i></button></div>`);
    el('#aiRev').onclick=()=>this.stepReview();
  }

  scaledWalls(){
    const mpp=this.data.scale_m_per_pixel||0.02;
    const e=this.pxExtents();
    const userW=Math.max(2,this.userW||+el('#aiW')?.value||((e.x1-e.x0)*mpp));
    const aiWm=Math.max(0.01,(e.x1-e.x0)*mpp);
    const f=userW/aiWm; // px→m factor including user correction
    const k=px=>+((px-e.x0)*mpp*f).toFixed(3);
    const kz=px=>+((px-e.y0)*mpp*f).toFixed(3);
    return {walls:this.data.walls.map(w=>({x1:k(w.x1),z1:kz(w.z1),x2:k(w.x2),z2:kz(w.z2)})), ext:{w:userW,d:+(((e.y1-e.y0)*mpp*f).toFixed(2))}, cx:0, cz:0, k, kz, f, mpp};
  }

  stepReview(){
    const H=+el('#aiH').value||2.7, T=+el('#aiT').value||0.15;
    this.genH=H; this.genT=T; this.genMode=el('#aiMode')?.value||'replace';
    this.userW=Math.max(2,+el('#aiW').value||0);
    const s=this.scaledWalls();
    const unc=this.data.uncertain;
    const items=[];
    this.data.walls.forEach((w,i)=>{
      const u=unc.find(u=>u.type==='wall'&&u.ref===i);
      items.push({kind:'w',i,label:`Wall ${i+1} — ${Math.hypot(s.walls[i].x2-s.walls[i].x1,s.walls[i].z2-s.walls[i].z1).toFixed(2)}m`,warn:u?.note||''});
    });
    this.data.openings.forEach((o,i)=>{
      const u=unc.find(u=>u.type==='opening'&&u.ref===i);
      items.push({kind:'o',i,label:`${o.kind||'opening'} on wall ${(o.wall??-1)+1} — ${(o.w||'?')}m`,warn:u?.note||''});
    });
    this.box(`<h3>Step 4 — Review & edit later in 2D</h3>
      <p>Shell: ${s.ext.w.toFixed(1)} × ${s.ext.d.toFixed(1)} m, wall h=${H}m. Uncheck anything to skip it. Positions stay fully editable in 2D after generation.</p>
      <div id="aiRevList">${items.map((it,ix)=>`
        <div class="revItem${(it.kind==='w'?this.skipW.has(it.i):this.skipO.has(it.i))?' skip':''}" data-ix="${ix}">
          <input type="checkbox" ${(it.kind==='w'?this.skipW.has(it.i):this.skipO.has(it.i))?'':'checked'}>
          <div><b>${it.label}</b>${it.warn?`<br><small class="warn">${it.warn}</small>`:''}</div>
        </div>`).join('')||'<p>No elements.</p>'}</div>
      ${this.data.rooms.length?`<h3>Rooms (${this.data.rooms.length})</h3><div>${this.data.rooms.map((r,i)=>`
        <div class="revItem"><div style="flex:1"><b>${r.name||'Room '+(i+1)}</b><br><small>labels the plan; regenerate re-detects walls in that region</small></div>
        <button class="btn small" data-reg="${i}"><i data-lucide="rotate-cw"></i>Regen</button></div>`).join('')}</div>`:''}
      <div class="stepBtns"><button class="btn primary" id="aiGen"><i data-lucide="house"></i>Generate 2D shell</button><button class="btn" id="aiBack3"><i data-lucide="arrow-left"></i>Scale</button></div>`);
    el('#aiRevList')?.querySelectorAll('.revItem').forEach(row=>{
      const ix=+row.dataset.ix, it=items[ix];
      row.querySelector('input').onchange=e=>{
        const set=it.kind==='w'?this.skipW:this.skipO;
        if(e.target.checked) set.delete(it.i); else set.add(it.i);
        row.classList.toggle('skip',!e.target.checked);
      };
    });
    el('#aiSteps').querySelectorAll('[data-reg]').forEach(b=>b.onclick=()=>this.regenRoom(+b.dataset.reg));
    el('#aiGen').onclick=()=>this.generate();
    el('#aiBack3').onclick=()=>this.stepScale();
  }

  generate(){
    const app=this.app, fl=app.curFloor();
    const s=this.scaledWalls();
    const H=this.genH||+el('#aiH')?.value||app.state.settings.wallHeightDefault||2.7;
    const T=this.genT||+el('#aiT')?.value||app.state.settings.wallThickness||0.15;
    const mode=this.genMode||el('#aiMode')?.value||'replace';
    app.pushUndo();
    if(mode==='replace'){ fl.openings=[]; fl.walls=[]; }
    const ids=[];
    s.walls.forEach((w,i)=>{
      if(this.skipW.has(i)) return;
      const rec={id:uid('w'),x1:w.x1,z1:w.z1,x2:w.x2,z2:w.z2,h:H,t:T,color:'#e8e4da'};
      fl.walls.push(rec); ids[i]=rec.id;
    });
    let nOp=0;
    this.data.openings.forEach((o,i)=>{
      if(this.skipO.has(i)) return;
      const wid=ids[o.wall]; if(!wid) return;
      const wall=fl.walls.find(w=>w.id===wid); if(!wall) return;
      const len=Math.hypot(wall.x2-wall.x1,wall.z2-wall.z1);
      const wdt=Math.min(len*0.9,Math.max(0.4,o.w||1));
      fl.openings.push({id:uid('o'),wallId:wid,at:Math.max(0.05,Math.min(0.95,o.at??0.5)),w:+wdt.toFixed(2),h:o.h||(o.kind==='door'?2.1:1.15),sill:o.sill??(o.kind==='door'?0:0.9),kind:['door','window','arch'].includes(o.kind)?o.kind:'door',color:o.kind==='window'?'#9fc7ff':'#8a5a33'});
      nOp++;
    });
    fl.rooms=(this.data.rooms||[]).map(r=>({name:r.name||'Room',x:+(((r.x-this.pxExtents().x0)*(this.data.scale_m_per_pixel||0.02)*(s.f)).toFixed(2)),z:+(((r.z-this.pxExtents().y0)*(this.data.scale_m_per_pixel||0.02)*(s.f)).toFixed(2))}));
    // preserve blueprint as a 2D underlay for comparison (upload path only)
    if(this.cv){
    try{
      const cv2=document.createElement('canvas');
      const sc=Math.min(1,1024/Math.max(this.cv.width,this.cv.height));
      cv2.width=Math.max(1,Math.round(this.cv.width*sc)); cv2.height=Math.max(1,Math.round(this.cv.height*sc));
      cv2.getContext('2d').drawImage(this.cv,0,0,cv2.width,cv2.height);
      app.state.blueprint={name:(this.fileName||'plan').slice(0,40),dataUrl:cv2.toDataURL('image/jpeg',0.82),w:+(s.ext.w+2).toFixed(2),d:+(s.ext.d+2).toFixed(2),cx:+(s.ext.w/2).toFixed(2),cz:+(s.ext.d/2).toFixed(2),opacity:0.55,visible:true};
    }catch(e){ console.warn('underlay fail',e); }
    } // endif this.cv
    app.select(null); app.syncAll(); app.view2d.fit();
    import('./store.js').then(m=>m.saveState(app.state)).catch(()=>{});
    this.stepDone(fl.walls.length,nOp);
  }

  stepDone(nW,nO){
    this.box(`<h3>Step 5 — Shell generated ✓</h3>
      <p><b>${nW} walls, ${nO} openings</b> on ${this.app.curFloor().name}. Empty shell — decorate it yourself.${this.cv?' The original plan stays as a 2D underlay for comparison.':''}</p>
      <label class="f">Plan overlay <select id="aiVis"><option value="on">Visible</option><option value="off">Hidden</option></select></label>
      <label class="f">Overlay opacity <input type="range" id="aiOp" min="0.1" max="1" step="0.05" value="${this.app.state.blueprint?.opacity??0.55}"></label>
      <div class="stepBtns"><button class="btn primary" id="aiTo2d"><i data-lucide="scan"></i>Review in 2D</button><button class="btn" id="aiTo3d"><i data-lucide="box"></i> Generate 3D</button></div>`);
    el('#aiVis').onchange=e=>{ if(this.app.state.blueprint){ this.app.state.blueprint.visible=e.target.value==='on'; this.app.view2d.request(); import('./store.js').then(m=>m.saveState(this.app.state)).catch(()=>{}); } };
    el('#aiOp').oninput=e=>{ if(this.app.state.blueprint){ this.app.state.blueprint.opacity=+e.target.value; this.app.view2d.request(); } };
    el('#aiOp').onchange=()=>import('./store.js').then(m=>m.saveState(this.app.state)).catch(()=>{});
    el('#aiTo2d').onclick=()=>{ el('#aiVeil').classList.remove('on'); document.querySelector('#mode2dBtn')?.click(); this.app.view2d.fit(); };
    el('#aiTo3d').onclick=()=>{ el('#aiVeil').classList.remove('on'); document.querySelector('#mode3dBtn')?.click(); };
  }

  async regenRoom(i){
    const r=this.data.rooms[i]; if(!r) return;
    toast('Re-detecting '+(r.name||'room')+'…');
    try{
      const mpp=this.data.scale_m_per_pixel||0.02;
      const pad=40; // px margin
      const sx=Math.max(0,(r.x-r.w/2)-pad), sy=Math.max(0,(r.z-r.d/2)-pad);
      const sw=Math.min(this.cv.width-sx,r.w+pad*2), sh=Math.min(this.cv.height-sy,r.d+pad*2);
      const key=i+'_'+Math.round(sx)+'_'+Math.round(sy);
      const cv=document.createElement('canvas'); cv.width=Math.round(sw); cv.height=Math.round(sh);
      cv.getContext('2d').drawImage(this.cv,sx,sy,sw,sh,0,0,sw,sh);
      const blob=await canvasBlob(cv,'image/jpeg',0.9);
      const gen=globalThis.root?.generateText;
      const res=await gen({instruction:[ROOM_PROMPT,blob]});
      const m=String(res?.text??res).match(/\{[\s\S]*\}/);
      if(!m) throw new Error('no JSON');
      const sub=JSON.parse(m[0]);
      if(!Array.isArray(sub.walls)||!sub.walls.length) throw new Error('no walls found');
      // replace walls whose midpoint falls in the crop bbox
      const app=this.app, fl=app.curFloor();
      app.pushUndo();
      // delete walls intersecting the room's meter bbox, add fresh detections
      const e=this.pxExtents(); const sc=this.scaledWalls();
      const mx0=((sx-e.x0)*mpp*sc.f), mz0=((sy-e.y0)*mpp*sc.f);
      const mx1=((sx+sw-e.x0)*mpp*sc.f), mz1=((sy+sh-e.y0)*mpp*sc.f);
      const H=fl.walls[0]?.h||app.state.settings.wallHeightDefault||2.7;
      const T=fl.walls[0]?.t||app.state.settings.wallThickness||0.15;
      fl.walls=fl.walls.filter(w=>{
        const cx=(w.x1+w.x2)/2, cz=(w.z1+w.z2)/2;
        if(cx>mx0-0.3&&cx<mx1+0.3&&cz>mz0-0.3&&cz<mz1+0.3){ fl.openings=fl.openings.filter(o=>o.wallId!==w.id); return false; }
        return true;
      });
      for(const w of sub.walls){
        fl.walls.push({id:uid('w'),
          x1:+(((sx+w.x1-e.x0)*mpp*sc.f).toFixed(3)),z1:+(((sy+w.z1-e.y0)*mpp*sc.f).toFixed(3)),
          x2:+(((sx+w.x2-e.x0)*mpp*sc.f).toFixed(3)),z2:+(((sy+w.z2-e.y0)*mpp*sc.f).toFixed(3)),
          h:H,t:T,color:'#e8e4da'});
      }
      import('./store.js').then(m=>m.saveState(app.state)).catch(()=>{});
      app.syncAll(); app.view2d.fit();
      toast('✓ '+(r.name||'Room')+' regenerated ('+sub.walls.length+' walls)');
      this.data.walls=sub.walls.map(w=>({x1:w.x1+sx,z1:w.z1+sy,x2:w.x2+sx,z2:w.z2+sy}));
    }catch(err){ console.warn(err); toast('Regen failed: '+String(err.message||err).slice(0,120)); }
  }
}
