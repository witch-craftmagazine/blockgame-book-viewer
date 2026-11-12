#!/usr/bin/env python3
"""
Generate exact Minecraft Java Unifont advances from a client's font assets.

Mirrors net.minecraft.client.gui.font.providers.UnihexProvider (26.2):
  - hex entries "CODEPOINT:DATA", DATA = 32/64/96/128 hex digits (8/16/24/32 px wide x 16 rows); later entries win
  - size_overrides (from,to,left,right) are applied first, in order, and remove the glyph from the pool
  - otherwise bounds come from the set bits: left = leading zeros, right = 31 - trailing zeros
  - blank glyph: left = 0, right = bitWidth  (so width = bitWidth + 1)
  - width = right - left + 1, advance = width / 2.0 + 1.0, bold offset = 0.5
  - NOTE: this script stores the half-pixel value. The runtime (src/engine/UnifontAdvances.ts) rounds it
    down to floor(width / 2) + 1, which is what real hand-typeset books need. See that file for the evidence.
Providers are read from include/unifont.json in order; filtered providers (e.g. {"jp": true}) are skipped by default.
Not modelled here: the space provider (' ' = 4, U+200C = 0), the bitmap sheets (they win over Unifont), and
the MISSING glyph (advance 6) for code points no provider has.

Usage: gen_unihex_advances.py <dir containing include/unifont.json and the hex zips> <out prefix> [--jp]
Writes <out>.json ({"0x00A0": 5.5, ...}) and <out>.bin (1 byte per code point = advance * 2, 0 = no glyph).
"""
import json, os, sys, zipfile

def read_hex(zpath):
    out = {}
    with zipfile.ZipFile(zpath) as z:
        for n in z.namelist():
            if n.endswith('.hex'):
                for line in z.read(n).decode('ascii').split('\n'):
                    if line:
                        cp, data = line.split(':')
                        out[int(cp, 16)] = data
    return out

def unpack(data):
    n = len(data)
    bw = {32: 8, 64: 16, 96: 24, 128: 32}[n]
    per = n // 16
    shift = {8: 24, 16: 16, 24: 8, 32: 0}[bw]
    return bw, [int(data[i * per:(i + 1) * per], 16) << shift for i in range(16)]

def bounds(data):
    bw, rows = unpack(data)
    mask = 0
    for r in rows:
        mask |= r
    if mask == 0:
        return 0, bw
    return 32 - mask.bit_length(), 32 - ((mask & -mask).bit_length() - 1) - 1

def cp(v):
    return ord(v) if isinstance(v, str) else v

def main():
    font_dir, out = sys.argv[1], sys.argv[2]
    use_jp = '--jp' in sys.argv
    providers = json.load(open(os.path.join(font_dir, 'include', 'unifont.json')))['providers']
    result = {}
    for p in providers:
        if p.get('type') != 'unihex':
            continue
        flt = p.get('filter') or {}
        if flt.get('jp') is True and not use_jp:
            continue
        if flt.get('jp') is False and use_jp:
            continue
        zpath = os.path.join(font_dir, p['hex_file'].split(':')[-1].replace('font/', '', 1))
        bits = read_hex(zpath)
        glyphs = {}
        for o in p.get('size_overrides', []):
            for c in range(cp(o['from']), cp(o['to']) + 1):
                if c in bits:
                    del bits[c]
                    glyphs[c] = (o['left'], o['right'])
        for c, d in bits.items():
            glyphs[c] = bounds(d)
        for c, (l, r) in glyphs.items():
            result.setdefault(c, (r - l + 1) / 2.0 + 1.0)      # first active provider wins
    json.dump({'0x%04X' % c: result[c] for c in sorted(result)}, open(out + '.json', 'w'), indent=0)
    size = max(result) + 1
    arr = bytearray(size)
    for c, a in result.items():
        arr[c] = int(a * 2)
    open(out + '.bin', 'wb').write(arr)
    print('glyphs: %d, max code point: U+%X, bin bytes: %d' % (len(result), max(result), size))

if __name__ == '__main__':
    main()
