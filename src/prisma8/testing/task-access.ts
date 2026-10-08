import { Prisma8Service } from '../prisma8.service';
import { seedProject, seedTask, seedUser } from './seed';

/**
 * The task visibility rule shared by every task child (labels, comments,
 * activity, attachments...): the project owner and the task assignee see it,
 * nobody else does.
 */
export async function seedTaskAccess(db: Prisma8Service) {
  const owner = await seedUser(db);
  const assignee = await seedUser(db);
  const stranger = await seedUser(db);
  const project = await seedProject(db, owner.id);
  const task = await seedTask(db, project.id, { assigneeId: assignee.id });
  const otherTask = await seedTask(db, project.id);
  return {
    owner: owner.id,
    assignee: assignee.id,
    stranger: stranger.id,
    project: project.id,
    task: task.id,
    otherTask: otherTask.id,
  };
}
