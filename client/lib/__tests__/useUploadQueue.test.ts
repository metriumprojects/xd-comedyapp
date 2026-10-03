import { useUploadQueue } from '../useUploadQueue';

describe('useUploadQueue', () => {
  beforeEach(() => {
    useUploadQueue.setState({ tasks: [], isProcessing: false });
  });

  it('initializes with empty tasks', () => {
    const state = useUploadQueue.getState();
    expect(state.tasks).toEqual([]);
    expect(state.isProcessing).toBe(false);
  });

  it('enqueues a new upload task with userId', async () => {
    let executed = false;
    useUploadQueue.getState().enqueueUpload({
      userId: 'user-123',
      type: 'post',
      action: async (onProgress) => {
        onProgress?.(50);
        executed = true;
        return { success: true };
      },
    });

    const tasks = useUploadQueue.getState().tasks;
    expect(tasks.length).toBe(1);
    expect(tasks[0].type).toBe('post');
    expect(tasks[0].userId).toBe('user-123');

    // Wait a brief tick for async processing
    await new Promise((r) => setTimeout(r, 50));
    expect(executed).toBe(true);
  });

  it('removes a task by id', () => {
    useUploadQueue.setState({
      tasks: [
        { id: 'task-1', userId: 'user-1', type: 'post', status: 'error', progress: 0, action: async () => {} },
        { id: 'task-2', userId: 'user-2', type: 'story', status: 'pending', progress: 0, action: async () => {} },
      ],
    });

    useUploadQueue.getState().removeTask('task-1');
    const remaining = useUploadQueue.getState().tasks;
    expect(remaining.length).toBe(1);
    expect(remaining[0].id).toBe('task-2');
  });

  it('clears completed tasks', () => {
    useUploadQueue.setState({
      tasks: [
        { id: 'task-1', userId: 'user-1', type: 'post', status: 'success', progress: 100, action: async () => {} },
        { id: 'task-2', userId: 'user-1', type: 'story', status: 'error', progress: 0, action: async () => {} },
      ],
    });

    useUploadQueue.getState().clearCompleted();
    const remaining = useUploadQueue.getState().tasks;
    expect(remaining.length).toBe(1);
    expect(remaining[0].id).toBe('task-2');
  });

  it('clears all tasks on clearAll (e.g. during logout)', () => {
    useUploadQueue.setState({
      tasks: [
        { id: 'task-1', userId: 'user-1', type: 'post', status: 'uploading', progress: 50, action: async () => {} },
        { id: 'task-2', userId: 'user-1', type: 'post', status: 'pending', progress: 0, action: async () => {} },
      ],
      isProcessing: true,
    });

    useUploadQueue.getState().clearAll();
    const state = useUploadQueue.getState();
    expect(state.tasks).toEqual([]);
    expect(state.isProcessing).toBe(false);
  });

  it('clears tasks for a specific user on clearForUser', () => {
    useUploadQueue.setState({
      tasks: [
        { id: 'task-1', userId: 'user-1', type: 'post', status: 'pending', progress: 0, action: async () => {} },
        { id: 'task-2', userId: 'user-2', type: 'post', status: 'pending', progress: 0, action: async () => {} },
      ],
    });

    useUploadQueue.getState().clearForUser('user-1');
    const remaining = useUploadQueue.getState().tasks;
    expect(remaining.length).toBe(1);
    expect(remaining[0].userId).toBe('user-2');
  });
});
