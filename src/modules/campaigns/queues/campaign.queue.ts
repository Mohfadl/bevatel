import 'dotenv/config';
import { Queue } from 'bullmq';

export const CAMPAIGN_QUEUE_NAME = 'campaigns';

const connection = {
  host: process.env.REDIS_HOST ?? '127.0.0.1',
  port: Number(process.env.REDIS_PORT ?? 6379),
  connectTimeout: 5000,
  maxRetriesPerRequest: 1,
};

export const campaignQueue = new Queue(CAMPAIGN_QUEUE_NAME, {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: { count: 500 },
    removeOnFail: { count: 1000 },
  },
});

campaignQueue.on('error', error => {
  console.error('Campaign queue error:', error.message);
});
