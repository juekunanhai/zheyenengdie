#!/usr/bin/env python3
"""Verify the committed transfer baseline; no Cocos, npm or third-party modules needed."""
import hashlib
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / 'preparation/repository/TRANSFER_MANIFEST.json'


def main():
    try:
        manifest = json.loads(MANIFEST.read_text(encoding='utf-8'))
    except (OSError, ValueError) as exc:
        print('Cannot read transfer manifest: {}'.format(exc), file=sys.stderr)
        return 1
    failures = []
    total = 0
    for entry in manifest['files']:
        relative = Path(entry['path'])
        if relative.is_absolute() or '..' in relative.parts:
            failures.append('{}: unsafe manifest path'.format(relative))
            continue
        path = ROOT / relative
        if path.is_symlink() or not path.is_file():
            failures.append('{}: missing file or unexpected symlink'.format(relative))
            continue
        data = path.read_bytes()
        if len(data) != entry['bytes'] or hashlib.sha256(data).hexdigest() != entry['sha256']:
            failures.append('{}: content differs from transfer baseline'.format(relative))
        total += len(data)
    if failures:
        print('\n'.join(failures), file=sys.stderr)
        print('FAIL: {} file(s); compare intended changes with git diff.'.format(len(failures)), file=sys.stderr)
        return 1
    print('PASS: {} files, {} bytes; transfer baseline is intact.'.format(len(manifest['files']), total))
    print('This checks transferred files, not engine execution or physical-device behavior.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
