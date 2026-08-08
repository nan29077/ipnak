import "server-only";
/**
 * 의존성 없는 최소 ZIP 생성기 (Node zlib deflate-raw 사용)
 *
 * YOLO 학습셋 내보내기(이미지 + 라벨 + data.yaml)를 zip 한 개로 묶기 위해 만들었다.
 * 외부 패키지를 추가하지 않으려고 스펙(APPNOTE 4.3)의 필요한 부분만 구현했다.
 *
 * 지원 범위
 *  - 저장 방식: deflate(method 8)
 *  - UTF-8 파일명 (general purpose flag bit 11)
 *  - ZIP64 미지원 → 개별 파일 4GB 미만, 전체 엔트리 65535개 미만
 */
import { deflateRawSync } from "zlib";

interface Entry {
  name: string;
  data: Buffer;
}

/** CRC-32 테이블 (최초 1회만 생성) */
let crcTable: Uint32Array | null = null;
function getCrcTable(): Uint32Array {
  if (crcTable) return crcTable;
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  crcTable = table;
  return table;
}

function crc32(buf: Buffer): number {
  const table = getCrcTable();
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Date → DOS 날짜/시간 (2바이트씩) */
function dosDateTime(d: Date): { time: number; date: number } {
  const year = Math.max(1980, d.getFullYear());
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2),
    date: ((year - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

/**
 * 파일 목록을 zip 버퍼로 만든다.
 *
 * @param entries  { name: "images/a.jpg", data: Buffer } 목록. name 의 "/" 가 폴더가 된다.
 * @param at       zip 안에 기록할 수정 시각 (기본 현재 시각)
 */
export function createZip(entries: Entry[], at: Date = new Date()): Buffer {
  const { time, date } = dosDateTime(at);
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.name, "utf8");
    const crc = crc32(entry.data);
    const compressed = deflateRawSync(entry.data);

    const local = Buffer.alloc(30 + nameBuf.length);
    local.writeUInt32LE(0x04034b50, 0); // local file header signature
    local.writeUInt16LE(20, 4);         // version needed
    local.writeUInt16LE(0x0800, 6);     // flags: bit 11 = UTF-8 파일명
    local.writeUInt16LE(8, 8);          // compression: deflate
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(date, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(entry.data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);         // extra field length
    nameBuf.copy(local, 30);

    const central = Buffer.alloc(46 + nameBuf.length);
    central.writeUInt32LE(0x02014b50, 0); // central directory header signature
    central.writeUInt16LE(20, 4);         // version made by
    central.writeUInt16LE(20, 6);         // version needed
    central.writeUInt16LE(0x0800, 8);     // flags
    central.writeUInt16LE(8, 10);         // compression
    central.writeUInt16LE(time, 12);
    central.writeUInt16LE(date, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(entry.data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt16LE(0, 30);         // extra length
    central.writeUInt16LE(0, 32);         // comment length
    central.writeUInt16LE(0, 34);         // disk number start
    central.writeUInt16LE(0, 36);         // internal attributes
    central.writeUInt32LE(0, 38);         // external attributes
    central.writeUInt32LE(offset, 42);    // local header offset
    nameBuf.copy(central, 46);

    locals.push(local, compressed);
    centrals.push(central);
    offset += local.length + compressed.length;
  }

  const centralBuf = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); // end of central directory signature
  eocd.writeUInt16LE(0, 4);          // disk number
  eocd.writeUInt16LE(0, 6);          // disk with central directory
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);         // comment length

  return Buffer.concat([...locals, centralBuf, eocd]);
}
