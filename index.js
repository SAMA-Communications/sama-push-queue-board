const { createBullBoard } = require('@bull-board/api');
const { BullMQAdapter } = require('@bull-board/api/bullMQAdapter');
const { FastifyAdapter } = require('@bull-board/fastify');
const { Queue: QueueMQ } = require('bullmq');
const fastify = require('fastify');

require('dotenv').config()

const redisOptions = {
  port: process.env.REDIS_PORT,
  host: process.env.REDIS_HOST,
  password: '',
  tls: false,
};

const createQueueMQ = (name) => new QueueMQ(name, { connection: redisOptions });

const run = async () => {
  const exampleBullMq = createQueueMQ(process.env.BULL_QUEUE_NAME);

  const app = fastify();

  const serverAdapter = new FastifyAdapter();

  createBullBoard({
    queues: [new BullMQAdapter(exampleBullMq)],
    serverAdapter,
  });

  serverAdapter.setBasePath('/ui');
  app.register(serverAdapter.registerPlugin(), { prefix: '/ui' });

  await app.listen({ port: process.env.PORT, host: process.env.HOST });
  
  // eslint-disable-next-line no-console
  console.log(`Running on ${process.env.PORT}...`);
  console.log(`For the UI, open http://localhost:${process.env.PORT}/ui`);
  console.log(`Make sure Redis is running on port ${process.env.REDIS_PORT} by default`);
};

run().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});