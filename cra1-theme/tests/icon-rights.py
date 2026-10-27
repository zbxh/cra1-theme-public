#!/usr/bin/env python3
"""Prevent provenance checks from approving approximate or incomplete drawing matches."""
import json
import pathlib
import runpy

key = runpy.run_path(str(pathlib.Path(__file__).resolve().parents[1] / 'scripts/icon-rights.py'))['coordinate_key']
checks = []

original = '<svg><path d="M1 2L3 4Z M5 6L7 8z"/></svg>'
serialized = '<svg fill="red"><path d="M5,6 L7,8Z"/><path d="M1.0 2 L3 4z"/></svg>'
assert key(original) == key(serialized)
checks.append('Exact numbers, paint changes and absolute path grouping preserve source coordinates')

for changed in [
    '<svg><path d="M1 2L3 5Z M5 6L7 8z"/></svg>',
    '<svg><path d="M1 2L3 4Z M5 6L7 8z"/><circle cx="1" cy="2" r="3"/></svg>',
    '<svg><g transform="scale(2)"><path d="M1 2L3 4Z M5 6L7 8z"/></g></svg>',
]:
    assert key(original) != key(changed)
    checks.append('Changed coordinates, additional drawings and transforms are not silently ignored')

for unsupported in [
    '<svg><image href="test"/></svg>',
    '<svg><path d="M1 2 !"/></svg>',
    '<svg/>',
    '<!DOCTYPE svg><svg/>',
]:
    try:
        key(unsupported)
    except ValueError:
        checks.append('Unsupported or empty source is rejected')
    else:
        raise AssertionError('Unsupported source accepted')

print(json.dumps({'status':'passed','checks':len(checks),'production_writes':0}))
