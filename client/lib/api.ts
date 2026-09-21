import Constants from 'expo-constants';

function normalizeApiBase(url: string): string {
  const trimmed = url.replace(/\/+$/, '');
  return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
}

import { getAPIBaseURL as getBaseUrl } from '../config/environment';

function getAPIBaseURL(): string {
  return getBaseUrl();
}

export const API_BASE_URL = getAPIBaseURL();
export const BACKEND_URL = API_BASE_URL.replace(/\/api\/?$/, '');
export const DEFAULT_AVATAR_URL = `${BACKEND_URL}/assests/avatardefault.webp`;

const extra = (Constants as any)?.expoConfig?.extra || {};

/** CloudFront / media CDN host (no scheme). */
export const CLOUDFRONT_DOMAIN = (
  process.env.EXPO_PUBLIC_CLOUDFRONT_DOMAIN ||
  process.env.EXPO_PUBLIC_MEDIA_CDN_URL ||
  extra.CLOUDFRONT_DOMAIN ||
  extra.MEDIA_CDN_URL ||
  'd2ghstwmcd6f2g.cloudfront.net'
)
  .replace(/^https?:\/\//, '')
  .replace(/\/+$/, '');

export const S3_DIRECT_ORIGIN = 'https://tripsapp-bucket.s3.eu-north-1.amazonaws.com';

/**
 * Map S3 object URLs onto CloudFront. Already-CDN URLs pass through.
 */
export function getCdnUrl(url: string | null | undefined): string {
  if (!url) return '';
  const cleanDomain = CLOUDFRONT_DOMAIN;
  if (!cleanDomain) return url;

  if (url.includes(cleanDomain)) return url;

  if (url.includes('.amazonaws.com/')) {
    const s3Path = url.split('.amazonaws.com/')[1];
    if (!s3Path) return url;
    return `https://${cleanDomain}/${s3Path}`;
  }

  return url;
}
