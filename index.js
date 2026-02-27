const { createBullBoard } = require('@bull-board/api');
const { BullMQAdapter } = require('@bull-board/api/bullMQAdapter');
const { FastifyAdapter } = require('@bull-board/fastify');
const { Queue: QueueMQ } = require('bullmq');
const fastify = require('fastify');

require('dotenv').config()

const redisOptions = {
  host: process.env.REDIS_HOST,
  port: +process.env.REDIS_PORT,
  password: process.env.REDIS_PASSWORD,
  db: process.env.REDIS_DB,
  tls: process.env.REDIS_TLS === 'true',
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

  if (process.env.SAMA_URL) {
    require('./sama-stats')(app);
  }

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