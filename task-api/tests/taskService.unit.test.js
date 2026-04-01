const taskService = require('../src/services/taskService'); 

beforeEach(() => {
  taskService._reset();
});

describe('taskService.create', () => {
  it('creates a task with only title, applying all defaults', () => {
    const task = taskService.create({ title: 'Buy milk' });

    expect(task).toMatchObject({
      title: 'Buy milk',
      description: '',
      status: 'todo',
      priority: 'medium',
      dueDate: null,
      completedAt: null,
    });
    expect(task.id).toBeDefined();
    expect(task.createdAt).toBeDefined();
  });

  it('creates a task with all fields provided', () => {
    const task = taskService.create({
      title: 'Deploy app',
      description: 'Push to prod',
      status: 'in_progress',
      priority: 'high',
      dueDate: '2025-12-31T00:00:00.000Z',
    });

    expect(task.status).toBe('in_progress');
    expect(task.priority).toBe('high');
    expect(task.description).toBe('Push to prod');
    expect(task.dueDate).toBe('2025-12-31T00:00:00.000Z');
  });

  it('assigns a unique id to each task', () => {
    const t1 = taskService.create({ title: 'Task 1' });
    const t2 = taskService.create({ title: 'Task 2' });

    expect(t1.id).not.toBe(t2.id);
  });
});


describe('taskService.getAll', () => {
  it('returns empty array when no tasks exist', () => {
    expect(taskService.getAll()).toEqual([]);
  });

  it('returns all created tasks', () => {
    taskService.create({ title: 'A' });
    taskService.create({ title: 'B' });

    expect(taskService.getAll()).toHaveLength(2);
  });

  it('returns a shallow copy — mutating it does not affect the store', () => {
    taskService.create({ title: 'A' });

    const all = taskService.getAll();
    all.push({ id: 'fake' });

    expect(taskService.getAll()).toHaveLength(1);
  });
});


describe('taskService.findById', () => {
  it('returns the matching task', () => {
    const task = taskService.create({ title: 'Find me' });

    expect(taskService.findById(task.id)).toEqual(task);
  });

  it('returns undefined for an unknown id', () => {
    expect(taskService.findById('non-existent')).toBeUndefined();
  });
});


describe('taskService.getByStatus', () => {
  it('returns only tasks matching the given status', () => {
    taskService.create({ title: 'A', status: 'todo' });
    taskService.create({ title: 'B', status: 'done' });
    taskService.create({ title: 'C', status: 'todo' });

    const todos = taskService.getByStatus('todo');

    expect(todos).toHaveLength(2);
    todos.forEach((t) => expect(t.status).toBe('todo'));
  });

  it('returns empty array when no tasks match', () => {
    taskService.create({ title: 'A', status: 'todo' });

    expect(taskService.getByStatus('done')).toHaveLength(0);
  });
});


describe('taskService.getPaginated', () => {
  beforeEach(() => {
    for (let i = 1; i <= 5; i++) taskService.create({ title: `Task ${i}` });
  });

  it('returns the first page (page=0)', () => {
    const page = taskService.getPaginated(0, 2);

    expect(page).toHaveLength(2);
    expect(page[0].title).toBe('Task 1');
  });

  it('returns the second page (page=1)', () => {
    const page = taskService.getPaginated(1, 2);

    expect(page).toHaveLength(2);
    expect(page[0].title).toBe('Task 3');
  });

  it('returns remaining items on the last partial page', () => {
    const page = taskService.getPaginated(2, 2);

    expect(page).toHaveLength(1);
    expect(page[0].title).toBe('Task 5');
  });

  it('returns empty array when page is out of range', () => {
    expect(taskService.getPaginated(10, 2)).toHaveLength(0);
  });
});


describe('taskService.getStats', () => {
  it('returns all-zero stats when no tasks exist', () => {
    expect(taskService.getStats()).toEqual({ todo: 0, in_progress: 0, done: 0, overdue: 0 });
  });

  it('counts tasks correctly by status', () => {
    taskService.create({ title: 'A' }); // todo
    taskService.create({ title: 'B', status: 'in_progress' });
    taskService.create({ title: 'C', status: 'done' });

    expect(taskService.getStats()).toMatchObject({ todo: 1, in_progress: 1, done: 1, overdue: 0 });
  });

  it('counts a task as overdue when dueDate is in the past and status is not done', () => {
    taskService.create({ title: 'Overdue', dueDate: '2000-01-01T00:00:00.000Z' });

    expect(taskService.getStats().overdue).toBe(1);
  });

  it('does not count a future dueDate as overdue', () => {
    taskService.create({ title: 'Future', dueDate: '2099-01-01T00:00:00.000Z' });

    expect(taskService.getStats().overdue).toBe(0);
  });

  it('does not count done tasks as overdue even if dueDate is past', () => {
    taskService.create({ title: 'Done', status: 'done', dueDate: '2000-01-01T00:00:00.000Z' });

    expect(taskService.getStats().overdue).toBe(0);
  });
});


describe('taskService.update', () => {
  it('updates only the specified fields, leaving others unchanged', () => {
    const task = taskService.create({ title: 'Original', priority: 'low' });

    const updated = taskService.update(task.id, { title: 'Updated', priority: 'high' });

    expect(updated.title).toBe('Updated');
    expect(updated.priority).toBe('high');
    expect(updated.id).toBe(task.id);
    expect(updated.status).toBe('todo'); 
  });

  it('returns null for an unknown id', () => {
    expect(taskService.update('ghost-id', { title: 'x' })).toBeNull();
  });

  it('persists the update — getAll reflects the change', () => {
    const task = taskService.create({ title: 'Before' });
    taskService.update(task.id, { title: 'After' });

    expect(taskService.findById(task.id).title).toBe('After');
  });
});

describe('taskService.remove', () => {
  it('removes the task and returns true', () => {
    const task = taskService.create({ title: 'Delete me' });

    expect(taskService.remove(task.id)).toBe(true);
    expect(taskService.findById(task.id)).toBeUndefined();
  });

  it('returns false for an unknown id', () => {
    expect(taskService.remove('ghost-id')).toBe(false);
  });

  it('reduces the total task count by 1', () => {
    const t1 = taskService.create({ title: 'A' });
    taskService.create({ title: 'B' });

    taskService.remove(t1.id);

    expect(taskService.getAll()).toHaveLength(1);
  });
});


describe('taskService.completeTask', () => {
  it('sets status to done, resets priority to medium, and sets completedAt', () => {
    const task = taskService.create({ title: 'Finish me', priority: 'high' });

    const completed = taskService.completeTask(task.id);

    expect(completed.status).toBe('done');
    expect(completed.priority).toBe('medium');
    expect(completed.completedAt).not.toBeNull();
  });

  it('returns null for an unknown id', () => {
    expect(taskService.completeTask('ghost-id')).toBeNull();
  });

  it('persists the completion — findById reflects the change', () => {
    const task = taskService.create({ title: 'Finish me' });
    taskService.completeTask(task.id);

    expect(taskService.findById(task.id).status).toBe('done');
  });
});