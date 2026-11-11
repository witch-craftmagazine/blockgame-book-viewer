#!/usr/bin/env python3
"""
Encode the JSON produced by gen_unihex_advances.py into src/engine/unifontAdvancesData.ts.

Usage:
  python3 scripts/gen_unihex_advances.py <client font dir> /tmp/unifont_advances
  python3 scripts/encode_unifont_advances.py /tmp/unifont_advances.json src/engine/unifontAdvancesData.ts

Format: runs of consecutive code points that share one advance, written as LEB128 varints
(gap since the previous run's end, run length) followed by one byte holding advance * 2.
The whole stream is base64 encoded. Decoded by src/engine/UnifontAdvances.ts.
"""
import base64, json, sys

def varint(n):
    out = bytearray()
    while True:
        b = n & 0x7F
        n >>= 7
        if n:
            out.append(b | 0x80)
        else:
            out.append(b)
            return bytes(out)

def main():
    src, dst = sys.argv[1], sys.argv[2]
    table = json.load(open(src))
    items = sorted((int(k, 16), v) for k, v in table.items())
    for _, v in items:
        assert v * 2 == int(v * 2) and 0 < v * 2 < 256, v
    items = [(c, int(v * 2)) for c, v in items]

    buf = bytearray()
    prev_end = 0
    runs = 0
    i = 0
    while i < len(items):
        start, val = items[i]
        j = i
        while j + 1 < len(items) and items[j + 1][0] == items[j][0] + 1 and items[j + 1][1] == val:
            j += 1
        length = j - i + 1
        buf += varint(start - prev_end) + varint(length) + bytes([val])
        prev_end = start + length
        runs += 1
        i = j + 1

    b64 = base64.b64encode(bytes(buf)).decode('ascii')
    lines = [b64[k:k + 100] for k in range(0, len(b64), 100)]
    body = "\n".join("  '%s'" % l + (" +" if n < len(lines) - 1 else ";") for n, l in enumerate(lines))
    with open(dst, 'w') as f:
        f.write(
            "// GENERATED FILE. Do not edit by hand.\n"
            "// Exact Minecraft Java Unifont advances (UnihexProvider rules), %d glyphs in %d runs.\n"
            "// Regenerate with scripts/gen_unihex_advances.py and scripts/encode_unifont_advances.py.\n"
            "export const UNIFONT_ADVANCES_B64 =\n%s\n" % (len(items), runs, body)
        )
    print('glyphs %d, runs %d, base64 chars %d' % (len(items), runs, len(b64)))

if __name__ == '__main__':
    main()
