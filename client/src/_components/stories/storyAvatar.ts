/**
 * Story avatar resolution helpers (no UI).
 */
import { getUserAvatarUrl, resolveAvatarUrl, isMissingOrDefaultAvatar } from '@/lib/utils/avatar';
import { DEFAULT_AVATAR_URL } from '@/lib/api';

export function resolveStoryUserAvatar(storyOrUser: any, fallback?: string | null): string {
  const fromObj = getUserAvatarUrl(storyOrUser);
  if (!isMissingOrDefaultAvatar(fromObj)) return fromObj;
  if (fallback && !isMissingOrDefaultAvatar(fallback)) return resolveAvatarUrl(fallback);
  return DEFAULT_AVATAR_URL;
}

export async function fetchFreshUserAvatar(userId: string): Promise<string | null> {
  if (!userId) return null;
  try {
    const { apiService } = await import('@/src/_services/apiService');
    const res = await apiService.get(`/users/${userId}`);
    if (!res?.success) return null;
    const data =
      (res?.data && typeof res.data === 'object' && (res.data as any).data) ||
      (res?.data && typeof res.data === 'object' && (res.data as any).user) ||
      res?.data;
    if (!data) return null;
    const avatar = getUserAvatarUrl(data);
    return avatar;
  } catch {
    return null;
  }
}
