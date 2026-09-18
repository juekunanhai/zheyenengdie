"""Record this physics revision's build, with retained runtime inputs checked against Git.

Run immediately after a completed Creator invocation. --exit-code is its actual
process result, not an inferred success from files left by an earlier build.
"""
from pathlib import Path
import argparse
import hashlib
import json
import subprocess
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'preparation/review/evidence/depth-assist-r1'
CHANGED = {'assets/batch1/tower-world.ts', 'assets/batch1/game-controller.ts'}
ADDED = {'assets/batch1/contact-assistance.ts', 'assets/batch1/contact-assistance.ts.meta'}


def sha(data):
    return hashlib.sha256(data).hexdigest()


def tree(directory):
    return {p.relative_to(directory).as_posix(): sha(p.read_bytes())
            for p in sorted(directory.rglob('*')) if p.is_file()}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--target', choices=['web-desktop', 'wechatgame'], required=True)
    parser.add_argument('--exit-code', type=int, required=True)
    parser.add_argument('--log', required=True)
    args = parser.parse_args()
    if args.exit_code not in (0, 36):
        raise RuntimeError(f'Creator did not complete successfully: {args.exit_code}')
    baseline = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT).decode().strip()
    names = subprocess.check_output(['git', 'ls-tree', '-r', '--name-only', baseline,
        'assets', 'settings', '.creator', 'package.json', 'tsconfig.json'], cwd=ROOT).decode().splitlines()
    inputs, retained = {}, 0
    for name in names:
        path = ROOT / name
        current = path.read_bytes()
        inputs[name] = sha(current)
        if name not in CHANGED:
            original = subprocess.check_output(['git', 'show', f'{baseline}:{name}'], cwd=ROOT)
            if current != original:
                raise RuntimeError(f'Unexpected retained runtime change: {name}')
            retained += 1
    actual = {p.relative_to(ROOT).as_posix() for top in ['assets', 'settings', '.creator']
              for p in (ROOT / top).rglob('*') if p.is_file()}
    if actual - set(names) != ADDED:
        raise RuntimeError(f'Unexpected added runtime inputs: {actual - set(names)}')
    for name in sorted(ADDED):
        inputs[name] = sha((ROOT / name).read_bytes())
    log = (ROOT / args.log).read_bytes()
    if f'build Task ({args.target}) Finished'.encode() not in log:
        raise RuntimeError('Missing matching Creator build completion in supplied log')
    outputs = tree(ROOT / 'build' / args.target)
    if not outputs:
        raise RuntimeError('No build outputs')
    report = {'revision': 'depth-assist-r1-angular', 'recordedAt': datetime.now(timezone.utc).isoformat(),
        'baselineCommit': baseline, 'target': args.target, 'actualCreatorExitCode': args.exit_code,
        'retainedInputsVerified': retained, 'runtimeInputHashes': inputs,
        'outputHashes': outputs, 'outputCount': len(outputs), 'logSha256': sha(log),
        'outputTreeSha256': sha('\n'.join(f'{n}:{outputs[n]}' for n in sorted(outputs)).encode()),
        'scope': 'Build and unchanged-resource validation only; runtime and real-device results are separate.'}
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / f'BUILD_{args.target}.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    (OUT / f'BUILD_{args.target}.log').write_bytes(log)
    print(json.dumps({'target': args.target, 'retainedInputsVerified': retained,
                      'outputCount': len(outputs), 'status': 'build_and_scope_verified'}))


if __name__ == '__main__':
    main()
