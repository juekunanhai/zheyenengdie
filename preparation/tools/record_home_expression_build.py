"""Record a completed local home-expression build against this round's working-tree baseline."""
from pathlib import Path
import argparse, hashlib, json
from datetime import datetime, timezone
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'preparation/review/evidence/home-expression-r1'
def digest(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def tree(d): return {p.relative_to(ROOT).as_posix():digest(p) for p in sorted(d.rglob('*')) if p.is_file()}
def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--target', choices=['web-desktop','wechatgame'], required=True)
    parser.add_argument('--log',required=True)
    parser.add_argument('--exit-code',type=int,required=True)
    args=parser.parse_args()
    log=ROOT/args.log
    assert args.exit_code in (0,36), 'Creator exited unsuccessfully'
    assert f'build Task ({args.target}) Finished' in log.read_text(), 'Matching completion absent'
    before=json.loads((OUT/'BASELINE.json').read_text())['runtimeInputHashes']
    current={}
    for name in ['assets','settings','.creator']:current.update(tree(ROOT/name))
    for name in ['package.json','tsconfig.json']:current[name]=digest(ROOT/name)
    allowed={'assets/batch0/presentation/HomePresentation.ts','assets/batch0/scenes/Home.scene'}
    assets=['home_face_duck_blink_r1','home_face_crate_blink_r1','home_face_toilet_look_r1',
        'home_face_slipper_blink_r1','home_arm_open_r1','home_arm_grip_r1']
    additions={f'assets/batch0/art/{name}.png{ext}' for name in assets for ext in ['', '.meta']}
    changed={n for n in before if before[n]!=current.get(n)}
    assert changed <= allowed, f'Unexpected existing runtime changes {changed-allowed}'
    assert set(current)-set(before)==additions, 'Unexpected new runtime inputs'
    outputs=tree(ROOT/'build'/args.target)
    report={'recordedAt':datetime.now(timezone.utc).isoformat(),'revision':'home-expression-r1',
        'actualCreatorExitCode':args.exit_code,'target':args.target,'logSha256':digest(log),
        'baseline':'BASELINE.json (camera-impact-home-r1 final inputs)',
        'runtimeInputHashes':current,'changedExisting':sorted(changed),'added':sorted(additions),
        'retainedVerified':len(before)-len(changed),'outputHashes':outputs,
        'outputTreeSha256':hashlib.sha256('\n'.join(f'{n}:{outputs[n]}' for n in sorted(outputs)).encode()).hexdigest(),
        'limit':'Local build only. Runtime and real-device acceptance are separate.'}
    (OUT/f'BUILD_{args.target}.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    (OUT/f'BUILD_{args.target}.log').write_bytes(log.read_bytes())
    print(json.dumps({k:report[k] for k in ['target','actualCreatorExitCode','retainedVerified','changedExisting','outputTreeSha256']}))
if __name__=='__main__':main()
