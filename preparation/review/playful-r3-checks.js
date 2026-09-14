/* Local engine QA. Fixtures are labelled; no prefilled pass or claimed natural score. */
(() => {
    'use strict';
    const $ = id => document.getElementById(id), frame = $('player'), clone = x => JSON.parse(JSON.stringify(x));
    const report = window.playfulR3QA = {schema:'playful-r3-engine',createdAt:new Date().toISOString(),results:[],errors:[],ready:false,busy:false};
    const assert = (ok,message,evidence) => { if(!ok){const e=Error(message);e.evidence=evidence;throw e;} };
    const state = () => {try{return frame.contentWindow.qaSnapshot?.()??null;}catch(e){return {error:String(e)};}};
    const status = message => { $('status').textContent=message; };
    function render() {
        $('qaResults').textContent=JSON.stringify(report,null,2);
        $('summary').textContent=`${report.results.filter(r=>r.status==='passed').length} 项通过 / ${report.results.filter(r=>r.status==='failed').length} 项失败`;
        document.querySelectorAll('button').forEach(b=>b.disabled=!report.ready||report.busy);
        $('export').disabled=report.busy||!report.results.length;frame.style.pointerEvents=report.busy?'none':'auto';
    }
    function until(ctx,predicate,label,timeout=15000) {
        return new Promise((resolve,reject)=>{
            let elapsed=0,done=false;
            const finish=(error,result)=>{if(done)return;done=true;clearTimeout(timer);ctx.cc.director.off(ctx.cc.Director.EVENT_AFTER_UPDATE,tick);error?reject(error):resolve(result);};
            const tick=()=>{try{assert(ctx.cc.isValid(ctx.g,true)&&ctx.win.qaGame()===ctx.g,`${label}：场景提前切换`,state());elapsed+=Math.min(.1,Math.max(0,ctx.cc.game.deltaTime));const value=predicate(elapsed);if(value)finish(null,value);}catch(e){finish(e);}};
            const timer=setTimeout(()=>{const e=Error(`${label}：超时`);e.evidence=state();finish(e);},timeout);
            ctx.cc.director.on(ctx.cc.Director.EVENT_AFTER_UPDATE,tick);
        });
    }
    async function fresh() {
        const win=frame.contentWindow;await win.qaLoad('HUD');const cc=win.qaCC,g=win.qaGame();
        const platform=await win.System.import('chunks:///_virtual/local-platform.ts'),settings=platform.readSettings();
        assert(g?.audio?.stopReactions&&g.audio.isReacting,'当前构建尚未包含 R3 人声接口');
        platform.writeSettings({...settings,music:true,sound:true});g.audio.interact();
        assert(g.configureCalibration(g.snapshot().sequence,true),'无法进入无计时校准');
        const ctx={win,cc,g,platform,settings,events:[],listeners:[]};
        for(const voice of g.audio.voices) for(const type of ['STARTED','ENDED']) {
            const event=cc.AudioSource.EventType[type],listener=()=>ctx.events.push({type,clip:voice.source.clip?.name,at:performance.now(),clock:g.audio.clock});
            voice.source.node.on(event,listener);ctx.listeners.push(()=>voice.source.node?.off(event,listener));
        }
        await until(ctx,()=>g.snapshot().phase==='planning'&&g.display.cameraRecovered(),'规划准备');return ctx;
    }
    const audioState = g => ({clock:g.audio.clock,lastReactionAt:g.audio.lastReactionAt,reacting:g.audio.isReacting(),voices:g.audio.voices.map(v=>({clip:v.source.clip?.name,playing:v.source.playing,reaction:v.reaction,volume:v.source.volume}))});
    const eventCount = (ctx,id,type='STARTED') => ctx.events.filter(e=>e.clip===id&&e.type===type).length;
    async function played(ctx,id) {
        const before=eventCount(ctx,id);assert(ctx.g.audio.play(id,.7),`${id} 未接受播放`,audioState(ctx.g));
        await until(ctx,()=>eventCount(ctx,id)>before,`${id} 真实 STARTED`);
        assert(ctx.g.audio.voices.filter(v=>v.reaction&&v.source.playing).length===1,'同时播放了多个人声',audioState(ctx.g));
        await until(ctx,()=>eventCount(ctx,id,'ENDED')>before,`${id} 真实 ENDED`);
    }
    async function voices(ctx) {
        const observations=[];
        for(const id of ['voice_wow','voice_hey','voice_chuckle']) {
            if(observations.length){await until(ctx,()=>ctx.g.audio.clock-ctx.g.audio.lastReactionAt>=12.05,'自然等待 12 秒冷却',18000);assert(ctx.events.filter(e=>e.type==='STARTED'&&e.clip?.startsWith('voice_')).length===observations.length,'冷却结束后补播了旧请求',ctx.events);}
            await played(ctx,id);const blocked=ctx.g.audio.play(id==='voice_wow'?'voice_hey':'voice_wow');
            assert(!blocked,'跨人声共享冷却未生效');observations.push({id,state:audioState(ctx.g),otherVoiceBlocked:!blocked});
        }
        return {mode:'real audio start/end and natural cooldown wait',observations,events:ctx.events};
    }
    async function controls(ctx) {
        const {g,platform,cc}=ctx,observations=[];
        platform.writeSettings({...ctx.settings,music:true,sound:false});assert(!g.audio.play('voice_wow'),'静音仍接受人声');
        platform.writeSettings({...ctx.settings,music:true,sound:true});assert(g.audio.play('voice_wow'),'解除静音未接受人声');
        await until(ctx,()=>eventCount(ctx,'voice_wow')>0,'静音解除后真实播放');g.audio.pause(true);const pauseClock=g.audio.clock;g.audio.update(2);assert(g.audio.clock===pauseClock,'暂停期间人声时钟仍前进');
        assert(!g.audio.isReacting()&&!g.audio.play('voice_hey'),'暂停未停止 / 阻止人声');g.audio.pause(false);
        observations.push({step:'pause-resume-no-replay',audio:audioState(g)});assert(!g.audio.isReacting(),'恢复后补播旧人声');
        g.audio.update(12.1);assert(g.audio.play('voice_hey'),'后台前人声未接受');await until(ctx,()=>eventCount(ctx,'voice_hey')>0,'后台前真实播放');
        cc.game.emit(cc.Game.EVENT_HIDE);const hidden={audio:audioState(g),music:g.music.snapshot(),paused:g.lifecycle.paused};
        cc.game.emit(cc.Game.EVENT_SHOW);assert(hidden.paused&&!hidden.audio.reacting,'模拟后台未停止人声',hidden);
        assert(!g.audio.isReacting(),'后台返回补播旧人声');observations.push({step:'simulated-hide-show',hidden,returned:audioState(g)});
        return {mode:'controlled settings and simulated visibility; audio clock advanced 12.1s between independent cases',observations,events:ctx.events};
    }
    async function incidents(ctx) {
        const {g}=ctx;assert(g.audio.play('voice_wow'),'异步取消用例声音未接受');g.audio.stopReactions();
        await until(ctx,elapsed=>elapsed>=.3,'立即取消后观察延迟播放');
        const cancelled={audio:audioState(g),events:clone(ctx.events)};
        assert(eventCount(ctx,'voice_wow')===0&&!g.audio.isReacting()&&!g.audio.voices.some(v=>v.reaction&&v.source.playing),'立即取消后异步加载仍启动人声',cancelled);
        g.audio.update(12.1);assert(g.audio.play('voice_wow'),'事故前声音未接受');await until(ctx,()=>eventCount(ctx,'voice_wow')>0,'事故前人声开始');
        g.beginIncident();assert(!g.audio.isReacting(),'事故未立即停止人声');const impact=g.audio.play('impact_wood_plank',.8,'qa-incident');
        assert(impact,'停止人声误阻断材质声');await until(ctx,()=>ctx.events.some(e=>e.type==='STARTED'&&e.clip?.startsWith('impact_wood_')),'事故材质声开始');
        const incident=audioState(g);g.enabled=false;g.audio.update(12.1);assert(g.audio.play('voice_hey'),'失败夹具前声音未接受');
        await until(ctx,()=>eventCount(ctx,'voice_hey')>0,'失败前人声开始');g.lockFailure('calibration_end');
        assert(!g.audio.isReacting(),'失败未立即停止人声');return {mode:'immediate cancel plus explicit incident/failure fixture; controlled audio clock advance between cases',cancelled,incident,defeated:audioState(g),events:ctx.events};
    }
    async function duck(ctx) {
        const {g}=ctx;await until(ctx,()=>g.music.snapshot().gain>=.215&&g.music.snapshot().sources.some(s=>s.playing),'BGM 真正开始并升至正常音量');
        const before=clone(g.music.snapshot());assert(g.audio.play('voice_chuckle'),'降音测试人声未接受');
        await until(ctx,()=>eventCount(ctx,'voice_chuckle')>0,'降音人声真正开始');
        await until(ctx,()=>g.music.snapshot().gain<.115,'人声期间音乐降低');const lowered=clone(g.music.snapshot());
        await until(ctx,()=>eventCount(ctx,'voice_chuckle','ENDED')>0,'短笑结束');await until(ctx,()=>g.music.snapshot().gain>=.215,'音乐恢复');
        return {mode:'real controller lateUpdate and AudioSource events',before,lowered,restored:g.music.snapshot(),events:ctx.events};
    }
    async function fixture(ctx) {
        const {g}=ctx,oldWorld=g.world,originalPlay=g.audio.play,attempts=[];g.enabled=false;
        g.audio.play=function(name,...args){const accepted=originalPlay.call(this,name,...args);attempts.push({name,accepted});return accepted;};
        let top=0,bodies=[];g.world={bodies,isStable:()=>true,confirmedTop:()=>top,configureSafety:()=>{}};
        const confirm=(height,kind='cardboard_box')=>{top=height;bodies.push({id:bodies.length+1,spec:{kind},lost:false,collider:{enabled:true},placed:false});g.confirmStable(.7);};
        try {
            confirm(490);assert(!attempts.some(a=>a.name==='voice_wow'),'未到 5m 误触 Wow');confirm(510);
            assert(attempts.filter(a=>a.name==='voice_wow').length===1,'首次跨5m未恰好触发一次',attempts);
            g.confirmStable(.7);assert(attempts.filter(a=>a.name==='voice_wow').length===1,'同一稳定状态重复触发');
            confirm(1510);assert(attempts.filter(a=>a.name==='voice_wow').length===2,'跨多个档应只产生一个新事件',attempts);
            assert(!attempts.at(-1).accepted,'冷却中的跨档没有被拒绝');
            g.audio.stopReactions();g.audio.update(12.1);confirm(1515,'toilet');assert(attempts.at(-1).name==='voice_chuckle'&&attempts.at(-1).accepted,'新趣味物体未播放短笑',attempts);
            const laughs=attempts.filter(a=>a.name==='voice_chuckle').length;g.audio.stopReactions();g.audio.update(12.1);confirm(1520,'slipper');
            assert(attempts.filter(a=>a.name==='voice_chuckle').length===laughs,'每局短笑限制失效');
            return {mode:'controlled controller fixture; synthetic stable scores, not natural tower evidence',attempts,peak:g.peak,playfulReactionUsed:g.playfulReactionUsed};
        } finally {g.world=oldWorld;g.audio.play=originalPlay;}
    }
    async function natural(ctx) {
        const {g,cc}=ctx,observations=[];let greeted=false;
        for(let n=0;n<14;n++) {
            status(`默认序列真实放置 ${n+1}/14`);await until(ctx,()=>g.phase==='planning'&&g.display.cameraRecovered()&&!g.world.hasPlacementHazard(),'等正常放置阶段',20000);
            const current=g.current;g.moveTo(0);
            if(!greeted){g.touchStart(901,new cc.Vec2(187,333));g.touchEnd(901);greeted=true;}else g.release();
            await until(ctx,()=>g.current!==current&&g.phase==='planning'&&g.display.cameraRecovered(),'自然接触和交接',22000);
            observations.push({step:n+1,kind:current.spec.kind,peak:g.peak/100,placed:current.placed,supported:current.supported,lost:current.lost,stars:g.stars,incidentCount:g.incidentCount});
            if(g.peak>=500&&eventCount(ctx,'voice_wow')>0&&observations.some(o=>o.placed&&['whale','burger','toilet','slipper'].includes(o.kind)))break;
        }
        assert(g.peak>=500&&eventCount(ctx,'voice_wow')>0,'本次自然放置尚未验证 5m Wow',{observations,events:ctx.events});
        assert(eventCount(ctx,'voice_hey')===1,'首次有效触碰 Hey 未恰好播放一次',ctx.events);
        return {mode:'actual default sequence / controlled centre release / unchanged physics',observations,events:ctx.events,funnyVoiceObserved:eventCount(ctx,'voice_chuckle')>0,final:g.snapshot()};
    }
    async function loops(ctx) {
        const {g,cc}=ctx,ids=['bgm_city','bgm_cloud','bgm_space'],startedAt=performance.now(),observations=[],transitions=[];
        const durations=ids.map(id=>({id,seconds:g.approvedSounds.find(clip=>clip.name===id)?.getDuration()}));
        assert(durations.every(d=>Number.isFinite(d.seconds)&&Math.abs(d.seconds-14.328367346939)<.05),'实际三首循环片段长度不符',durations);
        assert(Math.max(...durations.map(d=>d.seconds))-Math.min(...durations.map(d=>d.seconds))<.01,'三高度版本长度不一致',durations);
        let height=0,lastSample=-1,driverError=null;g.enabled=false;
        const phaseGap=(a,b,length)=>{const d=Math.abs(a-b)%length;return Math.min(d,length-d);};
        const driver=()=>{try{g.music.update(Math.min(.067,Math.max(0,cc.game.deltaTime)),height);if(performance.now()-lastSample>500){lastSample=performance.now();observations.push({elapsedMs:lastSample-startedAt,height,music:clone(g.music.snapshot())});}}catch(e){driverError=e;}};
        cc.director.on(cc.Director.EVENT_AFTER_UPDATE,driver);
        const wait=(predicate,label)=>until(ctx,()=>{if(driverError)throw driverError;return predicate();},label,Math.max(1,40000-(performance.now()-startedAt)));
        try {
            await wait(()=>g.music.active>=0&&g.music.voices[g.music.active].ready&&g.music.voices[g.music.active].source.playing,'城市 B 配乐真实播放');
            const city=g.music.voices[g.music.active].source,length=city.duration;let previous=city.currentTime,wrap=null;
            await wait(()=>{const current=city.currentTime;if(previous>length-.3&&current<.3&&previous-current>length/2)wrap={previous,current,duration:length,elapsedMs:performance.now()-startedAt,playing:city.playing};previous=current;return wrap;},'14.328 秒片段自然回绕');
            assert(wrap.playing,'回绕时音乐未在播放',wrap);
            for(const [target,nextHeight] of [['bgm_cloud',60],['bgm_space',170]]) {
                const before=clone(g.music.snapshot()),priorTime=g.music.voices[g.music.active].source.currentTime,switchAt=performance.now(),phaseSamples=[];height=nextHeight;
                await wait(()=>{
                    const music=g.music,snapshot=music.snapshot(),old=music.voices[music.fadingFrom],active=music.voices[music.active];
                    if(old&&active.ready&&old.source.playing&&active.source.playing){const gap=phaseGap(old.source.currentTime,active.source.currentTime,length);phaseSamples.push({old:old.source.currentTime,next:active.source.currentTime,gap});assert(gap<=.15,'高度切换两路乐句相位偏移超过 0.15 秒',phaseSamples.at(-1));}
                    return snapshot.region===target&&!snapshot.fading&&active.ready&&active.source.playing;
                },`${target} 实际淡化完成`);
                const after=clone(g.music.snapshot()),elapsed=(performance.now()-switchAt)/1000,actual=g.music.voices[g.music.active].source.currentTime,expected=(priorTime+elapsed)%length;
                assert(phaseSamples.length>0,'没有观察到两路真实交叉淡化',{before,after});
                assert(phaseGap(actual,expected,length)<=.15,'切换后播放时间未连续推进',{actual,expected,elapsed});
                transitions.push({controlledHeight:nextHeight,before,after,phaseSamples,continuity:{actual,expected,gap:phaseGap(actual,expected,length)}});
            }
            return {mode:'controlled height inputs 0/60/170; actual AudioSource natural playback, no music time fast-forward; not natural tower-height evidence',durations,wrap,transitions,observations,elapsedMs:performance.now()-startedAt};
        } finally {cc.director.off(cc.Director.EVENT_AFTER_UPDATE,driver);g.enabled=true;}
    }
    const checks={voices,controls,incidents,duck,fixture,natural,loops};
    async function run(name) {
        const row={name,status:'running',startedAt:new Date().toISOString()};report.results.push(row);render();status(`正在检查：${name}`);let ctx;
        try {ctx=await fresh();row.evidence=await checks[name](ctx);row.status='passed';}
        catch(e){row.status='failed';row.error=String(e.stack||e);row.evidence=e.evidence??state();}
        finally {if(ctx){ctx.listeners.forEach(off=>off());ctx.platform.writeSettings(ctx.settings);if(ctx.cc.isValid(ctx.g,true)){ctx.g.audio?.pause(false);if(ctx.g.lifecycle?.paused){ctx.cc.game.emit(ctx.cc.Game.EVENT_SHOW);if(ctx.g.lifecycle.paused)ctx.g.lifecycle.togglePause();}ctx.g.enabled=true;}}row.completedAt=new Date().toISOString();render();}
    }
    async function batch(names) {report.busy=true;render();try{for(const name of names)await run(name);}finally{report.busy=false;status('检查完成；结果和未通过原因见 JSON。');render();}}
    for(const name of Object.keys(checks))$(`check-${name}`).onclick=()=>batch([name]);
    $('check-all').onclick=()=>batch(Object.keys(checks));
    $('home').onclick=async()=>{await frame.contentWindow.qaLoad('Home');status('普通试玩：请点击游戏内开始按钮。');};
    $('practice').onclick=async()=>{const ctx=await fresh();ctx.listeners.forEach(off=>off());ctx.platform.writeSettings(ctx.settings);status('无计时试玩：真实拖动、旋转和松手释放。');};
    $('export').onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=`playful-r3-${Date.now()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
    window.addEventListener('message',async e=>{if(e.origin!==location.origin||e.source!==frame.contentWindow)return;if(e.data?.type==='play-ready'){frame.contentWindow.addEventListener('error',error=>{report.errors.push({source:'engine',message:String(error.error||error.message)});render();});frame.contentWindow.addEventListener('unhandledrejection',error=>{report.errors.push({source:'engine-promise',message:String(error.reason)});render();});report.ready=true;await frame.contentWindow.qaLoad('Home');status('引擎已准备，从首页开始试玩。');render();}else if(e.data?.type==='play-error'){report.errors.push(e.data.error);status(e.data.error);render();}});
    window.addEventListener('error',e=>{report.errors.push(String(e.error||e.message));render();});
    window.addEventListener('unhandledrejection',e=>{report.errors.push(String(e.reason));render();});
    setInterval(()=>{$('state').textContent=JSON.stringify(state(),null,2);},1000);
})();
