/** Shared mutable inbox list cache — keeps DM edits in sync with inbox preview. */

let globalInboxCache: any[] | null = null;

export function getInboxCache(): any[] | null {
  return globalInboxCache;
}

export function setInboxCache(next: any[] | null) {
  globalInboxCache = next;
}

/** Instantly update inbox row preview after a message edit. */
export function patchInboxLastMessage(conversationId: string, lastMessage: string) {
  const cid = String(conversationId || '').trim();
  const preview = String(lastMessage || '').trim();
  if (!cid || !preview || !Array.isArray(globalInboxCache)) return;
  globalInboxCache = globalInboxCache.map((c: any) => {
    const cId = String(c?.conversationId || c?.id || c?._id || c?.groupId || '');
    if (!cId) return c;
    if (cId === cid || cId.includes(cid) || cid.includes(cId)) {
      return { ...c, lastMessage: preview };
    }
    return c;
  });
}
