const mockStorageMap = new Map<string, string>();
jest.mock('@/lib/storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn((k: string) => Promise.resolve(mockStorageMap.get(k) || null)),
    setItem: jest.fn((k: string, v: string) => {
      mockStorageMap.set(k, v);
      return Promise.resolve();
    }),
    removeItem: jest.fn((k: string) => {
      mockStorageMap.delete(k);
      return Promise.resolve();
    }),
    clear: jest.fn(() => {
      mockStorageMap.clear();
      return Promise.resolve();
    }),
  },
}));
jest.mock('@react-native-community/netinfo', () => ({
  fetch: jest.fn(() => Promise.resolve({ isConnected: true, isInternetReachable: true })),
  addEventListener: jest.fn(() => () => {}),
}));
jest.mock('../../../lib/firebaseHelpers/messages', () => ({
  uploadMedia: jest.fn(() => Promise.resolve({ success: true, url: 'https://test.com/media.jpg' })),
}));
jest.mock('../apiService', () => ({
  apiService: {
    post: jest.fn(() => Promise.resolve({ success: true, message: { id: 'msg_123', text: 'ok' } })),
  },
}));

import {
  isNetworkError,
  enqueueOfflineMessage,
  getOfflineOutbox,
  removeOfflineMessage,
  updateOfflineMessageStatus,
  OutboxMessage,
} from '../dmOfflineQueue';
import AsyncStorage from '@/lib/storage';

describe('dmOfflineQueue', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
  });

  describe('isNetworkError', () => {
    it('returns true for Network Error string', () => {
      expect(isNetworkError('Network Error')).toBe(true);
      expect(isNetworkError({ message: 'Network request failed' })).toBe(true);
    });

    it('returns true for timeout errors', () => {
      expect(isNetworkError({ message: 'timeout of 15000ms exceeded' })).toBe(true);
      expect(isNetworkError({ code: 'ECONNABORTED' })).toBe(true);
      expect(isNetworkError({ code: 'ERR_NETWORK' })).toBe(true);
    });

    it('returns true for socket / connection errors', () => {
      expect(isNetworkError({ message: 'connect ECONNREFUSED 127.0.0.1' })).toBe(true);
      expect(isNetworkError({ message: 'socket hang up' })).toBe(true);
      expect(isNetworkError({ message: 'Device is offline' })).toBe(true);
    });

    it('returns false for 400 validation or authentication errors', () => {
      expect(isNetworkError({ message: 'Requires recipientId', status: 400 })).toBe(false);
      expect(isNetworkError({ message: 'Cannot send messages to a blocked user', status: 403 })).toBe(false);
      expect(isNetworkError({ error: 'User not found' })).toBe(false);
      expect(isNetworkError(null)).toBe(false);
      expect(isNetworkError(undefined)).toBe(false);
    });
  });

  describe('Outbox Queue Management', () => {
    const sampleMsg: OutboxMessage = {
      tempId: 'temp_text_999',
      conversationId: 'convo_123',
      currentUserId: 'userA',
      otherUserId: 'userB',
      text: 'Offline message text',
      mediaType: 'text',
      createdAt: Date.now(),
      status: 'pending',
    };

    it('enqueues a message into the offline outbox', async () => {
      await enqueueOfflineMessage(sampleMsg);
      const outbox = await getOfflineOutbox();
      expect(outbox).toHaveLength(1);
      expect(outbox[0].tempId).toBe('temp_text_999');
      expect(outbox[0].text).toBe('Offline message text');
      expect(outbox[0].status).toBe('pending');
    });

    it('filters outbox by conversationId', async () => {
      await enqueueOfflineMessage(sampleMsg);
      await enqueueOfflineMessage({
        ...sampleMsg,
        tempId: 'temp_text_other',
        conversationId: 'convo_456',
      });

      const forConvo123 = await getOfflineOutbox('convo_123');
      expect(forConvo123).toHaveLength(1);
      expect(forConvo123[0].tempId).toBe('temp_text_999');

      const all = await getOfflineOutbox();
      expect(all).toHaveLength(2);
    });

    it('updates status of an outbox message', async () => {
      await enqueueOfflineMessage(sampleMsg);
      await updateOfflineMessageStatus('temp_text_999', 'sending');

      const outbox = await getOfflineOutbox();
      expect(outbox[0].status).toBe('sending');

      await updateOfflineMessageStatus('temp_text_999', 'failed');
      const outbox2 = await getOfflineOutbox();
      expect(outbox2[0].status).toBe('failed');
    });

    it('removes a message from the outbox on completion', async () => {
      await enqueueOfflineMessage(sampleMsg);
      expect(await getOfflineOutbox()).toHaveLength(1);

      await removeOfflineMessage('temp_text_999');
      expect(await getOfflineOutbox()).toHaveLength(0);
    });
  });
});
