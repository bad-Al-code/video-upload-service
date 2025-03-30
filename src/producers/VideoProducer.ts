import { Channel } from 'amqplib';

import { getRabbitMQChannel } from '../config/rabbitmq-client';
import { VIDEO_EVENTS_EXCHANGE } from '../config/constants';

export class VideoEventProducer {
  private channel: Channel | null;

  constructor() {
    this.channel = getRabbitMQChannel();
    if (!this.channel) {
      console.error(
        `[VideoEentProducer] RabbitMQ channel not available at instantiation!`,
      );
    }
  }

  async publishVideoEvent(
    routingKey: string,
    eventPayload: any,
  ): Promise<boolean> {
    if (!this.channel) {
      console.error(
        `[VideoEentProducer] Caanot publish event, channel is not available.`,
      );

      return false;
    }

    try {
      await this.channel.assertExchange(VIDEO_EVENTS_EXCHANGE, 'topic', {
        durable: true,
      });

      const messageBuffer = Buffer.from(JSON.stringify(eventPayload));

      const sent = this.channel.publish(
        VIDEO_EVENTS_EXCHANGE,
        routingKey,
        messageBuffer,
        { persistent: true },
      );

      if (sent) {
        console.log(
          `✅ [VideoEventProducer] Published event to exchange '${VIDEO_EVENTS_EXCHANGE}' [${routingKey}]:`,
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
