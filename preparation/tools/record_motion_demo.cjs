/** Real gameplay drops followed by an explicitly requested camera-only demonstration. */
const {chromium}=require('/Users/admin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..'),out=path.join(root,'preparation/review/evidence/camera-impact-r1');
const before=process.argv[2]==='before',name=before?'play-before':'play-current';
(async()=>{let browser,context;const report={name,contacts:[],method:'Approved box/fridge/ball sequence, actual controller release and native physics. At the end only PlayView.beginIncident(.75)/endIncident are manually triggered to demonstrate lens motion; no accident or loss is claimed.'};
try{
 browser=await chromium.launch({headless:true});context=await browser.newContext({viewport:{width:375,height:667},recordVideo:{dir:path.join(root,'temp/motion-recordings'),size:{width:375,height:667}}});
 const page=await context.newPage();page.on('pageerror',e=>(report.errors??=[]).push(String(e)));
 await page.goto('http://127.0.0.1:8767/'+(before?'temp/camera-impact-before/player.html':'preparation/review/play-player.html'));
 await page.waitForFunction(()=>window.qaLoad,null,{timeout:45000});
 await page.evaluate(async()=>{
  qaCC.sys.localStorage.setItem('zhynd.local-settings.v1',JSON.stringify({tutorialDone:true,music:false,sound:false,vibration:false}));await qaLoad('HUD');
 });
 await page.waitForFunction(()=>qaGame()?.snapshot().phase==='planning');
 await page.evaluate(()=>qaGame().configureCalibration(['cardboard_box','fridge','basketball','wood_plank'],true));
 for(let i=0;i<3;i++){
  await page.waitForFunction(i=>qaGame().snapshot().phase==='planning'&&qaGame().snapshot().releases===i,i,{timeout:15000});
  await page.waitForTimeout(400);await page.evaluate(()=>{qaGame().moveTo(0);qaGame().release();});
 }
 await page.waitForFunction(()=>qaGame().snapshot().phase==='planning'&&qaGame().snapshot().releases===3,null,{timeout:15000});
 report.beforeZoom=await page.evaluate(()=>qaGame().snapshot());
 await page.waitForTimeout(400);await page.evaluate(()=>qaGame().display.beginIncident(.75));await page.waitForTimeout(900);
 report.pulledBack=await page.evaluate(()=>qaGame().snapshot());
 await page.screenshot({path:path.join(out,`${name}-pullback.png`)});
 await page.evaluate(()=>qaGame().display.endIncident());await page.waitForTimeout(900);
 report.afterZoom=await page.evaluate(()=>qaGame().snapshot());
 const video=page.video();await context.close();await video.saveAs(path.join(out,`${name}.webm`));report.status=report.errors?.length?'errors':'recorded';
}catch(e){report.status='failed';report.error=String(e.stack||e);process.exitCode=1;}finally{await browser?.close();fs.writeFileSync(path.join(out,`${name}.json`),JSON.stringify(report,null,2)+'\n');process.stdout.write(JSON.stringify({name,status:report.status,error:report.error,errors:report.errors})+'\n');}})();
