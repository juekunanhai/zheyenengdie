/** Read native polygon vertices through Box2D's official debug-draw callback path.
 * Captures Cocos Graphics commands produced directly from B2.HEAPF32 vertices;
 * does not change collision decisions or reconstruct native geometry from input. */
const {chromium}=require('/Users/admin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),path=require('node:path');
const ROOT=path.resolve(__dirname,'../..'),OUT=path.join(ROOT,'preparation/review/evidence/difficulty-r1');
const profiles={original16:JSON.parse(fs.readFileSync(path.join(OUT,'initial16/profiles/geometry-cushion.json'))),
  plank8:JSON.parse(fs.readFileSync(path.join(OUT,'initial16/profiles/geometry-cushion-plank8-diagnostic.json')))};
const REPORT_FILE=process.env.NATIVE_CURRENT?'NATIVE_CURRENT_FIXTURES.json':'NATIVE_FIXTURES.json';
const report={createdAt:new Date().toISOString(),method:'Isolated automatic Cocos/Box2D physics. Source profiles preserved under initial16. Native fixture vertices are captured from engine debug draw, which reads B2.HEAPF32, not inferred from spec outline. Contact normals are genuine PRE_SOLVE world manifolds.',native:[],contacts:[],errors:[]};let browser,page;
async function fresh(){
  await page.evaluate(()=>{window.fi?.dispose();const pw=qaCC.PhysicsSystem2D.instance.physicsWorld;pw.debugDrawFlags=0;pw._debugGraphics=null;});await page.evaluate(()=>qaLoad('HUD'));await page.waitForFunction(()=>qaGame()?.snapshot().phase==='planning');
  await page.evaluate(async()=>{const cc=qaCC,g=qaGame();g.enabled=false;g.audio.pause(true);g.world.dispose();g.display.dispose();await new Promise(r=>requestAnimationFrame(r));
    const {TowerWorld}=await System.import('chunks:///_virtual/tower-world.ts');window.fi={world:g.world=new TowerWorld(cc.director.getScene()),ticks:0,steady:0,normals:[]};
    const tick=()=>{fi.ticks++;fi.steady=fi.world.isStable()?fi.steady+1:0;};cc.director.on(cc.Director.EVENT_AFTER_PHYSICS,tick);fi.dispose=()=>cc.director.off(cc.Director.EVENT_AFTER_PHYSICS,tick);
    fi.frames=n=>new Promise(r=>{let i=0;const f=()=>{if(++i<n)return;cc.director.off(cc.Director.EVENT_AFTER_PHYSICS,f);r();};cc.director.on(cc.Director.EVENT_AFTER_PHYSICS,f);});
    fi.spawn=(spec,x,y)=>{const b=fi.world.create(spec,x,y);fi.world.release(b);fi.steady=0;return b;};
    fi.read=()=>({tick:fi.ticks,steady:fi.steady,bodies:fi.world.bodies.map(b=>({id:b.id,kind:b.spec.kind,x:b.node.position.x,y:b.node.position.y,angle:b.body.impl.impl.GetAngle()*180/Math.PI,
      mass:b.body.getMass(),vx:b.body.linearVelocity.x,vy:b.body.linearVelocity.y,omega:b.body.angularVelocity,bounds:fi.world.bounds(b)})),normals:fi.normals});
    fi.native=(record)=>{const pw=cc.PhysicsSystem2D.instance.physicsWorld;pw.debugDrawFlags=1;pw.drawDebug();const g=pw._debugGraphics,polys=[];let poly=null;
      const move=g.moveTo,line=g.lineTo,close=g.close;g.moveTo=function(x,y){poly=[[x-record.node.position.x,y-record.node.position.y]];return move.call(this,x,y);};
      g.lineTo=function(x,y){poly?.push([x-record.node.position.x,y-record.node.position.y]);return line.call(this,x,y);};g.close=function(){if(poly)polys.push(poly);poly=null;return close.call(this);};
      try{pw.drawDebug();}finally{g.moveTo=move;g.lineTo=line;g.close=close;pw.debugDrawFlags=0;}
      return {kind:record.spec.kind,input:record.spec.outline,nativePieces:polys,fixtureCount:record.collider.impl._fixtures.length,mass:record.body.getMass(),density:record.spec.density};};
  });
}
function area(poly){return Math.abs(poly.reduce((a,p,i)=>{const q=poly[(i+1)%poly.length];return a+p[0]*q[1]-q[0]*p[1];},0))/2;}
async function collectNative(profileName,kind){await fresh();const s=profiles[profileName][kind];await page.evaluate(spec=>{fi.world.platform.enabled=false;fi.subject=fi.spawn(spec,0,200);fi.subject.body.gravityScale=0;},s);await page.evaluate(()=>fi.frames(3));
  const n=await page.evaluate(()=>fi.native(fi.subject));n.profile=profileName;n.inputArea=area(n.input);n.pieceAreas=n.nativePieces.map(area);n.nativeArea=n.pieceAreas.reduce((a,b)=>a+b,0);n.areaRatio=n.nativeArea/n.inputArea;n.vertexCounts=n.nativePieces.map(p=>p.length);report.native.push(n);
}
async function contactCase(profileName){await fresh();const specs=profiles[profileName];await page.evaluate(spec=>fi.spawn(spec,0,90),specs.cardboard_box);await page.waitForFunction(()=>fi.steady>=25);
  await page.evaluate(spec=>fi.spawn(spec,0,185),specs.wood_plank);await page.waitForFunction(()=>fi.steady>=25,null,{timeout:8000});
  await page.evaluate(spec=>{const cc=qaCC,b=fi.spawn(spec,0,280);b.collider.on(cc.Contact2DType.PRE_SOLVE,(self,other,c)=>{if(other!==fi.world.bodies[1].collider)return;const m=c.getWorldManifold(),sign=c.colliderA===self?1:-1;
      if(fi.normals.length<1600)fi.normals.push({tick:fi.ticks,normal:[m.normal.x*sign,m.normal.y*sign],points:m.points.map(p=>[p.x,p.y]),separations:m.separations,
        selfFixture:c.colliderA===self?c._fixtureIndexA:c._fixtureIndexB,boardFixture:c.colliderA===self?c._fixtureIndexB:c._fixtureIndexA});});},specs.toilet);
  await page.evaluate(()=>fi.frames(600));const r=await page.evaluate(()=>fi.read());r.profile=profileName;report.contacts.push(r);
}
async function controllerContactCase(profileName){
  await page.evaluate(()=>{window.fi?.dispose();window.ci?.dispose();const pw=qaCC.PhysicsSystem2D.instance.physicsWorld;pw.debugDrawFlags=0;pw._debugGraphics=null;});
  await page.evaluate(async specs=>{const d=await System.import('chunks:///_virtual/object-data.ts');Object.assign(d.OBJECTS,specs);localStorage.setItem('zhynd.local-settings.v1',JSON.stringify({tutorialDone:true,music:false,sound:false,vibration:false}));},profiles[profileName]);
  await page.evaluate(()=>qaLoad('HUD'));await page.waitForFunction(()=>qaGame()?.snapshot().phase==='planning');
  await page.evaluate(()=>{const cc=qaCC,g=qaGame();g.configureCalibration(['cardboard_box','wood_plank','toilet'],true);
    const p=window.ci={g,time:0,planningSince:null,released:0,lastDrop:null,done:false,normals:[],samples:[],actions:[],watch:new Set()};
    const tick=()=>{p.time+=cc.director.getDeltaTime();const s=g.snapshot();if(p.done)return;
      for(const b of g.world.bodies)if(!p.watch.has(b.id)){p.watch.add(b.id);b.collider.on(cc.Contact2DType.PRE_SOLVE,(self,other,contact)=>{
        if(b.id!==3||other!==g.world.bodies[1]?.collider||p.normals.length>=2000)return;const m=contact.getWorldManifold(),sign=contact.colliderA===self?1:-1;
        const board=g.world.bodies[1],angle=board.body.impl.impl.GetAngle(),nx=m.normal.x*sign,ny=m.normal.y*sign;
        p.normals.push({time:p.time,normal:[nx,ny],boardLocalNormal:[nx*Math.cos(angle)+ny*Math.sin(angle),-nx*Math.sin(angle)+ny*Math.cos(angle)],points:m.points.map(v=>[v.x,v.y]),separations:m.separations.slice(),
          board:{x:board.node.position.x,y:board.node.position.y,angle},toilet:{x:b.node.position.x,y:b.node.position.y,angle:b.body.impl.impl.GetAngle()}});
      });}
      if(Math.floor(p.time*5)>p.samples.length)p.samples.push({time:p.time,state:s});
      if(s.phase==='ended'){p.done=true;return;}
      if(s.phase==='planning'&&!s.placementBlocked){if(p.planningSince===null)p.planningSince=p.time;
        if(p.released<3&&p.time-p.planningSince>=.18){g.moveTo(0);p.actions.push({time:p.time,state:g.snapshot()});g.release();p.released++;p.lastDrop=p.time;p.planningSince=null;}
      }else p.planningSince=null;
      if(p.released===3&&p.time-p.lastDrop>10)p.done=true;if(p.time>35)p.done=true;
    };cc.director.on(cc.Director.EVENT_AFTER_UPDATE,tick);p.dispose=()=>cc.director.off(cc.Director.EVENT_AFTER_UPDATE,tick);
  });
  await page.waitForFunction(()=>ci.done,null,{timeout:45000});const result=await page.evaluate(()=>({profile:null,actions:ci.actions,samples:ci.samples,normals:ci.normals,final:ci.g.snapshot()}));result.profile=profileName;
  (report.controllerContacts??=[]).push(result);
}
(async()=>{try{browser=await chromium.launch({headless:true});page=await browser.newPage({viewport:{width:375,height:667}});page.on('pageerror',e=>report.errors.push(String(e)));
  await page.goto('http://127.0.0.1:8767/preparation/review/play-player.html?probe=fixtures');await page.waitForFunction(()=>!!window.qaLoad,null,{timeout:45000});
  if(process.env.NATIVE_CURRENT){profiles.currentCompiled=await page.evaluate(async()=>JSON.parse(JSON.stringify((await System.import('chunks:///_virtual/object-data.ts')).OBJECTS)));for(const kind of ['wood_plank','cardboard_box','fridge'])await collectNative('currentCompiled',kind);}
  else{for(const kind of ['wood_plank','cardboard_box','fridge'])await collectNative('original16',kind);await collectNative('plank8','wood_plank');
  await contactCase('original16');await contactCase('plank8');await controllerContactCase('original16');await controllerContactCase('plank8');}report.status=report.errors.length?'failed':'complete_diagnostic';
}catch(e){report.status='failed';report.failure=String(e.stack||e);}finally{fs.writeFileSync(path.join(OUT,REPORT_FILE),JSON.stringify(report,null,2)+'\n');
  process.stdout.write(JSON.stringify({status:report.status,failure:report.failure,errors:report.errors,native:report.native.map(n=>({profile:n.profile,kind:n.kind,vertexCounts:n.vertexCounts,areaRatio:n.areaRatio})),contacts:report.contacts.map(r=>({profile:r.profile,bodies:r.bodies,normals:r.normals.length}))})+'\n');await browser?.close();}})();
