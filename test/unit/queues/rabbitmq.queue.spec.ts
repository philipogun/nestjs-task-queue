 
import { Test, TestingModule } from '@nestjs/testing';
import { RabbitMQQueue } from '../../../src/queues/rabbitmq.queue';
import { Connection, Channel } from 'amqplib';
import { Task } from '../../../src/interfaces/task.interface';

describe('RabbitMQQueue', () => {
  let rabbitMQQueue: RabbitMQQueue;
  let mockConnection: jest.Mocked<Connection>;
  let mockChannel: jest.Mocked<Channel>;

  beforeEach(async () => {
    mockConnection = {
      createChannel: jest.fn().mockResolvedValue({
        assertQueue: jest.fn().mockResolvedValue(undefined),
        sendToQueue: jest.fn().mockResolvedValue(undefined),
        consume: jest.fn().mockImplementation((queue, callback) => {
          callback({ content: Buffer.from(JSON.stringify({ name: 'test', payload: {} })) });
        }),
        ack: jest.fn().mockResolvedValue(undefined),
      }),
      close: jest.fn().mockResolvedValue(undefined),
    } as any;

    mockChannel = {
      assertQueue: jest.fn().mockResolvedValue(undefined),
      sendToQueue: jest.fn().mockResolvedValue(undefined),
      consume: jest.fn().mockImplementation((queue, callback) => {
        callback({ content: Buffer.from(JSON.stringify({ name: 'test', payload: {} })) });
      }),
      ack: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RabbitMQQueue,
        {
          provide: 'RABBITMQ_OPTIONS',
          useValue: {},
        },
        {
          provide: 'AMQP_CONNECTION',
          useValue: mockConnection,
        },
        {
          provide: 'AMQP_CHANNEL',
          useValue: mockChannel,
        },
      ],
    }).compile();

    rabbitMQQueue = module.get<RabbitMQQueue>(RabbitMQQueue);
  });

  it('should add a task to the queue', async () => {
    const task: Task = { name: 'test', payload: {} };
    await rabbitMQQueue.add(task);
    expect(mockChannel.sendToQueue).toHaveBeenCalledWith(
      'tasks',
      Buffer.from(JSON.stringify(task)),
      { priority: task.priority ?? 0 },
    );
  });

  it('should process tasks from the queue', async () => {
    const handler = jest.fn().mockResolvedValue(undefined);
    rabbitMQQueue.process(handler);
    expect(mockChannel.consume).toHaveBeenCalledWith('tasks', expect.any(Function));
    expect(handler).toHaveBeenCalledWith({ name: 'test', payload: {} });
  });

  it('should shutdown the queue', async () => {
    await rabbitMQQueue.shutdown();
    expect(mockChannel.close).toHaveBeenCalled();
  });
});