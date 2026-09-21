import { CHUNKED_UPLOAD_THRESHOLD, chunkedS3Upload, abortChunkedUploadSession } from '../chunkedS3Upload';

describe('chunkedS3Upload', () => {
  it('has 8MB threshold', () => {
    expect(CHUNKED_UPLOAD_THRESHOLD).toBe(8 * 1024 * 1024);
  });

  it('gracefully handles abort for non-existent session', async () => {
    await expect(abortChunkedUploadSession('file:///tmp/nonexistent.mp4', 1000)).resolves.not.toThrow();
  });

  it('fails cleanly when local file does not exist', async () => {
    const res = await chunkedS3Upload({
      uri: 'file:///path/to/missing/video.mp4',
      mediaType: 'video',
    });
    expect(res.success).toBe(false);
    expect(res.error).toBeDefined();
  });
});
