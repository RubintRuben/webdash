#!/usr/bin/env python3
"""Copy original, locally installed audio referenced by GD level strings.

python tools/import-gd-audio.py LOCAL_GD_DIR fixture.txt ... --songs 1382827,1370030
No level names or special playback rules enter the game engine.
"""
import argparse
import json
import shutil
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('source', type=Path)
parser.add_argument('levels', nargs='*', type=Path)
parser.add_argument('--songs', default='')
args = parser.parse_args()
target = Path(__file__).resolve().parent.parent / 'assets/audio/gd'
target.mkdir(parents=True, exist_ok=True)
manifest_file = target / 'manifest.json'
manifest = json.loads(manifest_file.read_text()) if manifest_file.exists() else {}
assets = {('song', int(i)) for i in args.songs.split(',') if i.strip()}
for file in args.levels:
    for obj in file.read_text(encoding='utf-8-sig').split(';')[1:]:
        fields = obj.split(',')
        raw = dict(zip(fields[::2], fields[1::2]))
        if raw.get('1') in ('1934', '3602') and int(raw.get('392', 0)) > 0:
            assets.add(('song' if raw['1'] == '1934' else 'sfx', int(raw['392'])))
missing = []
for kind, ident in sorted(assets):
    stem = ('s' if kind == 'sfx' else '') + str(ident)
    source = next((args.source / (stem + suffix) for suffix in ('.ogg', '.mp3', '.wav')
                   if (args.source / (stem + suffix)).is_file()), None)
    if source is None:
        missing.append(f'{kind}:{ident}')
        continue
    dest = target / source.name
    if not dest.exists() or source.stat().st_size != dest.stat().st_size:
        shutil.copy2(source, dest)
    manifest[f'{kind}:{ident}'] = source.name
manifest_file.write_text(json.dumps(manifest, indent=2, sort_keys=True) + '\n')
print(json.dumps({'available': len(manifest), 'missing': missing, 'manifest': str(manifest_file)}))
