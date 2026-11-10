"""Import the original part-animation timing and looping metadata."""
import json
import plistlib
import sys
from pathlib import Path

resources = Path(sys.argv[1] if len(sys.argv) > 1 else
                 r'C:/Program Files (x86)/Steam/steamapps/common/Geometry Dash/Resources')
definitions = plistlib.loads((resources / 'objectDefinitions.plist').read_bytes().lstrip())
names = ['GJBeast01', 'GJBeast02', 'GJBeast03', 'GJBeast04', 'GJBeast05', 'BlackSludge']
settings = {}
for name in names:
    source = definitions[name]
    settings[name] = {
        'defaultAnimation': source['defaultAnimation'],
        'animations': {clip: {'delay': float(data['delay']), 'frames': int(data['frames']),
                              'looped': data['looped'] == '1'}
                       for clip, data in source['animations'].items()}
    }
target = Path(__file__).resolve().parents[1] / 'assets/animations/beast-settings.json'
target.write_text(json.dumps(settings, indent=2) + '\n', encoding='utf-8')
print(f'Imported {len(settings)} animation definitions: {target}')
