const request = require('supertest');
const app = require('../src/app'); 

const createTask = (fields = {}) =>
  request(app)
    .post('/tasks')
    .send({ title: 'Default task', ...fields });

beforeEach(async () => {
  const res = await request(app).get('/tasks');
  await Promise.all(res.body.map((t) => request(app).delete(`/tasks/${t.id}`)));
});


describe('POST /tasks', () => {
  it('creates a task with title only', async () => {
    const res = await createTask({ title: 'New task' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      title: 'New task',
      status: 'todo',
      priority: 'medium',
      completedAt: null,
    });
    expect(res.body.id).toBeDefined();
    expect(res.body.createdAt).toBeDefined();
  });

  it('creates a task with all fields', async () => {
    const res = await createTask({
      title: 'Full task',
      description: 'Details here',
      status: 'in_progress',
      priority: 'high',
      dueDate: '2025-12-31T00:00:00.000Z',
    });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('in_progress');
    expect(res.body.priority).toBe('high');
    expect(res.body.description).toBe('Details here');
  });

  it('returns 400 when title is missing', async () => {
    const res = await request(app).post('/tasks').send({ status: 'todo' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/title/i);
  });

  it('returns 400 when title is an empty string', async () => {
    const res = await createTask({ title: '   ' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/title/i);
  });

  it('returns 400 for invalid status', async () => {
    const res = await createTask({ status: 'invalid' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/status/i);
  });

  it('returns 400 for invalid priority', async () => {
    const res = await createTask({ priority: 'urgent' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/priority/i);
  });

  it('returns 400 for invalid dueDate', async () => {
    const res = await createTask({ dueDate: 'not-a-date' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/dueDate/i);
  });
});


describe('GET /tasks', () => {
  it('returns empty array when no tasks exist', async () => {
    const res = await request(app).get('/tasks');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns all tasks', async () => {
    await createTask({ title: 'A' });
    await createTask({ title: 'B' });

    const res = await request(app).get('/tasks');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });

  it('filters tasks by status', async () => {
    await createTask({ title: 'Todo task', status: 'todo' });
    await createTask({ title: 'Done task', status: 'done' });

    const res = await request(app).get('/tasks?status=todo');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].status).toBe('todo');
  });

  it('paginates results', async () => {
    await Promise.all(
      Array.from({ length: 5 }, (_, i) => createTask({ title: `Task ${i + 1}` }))
    );

    const res = await request(app).get('/tasks?page=0&limit=2');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });
});

describe('GET /tasks/stats', () => {
  it('returns zeroed stats when no tasks exist', async () => {
    const res = await request(app).get('/tasks/stats');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ todo: 0, in_progress: 0, done: 0, overdue: 0 });
  });

  it('returns correct counts per status', async () => {
    await createTask({ title: 'A', status: 'todo' });
    await createTask({ title: 'B', status: 'in_progress' });
    await createTask({ title: 'C', status: 'done' });

    const res = await request(app).get('/tasks/stats');

    expect(res.body).toMatchObject({ todo: 1, in_progress: 1, done: 1 });
  });

  it('counts overdue tasks (past dueDate, not done)', async () => {
    await createTask({ title: 'Overdue', dueDate: '2000-01-01T00:00:00.000Z' });
    await createTask({ title: 'Future', dueDate: '2099-01-01T00:00:00.000Z' });

    const res = await request(app).get('/tasks/stats');

    expect(res.body.overdue).toBe(1);
  });

  it('does not count done tasks as overdue', async () => {
    await createTask({ title: 'Done overdue', status: 'done', dueDate: '2000-01-01T00:00:00.000Z' });

    const res = await request(app).get('/tasks/stats');

    expect(res.body.overdue).toBe(0);
  });
});

describe('GET /tasks/:id', () => {
  it('returns the task for a valid id', async () => {
    const { body: created } = await createTask({ title: 'Find me' });

    const res = await request(app).get(`/tasks/${created.id}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(created.id);
    expect(res.body.title).toBe('Find me');
  });

  it('returns 404 for an unknown id', async () => {
    const res = await request(app).get('/tasks/non-existent-id');

    expect(res.status).toBe(404);
  });
});


describe('PUT /tasks/:id', () => {
  it('updates allowed fields on a task', async () => {
    const { body: created } = await createTask({ title: 'Original' });

    const res = await request(app)
      .put(`/tasks/${created.id}`)
      .send({ title: 'Updated', priority: 'high' });

    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Updated');
    expect(res.body.priority).toBe('high');
    expect(res.body.id).toBe(created.id); // id must not change
  });

  it('returns 404 for an unknown id', async () => {
    const res = await request(app).put('/tasks/ghost-id').send({ title: 'x' });

    expect(res.status).toBe(404);
  });

  it('returns 400 for invalid status', async () => {
    const { body: created } = await createTask();

    const res = await request(app).put(`/tasks/${created.id}`).send({ status: 'flying' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/status/i);
  });

  it('returns 400 when title is set to an empty string', async () => {
    const { body: created } = await createTask();

    const res = await request(app).put(`/tasks/${created.id}`).send({ title: '' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/title/i);
  });
});


describe('DELETE /tasks/:id', () => {
  it('deletes an existing task and returns 204', async () => {
    const { body: created } = await createTask({ title: 'Delete me' });

    const deleteRes = await request(app).delete(`/tasks/${created.id}`);
    expect(deleteRes.status).toBe(204);

    const getRes = await request(app).get(`/tasks/${created.id}`);
    expect(getRes.status).toBe(404);
  });

  it('returns 404 for an unknown id', async () => {
    const res = await request(app).delete('/tasks/ghost-id');

    expect(res.status).toBe(404);
  });
});


describe('PATCH /tasks/:id/complete', () => {
  it('marks a task as done and resets priority to medium', async () => {
    const { body: created } = await createTask({ title: 'Finish me', priority: 'high' });

    const res = await request(app).patch(`/tasks/${created.id}/complete`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('done');
    expect(res.body.priority).toBe('medium');
    expect(res.body.completedAt).not.toBeNull();
  });

  it('returns 404 for an unknown id', async () => {
    const res = await request(app).patch('/tasks/ghost-id/complete');

    expect(res.status).toBe(404);
  });
});

//adding this test for the new created route
describe('PATCH /tasks/:id/assign', () => {
  it('assigns a task to a valid assignee', async () => {
    const { body: created } = await createTask({ title: 'Task to assign' });
 
    const res = await request(app)
      .patch(`/tasks/${created.id}/assign`)
      .send({ assignee: 'Alice' });
 
    expect(res.status).toBe(200);
    expect(res.body.assignee).toBe('Alice');
    expect(res.body.id).toBe(created.id); // other fields unchanged
    expect(res.body.title).toBe('Task to assign');
  });
 
  it('trims whitespace from assignee name', async () => {
    const { body: created } = await createTask();
 
    const res = await request(app)
      .patch(`/tasks/${created.id}/assign`)
      .send({ assignee: '  Bob  ' });
 
    expect(res.status).toBe(200);
    expect(res.body.assignee).toBe('Bob');
  });
 
  it('allows reassigning a task that is already assigned', async () => {
    const { body: created } = await createTask();
 
    await request(app)
      .patch(`/tasks/${created.id}/assign`)
      .send({ assignee: 'Alice' });
 
    const res = await request(app)
      .patch(`/tasks/${created.id}/assign`)
      .send({ assignee: 'Bob' });
 
    expect(res.status).toBe(200);
    expect(res.body.assignee).toBe('Bob');
  });
 
  it('returns 404 for an unknown task id', async () => {
    const res = await request(app)
      .patch('/tasks/ghost-id/assign')
      .send({ assignee: 'Alice' });
 
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not found/i);
  });
 
  it('returns 400 when assignee is missing', async () => {
    const { body: created } = await createTask();
 
    const res = await request(app)
      .patch(`/tasks/${created.id}/assign`)
      .send({});
 
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/assignee/i);
  });
 
  it('returns 400 when assignee is an empty string', async () => {
    const { body: created } = await createTask();
 
    const res = await request(app)
      .patch(`/tasks/${created.id}/assign`)
      .send({ assignee: '' });
 
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/assignee/i);
  });
 
  it('returns 400 when assignee is a whitespace-only string', async () => {
    const { body: created } = await createTask();
 
    const res = await request(app)
      .patch(`/tasks/${created.id}/assign`)
      .send({ assignee: '   ' });
 
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/assignee/i);
  });
 
  it('returns 400 when assignee is not a string', async () => {
    const { body: created } = await createTask();
 
    const res = await request(app)
      .patch(`/tasks/${created.id}/assign`)
      .send({ assignee: 123 });
 
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/assignee/i);
  });
 
  it('persists the assignee — GET /tasks/:id reflects the assignment', async () => {
    const { body: created } = await createTask();
 
    await request(app)
      .patch(`/tasks/${created.id}/assign`)
      .send({ assignee: 'Alice' });
 
    const res = await request(app).get(`/tasks/${created.id}`);
 
    expect(res.status).toBe(200);
    expect(res.body.assignee).toBe('Alice');
  });
});