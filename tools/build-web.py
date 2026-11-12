#!/usr/bin/env python3
"""Create a clean CDN artifact. Never publish tools, work, Git or native files."""
from pathlib import Path
import json
import hashlib
import re
import os
import shutil
import urllib.parse

root = Path(__file__).resolve().parent.parent
out = root / 'dist'
api = os.environ.get('WEBDASH_API_BASE', '').strip()
if os.environ.get('RENDER') == 'true' and not api:
    raise SystemExit('Set WEBDASH_API_BASE to the backend public URL before building the static site')
if api and not api.startswith(('http://', 'https://')):
    api = 'https://' + api
if api:
    url = urllib.parse.urlsplit(api)
    if url.scheme != 'https' or not url.hostname or url.username or url.password or url.path not in ('', '/') or url.query or url.fragment:
        raise SystemExit('WEBDASH_API_BASE must be an HTTPS service origin')
    api = api.rstrip('/')
if out.is_symlink() or out.resolve().parent != root or out.name != 'dist':
    raise SystemExit('Refusing to clean an output directory outside this project')
if out.exists():
    shutil.rmtree(out)
out.mkdir(exist_ok=True)
shutil.copyfile(root / 'index.html', out / 'index.html')
shutil.copytree(root / 'assets', out / 'assets', dirs_exist_ok=True)
(out / 'assets/scripts/utils/hosting-config.js').write_text(
    'window.WEBDASH_API_BASE = ' + json.dumps(api) + ';\n', encoding='utf-8')
# Some CDN paths retain old assets despite a changed query string. Give
# each entry script/style an immutable URL derived from its actual bytes.
# Keep the original paths for dynamic resource lookups and local development.
index = out / 'index.html'
def version_asset(match):
    attribute, relative = match.group(1), match.group(2)
    source = (out / relative).resolve()
    if not source.is_relative_to(out.resolve()) or not source.is_file():
        raise SystemExit('Missing build entry asset: ' + relative)
    digest = hashlib.sha256(source.read_bytes()).hexdigest()[:16]
    target = source.with_name(source.stem + '.' + digest + source.suffix)
    shutil.copyfile(source, target)
    return attribute + '="' + target.relative_to(out.resolve()).as_posix() + '"'
index.write_text(re.sub(r'(src|href)=["\'](assets/[^"\'?#]+\.(?:js|css))(?:\?[^"\']*)?["\']',
                        version_asset, index.read_text(encoding='utf-8')), encoding='utf-8')
(out / '.nojekyll').write_text('', encoding='utf-8')
print('Built static frontend in dist; backend configured:', bool(api))
