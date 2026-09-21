import { create } from 'zustand';

export type UploadType = 'post' | 'story' | 'reel';
export type UploadStatus = 'pending' | 'uploading' | 'success' | 'error';

export interface UploadTask {
  id: string;
  type: UploadType;
  status: UploadStatus;
  progress: number;
  error?: string;
  retries?: number;
  action: (onProgress?: (percent: number) => void) => Promise<any>;
}

interface UploadQueueState {
  tasks: UploadTask[];
  isProcessing: boolean;
  enqueueUpload: (task: Omit<UploadTask, 'id' | 'status' | 'progress'>) => void;
  removeTask: (id: string) => void;
  retryTask: (id: string) => void;
  clearCompleted: () => void;
}

const generateId = () => Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
const MAX_AUTO_RETRIES = 2;

export const useUploadQueue = create<UploadQueueState>((set, get) => ({
  tasks: [],
  isProcessing: false,

  enqueueUpload: (taskData) => {
    const newTask: UploadTask = {
      ...taskData,
      id: generateId(),
      status: 'pending',
      progress: 0,
      retries: 0,
    };

    set((state) => ({ tasks: [newTask, ...state.tasks] }));
    processNextUpload();
  },

  removeTask: (id) => {
    set((state) => ({ tasks: state.tasks.filter((t) => t.id !== id) }));
  },

  retryTask: (id) => {
    set((state) => ({
      tasks: state.tasks.map((t) =>
        t.id === id ? { ...t, status: 'pending', progress: 0, error: undefined, retries: 0 } : t
      ),
    }));
    processNextUpload();
  },

  clearCompleted: () => {
    set((state) => ({
      tasks: state.tasks.filter((t) => t.status !== 'success'),
    }));
  },
}));

let activeProcessingPromise: Promise<void> | null = null;

const processNextUpload = async () => {
  if (activeProcessingPromise) return activeProcessingPromise;

  activeProcessingPromise = (async () => {
    try {
      while (true) {
        const state = useUploadQueue.getState();
        const task = state.tasks.find((t) => t.status === 'pending');

        if (!task) {
          useUploadQueue.setState({ isProcessing: false });
          break;
        }

        useUploadQueue.setState((s) => ({
          isProcessing: true,
          tasks: s.tasks.map((t) => (t.id === task.id ? { ...t, status: 'uploading', progress: 0 } : t)),
        }));

        try {
          const onProgress = (percent: number) => {
            const clamped = Math.max(0, Math.min(99, Math.round(percent)));
            useUploadQueue.setState((s) => ({
              tasks: s.tasks.map((t) => (t.id === task.id ? { ...t, progress: Math.max(t.progress, clamped) } : t)),
            }));
          };

          // Execute the async upload action with progress callback
          await task.action(onProgress);

          useUploadQueue.setState((s) => ({
            tasks: s.tasks.map((t) => (t.id === task.id ? { ...t, status: 'success', progress: 100 } : t)),
          }));

          setTimeout(() => {
            const currentState = useUploadQueue.getState();
            if (currentState.tasks.find((t) => t.id === task.id)?.status === 'success') {
              currentState.removeTask(task.id);
            }
          }, 3000);
        } catch (error: any) {
          const retries = (task.retries || 0) + 1;
          const errMsg = error?.message || 'Upload failed';
          const isNetworkErr = /network|timeout|connection|abort|econnreset/i.test(errMsg);

          if (retries <= MAX_AUTO_RETRIES && isNetworkErr) {
            console.warn(`[UploadQueue] Retrying task ${task.id} (attempt ${retries}/${MAX_AUTO_RETRIES})...`);
            // Brief backoff
            await new Promise((r) => setTimeout(r, 1500 * retries));
            useUploadQueue.setState((s) => ({
              tasks: s.tasks.map((t) => (t.id === task.id ? { ...t, status: 'pending', retries, progress: 0 } : t)),
            }));
          } else {
            console.error('[UploadQueue] Error processing task:', error);
            useUploadQueue.setState((s) => ({
              tasks: s.tasks.map((t) => (t.id === task.id ? { ...t, status: 'error', error: errMsg, retries } : t)),
            }));
          }
        }
      }
    } finally {
      activeProcessingPromise = null;
      useUploadQueue.setState({ isProcessing: false });
    }
  })();

  return activeProcessingPromise;
};
