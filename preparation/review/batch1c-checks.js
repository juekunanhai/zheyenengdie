/* Local review host only. Normal sequence uses moveTo/release; shape/contact fixtures are
 * separately labelled and create bodies through the compiled TowerWorld. No prefilled passes. */
(() => {
    'use strict';
    const $ = id => document.getElementById(id), frame = $('player');
    const kinds = ['cardboard_box','wooden_crate','sofa','toilet','burger','basketball','ice_block','wood_plank','fridge','dumbbell','slipper','whale'];
    const added = ['wooden_crate','sofa','burger','ice_block','slipper','whale'];
    const names = {cardboard_box:'纸箱',wooden_crate:'木箱',sofa:'沙发',toilet:'马桶',burger:'汉堡',basketball:'篮球',ice_block:'冰块',wood_plank:'长木板',fridge:'冰箱',dumbbell:'哑铃',slipper:'拖鞋',whale:'鲸鱼'};
    const clone = value => JSON.parse(JSON.stringify(value));
    const report = window.batch1cQA = {schema:'batch1c-local-engine-checks',createdAt:new Date().toISOString(),
        source:'play-player.html / actual locally built Cocos modules',results:[],manualActions:[],errors:[],busy:false,ready:false};
    let cleanup = null, frameErrorWindow = null;
    function assert(condition, message, evidence) { if (!condition) { const e = new Error(message); e.evidence = evidence; throw e; } }
    function status(text) { $('status').textContent = text; }
    function currentState() {
        try { const w=frame.contentWindow,cc=w.qaCC,g=w.qaGame?.();
            return {scene:cc?.director.getScene()?.name,engine:cc?.VERSION,viewport:{width:+frame.width,height:+frame.height},
                game:g&&cc.isValid(g,true)?g.snapshot():null};
        } catch(e) { return {diagnosticError:String(e)}; }
    }
    function render() {
        $('qaResults').textContent=JSON.stringify(report.results,null,2);
        const p=report.results.filter(r=>r.status==='passed').length,f=report.results.filter(r=>r.status==='failed').length,last=report.results.at(-1);
        $('checkSummary').textContent=last?`${p} 项通过 / ${f} 项失败；最近：${last.name}（${{running:'运行中',passed:'通过',failed:'失败'}[last.status]}）${last.error?' · '+last.error.split('\n')[0]:''}`:'尚未运行。';
        for(const b of document.querySelectorAll('button')) b.disabled=!report.ready||report.busy;
        $('export').disabled=report.busy||(!report.results.length&&!report.manualActions.length);
        $('size').disabled=report.busy;frame.style.pointerEvents=report.busy?'none':'auto';
    }
    function capture(e,source) { report.errors.push({at:new Date().toISOString(),source,message:String(e?.stack||e)}); }
    function loadScene(name) {
        return new Promise((resolve,reject)=>{
            const timer=setTimeout(()=>reject(Error(`加载 ${name} 场景超过 30000ms`)),30000);
            frame.contentWindow.qaLoad(name).then(value=>{clearTimeout(timer);resolve(value);},error=>{clearTimeout(timer);reject(error);});
        });
    }
    window.addEventListener('error',e=>capture(e.error||e.message,'review'));
    window.addEventListener('unhandledrejection',e=>capture(e.reason,'review-promise'));
    function until(ctx,predicate,label,timeoutMs=12000,options={}) {
        return new Promise((resolve,reject)=>{
            const {cc,win,g}=ctx,event=options.event||cc.Director.EVENT_AFTER_PHYSICS;
            let done=false,elapsed=0,frames=0;
            const finish=(e,v)=>{if(done)return;done=true;clearTimeout(timer);cc.director.off(event,tick);e?reject(e):resolve(v);};
            const tick=()=>{try{
                if(!options.allowSceneChange&&(!cc.isValid(g,true)||win.qaGame()!==g))throw Error(`${label}：场景提前切换`);
                elapsed+=Math.min(.1,Math.max(0,cc.game.deltaTime));frames++;
                const v=predicate({elapsed,frames});if(v)finish(null,v);
            }catch(e){finish(e);}};
            const timer=setTimeout(()=>{const e=Error(`${label}：超过 ${timeoutMs}ms`);e.evidence=currentState();finish(e);},timeoutMs);
            cc.director.on(event,tick);
        });
    }
    async function fresh(untimed=true) {
        cleanup?.();cleanup=null;
        const win=frame.contentWindow;await loadScene('HUD');
        const cc=win.qaCC,g=win.qaGame(),data=await win.System.import('chunks:///_virtual/object-data.ts');
        assert(g&&kinds.every(k=>data.OBJECTS[k]),'当前构建没有完整十二物体，请完成 1C 构建后再检查。');
        const sequence=g.snapshot().sequence;
        assert(kinds.every(k=>sequence.includes(k)),'正式默认出物序列尚未覆盖十二物体',sequence);
        assert(g.configureCalibration(sequence,untimed),'当前顺序缺少 Sprite / NEXT 或校准接口不可用');
        g.audio.interact();
        const ctx={win,cc,g,data,world:g.world};
        await until(ctx,()=>g.snapshot().phase==='planning'&&g.display.cameraRecovered(),'等待真实规划阶段');
        $('sequence').textContent='当前固定顺序：'+sequence.map(k=>names[k]||k).join(' → ');
        return ctx;
    }
    const nextName=g=>g.display.next.spriteFrame?.name;
    function native(ctx,b) { return {kind:b.spec.kind,angle:ctx.data.planarAngle(b.node.rotation),bounds:ctx.world.nativeBounds(b),
        mass:b.body.getMass(),bullet:b.body.impl?.impl?.IsBullet?.()??null,fixtures:b.collider.impl?._fixtures?.length??null,
        supported:b.supported,lost:b.lost,velocity:clone(b.body.linearVelocity),angularVelocity:b.body.angularVelocity}; }
    function isConcave(points) {
        const signs=new Set();
        for(let i=0;i<points.length;i++) { const a=points[i],b=points[(i+1)%points.length],c=points[(i+2)%points.length];
            const cross=(b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0]);if(Math.abs(cross)>1e-5)signs.add(Math.sign(cross)); }
        return signs.size>1;
    }
    async function shapeCheck() {
        const ctx=await fresh(),{g,world,data,cc}=ctx,observations=[];
        g.current.node.active=false;
        for(const kind of kinds) {
            status(`形状与旋转：${names[kind]}（${observations.length+1}/12）`);
            if(g.current)g.current.node.active=false;
            const spec=data.OBJECTS[kind],bounds=data.localBounds(spec,0);
            const b=world.create(spec,0,g.boundary.top-bounds.top);g.current=b;g.phase='planning';g.rotations=0;
            g.display.setNext(kind);
            const sprite=g.frames.find(f=>f.name===`object_${kind}`),preview=g.display.next.spriteFrame;
            assert(sprite&&preview?.name===`next_${kind}`,'Sprite / NEXT 对应错误',{kind,preview:preview?.name});
            const samples=[];
            for(let rotation=0;rotation<4;rotation++) {
                if(rotation)g.rotate();
                for(const x of [-100000,0,100000]) {
                    g.moveTo(x);await until(ctx,({frames})=>frames>=2,'旋转和夹边生效');
                    const local=data.localBounds(spec,data.planarAngle(b.node.rotation)),p=b.node.position;
                    const sample={rotation:rotation*90,requestX:x,x:p.x,y:p.y,local:clone(local),next:nextName(g)};samples.push(sample);
                    assert(Math.abs(p.y+local.top-g.boundary.top)<.01,'旋转后物体挂点不在抓取高度',sample);
                    assert(p.x+local.left>=g.boundary.left+3.9&&p.x+local.right<=g.boundary.right-3.9,'旋转夹边超出真实轮廓边界',sample);
                    assert(nextName(g)===`next_${kind}`,'移动或旋转改变了已展示 NEXT',sample);
                }
            }
            // Enable the collider only after the held-pose checks; native shapes are then observed.
            world.release(b);await until(ctx,({frames})=>frames>=2,'原生碰撞 Fixture 创建');
            const physical=native(ctx,b),concave=!!spec.outline&&isConcave(spec.outline);
            assert(physical.bullet===true&&physical.fixtures>=1,'原生 Bullet 或 Fixture 缺失',physical);
            if(concave)assert(physical.fixtures>1,'凹形被简化成单个凸形或包围盒',physical);
            const nextSize=g.display.next.node.getComponent(cc.UITransform).contentSize;
            assert(nextSize.width>0&&nextSize.height>0&&Math.max(nextSize.width,nextSize.height)<=62.01,'NEXT 预览未约束在展示区域',nextSize);
            observations.push({kind,sprite:sprite.name,next:preview.name,points:spec.outline?.length??0,concave,native:physical,rotationSamples:samples,nextSize:clone(nextSize)});
            b.collider.enabled=false;b.node.active=false;
        }
        return {method:'受控替换待放物体；使用实际 rotate/moveTo；开启碰撞后读原生 Bullet/Fixture。未证明逐像素贴合或图片颜色。',observations,
            notProven:['NEXT 图片须由静态 alpha/RGB 门禁与人工目视确认纯轮廓','真实触摸手感','旋转后每个任意堆叠组合']};
    }
    async function isolated() {
        const ctx=await fresh();ctx.g.enabled=false;ctx.g.audio.pause(true);ctx.g.music?.pause(true);
        ctx.world.dispose();await until(ctx,({frames})=>frames>=2,'移除原物理根');
        const {TowerWorld}=await ctx.win.System.import('chunks:///_virtual/tower-world.ts');
        ctx.world=ctx.g.world=new TowerWorld(ctx.cc.director.getScene());ctx.g.current=null;
        // TowerWorld IDs restart at 1 in the isolated fixture. Remove the old view cache so
        // a newly created sofa/whale cannot accidentally reuse the former cardboard sprite.
        for(const node of ctx.g.display.views.values()){node.removeFromParent();node.destroy();}
        ctx.g.display.views.clear();
        ctx.world.configureSafety({left:-400,right:400,bottom:-200,top:1200},0);
        const paint=()=>ctx.g.display.update(Math.min(.067,ctx.cc.game.deltaTime),ctx.world.bodies,null,1);
        ctx.cc.director.on(ctx.cc.Director.EVENT_AFTER_PHYSICS,paint);
        cleanup=()=>ctx.cc.director.off(ctx.cc.Director.EVENT_AFTER_PHYSICS,paint);
        return ctx;
    }
    async function steady(ctx,b,label) {
        let stable=0;
        await until(ctx,()=>{
            assert(!b.lost,`${label}：物体实际掉落`,native(ctx,b));
            stable=b.supported&&b.body.linearVelocity.length()<.16&&Math.abs(b.body.angularVelocity)<.25?stable+Math.min(.1,ctx.cc.game.deltaTime):0;
            return stable>=.65;
        },label,16000);
    }
    async function contactCheck(kind,offsetX=0) {
        const ctx=await isolated(),{world,data,cc}=ctx,spec=data.OBJECTS[kind],contacts=[],trajectory=[];
        const b=world.create(spec,0,60-data.localBounds(spec,0).bottom);
        let upper=null,grounded=null,loaded=null,initialUpper=null,elapsed=0,lastSample=-1;
        const contactTimes=new Map();
        const state=record=>{
            if(!record)return null;
            try{return {id:record.id,...native(ctx,record)};}
            catch(error){return {id:record.id,kind:record.spec.kind,lost:record.lost,supported:record.supported,diagnosticError:String(error)};}
        };
        const sample=force=>{
            if(!force&&elapsed-lastSample<.2)return;lastSample=elapsed;
            trajectory.push({seconds:+elapsed.toFixed(3),lower:state(b),upper:state(upper),touchesLower:upper?.contacts.has(b.collider)??false});
            if(trajectory.length>120)trajectory.shift();
        };
        const tick=()=>{elapsed+=Math.min(.1,Math.max(0,cc.game.deltaTime));sample(false);};
        const observe=(self,other,contact)=>{
            const pair=`${self.node.name}:${other.node.name}`,last=contactTimes.get(pair)??-1;
            if(elapsed-last<.2)return;contactTimes.set(pair,elapsed);
            const m=contact.getWorldManifold();
            contacts.push({seconds:+elapsed.toFixed(3),self:self.node.name,other:other.node.name,normal:clone(m.normal),points:clone(m.points),disabled:!!contact.disabled});
            if(contacts.length>72)contacts.shift();
        };
        const current=()=>({lower:state(b),upper:state(upper),touchesLower:upper?.contacts.has(b.collider)??false});
        cc.director.on(cc.Director.EVENT_AFTER_PHYSICS,tick);
        try {
            b.collider.on(cc.Contact2DType.PRE_SOLVE,observe);world.release(b);sample(true);
            await steady(ctx,b,`${names[kind]}真实落在地面`);
            grounded=state(b);b.placed=true; // only after real contact + .65s low motion; fixture bookkeeping only
            const paper=data.OBJECTS.cardboard_box,top=world.nativeBounds(b).top;
            upper=world.create(paper,offsetX,top+35-data.localBounds(paper,0).bottom);
            initialUpper={position:clone(upper.node.position),actualOffsetFromLower:upper.node.position.x-b.node.position.x};
            upper.collider.on(cc.Contact2DType.PRE_SOLVE,observe);world.release(upper);sample(true);
            await steady(ctx,upper,`纸箱由${names[kind]}承托`);
            loaded=current();upper.placed=true; // same real stability requirement before enabling old-body grace
            assert(loaded.touchesLower&&b.supported&&!b.lost,'上件没有真实接触待验物体或下件失去支撑',loaded);
            assert(loaded.lower.bullet&&loaded.upper.bullet,'新物体或上件缺少原生 CCD',loaded);
            if(isConcave(spec.outline||[]))assert(loaded.lower.fixtures>1,'新凹形物体缺少多 Fixture',loaded);
            await until(ctx,({elapsed:heldSeconds})=>{
                assert(!b.lost&&!upper.lost&&b.supported&&upper.supported,'承托初步稳定后两秒内又失去支撑或掉落',current());
                return heldSeconds>=2;
            },`${names[kind]}与纸箱继续自然承托两秒`,5000);
            const retained=current();
            assert(retained.touchesLower&&world.isStable(),'两秒后上件已离开下件或仍有明显运动',retained);sample(true);
            return {method:'独立世界；原始参数物体从台面上方60单位自然下落，稳定后标记fixture placed；纸箱从其最高点上方35单位自然下落，真实稳定后同样标记，并继续自然模拟两秒。无速度/姿态/隐藏支撑注入。',
                kind,requestedOffsetX:offsetX,initialUpper,grounded,loaded,retained,holdSeconds:2,contacts,trajectory};
        } catch(error) {
            sample(true);error.evidence={kind,requestedOffsetX:offsetX,initialUpper,grounded,loaded,current:current(),contacts,trajectory,failure:error.evidence??null};throw error;
        } finally {
            cc.director.off(cc.Director.EVENT_AFTER_PHYSICS,tick);
            if(cc.isValid(b.collider,true))b.collider.off(cc.Contact2DType.PRE_SOLVE,observe);
            if(upper&&cc.isValid(upper.collider,true))upper.collider.off(cc.Contact2DType.PRE_SOLVE,observe);
        }
    }
    async function normalCheck(sequenceOverride=null,candidateLabel='鲸鱼与篮球互换') {
        const ctx=await fresh(),{g,cc,data}=ctx,defaultSequence=[...g.snapshot().sequence],drops=[];
        const candidate=sequenceOverride!==null,sequence=candidate?[...sequenceOverride]:[...defaultSequence];
        try {
            if(candidate) {
                assert(g.snapshot().releases===0,'候选顺序设置前已经发生释放');
                assert(g.configureCalibration(sequence,true),'无法在首件释放前设置候选顺序',sequence);
                await until(ctx,({frames})=>frames>=2&&g.snapshot().phase==='planning'&&g.display.cameraRecovered(),'候选 NEXT 和规划状态就绪');
                assert(nextName(g)===`next_${sequence[1]}`,'候选顺序没有同步更新 NEXT');
                $('sequence').textContent='本次仅验收候选顺序（非正式默认）：'+sequence.map(k=>names[k]||k).join(' → ');
            }
            for(let i=0;i<sequence.length;i++) {
                status(`${candidate?'候选顺序（非正式默认）':'默认全居中快速叠放压力测试'}：第 ${i+1}/${sequence.length} 件 ${names[sequence[i]]}`);
                await until(ctx,()=>g.snapshot().phase==='planning'&&g.display.cameraRecovered()&&!g.world.hasPlacementHazard(),'等待正常放置',18000);
                const before=clone(g.snapshot()),current=g.current;
                assert(current.spec.kind===sequence[i],'真实出物与固定序列不同',{before,expected:sequence[i]});
                const next=nextName(g);g.moveTo(0);g.release();
                assert(g.snapshot().releases===before.releases+1,'正常释放未被接受');
                assert(nextName(g)===next,'释放的同一刻改变了 NEXT');
                await until(ctx,()=>g.current!==current&&g.snapshot().phase==='planning'&&g.display.cameraRecovered(),'真实落下并交接下一件',18000);
                drops.push({index:i,kind:current.spec.kind,announcedNext:next,nextHeld:g.current.spec.kind,after:clone(g.snapshot())});
                assert(`next_${g.current.spec.kind}`===next,'已经展示的 NEXT 没有按约定进入抓手',drops.at(-1));
            }
            await until(ctx,()=>g.snapshot().placed===sequence.length&&!g.snapshot().incident&&g.world.isStable(),'固定一轮物体全部真实稳定',18000);
            const final=clone(g.snapshot());assert(kinds.every(k=>drops.some(d=>d.kind===k)),'一轮没有覆盖十二种物体');
            g.finish('batch1c_review_end');
            await until(ctx,()=>cc.director.getScene()?.name==='Result','真实控制器进入结算',8000,{allowSceneChange:true,event:cc.Director.EVENT_AFTER_UPDATE});
            const canvas=cc.director.getScene().getChildByName('Canvas'),result=canvas.getComponent('ResultPresentation');
            const glyphs=result.card.getChildByName('HeightTreatment').children.map(n=>n.name.replace('HeightGlyph:','')).join('');
            assert(glyphs===`${final.peakMetres.toFixed(1)}m`&&Math.abs(data.runResult.height-final.peakMetres)<1e-8,'结算数字未使用真实本局高度',{glyphs,final,runResult:clone(data.runResult)});
            const retry=result.card.getChildByName('result_btn_retry'),event={getID:()=>701,propagationStopped:false};
            retry.emit(cc.Node.EventType.TOUCH_START,event);retry.emit(cc.Node.EventType.TOUCH_END,event);
            await until(ctx,()=>cc.director.getScene()?.name==='HUD'&&ctx.win.qaGame()?.snapshot().phase==='planning','真实重开按钮处理器进入新局',8000,{allowSceneChange:true,event:cc.Director.EVENT_AFTER_UPDATE});
            const restarted=ctx.win.qaGame().snapshot();
            assert(restarted.releases===0&&restarted.placed===0&&restarted.peakMetres===0&&restarted.stars===3&&!restarted.incident,'重开未清空本局状态',restarted);
            assert(JSON.stringify(restarted.sequence)===JSON.stringify(defaultSequence),'候选顺序或本局校准配置污染重开后的正式默认',restarted.sequence);
            return {method:(candidate?`候选出物顺序（${candidateLabel}），未采用为正式默认；首次释放前经configureCalibration设置。`:'正式默认出物顺序的全居中快速叠放压力配方，非所有玩家的必须成功路径。')+
                '无计时；只调用moveTo(0)/release，不注入物理位置或速度。结束用真实finish，重开向现有按钮发送触摸事件触发已绑定处理器，非真实手指。',
                candidate,candidateLabel:candidate?candidateLabel:null,defaultSequence,sequence,drops,final,result:{glyphs,height:data.runResult.height},restarted,
                notProven:['定时首局或玩家胜率','十局主观乐趣','微信触摸和性能']};
        } catch(e) { e.evidence={candidate,candidateLabel:candidate?candidateLabel:null,defaultSequence,sequence,completedDrops:drops,runResult:clone(data.runResult),failureReason:g.failureReason??data.runResult.reason,
            currentState:currentState(),failure:e.evidence||null};throw e; }
    }
    async function naturalResultCheck(recipe=[0],allowSurvival=false) {
        const ctx=await fresh(),{g,cc,data,win}=ctx,sequence=[...g.snapshot().sequence],drops=[];
        const platform=await win.System.import('chunks:///_virtual/local-platform.ts');
        const key='zhynd.local-settings.v1',raw=cc.sys.localStorage.getItem(key),saved=platform.readSettings();
        const audioEvents=[],listeners=[],observed=new WeakSet(),oldMusic=g.music.voices.map(v=>({source:v.source,node:v.source.node,name:v.source.node.name}));
        const started=cc.AudioSource.EventType.STARTED,ended=cc.AudioSource.EventType.ENDED;
        let maxPlaced=0,lastHUD=null,engineSeconds=0,cycleCheckpoint=null,survivalLimit=null,retiredAtResult=null;
        const retired=()=>oldMusic.map(v=>({name:v.name,validSource:cc.isValid(v.source,true),validNode:cc.isValid(v.node,true),
            playing:cc.isValid(v.source,true)?v.source.playing:false}));
        const observeNode=(node,scope)=>{
            if(observed.has(node)||!(/^(Sfx|Music):/.test(node.name)))return;observed.add(node);
            for(const type of [started,ended]){
                const callback=()=>{const source=node.getComponent(cc.AudioSource);audioEvents.push({scope,type,clip:source?.clip?.name,
                    node:node.name,at:performance.now(),playing:source?.playing,time:source?.currentTime});};
                node.on(type,callback);listeners.push({node,type,callback});
            }
        };
        const beforeLaunch=scene=>{
            const scope=scene.name==='Result'?'result':scene.name==='HUD'?'restarted':'other';
            if(scope==='result')retiredAtResult=retired();
            const canvas=scene.getChildByName('Canvas');if(!canvas)return;
            canvas.children.forEach(n=>observeNode(n,scope));
            const childAdded=node=>observeNode(node,scope);
            canvas.on(cc.Node.EventType.CHILD_ADDED,childAdded);listeners.push({node:canvas,type:cc.Node.EventType.CHILD_ADDED,callback:childAdded});
        };
        oldMusic.forEach(v=>observeNode(v.node,'original'));
        cc.director.on(cc.Director.EVENT_BEFORE_SCENE_LAUNCH,beforeLaunch);
        try {
            assert(recipe.length&&recipe.every(Number.isFinite),'指定动作配方必须是有限坐标数组',recipe);
            assert(platform.writeSettings({...saved,music:true,sound:true}),'自然结算音频验收无法暂存开关');g.audio.interact();
            await until(ctx,()=>g.music.snapshot().sources.some(s=>s.playing),'旧局真实音乐开始',8000,{event:cc.Director.EVENT_AFTER_UPDATE});
            const originalMusic=clone(g.music.snapshot());
            await until(ctx,({elapsed})=>{
                engineSeconds=elapsed;
                if(cc.director.getScene()?.name==='Result')return true;
                assert(cc.isValid(g,true)&&win.qaGame()===g,'自然失败前切到了非结算场景',currentState());
                const state=g.snapshot();lastHUD=clone(state);maxPlaced=Math.max(maxPlaced,state.placed);
                if(!cycleCheckpoint&&state.releases>=sequence.length&&state.phase==='planning')cycleCheckpoint=clone(state);
                status(`指定动作 ${recipe.join('/')}：${state.releases}/25 次释放 · 累计曾确认 ${maxPlaced} 件 · ${elapsed.toFixed(1)}/120 秒 · ${state.phase}`);
                if(elapsed>120){
                    if(allowSurvival){survivalLimit='120_engine_seconds';return true;}
                    assert(false,'120 引擎秒内未观察到自然失败，本次结算覆盖不足',{lastHUD,drops});
                }
                if(state.phase==='planning'&&g.display.cameraRecovered()&&!g.world.hasPlacementHazard()) {
                    if(state.releases>=25){
                        if(allowSurvival){survivalLimit='25_releases';return true;}
                        assert(false,'25 次释放后仍未自然失败，本次结算覆盖不足',{lastHUD,drops});
                    }
                    const kind=g.current.spec.kind,announcedNext=nextName(g),requestedX=recipe[state.releases%recipe.length];
                    g.moveTo(requestedX);const actualX=g.current.node.position.x;g.release();
                    assert(g.snapshot().releases===state.releases+1,'自然流程释放未被控制器接受');
                    drops.push({kind,requestedX,actualX,announcedNext,before:clone(state),after:clone(g.snapshot())});
                }
                return false;
            },'真实自然失败或指定动作观察上限，禁止强制结束',125000,{allowSceneChange:true,event:cc.Director.EVENT_AFTER_UPDATE});
            assert(maxPlaced>=8,'观察结束前累计曾确认稳定的物体不足八件',{maxPlaced,lastHUD});
            const method='正式默认顺序，真实moveTo(recipe[index])/release；不调用finish、不修改物理或事故。最多25释放/120引擎秒，结束前累计至少8件曾获稳定确认（不保证最初8件）；达到观察上限仍存活时仅统计，不冒称结算已验。';
            const cycle={releaseCount:sequence.length,survived:!!cycleCheckpoint,checkpoint:cycleCheckpoint,
                allPlacedAtHandoff:!!cycleCheckpoint&&cycleCheckpoint.placed>=sequence.length};
            if(survivalLimit)return {method,recipe,sequence,drops,maxPlaced,engineSeconds,lastHUD,cycle,
                outcome:'alive_at_observation_limit',reason:survivalLimit,resultVerified:false,audio:{originalMusic,events:audioEvents},
                notProven:['本局自然失败与结算重开','玩家胜率','主观乐趣','真实手指或微信真机']};
            const resultData=clone(data.runResult);
            assert(['large_collapse','stars_exhausted'].includes(resultData.reason)&&lastHUD?.failureReason===resultData.reason,
                '结算并非实际事故失败触发',{resultData,lastHUD});
            await until(ctx,()=>audioEvents.some(e=>e.scope==='result'&&e.clip==='run_end'&&e.type===started)&&
                audioEvents.some(e=>e.scope==='result'&&e.clip==='run_end'&&e.type===ended),
                'R13真实 run_end 开始和结束',8000,{allowSceneChange:true,event:cc.Director.EVENT_AFTER_UPDATE});
            const endingEvents=audioEvents.filter(e=>e.scope==='result'&&e.clip==='run_end');
            assert(endingEvents.filter(e=>e.type===started).length===1&&endingEvents.filter(e=>e.type===ended).length===1,
                '自然失败结束声未单次播放',endingEvents);
            assert(retiredAtResult?.length===2&&retiredAtResult.every(v=>!v.validSource&&!v.validNode&&!v.playing),
                '进入Result后旧局音乐音源未停止销毁',retiredAtResult);
            const canvas=cc.director.getScene().getChildByName('Canvas'),result=canvas.getComponent('ResultPresentation');
            const glyphs=result.card.getChildByName('HeightTreatment').children.map(n=>n.name.replace('HeightGlyph:','')).join('');
            assert(glyphs===`${lastHUD.peakMetres.toFixed(1)}m`&&Math.abs(resultData.height-lastHUD.peakMetres)<1e-8,
                '自然失败结算未显示真实本局高度',{glyphs,resultData,lastHUD});
            const retry=result.card.getChildByName('result_btn_retry'),touch={getID:()=>702,propagationStopped:false};
            retry.emit(cc.Node.EventType.TOUCH_START,touch);retry.emit(cc.Node.EventType.TOUCH_END,touch);
            await until(ctx,()=>cc.director.getScene()?.name==='HUD'&&win.qaGame()?.snapshot().phase==='planning'&&
                audioEvents.some(e=>e.scope==='restarted'&&e.clip==='bgm_city'&&e.type===started),
                '自然失败后的重开处理器与新音乐真实开始',8000,{allowSceneChange:true,event:cc.Director.EVENT_AFTER_UPDATE});
            const restarted=win.qaGame().snapshot(),newMusic=win.qaGame().music;
            assert(restarted.releases===0&&restarted.placed===0&&restarted.peakMetres===0&&restarted.stars===3&&!restarted.incident&&
                JSON.stringify(restarted.sequence)===JSON.stringify(sequence),'自然失败重开未清空对局或默认顺序改变',restarted);
            assert(newMusic.voices.every(v=>!oldMusic.some(old=>old.source===v.source))&&newMusic.snapshot().sources.some(s=>s.playing),
                '重开未使用新的真实音乐音源',newMusic.snapshot());
            return {method:method+'自然失败时R13读取真实高度；向既有retry处理器发送触摸事件。BEFORE_SCENE_LAUNCH监听新场景增加的音源节点，捕获真正STARTED/ENDED，无伪造事件。',
                recipe,sequence,drops,maxPlaced,engineSeconds,lastHUD,cycle,outcome:'natural_failure',reason:resultData.reason,resultVerified:true,
                result:{...resultData,glyphs},restarted,audio:{originalMusic,retiredAtResult,endingEvents,restarted:clone(newMusic.snapshot()),events:audioEvents},
                notProven:['所有放置全稳定','主观难度和玩家胜率','真实手指点击或微信真机']};
        } catch(error) {
            error.evidence={recipe,sequence,drops,maxPlaced,engineSeconds,lastHUD,cycleCheckpoint,runResult:clone(data.runResult),
                audio:{retiredAtResult,events:audioEvents},failure:error.evidence??currentState()};throw error;
        } finally {
            cc.director.off(cc.Director.EVENT_BEFORE_SCENE_LAUNCH,beforeLaunch);
            for(const {node,type,callback} of listeners)if(cc.isValid(node,true))node.off(type,callback);
            if(raw===null)cc.sys.localStorage.removeItem(key);else cc.sys.localStorage.setItem(key,raw);
            assert(cc.sys.localStorage.getItem(key)===raw,'自然结算测试未恢复原始设置');
        }
    }
    async function musicCheck() {
        const ctx=await fresh(),{g,cc,win}=ctx,music=g.music;
        assert(music&&typeof music.snapshot==='function','当前构建未提供已接入的音乐播放器');
        const platform=await win.System.import('chunks:///_virtual/local-platform.ts');
        const key='zhynd.local-settings.v1',raw=cc.sys.localStorage.getItem(key),saved=platform.readSettings();
        const events=[],samples=[],listeners=[];let height=0,incident=false,defeated=false,restoreDelayedPlay=null;
        const event=cc.Director.EVENT_AFTER_UPDATE;
        const tick=()=>{music.update(Math.min(.067,cc.game.deltaTime),height,incident,defeated);samples.push(clone(music.snapshot()));if(samples.length>1800)samples.shift();};
        const wait=(predicate,label,ms=8000)=>until(ctx,predicate,label,ms,{event});
        const observe=source=>{
            const type=cc.AudioSource.EventType.STARTED;
            const callback=()=>events.push({type,clip:source.clip?.name,time:source.currentTime,at:new Date().toISOString(),state:clone(music.snapshot())});
            source.node.on(type,callback);listeners.push({node:source.node,type,callback});
        };
        const write=musicEnabled=>assert(platform.writeSettings({...saved,music:musicEnabled}),'音频fixture暂存开关失败');
        try {
            g.enabled=false;g.audio.pause(true);write(false);music.update(0,0);
            assert(music.voices?.length===2,'音乐播放器不是限定的两个声部');
            music.voices.forEach(v=>observe(v.source));platform.markUserInteraction();write(true);music.pause(false);
            cc.director.on(event,tick);
            await wait(()=>events.some(e=>e.clip==='bgm_city')&&music.snapshot().gain>=.21,'城市音乐实际开始');
            const city=clone(music.snapshot());
            // Hold exactly the next real AudioSource.play call. No STARTED event is fabricated:
            // after 1.2 engine-observed seconds the original method actually starts the clip.
            const oldSource=music.voices.find(v=>v.source.clip?.name==='bgm_city').source;
            const newSource=music.voices.find(v=>v.source!==oldSource).source;
            const originalPlay=newSource.play,hadOwn=Object.prototype.hasOwnProperty.call(newSource,'play');
            let deferred=null;
            newSource.play=function(...args){
                if(!deferred&&this.clip?.name==='bgm_cloud'){deferred={args,requestedAt:new Date().toISOString()};return;}
                return originalPlay.apply(this,args);
            };
            restoreDelayedPlay=()=>{if(hadOwn)newSource.play=originalPlay;else delete newSource.play;};
            const slowEventStart=events.length;
            height=55;
            await wait(({elapsed})=>deferred&&elapsed>=1.2,'人为延迟新曲真实 play 1.2 秒，旧曲持续播放');
            const delayed=clone(music.snapshot());
            assert(oldSource.playing&&!newSource.playing&&delayed.fading&&delayed.fade===0&&
                oldSource.volume>=.21&&newSource.volume===0&&
                !events.slice(slowEventStart).some(e=>e.clip==='bgm_cloud'),
            '新曲尚未 STARTED 时旧曲已静音、已停止或提前推进交叉淡化',delayed);
            const resumeAtOldTime=oldSource.currentTime;
            restoreDelayedPlay();restoreDelayedPlay=null;
            originalPlay.apply(newSource,deferred.args);
            await wait(()=>music.snapshot().region==='bgm_cloud'&&music.snapshot().fading&&music.snapshot().sources.every(s=>s.playing),'城市向云层两源淡化');
            const cloudMid=clone(music.snapshot());
            const cloudStarted=events.slice(slowEventStart).find(e=>e.clip==='bgm_cloud');
            assert(cloudStarted,'延迟之后未观测到真正的 AudioSource STARTED 事件',events);
            const startedTimes=cloudStarted.state.sources.filter(s=>s.clip&&s.playing).map(s=>s.time);
            assert(startedTimes.length===2&&Math.abs(startedTimes[0]-startedTimes[1])<.12,
                '慢加载结束时未以真实 STARTED 当刻同步音乐相位',cloudStarted);
            const playingTimes=cloudMid.sources.filter(s=>s.playing).map(s=>s.time);
            assert(Math.abs(playingTimes[0]-playingTimes[1])<.25,'同主题切换没有对齐当前片段位置',cloudMid);
            height=200; // a second target change while the first fade is still running
            await wait(()=>music.snapshot().region==='bgm_space'&&!music.snapshot().fading,'连续跨区最终到太空');
            const space=clone(music.snapshot());
            assert(['bgm_city','bgm_cloud','bgm_space'].every(name=>events.some(e=>e.clip===name)),'三版音乐未全部实际开始',events);
            assert(samples.every(s=>s.sources.length===2&&s.sources.filter(v=>v.playing).length<=2),'切换同时播放超过两路');
            incident=true;await wait(()=>Math.abs(music.snapshot().gain-.09)<.005,'事故降低音乐音量');
            const ducked=clone(music.snapshot());incident=false;
            await wait(()=>music.snapshot().gain>=.21,'事故后音乐恢复');
            music.pause(true);
            await wait(()=>music.snapshot().sources.every(s=>!s.playing),'播放器暂停实际停止播放');
            const paused=clone(music.snapshot());
            await wait(({elapsed})=>elapsed>.2,'暂停不推进播放位置');
            const held=clone(music.snapshot());
            assert(held.sources.every((s,i)=>Math.abs(s.time-paused.sources[i].time)<.06),'暂停后音乐播放位置继续推进',{paused,held});
            music.pause(false);await wait(()=>music.snapshot().sources.some(s=>s.playing),'播放器恢复当前音乐');
            write(false);await wait(()=>music.snapshot().region===null&&music.snapshot().sources.every(s=>!s.playing&&!s.clip),'关闭音乐实际停止并清空');
            music.pause(true);music.pause(false);
            await wait(({elapsed})=>elapsed>.2,'关闭开关后的恢复观察');
            const muted=clone(music.snapshot());
            assert(muted.region===null&&muted.sources.every(s=>!s.playing)&&platform.readSettings().sound===saved.sound,'恢复流程重新打开音乐或改动音效开关',muted);
            write(true);height=55;await wait(()=>music.snapshot().region==='bgm_cloud'&&music.snapshot().sources.some(s=>s.playing),'重新开启使用当前高度');
            // Exercise the registered Cocos lifecycle callback, not just the music class.
            cc.game.emit(cc.Game.EVENT_HIDE);
            const hidden=clone(music.snapshot());
            assert(hidden.paused,'Game.EVENT_HIDE 未经 RunLifecycle 暂停音乐',hidden);
            cc.game.emit(cc.Game.EVENT_SHOW);
            await wait(()=>!music.snapshot().paused&&music.snapshot().sources.some(s=>s.playing),'Game.EVENT_SHOW 恢复音乐');
            const shown=clone(music.snapshot());
            defeated=true;await wait(()=>music.snapshot().gain===0,'失败余韵逐渐静音');
            assert(!music.snapshot().issues?.length,'播放器报告音乐缺失或启动问题',music.snapshot());
            return {method:'实际GameMusic与AudioSource STARTED事件。fixture暂停玩法控制器，自行喂镜头高度，真实两源播放、跨区和暂停；最后发Cocos显示/隐藏事件触发现有RunLifecycle。没有物理位置注入。',
                city,delayedStart:{method:'只截留一次新AudioSource.play，等待1.2秒引擎事件，再调用原始play；STARTED完全由真实音源产生。',
                    requestedAt:deferred.requestedAt,waiting:delayed,oldTimeWhenRealPlayCalled:resumeAtOldTime,actualStarted:cloudStarted},
                cloudMid,space,ducked,paused,muted,hidden,shown,defeated:clone(music.snapshot()),events,
                maxConcurrent:Math.max(...samples.map(s=>s.sources.filter(v=>v.playing).length)),
                notProven:['主观音色、循环接缝和音乐风格','手机扬声器','微信系统电话或音频焦点中断']};
        } finally {
            restoreDelayedPlay?.();
            cc.director.off(event,tick);if(cc.isValid(g,true)){cc.game.emit(cc.Game.EVENT_SHOW);music.pause(true);}
            for(const {node,type,callback} of listeners)if(cc.isValid(node,true))node.off(type,callback);
            if(raw===null)cc.sys.localStorage.removeItem(key);else cc.sys.localStorage.setItem(key,raw);
            assert(cc.sys.localStorage.getItem(key)===raw,'未恢复原始音乐/音效开关');
        }
    }
    async function materialAudioCheck() {
        const ctx=await fresh(),{g,cc,win}=ctx,audio=g.audio,music=g.music;
        assert(music&&audio,'当前构建缺少真实音频播放器');
        const platform=await win.System.import('chunks:///_virtual/local-platform.ts');
        const key='zhynd.local-settings.v1',raw=cc.sys.localStorage.getItem(key),saved=platform.readSettings();
        const events=[],listeners=[],playback=[],loopSamples=[];
        const started=cc.AudioSource.EventType.STARTED,ended=cc.AudioSource.EventType.ENDED,event=cc.Director.EVENT_AFTER_UPDATE;
        const expectedNew=['soft','ice','heavy'].flatMap(material=>[1,2,3].map(i=>`impact_${material}_${i}`));
        const mapping=[['wooden_crate','wood'],['sofa','soft'],['burger','soft'],['slipper','soft'],['ice_block','ice'],['whale','heavy']];
        let beganAt=0,deadline=0,previous=null,wrapped=null,maxMusicVoices=0,lastStatus=-1,lastSample=-1;
        const observe=(source,channel)=>{
            for(const type of [started,ended]) {
                const callback=()=>events.push({type,channel,clip:source.clip?.name,source:source.node.name,
                    at:performance.now(),time:source.currentTime,playing:source.playing});
                source.node.on(type,callback);listeners.push({node:source.node,type,callback});
            }
        };
        const tick=()=>{
            const dt=Math.min(.067,cc.game.deltaTime);audio.update(dt);music.update(dt,0);
            const state=music.snapshot(),active=state.sources.find(s=>s.playing&&s.clip==='bgm_city');
            maxMusicVoices=Math.max(maxMusicVoices,state.sources.filter(s=>s.playing).length);
            if(active) {
                const sample={elapsedWall:(performance.now()-beganAt)/1000,time:active.time,playing:active.playing,
                    sources:clone(state.sources),region:state.region};
                if(previous&&previous.time>20&&sample.time<5&&sample.time+10<previous.time&&!wrapped)
                    wrapped={before:previous,after:sample};
                previous=sample;
                if(sample.elapsedWall-lastSample>=.2||wrapped&&loopSamples.at(-1)?.time>5) {
                    loopSamples.push(sample);lastSample=sample.elapsedWall;
                }
                const seconds=Math.floor(sample.elapsedWall);
                if(seconds!==lastStatus){lastStatus=seconds;status(`材质音效 ${playback.length}/18 · 音乐自然播放 ${active.time.toFixed(1)} 秒${wrapped?' · 已跨回循环起点':''}`);}
            }
        };
        const wait=(predicate,label,max=7000)=>until(ctx,predicate,label,Math.max(1,Math.min(max,deadline-performance.now())),{event});
        try {
            g.enabled=false;audio.pause(true);
            assert(platform.writeSettings({...saved,music:false,sound:true}),'无法暂存音效fixture设置');music.update(0,0);
            for(const id of expectedNew)assert(audio.clips.has(id),`新材质音效缺失：${id}`);
            for(const v of audio.voices)observe(v.source,'sfx');
            for(const v of music.voices)observe(v.source,'music');
            audio.interact();assert(platform.writeSettings({...saved,music:true,sound:true}),'无法开启本次音频fixture');
            audio.pause(false);music.pause(false);beganAt=performance.now();deadline=beganAt+45000;cc.director.on(event,tick);
            await wait(()=>events.some(e=>e.channel==='music'&&e.type===started&&e.clip==='bgm_city'),'自然音乐实际开始');
            const boundMusic=g.approvedSounds.find(c=>c.name==='bgm_city'),duration=boundMusic?.getDuration();
            assert(duration>30&&duration<40,'当前城市片段长度与自然循环验收预期不符',duration);
            for(const [kind,material] of mapping) for(const variant of [1,2,3]) {
                const eventName=`impact_${kind}`,expected=`impact_${material}_${variant}`,from=events.length;
                assert(audio.play(eventName,.55,`qa-1c-material:${kind}:${variant}`),`${eventName} 未被真实 GameAudio.play 接受`);
                await wait(()=>events.slice(from).some(e=>e.channel==='sfx'&&e.clip===expected&&e.type===started)&&
                    events.slice(from).some(e=>e.channel==='sfx'&&e.clip===expected&&e.type===ended),`${eventName} / ${expected} 真实开始与结束`);
                const observed=events.slice(from).filter(e=>e.channel==='sfx');
                assert(observed.filter(e=>e.clip===expected&&e.type===started).length===1&&observed.filter(e=>e.clip===expected&&e.type===ended).length===1,
                    '映射播放缺失、结束缺失或重复播放',observed);
                playback.push({kind,eventName,expected,events:observed});
            }
            await wait(()=>wrapped&&music.snapshot().sources.some(s=>s.clip==='bgm_city'&&s.playing&&s.time>=.35),
                '等待一次完整音乐自然循环，不快进',45000);
            const musicStart=events.find(e=>e.channel==='music'&&e.type===started&&e.clip==='bgm_city');
            assert(wrapped.after.elapsedWall-(musicStart.at-beganAt)/1000>=duration-.75,'循环证据没有经历足够自然播放时间',{duration,musicStart,wrapped});
            assert(maxMusicVoices===1&&wrapped.before.playing&&wrapped.after.playing,'自然循环中出现多重音乐声部或停止',wrapped);
            assert(expectedNew.every(id=>playback.some(p=>p.expected===id)),'没有覆盖新增九个短音效',playback);
            assert(!music.snapshot().issues?.length,'音乐循环期间报告加载问题',music.snapshot());
            return {method:'独立音频fixture暂停玩法，仅推进真实GameAudio/GameMusic时钟。六种新物体各实际调用三次impact事件，共18次，监听真实STARTED/ENDED；城市音乐从0自然播放跨过一次循环，无seek/倍速/伪造事件。45秒整体上限。',
                newClips:expectedNew,mapping,playback,musicLoop:{duration,wrapped,maxConcurrent:maxMusicVoices,final:clone(music.snapshot()),samples:loopSamples},events,
                notProven:['新物体音效均由自然碰撞触发','循环接缝主观听感','手机或微信音频行为']};
        } catch(error) {
            error.evidence={playback,events,musicLoop:{wrapped,maxConcurrent:maxMusicVoices,samples:loopSamples},failure:error.evidence??currentState()};throw error;
        } finally {
            cc.director.off(event,tick);if(cc.isValid(g,true)){audio.pause(true);music.pause(true);}
            for(const {node,type,callback} of listeners)if(cc.isValid(node,true))node.off(type,callback);
            if(raw===null)cc.sys.localStorage.removeItem(key);else cc.sys.localStorage.setItem(key,raw);
            assert(cc.sys.localStorage.getItem(key)===raw,'材质音效检查未恢复原始设置');
        }
    }
    const tests=[['shapes','十二种轮廓 / NEXT / 旋转',shapeCheck],...added.map(k=>[k,`${names[k]}真实落地与承托`,()=>contactCheck(k)]),
        ['normal','默认十四件全居中压力 / 全流程',normalCheck],['music','音乐切换与停止',musicCheck],
        ['material-audio','新材质音效 / 音乐自然循环',materialAudioCheck]];
    async function runChecks(list) {
        if(!report.ready||report.busy)return;report.busy=true;render();
        try { for(const [id,name,action] of list) {
            const row={id,name,status:'running',startedAt:new Date().toISOString()};report.results.push(row);
            $('modeLabel').textContent=id==='normal'?'默认全居中快速叠放压力测试':id.startsWith('candidate-')?'候选顺序 · 未采用 · 无物理注入':id==='natural-result'?'真实自然失败 → R13 → 重开':'受控检查 · 不代表正常游戏难度';
            status(`正在检查：${name}`);render();const errorStart=report.errors.length;
            try{row.evidence=await action();assert(report.errors.length===errorStart,'检查期间发生引擎错误',report.errors.slice(errorStart));row.status='passed';}
            catch(e){row.status='failed';row.error=String(e.stack||e);row.evidence=e.evidence||currentState();}
            finally{row.finishedAt=new Date().toISOString();row.engineErrors=report.errors.slice(errorStart);cleanup?.();cleanup=null;render();}
        }status('本次检查已结束；请查看实际结果，可以重新开始普通试玩。');}
        finally{report.busy=false;render();}
    }
    async function begin(untimed) {
        if(!report.ready||report.busy)return;report.busy=true;render();
        try{await fresh(untimed);$('modeLabel').textContent=untimed?'正常十二物体试玩 · 无计时':'正常十二物体试玩 · 4 秒';status('可左右拖动并松手释放，右下按钮旋转。');}
        catch(e){status(String(e));}finally{report.busy=false;render();}
    }
    function manual(name,action) {
        if(report.busy||!report.ready)return;const g=frame.contentWindow.qaGame?.();
        if(!g||!g.enabled){status('请先重新开始正常试玩。');return;}
        const before=currentState();action(g);const after=currentState();report.manualActions.push({name,at:new Date().toISOString(),before,after});
        status(name==='release'&&before.game.releases===after.game.releases?'尚未进入可释放阶段，本次未释放。':`已执行：${name}`);render();
    }
    $('start').onclick=()=>begin(false);$('untimed').onclick=()=>begin(true);
    $('release-center').onclick=()=>manual('release',g=>{g.moveTo(0);g.release();});$('rotate-current').onclick=()=>manual('rotate',g=>g.rotate());
    $('checkpoint').onclick=()=>manual('checkpoint',()=>{});$('finish').onclick=()=>manual('review-finish',g=>g.finish());
    $('size').onchange=e=>{[frame.width,frame.height]=e.target.value.split(',');};
    for(const test of tests)$(`check-${test[0]}`).onclick=()=>runChecks([test]);$('check-all').onclick=()=>runChecks(tests);
    // Separate optional regression; the existing ten-item all sequence remains unchanged.
    $('check-burger-offset').onclick=()=>runChecks([
        ['burger-left','汉堡左偏 10 单位自然承托',()=>contactCheck('burger',-10)],
        ['burger-right','汉堡右偏 10 单位自然承托',()=>contactCheck('burger',10)],
    ]);
    $('check-natural-result').onclick=()=>runChecks([['natural-result','真实自然失败 → R13 → 重开',naturalResultCheck]]);
    $('check-ten-runs').onclick=async()=>{
        const recipes=[[0],[4],[-4],[-4,4],[-8,8]],list=[];
        recipes.forEach((recipe,index)=>{for(let repeat=1;repeat<=2;repeat++)list.push([
            `ten-run-${index+1}-${repeat}`,`指定动作 ${recipe.join('/')} · 第 ${repeat}/2 局`,()=>naturalResultCheck(recipe,true),
        ]);});
        await runChecks(list);
        const rows=report.results.slice(-10).filter(row=>row.id.startsWith('ten-run-'));
        const survivors=rows.filter(row=>row.evidence?.cycle?.survived).length;
        status(`十局指定动作已记录：${survivors}/${rows.length} 局完成首轮 ${rows[0]?.evidence?.sequence?.length||14} 次释放后仍存活；仅表示当时仍可继续，不代表首轮全部放稳；这是固定配方统计，不是玩家胜率。`);
    };
    $('export').onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify({...report,exportedAt:new Date().toISOString(),finalState:currentState()},null,2)],{type:'application/json'}));
        const a=document.createElement('a');a.href=url;a.download=`batch1c-checks-${new Date().toISOString().replaceAll(':','-')}.json`;a.click();URL.revokeObjectURL(url);};
    window.addEventListener('message',async e=>{
        if(e.origin!==location.origin||e.source!==frame.contentWindow)return;
        if(e.data?.type==='play-error'){status(e.data.error);capture(e.data.error,'engine-startup');return;}
        if(e.data?.type!=='play-ready'||report.ready)return;
        try{const win=frame.contentWindow;if(frameErrorWindow!==win){frameErrorWindow=win;win.addEventListener('error',e=>capture(e.error||e.message,'engine'));win.addEventListener('unhandledrejection',e=>capture(e.reason,'engine-promise'));}
            await loadScene('HUD');const g=win.qaGame();if(g){g.enabled=false;g.music?.pause(true);}report.ready=true;status('引擎已就绪。选择普通试玩或一项检查。');render();
        }catch(e){status(String(e));capture(e,'engine-ready');}
    });
    setInterval(()=>{const s=currentState();$('state').textContent=JSON.stringify(s,null,2);const g=s.game;
        $('manualSummary').textContent=g?`阶段 ${g.phase} · 已释放 ${g.releases} · 已放稳 ${g.placed} · ${g.peakMetres.toFixed(2)} m · ${g.stars} 星 · 当前 ${names[g.bodies.find(b=>b.id===g.currentId)?.kind]||'无'} · ${report.manualActions.length} 次操作记录`:'当前不是游戏场景。';},200);
})();
