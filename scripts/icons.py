"""Generate dependency-free PNG icons; run python3 scripts/icons.py."""
import math, struct, zlib
from pathlib import Path

def chunk(kind, data):
    return struct.pack('>I', len(data)) + kind + data + struct.pack('>I', zlib.crc32(kind+data)&0xffffffff)
for size in [16,32,48,128]:
    rows=[]
    for y in range(size):
        row=bytearray([0])
        for x in range(size):
            total=[0,0,0,0]
            for sy in range(4):
                for sx in range(4):
                    px=(x+(sx+.5)/4)/size;py=(y+(sy+.5)/4)/size
                    rounded=math.hypot(max(abs(px-.5)-.32,0),max(abs(py-.5)-.32,0))<.17
                    radius=math.hypot(px-.5,py-.5)
                    ring=.30<radius<.35
                    bars=(.405<px<.465 or .535<px<.595) and .37<py<.63
                    color=(172,148,250,255) if ring or bars else (15,18,32,255 if rounded else 0)
                    total=[a+b for a,b in zip(total,color)]
            row.extend(v//16 for v in total)
        rows.append(bytes(row))
    data=b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',size,size,8,6,0,0,0))+chunk(b'IDAT',zlib.compress(b''.join(rows)))+chunk(b'IEND',b'')
    Path(f'public/icons/{size}.png').write_bytes(data)
