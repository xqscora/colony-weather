(() => {
  const W = 32, H = 20, MAX_CELLS = 180, DT = 0.25;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const fmt = (n, d=1) => Number(n).toFixed(d);

  function makeRng(seed) {
    let x = seed >>> 0;
    return () => { x = (1664525 * x + 1013904223) >>> 0; return x / 4294967296; };
  }
  function createChamber(settings, seed=41) {
    const rand = makeRng(seed);
    const glucose = new Float32Array(W*H).fill(Number(settings.glucose));
    const oxygen = new Float32Array(W*H).fill(Number(settings.oxygen)/100);
    const cells=[]; const occupied=new Set();
    for(let i=0;i<Number(settings.seeds);i++){
      let x,y,key,tries=0;
      do { x=3+Math.floor(rand()*(W-6)); y=3+Math.floor(rand()*(H-6)); key=y*W+x; tries++; } while(occupied.has(key)&&tries<200);
      occupied.add(key); cells.push({x,y,mass:0.76+rand()*0.18});
    }
    return {glucose,oxygen,ethanol:new Float32Array(W*H),co2:new Float32Array(W*H),cells,time:0,step:0,settings:{...settings},history:[],rng:rand,events:[],createdCells:cells.length};
  }
  function diffuse(field, rate=0.045) {
    const next=field.slice();
    for(let y=1;y<H-1;y++) for(let x=1;x<W-1;x++){
      const i=y*W+x, avg=(field[i-1]+field[i+1]+field[i-W]+field[i+W])*0.25;
      next[i]=field[i]+(avg-field[i])*rate;
    }
    return next;
  }
  function metrics(s) {
    const sum=a=>a.reduce((n,v)=>n+v,0)/a.length;
    const biomass=s.cells.reduce((n,c)=>n+c.mass,0);
    return {cells:s.cells.length,biomass,glucose:sum(s.glucose),oxygen:sum(s.oxygen),ethanol:sum(s.ethanol),co2:sum(s.co2)};
  }
  function tick(s) {
    if(s.time>=48) return s;
    const temperature=Number(s.settings.temp);
    const tempFactor=Math.exp(-Math.pow((temperature-30)/16,2));
    const occupied=new Set(s.cells.map(c=>c.y*W+c.x));
    for(const c of s.cells){
      const i=c.y*W+c.x, g=s.glucose[i], o=s.oxygen[i];
      const uptake=Math.min(g,0.12*c.mass*(g/(0.35+g)));
      if(uptake<=0.00001){ c.mass=Math.max(0.35,c.mass-0.004); continue; }
      const highSugar=g/(g+1.3), oxygenRel=o/(o+0.24);
      const ferment=clamp(0.18+0.58*highSugar+0.24*(1-oxygenRel),0.12,0.96);
      const resp=1-ferment;
      s.glucose[i]=Math.max(0,g-uptake);
      const oUse=Math.min(o,uptake*resp*0.65);
      s.oxygen[i]=Math.max(0,o-oUse);
      s.ethanol[i]+=uptake*ferment*0.53;
      s.co2[i]+=uptake*(0.12+0.55*resp);
      const energy=uptake*(0.26+resp*0.82)*tempFactor;
      c.mass+=energy*0.14-0.0025;
      if(c.mass>=1.42&&s.cells.length<MAX_CELLS){
        const candidates=[[0,-1],[1,0],[0,1],[-1,0]].map(([dx,dy])=>({x:clamp(c.x+dx,1,W-2),y:clamp(c.y+dy,1,H-2)})).filter(p=>!occupied.has(p.y*W+p.x));
        if(candidates.length){
          const p=candidates[Math.floor(s.rng()*candidates.length)]; occupied.add(p.y*W+p.x);
          c.mass*=0.51; s.cells.push({x:p.x,y:p.y,mass:c.mass}); s.createdCells++;
        } else c.mass=1.41;
      }
    }
    s.cells=s.cells.filter(c=>c.mass>0.36);
    s.glucose=diffuse(s.glucose,0.045); s.oxygen=diffuse(s.oxygen,0.07); s.ethanol=diffuse(s.ethanol,0.025); s.co2=diffuse(s.co2,0.035);
    s.time+=DT; s.step++;
    if(s.step%2===0){ const m=metrics(s); s.history.push({time:s.time,...m}); }
    return s;
  }
  function pulse(s, amount=1) {
    const each=Number(amount); for(let i=0;i<s.glucose.length;i++) s.glucose[i]+=each;
    s.events.push({time:s.time,kind:'glucose pulse',amount:each});
  }
  function createPair(settingsA, settingsB, seed=41) { return {a:createChamber(settingsA,seed),b:createChamber(settingsB,seed)}; }
  const api={W,H,DT,MAX_CELLS,createChamber,createPair,tick,metrics,pulse};
  if(typeof module!=='undefined'&&module.exports) module.exports=api;

  if(typeof document==='undefined') return;
  const $=id=>document.getElementById(id);
  const settings=side=>({glucose:Number($(`glucose${side}`).value),oxygen:Number($(`oxygen${side}`).value),temp:Number($(`temp${side}`).value),seeds:Number($('seedInput').value)});
  let pair=createPair(settings('A'),settings('B')); let running=false, interval=null;
  const colors={a:'#277c73',b:'#cf7258'};
  function drawDish(canvasId,s,key){
    const canvas=$(canvasId), rect=canvas.getBoundingClientRect(), dpr=window.devicePixelRatio||1;
    if(canvas.width!==Math.round(rect.width*dpr)||canvas.height!==Math.round(rect.height*dpr)){canvas.width=Math.round(rect.width*dpr);canvas.height=Math.round(rect.height*dpr);}
    const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);const cw=rect.width,ch=rect.height,tw=cw/W,th=ch/H;
    const field=s.glucose;
    for(let y=0;y<H;y++)for(let x=0;x<W;x++){
      const v=field[y*W+x];
      const t=clamp(v/8,0,1);
      ctx.fillStyle=`rgb(${Math.round(235-48*t)},${Math.round(247-20*t)},${Math.round(239-22*t)})`;
      ctx.fillRect(x*tw,y*th,tw+0.5,th+0.5);
    }
    for(const c of s.cells){const x=(c.x+0.5)*tw,y=(c.y+0.5)*th,r=2.1+Math.min(2,c.mass*0.7);ctx.beginPath();ctx.ellipse(x,y,r*1.2,r,0,0,Math.PI*2);ctx.fillStyle=colors[key==='dishA'?'a':'b'];ctx.fill();ctx.beginPath();ctx.arc(x+r*0.9,y-r*0.55,r*0.45,0,Math.PI*2);ctx.fillStyle=key==='dishA'?'#82b8a8':'#e7a18c';ctx.fill();}
    ctx.strokeStyle='#dce8e4';ctx.lineWidth=1;ctx.strokeRect(.5,.5,cw-1,ch-1);
  }
  function drawChart(id,series,field,maxOverride){
    const c=$(id),r=c.getBoundingClientRect(),dpr=window.devicePixelRatio||1;c.width=Math.round(r.width*dpr);c.height=Math.round(r.height*dpr);
    const x=c.getContext('2d');x.setTransform(dpr,0,0,dpr,0,0);const w=r.width,h=r.height,p={l:31,r:7,t:8,b:22},iw=w-p.l-p.r,ih=h-p.t-p.b;
    x.clearRect(0,0,w,h);const vals=series.flatMap(s=>s.history.map(v=>v[field]));const max=maxOverride||Math.max(1,...vals)*1.08;
    x.font='9px DM Mono,monospace';x.fillStyle='#849397';x.strokeStyle='#e6ecea';x.lineWidth=1;
    for(let j=0;j<=3;j++){const yy=p.t+ih*j/3;x.beginPath();x.moveTo(p.l,yy);x.lineTo(w-p.r,yy);x.stroke();x.fillText(fmt(max*(1-j/3),0),2,yy+3);}
    x.fillText('0h',p.l,h-5);x.fillText('48h',w-30,h-5);
    for(let k=0;k<series.length;k++){
      const hist=series[k].history;if(hist.length<2)continue;x.strokeStyle=k===0?colors.a:colors.b;x.lineWidth=2;x.beginPath();
      hist.forEach((v,i)=>{const px=p.l+iw*(v.time/48),py=p.t+ih*(1-clamp(v[field]/max,0,1));i?x.lineTo(px,py):x.moveTo(px,py);});x.stroke();
    }
  }
  function render(){
    for(const side of ['A','B']){
      const s=pair[side.toLowerCase()],m=metrics(s);drawDish(`dish${side}`,s,`dish${side}`);$(`time${side}`).textContent=`${fmt(s.time)} h`;
      $(`metrics${side}`).innerHTML=[['CELLS',m.cells,'agents'],['BIOMASS',fmt(m.biomass),'rel.'],['GLUCOSE',fmt(m.glucose),'rel.'],['O₂',`${fmt(m.oxygen*100,0)}%`,'rel.']].map(v=>`<div class="metric"><span>${v[0]}</span><strong>${v[1]}</strong><small>${v[2]}</small></div>`).join('');
    }
    drawChart('populationChart',[pair.a,pair.b],'cells',MAX_CELLS);drawChart('glucoseChart',[pair.a,pair.b],'glucose',8);
    const key=$('outputSelect').value;drawChart('outputChart',[pair.a,pair.b],key,key==='oxygen'?1:undefined);
    const ma=metrics(pair.a),mb=metrics(pair.b);const d=ma.cells-mb.cells;
    if(pair.a.step>0){const leader=Math.abs(d)<2?'The populations remain close so far.':`${d>0?'A':'B'} has ${Math.abs(d)} more cells at this snapshot.`;
      $('observation').innerHTML=`<span class="observation-mark">↗</span><div><strong>${leader}</strong><p>At ${fmt(pair.a.time)} h: glucose A/B ${fmt(ma.glucose)}/${fmt(mb.glucose)}; ethanol proxy A/B ${fmt(ma.ethanol)}/${fmt(mb.ethanol)}. This is a model readout, not a real-culture claim.</p></div><span class="observation-time">STEP ${pair.a.step}</span>`;
    }
  }
  function stop(){running=false;clearInterval(interval);interval=null;$('runBtn').innerHTML='<span aria-hidden="true">▶</span> Run both';}
  function oneStep(){tick(pair.a);tick(pair.b);render();if(pair.a.time>=48)stop();}
  function start(){if(running){stop();return;}running=true;$('runBtn').innerHTML='<span aria-hidden="true">Ⅱ</span> Pause';interval=setInterval(()=>{for(let i=0;i<Number($('speedSelect').value);i++)if(pair.a.time<48){tick(pair.a);tick(pair.b);}render();if(pair.a.time>=48)stop();},100);}
  function reset(){stop();pair=createPair(settings('A'),settings('B'));render();}
  for(const side of ['A','B'])for(const name of ['glucose','oxygen','temp']){
    const input=$(`${name}${side}`),out=$(`${name}${side}Out`);input.addEventListener('input',()=>{out.textContent=name==='oxygen'?`${input.value}%`:name==='temp'?`${input.value}°C`:fmt(input.value);});input.addEventListener('change',()=>{if(pair.a.step===0)reset();});
  }
  $('seedInput').addEventListener('input',e=>$('seedOut').textContent=e.target.value);
  $('seedInput').addEventListener('change',()=>{if(pair.a.step===0)reset();});
  $('runBtn').addEventListener('click',start);$('stepBtn').addEventListener('click',()=>{stop();oneStep();});$('resetBtn').addEventListener('click',reset);
  $('pulseA').addEventListener('click',()=>{pulse(pair.a,1);render();});$('pulseB').addEventListener('click',()=>{pulse(pair.b,1);render();});$('outputSelect').addEventListener('change',render);
  $('aboutBtn').addEventListener('click',()=>$('modelDialog').showModal());$('modelLink').addEventListener('click',()=>$('modelDialog').showModal());
  $('exportBtn').addEventListener('click',()=>{
    const rows=['time_h,chamber,cells,biomass_rel,glucose_rel,oxygen_rel,ethanol_proxy,co2_proxy'];
    for(const [label,s] of [['A',pair.a],['B',pair.b]])for(const m of s.history)rows.push([m.time,label,m.cells,m.biomass.toFixed(4),m.glucose.toFixed(4),m.oxygen.toFixed(4),m.ethanol.toFixed(4),m.co2.toFixed(4)].join(','));
    const blob=new Blob([rows.join('\n')+'\n'],{type:'text/csv'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='colony-weather-experiment.csv';a.click();URL.revokeObjectURL(a.href);
  });
  window.addEventListener('resize',render);
  window.ColonyWeather={get state(){return pair;},step:oneStep,reset,tick,render};
  render();
})();
