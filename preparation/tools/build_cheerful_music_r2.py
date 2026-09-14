#!/usr/bin/env python3
"""Reproducible audition exports; never imports files into the game runtime."""
from __future__ import annotations

import hashlib
import json
import subprocess
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'preparation/audio/cheerful-r2/music'
FFMPEG = '/opt/homebrew/bin/ffmpeg'
FFPROBE = '/opt/homebrew/bin/ffprobe'
CATALOG = 'https://incompetech.com/music/royalty-free/pieces.json'
LICENSE_URL = 'https://creativecommons.org/licenses/by/4.0/'
TRACKS = [
    dict(id='music_a_carefree', isrc='USUAN1400037', title='A · 轻快拨弦',
         max_duration_s=80,
         description='尤克里里、吉他、马林巴与轻打击的明亮拨弦方向；保留连续乐句和配器变化，供比较轻松、欢快的主配乐方向。',
         source_title='Carefree'),
    dict(id='music_b_happy_boy', isrc='USUAN1100648', title='B · 俏皮小乐队',
         max_duration_s=None,
         description='单簧管、大号、吉他与打击的喜剧小乐队方向；完整短曲包含两种速度的变奏，用来比较更活泼、逗趣的氛围。',
         source_title='Happy Boy End Theme'),
]


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def run(args: list[str]) -> subprocess.CompletedProcess:
    return subprocess.run(args, capture_output=True, text=True, check=True)


def relative(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def fetch(url: str, path: Path) -> dict:
    if path.exists():
        return dict(url=url, file=relative(path), sha256=digest(path), bytes=path.stat().st_size,
                    fetch_status='reused_local_original')
    request = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(request, timeout=45) as response:
        data = response.read()
        content_type = response.headers.get('Content-Type', '')
        if path.suffix == '.mp3' and 'text/html' in content_type:
            raise RuntimeError(f'Expected audio, received HTML: {url}')
        path.write_bytes(data)
        return dict(url=url, final_url=response.url, content_type=content_type,
                    file=relative(path), sha256=digest(path), bytes=len(data),
                    downloaded_at=datetime.now(timezone.utc).isoformat())


def probe(path: Path) -> dict:
    return json.loads(run([FFPROBE, '-v', 'error', '-show_format', '-show_streams',
                           '-of', 'json', str(path)]).stdout)


def loudness(path: Path) -> dict:
    result = run([FFMPEG, '-hide_banner', '-nostats', '-i', str(path), '-af',
                  'loudnorm=I=-22:TP=-2.5:LRA=20:print_format=json', '-f', 'null', '-'])
    text = result.stderr
    values = json.loads(text[text.rfind('{'):text.rfind('}') + 1])
    return dict(integrated_lufs=float(values['input_i']), true_peak_dbfs=float(values['input_tp']),
                loudness_range_lu=float(values['input_lra']))


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for name in ('sources', 'exports', 'evidence'):
        (OUT / name).mkdir(exist_ok=True)
    evidence = []
    evidence.append(fetch(CATALOG, OUT / 'evidence/pieces.json'))
    catalog = json.loads((OUT / 'evidence/pieces.json').read_text())
    evidence.append(fetch('https://incompetech.com/music/royalty-free/licenses/',
                          OUT / 'evidence/incompetech-license.html'))
    evidence.append(fetch(LICENSE_URL, OUT / 'evidence/cc-by-4.0.html'))
    outputs = []
    for track in TRACKS:
        item = next(p for p in catalog if p['isrc'] == track['isrc'])
        assert item['title'] == track['source_title']
        page = 'https://incompetech.com/music/royalty-free/index.html?isrc=' + track['isrc']
        evidence.append(fetch(page, OUT / f"evidence/{track['id']}-source.html"))
        source_url = ('https://incompetech.com/music/royalty-free/mp3-royaltyfree/'
                      + urllib.parse.quote(item['filename']))
        original = OUT / 'sources' / item['filename']
        source_record = fetch(source_url, original)
        original_probe = probe(original)
        original_duration = float(original_probe['format']['duration'])
        duration = min(track['max_duration_s'] or original_duration, original_duration)
        raw_excerpt = OUT / 'exports' / f"{track['id']}_excerpt.wav"
        run([FFMPEG, '-y', '-v', 'error', '-i', str(original), '-t', str(duration),
             '-ar', '44100', '-ac', '2', '-c:a', 'pcm_s16le', str(raw_excerpt)])
        before = loudness(raw_excerpt)
        # A constant gain preserves the source dynamics. No compressor, limiter,
        # tempo change, pitch change, extra synthesis, or repeat of an old loop.
        gain = min(-22.0 - before['integrated_lufs'], -2.5 - before['true_peak_dbfs'])
        processed = OUT / 'exports' / f"{track['id']}.mp3"
        fade = f'volume={gain:.5f}dB,afade=t=in:d=0.03,afade=t=out:st={max(0, duration-1.2):.5f}:d=1.2'
        run([FFMPEG, '-y', '-v', 'error', '-i', str(raw_excerpt), '-af', fade,
             '-ar', '44100', '-ac', '2', '-c:a', 'libmp3lame', '-b:a', '192k',
             '-map_metadata', '-1', str(processed)])
        final_probe = probe(processed)
        after = loudness(processed)
        assert abs(after['integrated_lufs'] + 22.0) < 1.0, after
        assert after['true_peak_dbfs'] < -2.0, after
        run([FFMPEG, '-v', 'error', '-i', str(processed), '-f', 'null', '-'])
        attribution = (f'"{item["title"]}" — Kevin MacLeod (incompetech.com). '
                       f'Licensed under Creative Commons Attribution 4.0: {LICENSE_URL} '
                       f'Source: {page} Changes: audition excerpt, constant-gain level adjustment, '
                       'brief boundary fades, MP3 re-encoding; no tempo or pitch changes.')
        outputs.append(dict(
            id=track['id'], title=track['title'], description=track['description'],
            file=relative(processed), file_base='project_root',
            duration_s=float(final_probe['format']['duration']),
            source_page=page, source_title=item['title'], source_url=source_url,
            author='Kevin MacLeod', license='CC BY 4.0', license_url=LICENSE_URL,
            attribution_required=True, attribution=attribution, source_record=source_record,
            source_format='Author website full downloadable MP3 (not lossless original)',
            source_instruments=item['instruments'], source_bpm=item['bpm'],
            instrumentation_caveat='官网声明乐器编配；未核实是否每件乐器都是真人实录。',
            source_duration_s=original_duration, excerpt_start_s=0, excerpt_duration_s=duration,
            loop_ready=False, loop_note='候选为带结尾淡出的试听段；尚未制作或验收无缝循环。',
            processing=dict(constant_gain_db=round(gain, 5), filters=fade, speed=1.0, pitch_changed=False,
                            compressed_or_limited=False, source_excerpt=relative(raw_excerpt),
                            source_excerpt_sha256=digest(raw_excerpt), before=before, after=after),
            sha256=digest(processed), bytes=processed.stat().st_size,
            technical_checks=dict(decode='pass', channels=2, sample_rate_hz=44100,
                                  encoded_bitrate_bps=192000, loudness_target_lufs=-22,
                                  peak_below_minus_2_dbfs=True),
            listening_status='not_claimed_audition_candidates_require_user_review',
        ))
    manifest = dict(revision='cheerful-r2', status='audition_candidates_only_not_imported',
                    generated_at=datetime.now(timezone.utc).isoformat(),
                    file_base='project_root', tracks=outputs, source_evidence=evidence,
                    scope='仅候选试听。未改运行时、assets、构建配置或既有音乐。',
                    tool_versions=dict(ffmpeg=run([FFMPEG, '-version']).stdout.splitlines()[0]),
                    listening_note='筛选依据为作者乐器/情绪/速度说明和本地技术检查；未声称已实际听感验收。')
    (OUT / 'MANIFEST.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    (OUT / 'CREDITS.txt').write_text('\n\n'.join(t['attribution'] for t in outputs) + '\n')
    print(json.dumps([dict(id=t['id'], file=t['file'], duration_s=t['duration_s'],
                           measurements=t['processing']['after']) for t in outputs], indent=2))


if __name__ == '__main__':
    main()
