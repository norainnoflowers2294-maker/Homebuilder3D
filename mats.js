// Procedural PBR-style textures (canvas-generated, zero assets) + lighting/quality presets.
function RNG(seed){ let s=seed>>>0; return ()=>((s=(s*1664525+1013904223)>>>0)/4294967296); }

const _texCache=new Map();
function makeTex(THREE, name, size, draw, rx=1, ry=1){
  const key=name+'|'+size+'|'+rx+'x'+ry;
  if(_texCache.has(key)) return _texCache.get(key);
  const c=document.createElement('canvas'); c.width=c.height=size;
  const g=c.getContext('2d');
  draw(g,size);
  const t=new THREE.CanvasTexture(c);
  t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(rx,ry);
  t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=8;
  _texCache.set(key,t); return t;
}
function grain(g,size,rnd,n,alpha,light){
  for(let i=0;i<n;i++){
    const y=rnd()*size, h=0.6+rnd()*1.4, w=size*(0.04+rnd()*0.12), x=rnd()*size;
    g.fillStyle=light?`rgba(255,255,255,${alpha*rnd()})`:`rgba(0,0,0,${alpha*rnd()})`;
    g.fillRect(x,y,w,h);
  }
}
function planks(g,size,rnd,base,rows,vertical=false){
  g.fillStyle=base; g.fillRect(0,0,size,size);
  const step=size/rows;
  for(let r=0;r<rows;r++){
    const off=(r%2)*step*0.5+rnd()*step*0.3;
    for(let s=-1;s<3;s++){
      const x=((s*step*1.7+off)%(size+step)+size+step)%(size+step)-step;
      const tone=0.92+rnd()*0.16;
      g.fillStyle=`rgb(${Math.min(255,150*tone)|0},${Math.min(255,118*tone)|0},${Math.min(255,86*tone)|0})`;
      if(vertical) g.fillRect(r*step,0,step-1.5,size); else g.fillRect(0,r*step,size,step-1.5);
      void x;
    }
    // grain streaks
    for(let i=0;i<14;i++){
      g.strokeStyle=`rgba(90,60,35,${0.05+rnd()*0.09})`; g.lineWidth=0.8+rnd();
      g.beginPath();
      if(vertical){ const x0=r*step+rnd()*step; g.moveTo(x0,0); g.bezierCurveTo(x0+3,size*0.3,x0-3,size*0.6,x0+2,size); }
      else { const y0=r*step+rnd()*step; g.moveTo(0,y0); g.bezierCurveTo(size*0.3,y0+3,size*0.6,y0-3,size,y0+2); }
      g.stroke();
    }
    g.fillStyle='rgba(60,40,22,0.55)';
    if(vertical) g.fillRect(r*step,0,1.5,size); else g.fillRect(0,r*step,size,1.5);
  }
}

const painters={
  oak(g,s){ const r=RNG(7); planks(g,s,r,'#96683c',5); },
  walnut(g,s){ const r=RNG(21); planks(g,s,r,'#5b3d26',5); },
  whitewood(g,s){ const r=RNG(33); planks(g,s,r,'#ddd6c8',5); },
  marble(g,s){
    const r=RNG(99);
    const grad=g.createLinearGradient(0,0,s,s);
    grad.addColorStop(0,'#eef0f2'); grad.addColorStop(0.5,'#e2e6ea'); grad.addColorStop(1,'#f2f4f6');
    g.fillStyle=grad; g.fillRect(0,0,s,s);
    for(let i=0;i<16;i++){
      g.strokeStyle=`rgba(120,135,150,${0.08+r()*0.14})`; g.lineWidth=0.6+r()*1.6;
      g.beginPath(); let x=r()*s,y=r()*s; g.moveTo(x,y);
      for(let k=0;k<5;k++){ x+=(r()-0.5)*s*0.5; y+=(r()-0.5)*s*0.5; g.quadraticCurveTo(x+(r()-0.5)*30,y+(r()-0.5)*30,x,y); }
      g.stroke();
    }
    grain(g,s,r,500,0.05,false);
  },
  tile(g,s){
    const r=RNG(5);
    g.fillStyle='#dfe3e8'; g.fillRect(0,0,s,s);
    const n=4, st=s/n;
    for(let i=0;i<n;i++) for(let j=0;j<n;j++){
      const t=0.94+r()*0.1;
      g.fillStyle=`rgb(${(223*t)|0},${(227*t)|0},${(232*t)|0})`;
      g.fillRect(i*st+1.5,j*st+1.5,st-3,st-3);
      if(r()<0.25){ g.fillStyle='rgba(255,255,255,0.10)'; g.fillRect(i*st+1.5,j*st+1.5,st-3,(st-3)*0.4); }
    }
    g.fillStyle='#9aa2ac';
    for(let i=0;i<=n;i++){ g.fillRect(i*st-1,0,2,s); g.fillRect(0,i*st-1,s,2); }
  },
  fabric(g,s){
    const r=RNG(11);
    g.fillStyle='#c9c9cf'; g.fillRect(0,0,s,s);
    for(let y=0;y<s;y+=3) for(let x=0;x<s;x+=3){
      const t=r();
      g.fillStyle=t<0.5?'rgba(0,0,0,0.06)':'rgba(255,255,255,0.07)';
      g.fillRect(x,y,2.4,2.4);
    }
    grain(g,s,r,300,0.04,true);
  },
  wallpaint(g,s){
    const r=RNG(3);
    g.fillStyle='#efe9dd'; g.fillRect(0,0,s,s);
    grain(g,s,r,1200,0.02,false); grain(g,s,r,700,0.018,true);
  },
  carpet(g,s){
    const r=RNG(17);
    g.fillStyle='#b9b3a8'; g.fillRect(0,0,s,s);
    for(let i=0;i<5200;i++){
      g.fillStyle=r()<0.5?'rgba(0,0,0,0.08)':'rgba(255,255,255,0.08)';
      g.fillRect(r()*s,r()*s,1.4,1.4);
    }
  },
  concrete(g,s){
    const r=RNG(29);
    g.fillStyle='#b9bec4'; g.fillRect(0,0,s,s);
    grain(g,s,r,2600,0.05,false); grain(g,s,r,1400,0.05,true);
  },
  roof(g,s){
    const r=RNG(41);
    g.fillStyle='#3a3f46'; g.fillRect(0,0,s,s);
    const n=6, st=s/n;
    for(let row=0;row<n;row++) for(let i=-1;i<n+1;i++){
      const off=(row%2)*st/2;
      const t=0.85+r()*0.3;
      g.fillStyle=`rgb(${(74*t)|0},${(80*t)|0},${(88*t)|0})`;
      g.fillRect(i*st+off+1,row*st+1,st-2,st*0.9);
    }
    grain(g,s,r,1500,0.08,false);
  },
  grass(g,s){
    const r=RNG(53);
    g.fillStyle='#4a7c3f'; g.fillRect(0,0,s,s);
    for(let i=0;i<4200;i++){
      const t=r();
      g.fillStyle=t<0.45?'rgba(30,70,25,0.25)':t<0.8?'rgba(90,140,70,0.22)':'rgba(150,180,110,0.15)';
      g.fillRect(r()*s,r()*s,1.6,2.6);
    }
  },
  blob(g,s){
    const grd=g.createRadialGradient(s/2,s/2,s*0.05,s/2,s/2,s*0.5);
    grd.addColorStop(0,'rgba(0,0,0,0.55)'); grd.addColorStop(0.7,'rgba(0,0,0,0.25)'); grd.addColorStop(1,'rgba(0,0,0,0)');
    g.fillStyle='rgba(0,0,0,0)'; g.fillRect(0,0,s,s);
    g.fillStyle=grd; g.fillRect(0,0,s,s);
  },
  curtain(g,s){
    const r=RNG(67);
    g.fillStyle='#d8cfc2'; g.fillRect(0,0,s,s);
    for(let x=0;x<s;x+=7){
      const grd=g.createLinearGradient(x,0,x+7,0);
      grd.addColorStop(0,'rgba(0,0,0,0.14)'); grd.addColorStop(0.5,'rgba(255,255,255,0.10)'); grd.addColorStop(1,'rgba(0,0,0,0.14)');
      g.fillStyle=grd; g.fillRect(x,0,7,s);
    }
    grain(g,s,r,500,0.03,false);
  },
  darkwood(g,s){ const r=RNG(71); planks(g,s,r,'#4a3320',5); },
  // ---- wallpapers ----
  floral(g,s){
    const r=RNG(101);
    g.fillStyle='#f3ece2'; g.fillRect(0,0,s,s);
    for(let i=0;i<6;i++) for(let j=0;j<6;j++){
      const x=(i+0.5*(j%2))*s/6, y=j*s/6;
      const cols=['#d96a8a','#c65f7e','#e8a0b4'];
      const c=cols[(i+j)%3];
      for(let p=0;p<5;p++){ const a=p/5*Math.PI*2+r();
        g.fillStyle=c; g.beginPath(); g.arc(x+Math.cos(a)*5,y+Math.sin(a)*5,4.2,0,7); g.fill(); }
      g.fillStyle='#e8c05a'; g.beginPath(); g.arc(x,y,3.4,0,7); g.fill();
      g.fillStyle='rgba(90,140,90,.5)';
      g.beginPath(); g.ellipse(x+9,y+8,5,2.4,0.6,0,7); g.fill();
    }
    grain(g,s,r,400,0.03,false);
  },
  stripe(g,s){
    const r=RNG(103); void r;
    g.fillStyle='#f4efe6'; g.fillRect(0,0,s,s);
    g.fillStyle='#7c9fc4';
    for(let x=0;x<s;x+=32) g.fillRect(x,0,13,s);
    g.fillStyle='rgba(124,159,196,.35)';
    for(let x=16;x<s;x+=32) g.fillRect(x,0,3,s);
  },
  geo(g,s){
    const r=RNG(107);
    g.fillStyle='#ece7db'; g.fillRect(0,0,s,s);
    const n=6, st=s/n;
    for(let i=0;i<n;i++) for(let j=0;j<n;j++){
      g.fillStyle=(i+j)%2?'#7c8fc9':'#e8a05a';
      g.globalAlpha=0.75;
      g.beginPath();
      if((i+j)%2){ g.moveTo(i*st+st/2,j*st); g.lineTo(i*st+st,j*st+st/2); g.lineTo(i*st+st/2,j*st+st); g.lineTo(i*st,j*st+st/2); }
      else { g.moveTo(i*st,j*st); g.lineTo(i*st+st,j*st); g.lineTo(i*st+st/2,j*st+st); }
      g.closePath(); g.fill(); g.globalAlpha=1;
    }
    grain(g,s,r,300,0.03,false);
  },
  damask(g,s){
    const r=RNG(109);
    g.fillStyle='#3d2b52'; g.fillRect(0,0,s,s);
    g.fillStyle='#c9a86a';
    for(let i=0;i<4;i++) for(let j=0;j<4;j++){
      const x=(i+0.5*(j%2))*s/4, y=j*s/4;
      g.save(); g.translate(x,y); g.rotate(Math.PI/4);
      g.fillRect(-7,-7,14,14); g.fillStyle='#3d2b52'; g.fillRect(-4,-4,8,8); g.fillStyle='#c9a86a';
      g.restore();
      g.beginPath(); g.arc(x,y,2,0,7); g.fill();
    }
    grain(g,s,r,500,0.05,false);
  },
  kids(g,s){
    const r=RNG(113);
    g.fillStyle='#bfe3f2'; g.fillRect(0,0,s,s);
    const cols=['#ff6b6b','#ffd93d','#6bcb77','#ff9f1c','#ffffff'];
    for(let i=0;i<40;i++){
      g.fillStyle=cols[(r()*cols.length)|0];
      const x=r()*s, y=r()*s;
      if(r()<0.4){ g.beginPath(); g.arc(x,y,3+r()*4,0,7); g.fill(); }
      else { g.save(); g.translate(x,y); g.rotate(r()*3); g.fillRect(-4,-1.5,8,3); g.fillRect(-1.5,-4,3,8); g.restore(); }
    }
  },
  // ---- wall materials ----
  brick(g,s){
    const r=RNG(127);
    g.fillStyle='#b9a89a'; g.fillRect(0,0,s,s);
    const bh=s/8, bw=s/4;
    for(let row=0;row<8;row++){
      const off=(row%2)*bw/2;
      for(let cx=-1;cx<5;cx++){
        const t=0.82+r()*0.36;
        const rr=Math.min(255,(168*t)|0), gg=Math.min(255,(92*t)|0), bb=Math.min(255,(70*t)|0);
        g.fillStyle=`rgb(${rr},${gg},${bb})`;
        g.fillRect(cx*bw+off+2,row*bh+2,bw-4,bh-4);
        g.fillStyle='rgba(255,255,255,.08)'; g.fillRect(cx*bw+off+2,row*bh+2,bw-4,4);
      }
    }
  },
  shiplap(g,s){
    const r=RNG(131);
    g.fillStyle='#e9e2d4'; g.fillRect(0,0,s,s);
    const n=6, st=s/n;
    for(let i=0;i<n;i++){
      const t=0.94+r()*0.1;
      g.fillStyle=`rgb(${(233*t)|0},${(226*t)|0},${(212*t)|0})`;
      g.fillRect(0,i*st+2,s,st-4);
      g.fillStyle='rgba(90,70,50,.5)'; g.fillRect(0,i*st,s,2);
      g.fillStyle='rgba(255,255,255,.25)'; g.fillRect(0,i*st+2,s,2);
    }
    grain(g,s,r,300,0.03,false);
  },
  woodpanel(g,s){
    const r=RNG(137); planks(g,s,r,'#6b4a2e',6,true);
  },
  stone(g,s){
    const r=RNG(139);
    g.fillStyle='#8f8a80'; g.fillRect(0,0,s,s);
    for(let row=0;row<5;row++){
      const y=row*s/5, n=3+((row%2));
      for(let i=0;i<n;i++){
        const x=((i+(row%2)*0.5)/n)*s;
        const t=0.8+r()*0.4;
        g.fillStyle=`rgb(${(150*t)|0},${(144*t)|0},${(132*t)|0})`;
        const wdt=s/n-6;
        g.beginPath(); g.roundRect(x+3,y+3,wdt,s/5-6,7); g.fill();
        g.fillStyle='rgba(255,255,255,.09)';
        g.beginPath(); g.roundRect(x+6,y+5,wdt-6,8,4); g.fill();
      }
    }
  },
  venetian(g,s){
    const r=RNG(141);
    const grd=g.createLinearGradient(0,0,s,s);
    grd.addColorStop(0,'#e6ddcf'); grd.addColorStop(0.5,'#ded3c2'); grd.addColorStop(1,'#e9e0d1');
    g.fillStyle=grd; g.fillRect(0,0,s,s);
    for(let i=0;i<26;i++){
      g.fillStyle=`rgba(190,175,155,${0.05+r()*0.08})`;
      g.beginPath(); g.ellipse(r()*s,r()*s,20+r()*50,12+r()*30,r()*3,0,7); g.fill();
    }
  },
  panel3d(g,s){
    const r=RNG(143); void r;
    g.fillStyle='#dfe0e2'; g.fillRect(0,0,s,s);
    const n=5, st=s/n;
    for(let i=0;i<n;i++) for(let j=0;j<n;j++){
      const grd=g.createLinearGradient(i*st,j*st,i*st+st,j*st+st);
      if((i+j)%2){ grd.addColorStop(0,'#f4f5f6'); grd.addColorStop(1,'#b9bcbf'); }
      else { grd.addColorStop(0,'#c6c9cc'); grd.addColorStop(1,'#eef0f1'); }
      g.fillStyle=grd;
      g.beginPath(); g.moveTo(i*st,j*st); g.lineTo(i*st+st,j*st); g.lineTo(i*st,j*st+st); g.closePath(); g.fill();
    }
  },
  acoustic(g,s){
    const r=RNG(149); void r;
    g.fillStyle='#241d16'; g.fillRect(0,0,s,s);
    for(let x=0;x<s;x+=16){
      const grd=g.createLinearGradient(x,0,x+11,0);
      grd.addColorStop(0,'#8a6238'); grd.addColorStop(0.5,'#a97e4f'); grd.addColorStop(1,'#6b4a2c');
      g.fillStyle=grd; g.fillRect(x+2,0,11,s);
    }
  },
  tilebig(g,s){
    const r=RNG(151);
    g.fillStyle='#cfd4d9'; g.fillRect(0,0,s,s);
    const n=2, st=s/n;
    for(let i=0;i<n;i++) for(let j=0;j<n;j++){
      const t=0.94+r()*0.1;
      g.fillStyle=`rgb(${(228*t)|0},${(230*t)|0},${(233*t)|0})`;
      g.fillRect(i*st+2,j*st+2,st-4,st-4);
    }
  },
  // ---- flooring ----
  herring(g,s){
    const r=RNG(157);
    g.fillStyle='#7a5230'; g.fillRect(0,0,s,s);
    const wdt=s/8, hgt=s/3.2;
    for(let i=-1;i<9;i++) for(let j=0;j<4;j++){
      g.save(); g.translate(i*wdt, j*hgt); g.rotate((j%2?1:-1)*Math.PI/5);
      const t=0.85+r()*0.3;
      g.fillStyle=`rgb(${(150*t)|0},${(102*t)|0},${(62*t)|0})`;
      g.fillRect(-wdt/2,-hgt/2+1,wdt-2,hgt-2);
      g.restore();
    }
  },
  chevron(g,s){
    const r=RNG(159); void r;
    g.fillStyle='#8a5f36'; g.fillRect(0,0,s,s);
    g.lineWidth=13;
    for(let y=-s;y<s*2;y+=36){
      g.strokeStyle='rgba(60,35,18,.55)';
      g.beginPath(); g.moveTo(0,y); g.lineTo(s/2,y+18); g.lineTo(s,y); g.stroke();
      g.strokeStyle='rgba(255,220,170,.18)';
      g.beginPath(); g.moveTo(0,y+7); g.lineTo(s/2,y+25); g.lineTo(s,y+7); g.stroke();
    }
  },
  laminate(g,s){ const r=RNG(161); planks(g,s,r,'#c9a878',5); },
  vinyl(g,s){ const r=RNG(163); planks(g,s,r,'#a8a49c',5); },
  granite(g,s){
    const r=RNG(167);
    g.fillStyle='#4a4d52'; g.fillRect(0,0,s,s);
    for(let i=0;i<2600;i++){
      const t=r();
      g.fillStyle=t<0.6?'rgba(200,205,212,.5)':t<0.85?'rgba(20,22,26,.5)':'rgba(180,150,120,.4)';
      g.fillRect(r()*s,r()*s,1.6,1.6);
    }
  },
  terrazzo(g,s){
    const r=RNG(169);
    g.fillStyle='#e3ddd2'; g.fillRect(0,0,s,s);
    const cols=['#8a8f96','#c96a5a','#5a7d9c','#3a3a3a','#c9a86a'];
    for(let i=0;i<70;i++){
      g.fillStyle=cols[(r()*cols.length)|0];
      g.beginPath();
      const x=r()*s,y=r()*s,rad=3+r()*10;
      g.moveTo(x+rad,y);
      for(let k=1;k<6;k++){ const a=k/6*Math.PI*2; g.lineTo(x+Math.cos(a)*rad*(0.6+r()*0.5),y+Math.sin(a)*rad*(0.6+r()*0.5)); }
      g.closePath(); g.fill();
    }
  },
  checker(g,s){
    g.fillStyle='#111'; g.fillRect(0,0,s,s);
    const n=4, st=s/n;
    for(let i=0;i<n;i++) for(let j=0;j<n;j++){
      g.fillStyle=(i+j)%2?'#111315':'#eef0ee';
      g.fillRect(i*st+1,j*st+1,st-2,st-2);
    }
  },
  carpetluxe(g,s){
    const r=RNG(173);
    g.fillStyle='#8f7f9c'; g.fillRect(0,0,s,s);
    for(let i=0;i<7000;i++){
      g.fillStyle=r()<0.5?'rgba(0,0,0,.1)':'rgba(255,255,255,.09)';
      g.fillRect(r()*s,r()*s,1.5,2.2);
    }
  },
  stonefloor(g,s){
    const r=RNG(179);
    g.fillStyle='#7d7870'; g.fillRect(0,0,s,s);
    const n=3, st=s/n;
    for(let i=0;i<n;i++) for(let j=0;j<n;j++){
      const t=0.85+r()*0.3;
      g.fillStyle=`rgb(${(140*t)|0},${(135*t)|0},${(125*t)|0})`;
      g.beginPath(); g.roundRect(i*st+3,j*st+3,st-6,st-6,5); g.fill();
      grain(g,s,r,60,0.04,false);
    }
  },
  // ---- terrain / patio ----
  turf(g,s){
    const r=RNG(181);
    g.fillStyle='#3f8f3a'; g.fillRect(0,0,s,s);
    for(let i=0;i<6000;i++){
      g.fillStyle=r()<0.5?'rgba(20,80,20,.3)':'rgba(140,200,110,.25)';
      g.fillRect(r()*s,r()*s,1.5,2.8);
    }
  },
  grassdry(g,s){
    const r=RNG(183);
    g.fillStyle='#9a9a55'; g.fillRect(0,0,s,s);
    for(let i=0;i<4200;i++){
      const t=r();
      g.fillStyle=t<0.4?'rgba(120,110,50,.3)':t<0.8?'rgba(150,150,80,.3)':'rgba(90,120,50,.25)';
      g.fillRect(r()*s,r()*s,1.6,2.6);
    }
  },
  mulch(g,s){
    const r=RNG(187);
    g.fillStyle='#4a3220'; g.fillRect(0,0,s,s);
    for(let i=0;i<900;i++){
      g.save(); g.translate(r()*s,r()*s); g.rotate(r()*3);
      const t=0.7+r()*0.7;
      g.fillStyle=`rgb(${(110*t)|0},${(70*t)|0},${(40*t)|0})`;
      g.fillRect(-5,-2,10,4);
      g.restore();
    }
  },
  gravel(g,s){
    const r=RNG(191);
    g.fillStyle='#9a978f'; g.fillRect(0,0,s,s);
    for(let i=0;i<1500;i++){
      const t=0.7+r()*0.5;
      g.fillStyle=`rgb(${(160*t)|0},${(156*t)|0},${(148*t)|0})`;
      g.beginPath(); g.arc(r()*s,r()*s,1+r()*2.4,0,7); g.fill();
    }
  },
  dirt(g,s){
    const r=RNG(193);
    g.fillStyle='#6e5236'; g.fillRect(0,0,s,s);
    for(let i=0;i<40;i++){
      g.fillStyle=`rgba(60,40,22,${0.1+r()*0.15})`;
      g.beginPath(); g.ellipse(r()*s,r()*s,10+r()*30,6+r()*16,r()*3,0,7); g.fill();
    }
    grain(g,s,r,900,0.06,false);
  },
  sand(g,s){
    const r=RNG(197);
    g.fillStyle='#e3d3a8'; g.fillRect(0,0,s,s);
    grain(g,s,r,3200,0.05,false); grain(g,s,r,1500,0.05,true);
  },
  paver(g,s){
    const r=RNG(199);
    g.fillStyle='#6e6a62'; g.fillRect(0,0,s,s);
    const n=3, st=s/n;
    for(let i=0;i<n;i++) for(let j=0;j<n;j++){
      const t=0.8+r()*0.35;
      g.fillStyle=`rgb(${(168*t)|0},${(160*t)|0},${(148*t)|0})`;
      g.beginPath(); g.roundRect(i*st+3,j*st+3,st-6,st-6,9); g.fill();
    }
  },
  deck(g,s){ const r=RNG(201); planks(g,s,r,'#8a5f3a',6); },
  composite(g,s){ const r=RNG(203); planks(g,s,r,'#5a5f66',6); },
  patio_stone(g,s){
    const r=RNG(205);
    g.fillStyle='#a09a8e'; g.fillRect(0,0,s,s);
    for(let row=0;row<4;row++) for(let i=0;i<4;i++){
      const x=((i+(row%2)*0.5)/4)*s, t=0.85+r()*0.3;
      g.fillStyle=`rgb(${(178*t)|0},${(170*t)|0},${(156*t)|0})`;
      g.beginPath(); g.roundRect(x+3,row*s/4+3,s/4-6,s/4-6,10); g.fill();
    }
  },
  water(g,s){
    const r=RNG(211); void r;
    const grd=g.createLinearGradient(0,0,s,s);
    grd.addColorStop(0,'#2f9fd8'); grd.addColorStop(0.5,'#1f7fb8'); grd.addColorStop(1,'#2f9fd8');
    g.fillStyle=grd; g.fillRect(0,0,s,s);
    g.strokeStyle='rgba(255,255,255,.22)'; g.lineWidth=2;
    for(let i=0;i<12;i++){
      const y=(i/12)*s;
      g.beginPath();
      for(let x=0;x<=s;x+=8) g.lineTo(x,y+Math.sin(x*0.1+i)*4);
      g.stroke();
    }
  },
};

export function tex(THREE, name, rx=1, ry=1){
  const p=painters[name]||painters.wallpaint;
  return makeTex(THREE,'px_'+name,512,p,rx,ry);
}

export const LIGHTING={
  day:      {sun:0xfff2dd,sunI:2.6,sky:0xbfd4ff,gnd:0x8a7a66,hemiI:0.9,bg:0x9fc3e8,fog:[60,220],exp:1.0,int:0.25,pos:[14,20,9],skyTop:0x3f7cd6,skyBot:0xcfe4f7,stars:0},
  golden:   {sun:0xffab52,sunI:2.35,sky:0xffecd1,gnd:0x6b533d,hemiI:0.85,bg:0xf2c89b,fog:[55,210],exp:1.05,int:0.75,pos:[-18,8,-8],skyTop:0x60457a,skyBot:0xfef5e7,stars:0.05,ambientHue:0xfef5e7,amberGlow:true},
  morning:  {sun:0xffd9a8,sunI:2.2,sky:0xcfe0ff,gnd:0x8a7a66,hemiI:0.8,bg:0xa8c8e8,fog:[55,210],exp:1.0,int:0.35,pos:[-16,9,10],skyTop:0x5a8fd6,skyBot:0xf2ddc0,stars:0},
  afternoon:{sun:0xfff6e8,sunI:2.8,sky:0xc4d9ff,gnd:0x8a7a66,hemiI:0.95,bg:0x9cc0e6,fog:[60,220],exp:1.02,int:0.2,pos:[4,22,-14],skyTop:0x3a76cf,skyBot:0xd4e6f5,stars:0},
  sunset:   {sun:0xff8d36,sunI:2.2,sky:0xf8b486,gnd:0x543f30,hemiI:0.70,bg:0xde8256,fog:[50,190],exp:1.04,int:0.85,pos:[-21,5.5,-6],skyTop:0x38346b,skyBot:0xfef5e7,stars:0.25,ambientHue:0xfef5e7,amberGlow:true},
  night:    {sun:0x8fa8ff,sunI:0.35,sky:0x2a3a5a,gnd:0x1a1a22,hemiI:0.35,bg:0x0b1220,fog:[40,160],exp:0.95,int:1.0,pos:[10,18,-8],skyTop:0x04060f,skyBot:0x101a30,stars:1},
};

export const QUALITY={
  performance:{pr:1,   shadow:0,   env:0.2, sunShadow:false},
  balanced:   {pr:1.5, shadow:1024,env:0.45,sunShadow:true},
  high:       {pr:2,   shadow:2048,env:0.6, sunShadow:true},
  ultra:      {pr:2.5, shadow:4096,env:0.75,sunShadow:true},
};
export const QUALITY_ORDER=['performance','balanced','high','ultra'];
export function qualityId(id){
  if(id==='low') return 'performance';
  if(id==='medium') return 'balanced';
  return QUALITY[id]?id:'balanced';
}

export function deviceDefaultQuality(){
  try{
    // only very small / old phones start on Performance; everything else gets Balanced
    if(Math.min(window.innerWidth,window.innerHeight)<380) return 'performance';
  }catch(e){}
  return 'balanced';
}

// ---- wall finish catalog: id -> {name, icon, tex painter, base tint} ----
export const FINISHES=[
  {id:'paint_white', name:'White', icon:'⬜', tex:'wallpaint', base:'#f4f1ea'},
  {id:'paint_cream', name:'Cream', icon:'🟧', tex:'wallpaint', base:'#f3e9d2'},
  {id:'paint_beige', name:'Beige', icon:'🟫', tex:'wallpaint', base:'#d9c6a5'},
  {id:'paint_gray', name:'Gray', icon:'⬛', tex:'wallpaint', base:'#9aa0a8'},
  {id:'paint_black', name:'Black', icon:'⬛', tex:'wallpaint', base:'#232326'},
  {id:'pastel_pink', name:'Pastel pink', icon:'🌸', tex:'wallpaint', base:'#f3c9d4'},
  {id:'pastel_blue', name:'Pastel blue', icon:'🩵', tex:'wallpaint', base:'#c3d9ec'},
  {id:'pastel_green', name:'Pastel green', icon:'🌿', tex:'wallpaint', base:'#c4dfc0'},
  {id:'pastel_lilac', name:'Lilac', icon:'💜', tex:'wallpaint', base:'#d3c6e8'},
  {id:'pastel_peach', name:'Peach', icon:'🍑', tex:'wallpaint', base:'#f2cf9f'},
  {id:'bold_red', name:'Bold red', icon:'🟥', tex:'wallpaint', base:'#b8352f'},
  {id:'bold_navy', name:'Navy', icon:'🟦', tex:'wallpaint', base:'#27436b'},
  {id:'bold_emerald', name:'Emerald', icon:'🟩', tex:'wallpaint', base:'#1f6e52'},
  {id:'bold_mustard', name:'Mustard', icon:'🟨', tex:'wallpaint', base:'#c9992e'},
  {id:'bold_teal', name:'Teal', icon:'🦚', tex:'wallpaint', base:'#14707a'},
  {id:'wp_floral', name:'Floral', icon:'🌺', tex:'floral', base:'#ffffff'},
  {id:'wp_stripe', name:'Striped', icon:'🦓', tex:'stripe', base:'#ffffff'},
  {id:'wp_geo', name:'Geometric', icon:'🔷', tex:'geo', base:'#ffffff'},
  {id:'wp_marble', name:'Marble', icon:'🤍', tex:'marble', base:'#ffffff'},
  {id:'wp_texture', name:'Textured', icon:'🧱', tex:'venetian', base:'#ffffff'},
  {id:'wp_luxury', name:'Luxury damask', icon:'👑', tex:'damask', base:'#ffffff'},
  {id:'wp_kids', name:'Kids fun', icon:'🧒', tex:'kids', base:'#ffffff'},
  {id:'mat_brick', name:'Brick', icon:'🧱', tex:'brick', base:'#ffffff'},
  {id:'mat_brickdark', name:'Exposed brick', icon:'🏭', tex:'brick', base:'#c9b8a8'},
  {id:'mat_woodpanel', name:'Wood panel', icon:'🪵', tex:'woodpanel', base:'#ffffff'},
  {id:'mat_shiplap', name:'Shiplap', icon:'⬜', tex:'shiplap', base:'#ffffff'},
  {id:'mat_wainscot', name:'Wainscoting', icon:'🪟', tex:'shiplap', base:'#d8cfc0'},
  {id:'mat_boardbatten', name:'Board + batten', icon:'🪟', tex:'woodpanel', base:'#e8e2d4'},
  {id:'mat_stone', name:'Stone', icon:'🪨', tex:'stone', base:'#ffffff'},
  {id:'mat_concrete', name:'Concrete', icon:'🌫️', tex:'concrete', base:'#ffffff'},
  {id:'mat_plaster', name:'Plaster', icon:'⬜', tex:'wallpaint', base:'#e8e0d2'},
  {id:'mat_venetian', name:'Venetian plaster', icon:'✨', tex:'venetian', base:'#ffffff'},
  {id:'mat_tile', name:'Tile', icon:'🟦', tex:'tile', base:'#ffffff'},
  {id:'mat_marbleslab', name:'Marble slabs', icon:'⬜', tex:'marble', base:'#dfe6ea'},
  {id:'mat_panel3d', name:'3D panels', icon:'🔶', tex:'panel3d', base:'#ffffff'},
  {id:'mat_acoustic', name:'Acoustic slats', icon:'🎵', tex:'acoustic', base:'#ffffff'},
];
export const FINISH_MAP=Object.fromEntries(FINISHES.map(f=>[f.id,f]));

// ---- flooring / patio / terrain materials ----
export const ZONE_MATS=[
  {id:'oak', name:'Hardwood', icon:'🪵', tex:'oak', base:'#ffffff', kind:'floor'},
  {id:'oak_light', name:'Oak', icon:'🪵', tex:'oak', base:'#f2e2c9', kind:'floor'},
  {id:'walnut', name:'Dark walnut', icon:'🟫', tex:'walnut', base:'#ffffff', kind:'floor'},
  {id:'herring', name:'Herringbone', icon:'🎣', tex:'herring', base:'#ffffff', kind:'floor'},
  {id:'chevron', name:'Chevron', icon:'🔻', tex:'chevron', base:'#ffffff', kind:'floor'},
  {id:'laminate', name:'Laminate', icon:'🟨', tex:'laminate', base:'#ffffff', kind:'floor'},
  {id:'vinyl', name:'Vinyl plank', icon:'⬜', tex:'vinyl', base:'#ffffff', kind:'floor'},
  {id:'ceramic', name:'Ceramic tile', icon:'🟦', tex:'tile', base:'#ffffff', kind:'floor'},
  {id:'porcelain', name:'Porcelain', icon:'⬜', tex:'tilebig', base:'#ffffff', kind:'floor'},
  {id:'marble_f', name:'Marble', icon:'🤍', tex:'marble', base:'#ffffff', kind:'floor'},
  {id:'granite', name:'Granite', icon:'⬛', tex:'granite', base:'#ffffff', kind:'floor'},
  {id:'terrazzo', name:'Terrazzo', icon:'🔶', tex:'terrazzo', base:'#ffffff', kind:'floor'},
  {id:'concrete_f', name:'Concrete', icon:'🌫️', tex:'concrete', base:'#ffffff', kind:'floor'},
  {id:'carpet', name:'Carpet', icon:'🟧', tex:'carpet', base:'#ffffff', kind:'floor'},
  {id:'carpet_luxe', name:'Luxury carpet', icon:'👑', tex:'carpetluxe', base:'#ffffff', kind:'floor'},
  {id:'pattern_tile', name:'Patterned tile', icon:'🔷', tex:'geo', base:'#ffffff', kind:'floor'},
  {id:'checker', name:'Checkerboard', icon:'🏁', tex:'checker', base:'#ffffff', kind:'floor'},
  {id:'stone_f', name:'Stone', icon:'🪨', tex:'stonefloor', base:'#ffffff', kind:'floor'},
  {id:'patio_conc', name:'Concrete patio', icon:'🌫️', tex:'concrete', base:'#cfd2d6', kind:'patio'},
  {id:'patio_stone', name:'Stone patio', icon:'🪨', tex:'patio_stone', base:'#ffffff', kind:'patio'},
  {id:'patio_paver', name:'Pavers', icon:'🧱', tex:'paver', base:'#ffffff', kind:'patio'},
  {id:'deck_wood', name:'Wooden deck', icon:'🪵', tex:'deck', base:'#ffffff', kind:'patio'},
  {id:'deck_comp', name:'Composite deck', icon:'⬜', tex:'composite', base:'#ffffff', kind:'patio'},
  {id:'grass', name:'Grass', icon:'🌱', tex:'grass', base:'#ffffff', kind:'terrain'},
  {id:'turf', name:'Turf', icon:'🌱', tex:'turf', base:'#ffffff', kind:'terrain'},
  {id:'grassdry', name:'Dry grass', icon:'🌾', tex:'grassdry', base:'#ffffff', kind:'terrain'},
  {id:'mulch', name:'Mulch', icon:'🟫', tex:'mulch', base:'#ffffff', kind:'terrain'},
  {id:'gravel', name:'Gravel', icon:'⚪', tex:'gravel', base:'#ffffff', kind:'terrain'},
  {id:'dirt', name:'Soil', icon:'🟤', tex:'dirt', base:'#ffffff', kind:'terrain'},
  {id:'sand', name:'Sand', icon:'🏖️', tex:'sand', base:'#ffffff', kind:'terrain'},
];
export const ZONE_MAP=Object.fromEntries(ZONE_MATS.map(f=>[f.id,f]));

export const POOL_WATERS=[
  {id:'aqua', name:'Aqua', icon:'🩵', base:'#2f9fd8'},
  {id:'turquoise', name:'Turquoise', icon:'💎', base:'#25c9b8'},
  {id:'deepblue', name:'Deep blue', icon:'🟦', base:'#1a5fb8'},
  {id:'lagoon', name:'Lagoon', icon:'🌊', base:'#3fb8a8'},
  {id:'teal', name:'Teal night', icon:'🌙', base:'#14606e'},
];
export const POOL_WATER_MAP=Object.fromEntries(POOL_WATERS.map(f=>[f.id,f]));

// Designer Color Palettes for walls, surfaces, and furniture
export const DESIGNER_COLORS = [
  { id:'c_cream', name:'Warm Alabaster', hex:'#f5f0e6', cat:'neutral' },
  { id:'c_linen', name:'Natural Linen', hex:'#e8e1d3', cat:'neutral' },
  { id:'c_greige', name:'Nordic Greige', hex:'#d3ccc1', cat:'neutral' },
  { id:'c_taupe', name:'Warm Taupe', hex:'#a89f91', cat:'neutral' },
  { id:'c_charcoal', name:'Luxe Charcoal', hex:'#2a2d34', cat:'dark' },
  { id:'c_black', name:'Obsidian Black', hex:'#171719', cat:'dark' },
  { id:'c_navy', name:'Midnight Navy', hex:'#1b293d', cat:'bold' },
  { id:'c_forest', name:'Hunter Green', hex:'#223b2e', cat:'bold' },
  { id:'c_terracotta', name:'Tuscan Terracotta', hex:'#b85a3c', cat:'warm' },
  { id:'c_ochre', name:'Golden Ochre', hex:'#d49d3d', cat:'warm' },
  { id:'c_olive', name:'Muted Olive', hex:'#6b7352', cat:'earth' },
  { id:'c_sage', name:'Soft Sage', hex:'#9eb09b', cat:'earth' },
  { id:'c_clay', name:'Desert Clay', hex:'#c48f78', cat:'warm' },
  { id:'c_blush', name:'Dusty Rose', hex:'#d9a79c', cat:'pastel' },
  { id:'c_sky', name:'Nordic Fog Blue', hex:'#9fb5c7', cat:'pastel' },
  { id:'c_lavender', name:'Muted Lavender', hex:'#b8adcc', cat:'pastel' },
  { id:'c_purewhite', name:'Chantilly White', hex:'#ffffff', cat:'neutral' },
  { id:'c_goldaccent', name:'Architectural Brass', hex:'#c99d42', cat:'metal' }
];

const _thumbCache = new Map();

/**
 * Returns a high-resolution dataURL preview of any procedural texture or solid color
 */
export function getTextureThumb(m, size = 96) {
  if (!m) return '';
  const isColor = !!m.hex;
  const texName = isColor ? 'wallpaint' : (m.tex || m.id || 'wallpaint');
  const baseColor = m.hex || m.base || '#ffffff';
  const key = `${texName}|${baseColor}|${size}`;
  if (_thumbCache.has(key)) return _thumbCache.get(key);

  try {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    if (isColor) {
      // Clean luxury swatch with subtle ambient border
      ctx.fillStyle = baseColor;
      ctx.fillRect(0, 0, size, size);
      // subtle vignette
      const grd = ctx.createRadialGradient(size/2, size/2, size*0.2, size/2, size/2, size*0.7);
      grd.addColorStop(0, 'rgba(255,255,255,0.08)');
      grd.addColorStop(1, 'rgba(0,0,0,0.14)');
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, size, size);
    } else {
      const painter = painters[texName];
      if (painter) {
        painter(ctx, size);
        if (baseColor && baseColor !== '#ffffff') {
          ctx.fillStyle = baseColor;
          ctx.globalCompositeOperation = 'multiply';
          ctx.fillRect(0, 0, size, size);
          ctx.globalCompositeOperation = 'source-over';
        }
      } else {
        ctx.fillStyle = baseColor;
        ctx.fillRect(0, 0, size, size);
        grain(ctx, size, RNG(42), 600, 0.04, false);
      }
    }
    const dataUrl = canvas.toDataURL('image/png');
    _thumbCache.set(key, dataUrl);
    return dataUrl;
  } catch (e) {
    return '';
  }
}

export { painters };
