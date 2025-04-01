 
import { RabbitMQQueue } from '../../../src/queues/rabbitmq.queue';
import { Task } from '../../../src/interfaces/task.interface';

describe('RabbitMQQueue Integration', () => {
  let rabbitMQQueue: RabbitMQQueue;

  beforeAll(async () => {
    rabbitMQQueue = new RabbitMQQueue({ hostname: 'localhost', queueName: 'test-queue' });
    await rabbitMQQueue['onModuleInit']();
  });

  afterAll(async () => {
    await rabbitMQQueue.shutdown();
  });

  it('should add and process a task', async () => {
    const task: Task = { name: 'test', payload: {} };
    await rabbitMQQueue.add(task);

    const handler = jest.fn().mockResolvedValue(undefined);
    rabbitMQQueue.process(handler);

    expect(handler).toHaveBeenCalledWith(task);
  });
});