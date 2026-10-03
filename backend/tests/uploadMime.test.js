const { sniffMime, normalizeClientMime, assertAllowedUpload, multerFileFilter } = require('../src/utils/uploadMime');

describe('uploadMime', () => {
  test('sniffs JPEG magic bytes', () => {
    const buf = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    expect(sniffMime(buf)).toBe('image/jpeg');
  });

  test('sniffs PNG magic bytes', () => {
    const buf = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
    expect(sniffMime(buf)).toBe('image/png');
  });

  test('rejects exe-like upload', () => {
    const file = { mimetype: 'application/x-msdownload', originalname: 'evil.exe' };
    expect(() => assertAllowedUpload(file, Buffer.from([0x4d, 0x5a]))).toThrow(/Unsupported/);
  });

  test('multerFileFilter accepts jpeg', (done) => {
    multerFileFilter({}, { mimetype: 'image/jpeg', originalname: 'a.jpg' }, (err, ok) => {
      expect(err).toBeNull();
      expect(ok).toBe(true);
      done();
    });
  });

  test('multerFileFilter rejects zip', (done) => {
    multerFileFilter({}, { mimetype: 'application/zip', originalname: 'a.zip' }, (err) => {
      expect(err).toBeTruthy();
      done();
    });
  });

  test('M4A voice ftyp brand sniffs as audio/mp4', () => {
    const buf = Buffer.alloc(16, 0);
    buf.write('ftyp', 4, 'ascii');
    buf.write('M4A ', 8, 'ascii');
    expect(sniffMime(buf)).toBe('audio/mp4');
  });

  test('audio/mp4 client + video sniff on .m4a is allowed (voice note)', () => {
    const ftypMp42 = Buffer.alloc(16, 0);
    ftypMp42.write('ftyp', 4, 'ascii');
    ftypMp42.write('mp42', 8, 'ascii');
    expect(sniffMime(ftypMp42)).toBe('video/mp4');
    expect(
      assertAllowedUpload(
        { mimetype: 'audio/mp4', originalname: 'audio-123.m4a' },
        ftypMp42
      )
    ).toBe('audio/mp4');
  });
});
