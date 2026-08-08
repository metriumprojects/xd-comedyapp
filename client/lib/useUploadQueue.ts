import { create } from 'zustand';

export type UploadType = 'post' | 'story' | 'reel';
export type UploadStatus = 'pending' | 'uploading' | 'success' | 'error';

export interface UploadTask {
  id: string;
  type: UploadType;
  status: UploadStatus;
  progress: number;
  error?: string;
  action: () => Promise<any>;
}

interface UploadQueueState {
  tasks: UploadTask[];
  enqueueUpload: (task: Omit<UploadTask, 'id' | 'status' | 'progress'>) => void;
  removeTask: (id: string) => void;
  retryTask: (id: string) => void;
  clearCompleted: () => void;
}

const generateId = () => Math.random().toString(36).substring(2, 15);

export const useUploadQueue = create<UploadQueueState>((set, get) => ({
  tasks: [],

  enqueueUpload: (taskData) => {
    const newTask: UploadTask = {
      ...taskData,
      id: generateId(),
      status: 'pending',
      progress: 0,
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
        t.id === id ? { ...t, status: 'pending', error: undefined } : t
      ),
    }));
    processNextUpload();
  },

  clearCompleted: () => {
    set((state) => ({
      tasks: state.tasks.filter((t) => t.status !== 'success'),
    }));
  }
}));

const processNextUpload = async () => {
  const state = useUploadQueue.getState();
  const task = state.tasks.find((t) => t.status === 'pending');
  
  if (!task) return;

  useUploadQueue.setState((s) => ({
    tasks: s.tasks.map((t) =>
      t.id === task.id ? { ...t, status: 'uploading', progress: 50 } : t
    ),
  }));

  try {
    // Execute the provided async action (e.g. createPost, createStory)
    await task.action();

    useUploadQueue.setState((s) => ({
      tasks: s.tasks.map((t) =>
        t.id === task.id ? { ...t, status: 'success', progress: 100 } : t
      ),
    }));

    setTimeout(() => {
      const currentState = useUploadQueue.getState();
      if (currentState.tasks.find(t => t.id === task.id)?.status === 'success') {
         currentState.removeTask(task.id);
      }
    }, 3000);

  } catch (error: any) {
    console.error('[UploadQueue] Error processing task:', error);
    useUploadQueue.setState((s) => ({
      tasks: s.tasks.map((t) =>
        t.id === task.id ? { ...t, status: 'error', error: error.message || 'Upload failed' } : t
      ),
    }));
  }

  processNextUpload();
};
