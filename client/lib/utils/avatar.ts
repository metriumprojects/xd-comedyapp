import { DEFAULT_AVATAR_URL, BACKEND_URL, getCdnUrl } from '../api';

/**
 * Canonical “no profile pic” avatar used across the app.
 * Prefer this helper instead of ad-hoc placeholders / splash icons.
 */
export { DEFAULT_AVATAR_URL };

const BAD_AVATAR_MARKERS = [
  'avatardefault.webp',
  'avatardefault.png',
  'default-pic.jpg',
  'default/default-pic',
  'via.placeholder.com',
  'placeholder.com',
];

export function isMissingOrDefaultAvatar(url?: string | null): boolean {
  if (url == null) return true;
  const s = String(url).trim();
  if (!s) return true;
  const lower = s.toLowerCase();
  if (lower === 'null' || lower === 'undefined' || lower === 'none' || lower === 'n/a' || lower === 'na') {
    return true;
  }
  return BAD_AVATAR_MARKERS.some((m) => lower.includes(m));
}

(resolveAvatarUrl as any).isMissingOrDefaultAvatar = isMissingOrDefaultAvatar;

/** Always returns a usable https/http URL for Image/ExpoImage. */
export function resolveAvatarUrl(url?: string | null): string {
  if (isMissingOrDefaultAvatar(url)) return DEFAULT_AVATAR_URL;
  let s = String(url).trim();
  if (s.startsWith('//')) return getCdnUrl(`https:${s}`);
  if (s.startsWith('http://')) return getCdnUrl(`https://${s.slice(7)}`);
  if (s.startsWith('https://')) return getCdnUrl(s);
  if (s.startsWith('file://') || s.startsWith('content://') || s.startsWith('ph://')) {
    // Allow in-session local previews (edit profile / picker). Broken paths fall back via Image onError.
    return s;
  }
  if (s.startsWith('/')) {
    const baseUrl = BACKEND_URL.endsWith('/') ? BACKEND_URL.slice(0, -1) : BACKEND_URL;
    return `${baseUrl}${s}`;
  }
  if (!s.includes('://')) {
    const baseUrl = BACKEND_URL.endsWith('/') ? BACKEND_URL.slice(0, -1) : BACKEND_URL;
    return `${baseUrl}/${s}`;
  }
  return s;
}

/** Flatten common avatar field shapes without picking defaults over real photos. */
function collectAvatarCandidates(userObj: any): Array<string | null | undefined> {
  return [
    userObj.user?.avatar,
    userObj.user?.photoURL,
    userObj.user?.profilePicture,
    userObj.userId?.avatar,
    userObj.userId?.photoURL,
    userObj.userId?.profilePicture,
    userObj.author?.avatar,
    userObj.author?.photoURL,
    userObj.author?.profilePicture,
    userObj.authorAvatar,
    userObj.sender?.avatar,
    userObj.sender?.photoURL,
    userObj.sender?.profilePicture,
    userObj.senderAvatar,
    userObj.profile?.avatar,
    userObj.profile?.photoURL,
    userObj.otherUser?.avatar,
    userObj.otherUser?.photoURL,
    userObj.otherUserProfile?.avatar,
    userObj.otherUserProfile?.photoURL,
    userObj.otherParticipant?.avatar,
    userObj.otherParticipant?.photoURL,
    userObj.avatar,
    userObj.photoURL,
    userObj.profilePicture,
    userObj.profileImage,
    userObj.userAvatar,
    userObj.userThumbnailUrl,
  ];
}

/** Utility to extract and resolve avatar URL from any user/post/story object structure or string */
export function getUserAvatarUrl(userObj: any): string {
  if (!userObj) return DEFAULT_AVATAR_URL;
  if (typeof userObj === 'string') return resolveAvatarUrl(userObj);

  const candidates = collectAvatarCandidates(userObj);
  for (const c of candidates) {
    if (!isMissingOrDefaultAvatar(c)) {
      return resolveAvatarUrl(c);
    }
  }
  return DEFAULT_AVATAR_URL;
}

/** Try multiple sources; first real (non-default) avatar wins. */
export function pickAvatarUrl(...sources: any[]): string {
  for (const s of sources) {
    if (s == null || s === '') continue;
    const url = typeof s === 'string' || typeof s === 'number' ? resolveAvatarUrl(String(s)) : getUserAvatarUrl(s);
    if (!isMissingOrDefaultAvatar(url)) return url;
  }
  return DEFAULT_AVATAR_URL;
}

/** Utility to check if a user is verified from any user/post/item object structure */
export function isUserVerified(userObj: any): boolean {
  if (!userObj) return false;
  if (typeof userObj === 'boolean') return userObj;

  return Boolean(
    userObj.verified ||
    userObj.isVerified ||
    userObj.userVerified ||
    userObj.user?.verified ||
    userObj.user?.isVerified ||
    userObj.userId?.verified ||
    userObj.userId?.isVerified ||
    userObj.author?.verified ||
    userObj.author?.isVerified ||
    userObj.profile?.verified ||
    userObj.profile?.isVerified ||
    userObj.otherUser?.verified ||
    userObj.otherUser?.isVerified ||
    userObj.postMetadata?.verified ||
    userObj.postMetadata?.isVerified
  );
}
