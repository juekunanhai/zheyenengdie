/** Cross-check the shipped local builds, source scope and bounded runtime evidence. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),out=path.join(root,'preparation/review/evidence/camera-impact-r1');
const read=n=>JSON.parse(fs.readFileSync(path.join(out,n),'utf8'));
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
const web=read('BUILD_web-desktop.json'),wechat=read('BUILD_wechatgame.json'),homeBuild=read('BUILD_web-desktop-attempt2.json');
const engine=read('engine-final.json'),corner=read('concave-l-r1.json'),home=read('home-r1.json');
assert.deepEqual(web.runtimeInputHashes,wechat.runtimeInputHashes);
for(const [name,hash] of Object.entries(web.runtimeInputHashes))assert.equal(sha(fs.readFileSync(path.join(root,name))),hash,name);
for(const build of [web,wechat])for(const [name,hash] of Object.entries(build.outputHashes))assert.equal(sha(fs.readFileSync(path.join(root,name))),hash,name);
const qaHash=sha(JSON.stringify(Object.entries(web.outputHashes).sort((a,b)=>a[0].localeCompare(b[0]))));
assert.equal(qaHash,engine.build.sha256);assert.equal(qaHash,corner.build.sha256);
for(const evidence of [engine,corner,home]){assert.equal(evidence.errors.length,0);assert(evidence.checks.every(c=>c.pass));}
const homeHash=sha(Object.entries(homeBuild.outputHashes).map(([p,h])=>`${p.replace('build/web-desktop/','')}:${h}`).sort().join('\n'));
assert.equal(homeHash,home.buildSha256Before);assert.equal(homeHash,home.buildSha256After);
const changesAfterHome=Object.keys(homeBuild.runtimeInputHashes).filter(n=>homeBuild.runtimeInputHashes[n]!==web.runtimeInputHashes[n]);
assert.deepEqual(changesAfterHome.sort(),['assets/batch0/presentation/HeightBackdrop.ts','assets/batch0/scenes/HUD.scene']);
assert.equal(home.sourceSha256,web.runtimeInputHashes['assets/batch0/presentation/HomePresentation.ts']);
const addedAfterHome=Object.keys(web.runtimeInputHashes).filter(n=>!homeBuild.runtimeInputHashes[n]);
assert.deepEqual(addedAfterHome.sort(),['assets/batch0/art/fx_backdrop_cloud_r1.png','assets/batch0/art/fx_backdrop_cloud_r1.png.meta']);
const config=JSON.parse(fs.readFileSync(path.join(root,'build/wechatgame/project.config.json'),'utf8'));
assert.equal(config.compileType,'game');assert.equal(config.appid,'wxc0360e0c829a3307');
for(const name of ['game.js','game.json'])assert(fs.existsSync(path.join(root,'build/wechatgame',name)));
const report={status:'local_build_and_bounded_runtime_verified',createdAt:new Date().toISOString(),
 sourceScopeMatchesBothBuilds:true,webOutputs: Object.keys(web.outputHashes).length,wechatOutputs:Object.keys(wechat.outputHashes).length,
 assertions:engine.checks.length+corner.checks.length+home.checks.length,retainedInputs:web.retainedVerified,
 homeEvidenceCarriedOnlyAfterIdenticalHomeSourceSceneAssetsAndInputVerification:true,changesAfterHome,addedAfterHome,
 finalWebSha256:web.outputTreeSha256,finalWechatSha256:wechat.outputTreeSha256,
 motionVideo:{home:read('home-r1.json').videoNote,gameplay:read('play-current.json').method},
 limitations:['No real-device validation of this new revision.','No claim of improved long-run physics or complete subjective surprise.','About five pixels of city edge mirroring remain at 0.75, not a new panoramic source.'],
 records:['engine-final.json','concave-l-r1.json','home-r1.json','BUILD_web-desktop.json','BUILD_wechatgame.json']};
fs.writeFileSync(path.join(out,'FINAL_VERIFICATION.json'),JSON.stringify(report,null,2)+'\n');
process.stdout.write(JSON.stringify({status:report.status,assertions:report.assertions,webOutputs:report.webOutputs,wechatOutputs:report.wechatOutputs})+'\n');
