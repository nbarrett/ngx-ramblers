const CRC32_TABLE: number[] = Array.from({length: 256}, (_unused, index) => {
  return [0, 1, 2, 3, 4, 5, 6, 7].reduce((crc) => {
    return (crc & 1) ? (0xedb88320 ^ (crc >>> 1)) : (crc >>> 1);
  }, index);
});

export interface ZipStoreEntry {
  name: string;
  bytes: Uint8Array;
}

function crc32(bytes: Uint8Array): number {
  return (bytes.reduce((crc, value) => CRC32_TABLE[(crc ^ value) & 0xff] ^ (crc >>> 8), 0xffffffff) ^ 0xffffffff) >>> 0;
}

function writeUint16(target: Uint8Array, offset: number, value: number): void {
  target[offset] = value & 0xff;
  target[offset + 1] = (value >>> 8) & 0xff;
}

function writeUint32(target: Uint8Array, offset: number, value: number): void {
  writeUint16(target, offset, value);
  writeUint16(target, offset + 2, value >>> 16);
}

function encodedName(name: string): Uint8Array {
  return new TextEncoder().encode(name.replace(/\\/g, "/"));
}

export function storedZipArchive(entries: ZipStoreEntry[]): Uint8Array {
  const files = entries.map(entry => {
    const nameBytes = encodedName(entry.name);
    const checksum = crc32(entry.bytes);
    return {nameBytes, checksum, bytes: entry.bytes, size: entry.bytes.length};
  });
  const localSize = files.reduce((total, file) => total + 30 + file.nameBytes.length + file.size, 0);
  const centralSize = files.reduce((total, file) => total + 46 + file.nameBytes.length, 0);
  const archive = new Uint8Array(new ArrayBuffer(localSize + centralSize + 22));
  const cursor = {offset: 0};
  const localOffsets = files.map(file => {
    const localOffset = cursor.offset;
    writeUint32(archive, cursor.offset, 0x04034b50);
    writeUint16(archive, cursor.offset + 4, 20);
    writeUint16(archive, cursor.offset + 6, 0x0800);
    writeUint16(archive, cursor.offset + 8, 0);
    writeUint16(archive, cursor.offset + 10, 0);
    writeUint16(archive, cursor.offset + 12, 0);
    writeUint32(archive, cursor.offset + 14, file.checksum);
    writeUint32(archive, cursor.offset + 18, file.size);
    writeUint32(archive, cursor.offset + 22, file.size);
    writeUint16(archive, cursor.offset + 26, file.nameBytes.length);
    writeUint16(archive, cursor.offset + 28, 0);
    archive.set(file.nameBytes, cursor.offset + 30);
    archive.set(file.bytes, cursor.offset + 30 + file.nameBytes.length);
    cursor.offset += 30 + file.nameBytes.length + file.size;
    return localOffset;
  });
  const centralOffset = cursor.offset;
  files.forEach((file, index) => {
    writeUint32(archive, cursor.offset, 0x02014b50);
    writeUint16(archive, cursor.offset + 4, 20);
    writeUint16(archive, cursor.offset + 6, 20);
    writeUint16(archive, cursor.offset + 8, 0x0800);
    writeUint16(archive, cursor.offset + 10, 0);
    writeUint16(archive, cursor.offset + 12, 0);
    writeUint16(archive, cursor.offset + 14, 0);
    writeUint32(archive, cursor.offset + 16, file.checksum);
    writeUint32(archive, cursor.offset + 20, file.size);
    writeUint32(archive, cursor.offset + 24, file.size);
    writeUint16(archive, cursor.offset + 28, file.nameBytes.length);
    writeUint16(archive, cursor.offset + 30, 0);
    writeUint16(archive, cursor.offset + 32, 0);
    writeUint16(archive, cursor.offset + 34, 0);
    writeUint16(archive, cursor.offset + 36, 0);
    writeUint32(archive, cursor.offset + 38, 0);
    writeUint32(archive, cursor.offset + 42, localOffsets[index]);
    archive.set(file.nameBytes, cursor.offset + 46);
    cursor.offset += 46 + file.nameBytes.length;
  });
  writeUint32(archive, cursor.offset, 0x06054b50);
  writeUint16(archive, cursor.offset + 4, 0);
  writeUint16(archive, cursor.offset + 6, 0);
  writeUint16(archive, cursor.offset + 8, files.length);
  writeUint16(archive, cursor.offset + 10, files.length);
  writeUint32(archive, cursor.offset + 12, cursor.offset - centralOffset);
  writeUint32(archive, cursor.offset + 16, centralOffset);
  writeUint16(archive, cursor.offset + 20, 0);
  return archive;
}

export function storedZipFile(entries: ZipStoreEntry[], fileName: string): File {
  const bytes = storedZipArchive(entries);
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return new File([buffer], fileName, {type: "application/zip"});
}
