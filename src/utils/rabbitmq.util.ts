import { connect, Channel, ChannelModel, Options } from 'amqplib';

/**
 * Creates a RabbitMQ connection and channel.
 * @param options - RabbitMQ connection options.
 * @returns A connection and channel.
 */
export const createRabbitMQConnection = async (
  options: Options.Connect
): Promise<{ connection: ChannelModel; channel: Channel }> => {
  const connection = await connect(options);
  const channel = await connection.createChannel();
  return { connection, channel };
};

/**
 * Closes a RabbitMQ connection and channel.
 * @param connection - The RabbitMQ connection.
 * @param channel - The RabbitMQ channel.
 */
export const closeRabbitMQConnection = async (
  connection: ChannelModel,
  channel: Channel
): Promise<void> => {
  await channel.close();
  await connection.close();
};
