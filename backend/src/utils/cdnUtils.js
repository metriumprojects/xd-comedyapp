/**
 * S3 → CloudFront / MEDIA_CDN URL helper.
 * Accepts MEDIA_CDN_URL, CLOUDFRONT_DOMAIN, or AWS_CLOUDFRONT_DOMAIN.
 */
function getCdnDomain() {
  const raw =
    process.env.MEDIA_CDN_URL ||
    process.env.CLOUDFRONT_DOMAIN ||
    process.env.AWS_CLOUDFRONT_DOMAIN ||
    '';
  if (!raw) return '';
  return String(raw).replace(/^https?:\/\//, '').replace(/\/+$/, '');
}

function toCdnUrl(url) {
  if (!url || typeof url !== 'string') return url;
  const cleanDomain = getCdnDomain();
  if (!cleanDomain) return url;

  // Already on our CDN host
  if (url.includes(cleanDomain)) return url;

  if (url.includes('.amazonaws.com/')) {
    const parts = url.split('.amazonaws.com/');
    const key = parts[1] || '';
    if (!key) return url;
    return `https://${cleanDomain}/${key}`;
  }

  // Relative S3-style keys (no host)
  if (url.startsWith('/') && !url.startsWith('//')) {
    return url; // leave API-relative paths alone
  }

  return url;
}

module.exports = { toCdnUrl, getCdnDomain };
