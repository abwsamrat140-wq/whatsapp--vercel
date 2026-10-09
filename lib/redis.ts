import Redis from 'ioredis';

const redisUrl = process.env.REDIS_URL;

if (!redisUrl) {
  console.warn('[Redis] REDIS_URL not set. Running without Redis.');
}

export const redis = redisUrl ? new Redis(redisUrl, {
  maxRetriesPerRequest: 3,
  enableReadyCheck: false,
}) : null;

export async function setSession(sessionId: string, data: any) {
  if (!redis) return;
  await redis.set(`session:${sessionId}`, JSON.stringify(data), 'EX', 86400);
}

export async function getSession(sessionId: string) {
  if (!redis) return null;
  const data = await redis.get(`session:${sessionId}`);
  return data ? JSON.parse(data) : null;
}

export async function deleteSession(sessionId: string) {
  if (!redis) return;
  await redis.del(`session:${sessionId}`);
}
