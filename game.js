(() => {
  'use strict';
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const scoreEl = document.getElementById('score');
  const bestEl = document.getElementById('best');
  const ballsEl = document.getElementById('balls');
  const toast = document.getElementById('toast');
  const soundButton = document.getElementById('sound-toggle');

  const W = 600, H = 900, GRAVITY = 520;
  const bumpers = [
    {x:300,y:250,r:38,color:'#ff4cb4',points:1000,phase:0},
    {x:210,y:370,r:31,color:'#50f6ff',points:500,phase:1},
    {x:390,y:370,r:31,color:'#ffdf70',points:500,phase:2},
    {x:300,y:490,r:27,color:'#a879ff',points:750,phase:3}
  ];
  const walls = [
    [78,105,78,690],[78,105,153,83],[153,83,446,83],[446,83,505,125],
    [505,125,505,700],[78,690,120,770],[505,700,467,770],
    [120,770,205,770],[395,770,467,770],[500,155,520,130],[500,700,520,730]
  ];
  let score = 0;
  let best = Number(localStorage.getItem('neonNightsBest') || 0);
  let balls = 3;
  let lastTime = 0;
  let soundOn = true;
  let audio = null;
  let pulling = false;
  let pull = 0;
  let pullStartY = 0;
  let toastTimer;
  let shake = 0;
  let particles = [];
  let gameOver = false;
  const keys = {left:false,right:false};
  const ball = {x:532,y:745,vx:0,vy:0,r:12,active:false,held:true,resetTimer:0,trail:[]};
  const flippers = [
    {x:232,y:743,length:88,rest:-0.32,active:-0.91,angle:-0.32,side:'left',hit:false},
    {x:368,y:743,length:88,rest:-2.82,active:-2.23,angle:-2.82,side:'right',hit:false}
  ];

  bestEl.textContent = format(best);
  function format(n){return Math.max(0,Math.floor(n)).toString().padStart(6,'0')}
  function setToast(text, time=2100){toast.textContent=text;toast.classList.remove('hidden');clearTimeout(toastTimer);if(time)toastTimer=setTimeout(()=>toast.classList.add('hidden'),time)}
  function tone(freq, duration=.12, type='square', volume=.045, endFreq=null){
    if(!soundOn)return;
    try{
      audio ||= new (window.AudioContext||window.webkitAudioContext)();
      if(audio.state==='suspended')audio.resume();
      const osc=audio.createOscillator(), gain=audio.createGain();
      osc.type=type;osc.frequency.setValueAtTime(freq,audio.currentTime);
      if(endFreq)osc.frequency.exponentialRampToValueAtTime(endFreq,audio.currentTime+duration);
      gain.gain.setValueAtTime(volume,audio.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audio.currentTime+duration);
      osc.connect(gain);gain.connect(audio.destination);osc.start();osc.stop(audio.currentTime+duration);
    }catch(_){/* Audio is optional when unavailable. */}
  }
  function addScore(n){score+=n;scoreEl.textContent=format(score);if(score>best){best=score;bestEl.textContent=format(best);localStorage.setItem('neonNightsBest',String(best))}}

  function launch(){
    if(gameOver){score=0;balls=3;gameOver=false;scoreEl.textContent=format(score);ballsEl.textContent=balls;ball.held=true;ball.active=false;ball.x=532;ball.y=745;pull=0;setToast('DRAG THE PLUNGER TO LAUNCH');return}
    if(!ball.held)return;
    const power=Math.max(.35,pull/100);
    ball.held=false;ball.active=true;ball.vx=-95-power*45;ball.vy=-360-power*710;
    tone(180+power*100,.24,'sawtooth',.055,620);setToast('LET IT RIDE!',900);pull=0;
  }
  function loseBall(){
    if(!ball.active)return;
    ball.active=false;ball.held=false;ball.vx=ball.vy=0;balls--;ballsEl.textContent=balls;shake=9;tone(150,.35,'triangle',.07,55);
    if(balls<=0){gameOver=true;setToast('GAME OVER — CLICK TO PLAY AGAIN',0)}
    else{setToast('BALL LOST — GET READY',1100);ball.resetTimer=1.15}
  }
  function resetBall(){ball.x=532;ball.y=745;ball.vx=ball.vy=0;ball.held=true;ball.active=false;ball.trail=[];pull=0}
  function closestPoint(px,py,x1,y1,x2,y2){const dx=x2-x1,dy=y2-y1;const l=dx*dx+dy*dy;const t=l?Math.max(0,Math.min(1,((px-x1)*dx+(py-y1)*dy)/l)):0;return{x:x1+t*dx,y:y1+t*dy,t}}
  function collideSegment(x1,y1,x2,y2,r,restitution=0.78){
    const p=closestPoint(ball.x,ball.y,x1,y1,x2,y2),dx=ball.x-p.x,dy=ball.y-p.y,d=Math.hypot(dx,dy);
    if(d>=ball.r+r||d===0)return false;
    const nx=dx/d,ny=dy/d;ball.x=p.x+nx*(ball.r+r);ball.y=p.y+ny*(ball.r+r);
    const vn=ball.vx*nx+ball.vy*ny;if(vn<0){ball.vx-=(1+restitution)*vn*nx;ball.vy-=(1+restitution)*vn*ny}
    return true;
  }
  function physics(dt,now){
    if(ball.held){ball.x=532;ball.y=745+pull*.64;return}
    if(!ball.active){if(ball.resetTimer>0){ball.resetTimer-=dt;if(ball.resetTimer<=0){resetBall();setToast('DRAG THE PLUNGER TO LAUNCH')}}return}
    ball.vy+=GRAVITY*dt;ball.x+=ball.vx*dt;ball.y+=ball.vy*dt;
    ball.vx*=Math.pow(.999,dt*60);ball.vy*=Math.pow(.999,dt*60);
    ball.trail.push({x:ball.x,y:ball.y});if(ball.trail.length>8)ball.trail.shift();
    // Fixed rails around the playfield and the shooter lane.
    for(const s of walls)collideSegment(...s,5,.72);
    // Inner shooter-lane rail: the lane is open at its lower entrance.
    collideSegment(514,165,514,690,3,.72);
    for(const b of bumpers){
      const dx=ball.x-b.x,dy=ball.y-b.y,d=Math.hypot(dx,dy),min=ball.r+b.r;
      if(d<min&&d>0){const nx=dx/d,ny=dy/d;ball.x=b.x+nx*min;ball.y=b.y+ny*min;const vn=ball.vx*nx+ball.vy*ny;ball.vx-=1.9*vn*nx;ball.vy-=1.9*vn*ny;ball.vx+=nx*100;ball.vy+=ny*100;
        if(now-b.phase>270){b.phase=now;addScore(b.points);tone(460+b.points/5,.13,'square',.045,850);burst(b.x,b.y,b.color,12);shake=4}
      }
    }
    for(const f of flippers){
      const target=keys[f.side]?f.active:f.rest;
      const old=f.angle;f.angle+=(target-f.angle)*Math.min(1,dt*23);
      const x2=f.x+Math.cos(f.angle)*f.length,y2=f.y+Math.sin(f.angle)*f.length;
      if(collideSegment(f.x,f.y,x2,y2,9,.76)){
        const wasHit=f.hit;f.hit=true;
        if(keys[f.side]){ball.vy-=wasHit?0:245;ball.vx+=(f.side==='left'?90:-90);tone(f.side==='left'?260:315,.075,'square',.035,440);if(!wasHit)burst(ball.x,ball.y,'#fff0a8',4)}
      }else f.hit=false;
      // A moving paddle lends a little energy on the upswing.
      if(keys[f.side]&&Math.abs(target-old)>.05&&f.hit)ball.vy-=70;
    }
    // Drain gap between the flippers.
    if(ball.y>835&&ball.x>132&&ball.x<475)loseBall();
    if(ball.y>H+40||ball.x<-35||ball.x>W+35)loseBall();
  }
  function burst(x,y,color,count){for(let i=0;i<count;i++){const a=Math.random()*Math.PI*2,s=45+Math.random()*180;particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:.3+Math.random()*.4,max:.7,color})}}
  function updateParticles(dt){particles=particles.filter(p=>p.life>0);for(const p of particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=.96;p.vy*=.96;p.life-=dt}}
  function glow(color,blur){ctx.shadowColor=color;ctx.shadowBlur=blur}
  function line(x1,y1,x2,y2,color,width=2){ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineCap='round';ctx.stroke()}

  function drawTable(now){
    ctx.clearRect(0,0,W,H);
    const bg=ctx.createLinearGradient(0,70,0,850);bg.addColorStop(0,'#111531');bg.addColorStop(.55,'#10132a');bg.addColorStop(1,'#19132c');ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);
    // Subtle 3D playfield perspective and luminous inner rails.
    ctx.save();ctx.beginPath();ctx.moveTo(79,106);ctx.lineTo(153,84);ctx.lineTo(446,84);ctx.lineTo(504,126);ctx.lineTo(504,700);ctx.lineTo(467,770);ctx.lineTo(395,770);ctx.lineTo(368,806);ctx.lineTo(232,806);ctx.lineTo(205,770);ctx.lineTo(120,770);ctx.lineTo(78,690);ctx.closePath();
    const field=ctx.createLinearGradient(100,100,490,800);field.addColorStop(0,'#171c40');field.addColorStop(.5,'#11172f');field.addColorStop(1,'#221536');ctx.fillStyle=field;ctx.fill();ctx.strokeStyle='#55edff';ctx.lineWidth=2;glow('#39dff6',13);ctx.stroke();ctx.restore();ctx.shadowBlur=0;
    // Decorative star grid
    ctx.save();ctx.globalAlpha=.16;for(let y=145;y<745;y+=38)for(let x=112;x<475;x+=38){ctx.fillStyle=(Math.floor(x/38+y/38)%3===0)?'#a9a8ff':'#55eaff';ctx.fillRect(x,y,2,2)}ctx.restore();
    // Shooter lane, shown with raised rails and a launch guide.
    ctx.fillStyle='#080d20';ctx.fillRect(510,148,27,565);line(510,148,510,692,'#60edff',2);line(537,148,537,692,'#5b426f',2);
    ctx.save();ctx.strokeStyle='#ffdf70';ctx.lineWidth=2;ctx.setLineDash([6,8]);ctx.globalAlpha=.55;ctx.beginPath();ctx.moveTo(523,170);ctx.lineTo(523,680);ctx.stroke();ctx.restore();
    // Rails
    ctx.save();ctx.lineJoin='round';ctx.beginPath();ctx.moveTo(78,105);ctx.lineTo(153,83);ctx.lineTo(446,83);ctx.lineTo(505,125);ctx.lineTo(505,700);ctx.lineTo(467,770);ctx.lineTo(395,770);ctx.moveTo(205,770);ctx.lineTo(120,770);ctx.lineTo(78,690);ctx.closePath();ctx.strokeStyle='#ff4cb4';ctx.lineWidth=5;glow('#ff4cb4',13);ctx.stroke();ctx.restore();ctx.shadowBlur=0;
    // Slingshots
    for(const [x,y,flip] of [[145,630,false],[455,630,true]]){ctx.save();ctx.translate(x,y);if(flip)ctx.scale(-1,1);ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(74,49);ctx.lineTo(11,63);ctx.closePath();ctx.fillStyle='#241737';ctx.fill();ctx.strokeStyle='#ff4cb4';ctx.lineWidth=3;glow('#ff4cb4',12);ctx.stroke();ctx.restore();ctx.shadowBlur=0}
    // Bumpers
    for(const b of bumpers){const pulse=Math.max(0,1-(now-b.phase)/300);ctx.save();const g=ctx.createRadialGradient(b.x-8,b.y-10,3,b.x,b.y,b.r+6);g.addColorStop(0,'#fff7ff');g.addColorStop(.18,b.color);g.addColorStop(.62,b.color+'bb');g.addColorStop(1,'#10142c');ctx.fillStyle=g;ctx.beginPath();ctx.arc(b.x,b.y,b.r+4+pulse*5,0,Math.PI*2);glow(b.color,20+pulse*20);ctx.fill();ctx.strokeStyle='#fff';ctx.globalAlpha=.8;ctx.lineWidth=2;ctx.stroke();ctx.shadowBlur=0;ctx.fillStyle='#fff';ctx.globalAlpha=.85;ctx.font='700 11px Orbitron, sans-serif';ctx.textAlign='center';ctx.fillText('+'+b.points,b.x,b.y+4);ctx.restore()}
    // Lane arrows / bonus lettering
    ctx.save();ctx.textAlign='center';ctx.font='700 12px Orbitron,sans-serif';ctx.fillStyle='#a2a8ff';ctx.globalAlpha=.85;ctx.fillText('NEON',300,170);ctx.fillStyle='#ffdf70';ctx.font='600 10px Orbitron,sans-serif';ctx.fillText('NIGHTS',300,188);ctx.restore();
    // Flippers with metallic 3D body and neon edge.
    for(const f of flippers){const tx=f.x+Math.cos(f.angle)*f.length,ty=f.y+Math.sin(f.angle)*f.length;ctx.save();ctx.lineCap='round';line(f.x,f.y,tx,ty,'#1b1730',24);line(f.x,f.y,tx,ty,keys[f.side]?'#ffdf70':'#f04cba',17);line(f.x,f.y,tx,ty,'#fff3c8',3);glow(keys[f.side]?'#ffdf70':'#ff4cb4',16);ctx.beginPath();ctx.arc(f.x,f.y,14,0,Math.PI*2);ctx.fillStyle='#ed58b4';ctx.fill();ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.stroke();ctx.restore();ctx.shadowBlur=0}
    // Plunger base and spring travel indicator.
    ctx.save();ctx.fillStyle='#25213e';ctx.fillRect(511,696,25,94);ctx.strokeStyle='#ffdf70';ctx.lineWidth=2;glow('#ffdf70',8);ctx.strokeRect(511,696,25,94);ctx.shadowBlur=0;
    const cy=733+pull*.62;ctx.beginPath();ctx.moveTo(523,cy-17);for(let i=0;i<8;i++)ctx.lineTo(i%2?517:529,cy-17+i*4.8);ctx.lineTo(523,cy+22);ctx.strokeStyle='#ffdfa0';ctx.lineWidth=2;ctx.stroke();ctx.beginPath();ctx.arc(523,cy+25,6,0,Math.PI*2);ctx.fillStyle='#fff0bb';ctx.fill();ctx.restore();
    // Drain lights
    for(let i=0;i<5;i++){ctx.beginPath();ctx.arc(235+i*32,812,4,0,Math.PI*2);ctx.fillStyle=(Math.floor(now/220)%5===i)?'#fff':'#ff4cb4';glow('#ff4cb4',8);ctx.fill();ctx.shadowBlur=0}
    // Ball trail and ball
    for(let i=0;i<ball.trail.length;i++){const p=ball.trail[i],a=(i+1)/ball.trail.length*.22;ctx.beginPath();ctx.arc(p.x,p.y,ball.r*a*1.7,0,Math.PI*2);ctx.fillStyle=`rgba(80,246,255,${a})`;ctx.fill()}
    if(ball.held||ball.active){ctx.save();const g=ctx.createRadialGradient(ball.x-4,ball.y-5,1,ball.x,ball.y,ball.r+3);g.addColorStop(0,'#fff');g.addColorStop(.35,'#eafaff');g.addColorStop(.72,'#78dbff');g.addColorStop(1,'#1b52a7');ctx.fillStyle=g;ctx.beginPath();ctx.arc(ball.x,ball.y,ball.r,0,Math.PI*2);glow('#75efff',17);ctx.fill();ctx.restore();ctx.shadowBlur=0}
    // Spark particles
    for(const p of particles){ctx.globalAlpha=Math.max(0,p.life/p.max);ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x,p.y,2.4,0,Math.PI*2);ctx.fill()}ctx.globalAlpha=1;
    // Perspective cabinet edge highlights
    ctx.save();ctx.globalAlpha=.5;line(55,58,545,58,'#6d78ac',2);line(55,58,55,835,'#5e6899',2);line(545,58,545,835,'#5e6899',2);ctx.restore();
  }
  function frame(t){const dt=Math.min(.032,(t-lastTime)/1000||0);lastTime=t;if(shake>0)shake=Math.max(0,shake-dt*20);physics(dt,t);updateParticles(dt);ctx.save();if(shake)ctx.translate((Math.random()-.5)*shake,(Math.random()-.5)*shake);drawTable(t);ctx.restore();requestAnimationFrame(frame)}

  function pointerPos(e){const r=canvas.getBoundingClientRect();return{x:(e.clientX-r.left)*W/r.width,y:(e.clientY-r.top)*H/r.height}}
  canvas.addEventListener('pointerdown',e=>{e.preventDefault();canvas.setPointerCapture(e.pointerId);const p=pointerPos(e);if(ball.held&&p.x>475&&p.y>640){pulling=true;pullStartY=p.y;pull=Math.min(100,Math.max(0,(pullStartY-p.y)+35));tone(115,.05,'triangle',.02)}else if(gameOver){launch()}else if(ball.held){pulling=true;pullStartY=p.y;pull=20}});
  canvas.addEventListener('pointermove',e=>{if(!pulling)return;const p=pointerPos(e);pull=Math.max(0,Math.min(100,(p.y-pullStartY)*.75));});
  function releasePointer(){if(!pulling)return;pulling=false;launch()}
  canvas.addEventListener('pointerup',releasePointer);canvas.addEventListener('pointercancel',releasePointer);
  window.addEventListener('keydown',e=>{const k=e.key.toLowerCase();if(['a','d','arrowleft','arrowright',' '].includes(k))e.preventDefault();if(k==='a'||k==='arrowleft')keys.left=true;if(k==='d'||k==='arrowright')keys.right=true;if(k===' '&&ball.held)launch()});
  window.addEventListener('keyup',e=>{const k=e.key.toLowerCase();if(k==='a'||k==='arrowleft')keys.left=false;if(k==='d'||k==='arrowright')keys.right=false});
  soundButton.addEventListener('click',()=>{soundOn=!soundOn;soundButton.textContent=soundOn?'♪ SOUND ON':'♪ SOUND OFF';soundButton.setAttribute('aria-pressed',String(!soundOn));if(soundOn)tone(620,.09,'square',.035,900)});
  requestAnimationFrame(frame);
})();
