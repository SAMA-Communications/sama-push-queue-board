const { createBullBoard } = require('@bull-board/api');
const { BullMQAdapter } = require('@bull-board/api/bullMQAdapter');
const { FastifyAdapter } = require('@bull-board/fastify');
const { Queue: QueueMQ, Worker } = require('bullmq');
const fastify = require('fastify');

require('dotenv').config()

const sleep = (t) => new Promise((resolve) => setTimeout(resolve, t * 1000));

const redisOptions = {
  port: process.env.REDIS_PORT,
  host: process.env.REDIS_URL,
  password: '',
  tls: false,
};

const createQueueMQ = (name) => new QueueMQ(name, { connection: redisOptions });

async function setupBullMQProcessor(queueName) {
  new Worker(
    queueName,
    async (job) => {
      for (let i = 0; i <= 100; i++) {
        await sleep(Math.random());
        await job.updateProgress(i);
        await job.log(`Processing job at interval ${i}`);

        if (Math.random() * 200 < 1) throw new Error(`Random error ${i}`);
      }

      return { jobId: `This is the return value of job (${job.id})` };
    },
    { connection: redisOptions }
  );
}

const run = async () => {
  const exampleBullMq = createQueueMQ(process.env.BULL_QUEUE_NAME);

  await setupBullMQProcessor(exampleBullMq.name);

  const app = fastify();

  const serverAdapter = new FastifyAdapter();

  createBullBoard({
    queues: [new BullMQAdapter(exampleBullMq)],
    serverAdapter,
  });

  serverAdapter.setBasePath('/ui');
  app.register(serverAdapter.registerPlugin(), { prefix: '/ui' });

  // app.get('/add', (req, reply) => {
  //   const opts = req.query.opts || {};

  //   if (opts.delay) {
  //     opts.delay = +opts.delay * 1000; // delay must be a number
  //   }

  //   exampleBullMq.add('Add', { title: req.query.title }, opts);

  //   reply.send({
  //     ok: true,
  //   });
  // });

  await app.listen({ port: process.env.PORT });
  // eslint-disable-next-line no-console
  console.log(`Running on ${process.env.PORT}...`);
  console.log(`For the UI, open http://localhost:${process.env.PORT}/ui`);
  console.log(`Make sure Redis is running on port ${process.env.REDIS_PORT} by default`);
  // console.log('To populate the queue, run:');
  // console.log(`  curl http://localhost:${process.env.PORT}/add?title=Example`);
  // console.log('To populate the queue with custom options (opts), run:');
  // console.log(`  curl http://localhost:${process.env.PORT}/add?title=Test&opts[delay]=9`);
};

run().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});