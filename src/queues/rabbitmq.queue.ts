import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Channel, ChannelModel, Options } from 'amqplib';
import { Queue } from '../interfaces/queue.interface';
import { Task } from '../interfaces/task.interface';
import { createRabbitMQConnection } from '../utils/rabbitmq.util';

interface RabbitMQOptions extends Options.Connect {
    queueName: string;
}

@Injectable()
export class RabbitMQQueue implements Queue, OnModuleInit, OnModuleDestroy {
    private connection: ChannelModel | null = null;
    private channel: Channel | null = null;

    constructor(private readonly options: RabbitMQOptions) { }

    async onModuleInit(): Promise<void> {
        try {
            const { connection, channel } = await createRabbitMQConnection(this.options);
            this.connection = connection;
            this.channel = channel;

            await this.channel.assertQueue(this.options.queueName, { durable: true });
            console.log(`RabbitMQ connection established and queue '${this.options.queueName}' asserted.`);
        } catch (error) {
            console.error('Failed to initialize RabbitMQ connection:', error);
            throw error;
        }
    }
    async add(task: Task): Promise<void> {
        if (!this.channel) {
            throw new Error('RabbitMQ channel is not initialized.');
        }

        try {
            const taskString = JSON.stringify(task);
            this.channel.sendToQueue(this.options.queueName, Buffer.from(taskString), {
                priority: task.priority ?? 0,
                persistent: true,
            });
        } catch (error) {
            console.error('Failed to add task to queue:', error);
            throw error;
        }
    }

    process(handler: (task: Task) => Promise<void>): void {
        if (!this.channel) {
            throw new Error('RabbitMQ channel is not initialized.');
        }

        this.channel.consume(this.options.queueName, async (msg) => {
            if (!msg) return;

            try {
                const task: Task = JSON.parse(msg.content.toString());
                await handler(task);
                if (this.channel) {
                    this.channel.ack(msg);
                }
            } catch (error) {
                console.error('Task processing failed:', error);
                this.handleFailedTask(msg);
            }
        });
    }

    private handleFailedTask(msg: any): void {
        if (!this.channel) return;

        try {
            const task: Task = JSON.parse(msg.content.toString());
            if ((task.retry ?? 0) > 0) {
                task.retry = (task.retry ?? 1) - 1;

                const retryDelay = task.delay ?? 0;
                setTimeout(() => {
                    this.channel!.sendToQueue(this.options.queueName, Buffer.from(JSON.stringify(task)), {
                        priority: task.priority ?? 0,
                        persistent: true,
                    });
                }, retryDelay);
            } else {
                this.channel.ack(msg);
            }
        } catch (error) {
            console.error('Failed to handle failed task:', error);
            this.channel.ack(msg);
        }
    }

    async shutdown(): Promise<void> {
        try {
            if (this.channel) {
                await this.channel.close();
                this.channel = null;
            }
            if (this.connection) {
                this.connection.emit('close');
                this.connection = null;
            }
            console.log('RabbitMQ connection and channel closed.');
        } catch (error) {
            console.error('Failed to shutdown RabbitMQ connection:', error);
        }
    }


    async onModuleDestroy(): Promise<void> {
        await this.shutdown();
    }
}
