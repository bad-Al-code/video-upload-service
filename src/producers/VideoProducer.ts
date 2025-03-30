import { Channel } from 'amqplib';

import { getRabbitMQChannel } from '../config/rabbitmq-client';
import { VIDEO_EVENTS_EXCHANGE } from '../config/constants';

export class VideoEventProducer {
  constructor() {
    console.log('[VideoEventProducer] Producer initialized.');
  }

  async publishVideoEvent(
    routingKey: string,
    eventPayload: any,
  ): Promise<boolean> {
    const channel = getRabbitMQChannel();

    if (!channel) {
      console.error(
        `[VideoEventProducer] Caanot publish event, channel is not available.`,
      );

      return false;
    }

    try {
      await channel.assertExchange(VIDEO_EVENTS_EXCHANGE, 'topic', {
        durable: true,
      });

      const messageBuffer = Buffer.from(JSON.stringify(eventPayload));

      const sent = channel.publish(
        VIDEO_EVENTS_EXCHANGE,
        routingKey,
        messageBuffer,
        { persistent: true },
      );

      if (sent) {
        console.log(
          `[VideoEventProducer] Published event to exchange '${VIDEO_EVENTS_EXCHANGE}' [${routingKey}]:`,
          eventPayload,
        );
      } else {
        console.warn(
          `[VideoEventProducer] Failed to publish event [${routingKey}] (channel buffer full or closed?).`,
        );
      }

      return sent;
    } catch (error: any) {
      console.error(
        `[VideoEventProducer] Error publishing event [${routingKey}]:`,
        error,
      );

      return false;
    }
  }
}
