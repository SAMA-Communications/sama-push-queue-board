const path = require('node:path')
const Redis = require('ioredis')
const { default: prettyMs } = require('pretty-ms')
const pointOfView = require('@fastify/view')

const PING_TIMEOUT_MS = 3_000

let redisConnection = void 0
let lastFetchDate = void 0
let lastServerStats = {}

const fetchSamaServerStats = async (endpoint) => {
  endpoint = endpoint.replace(/\/$/, '')

  const serverStats = await fetch(
      `${endpoint}/admin/server-stats?format=1`,
      { method: 'GET', headers: {'Admin-Api-Key': process.env.SAMA_ADMIN_API_KEY} }  
    )
    .then(response => response.json())
    .catch(error => {
      console.log('[Error][fetching]', error)
      const message = `SAMA Server: ${error.message}`
      return { error: message }
    })

  return serverStats
}

const fetchClusterStats = async () => {
  let clusterEndpoints = []

  if (process.env.SAMA_URL) {
    clusterEndpoints = process.env.SAMA_URL.split(',')
  } else {
    const listNodes = await redisConnection.keys('sama-node-data:*')

    clusterEndpoints = listNodes
      .map(key => key.replace('sama-node-data:', ''))
      .map(wsEndpoint => {
        const url = new URL(wsEndpoint)
        url.protocol = 'http'
        url.port = 9001
        return url.toString()
      })
  }

  console.log('[Endpoints]', clusterEndpoints)

  const clusterStats = {}
  
  for (const clusterEndpoint of clusterEndpoints) {
    const stats = await fetchSamaServerStats(clusterEndpoint)

    console.log('[Stats]', clusterEndpoint, stats)

    clusterStats[clusterEndpoint] = stats
  }

  return clusterStats
}

const updateClusterStats = async () => {
  lastServerStats = await fetchClusterStats()
  lastFetchDate = new Date().toString()
}

const startFetchingServerStats = () => setInterval(updateClusterStats, process.env.SERVER_UPDATE_INTERVAL ?? 30_000)

const checkHealth = async (req, reply) => {
  const redisResult = await pingRedis()
  const dependencies = [
    redisResult,
    ...(Object.values(lastServerStats) ?? [])
  ]

  const isOk = dependencies.every(item => item?.status === 'ok')

  const status = {
    status: isOk ? 'ok' : 'fail',
    uptime_seconds: Math.floor(process.uptime()),
    dependencies
  }
  
  return status
}

const pingRedis = async () => {
  try {
    await Promise.race([
      redisConnection.ping(),
      new Promise((resolve, reject) => setTimeout(() => reject(new Error(`ping timed out after ${PING_TIMEOUT_MS}ms`)), PING_TIMEOUT_MS))
    ])
    return { name: 'redis', status: 'ok' }
  } catch (error) {
    return { name: 'redis', status: 'fail', error: error.message }
  }
}

const formatStats = (stats) => {
  if (!Object.entries(stats).length || !stats) return stats

  stats = JSON.parse(JSON.stringify(stats))

  Object.entries(stats).forEach(([endpoint, item]) => {
    item.uptime = prettyMs(item.uptime_seconds * 1000)
  })

  return stats
}

module.exports = (fastifyApp, redisOptions) => {
  redisConnection = new Redis(redisOptions)

  fastifyApp.register(pointOfView, {
    engine: {
      ejs: require('ejs'),
    },
    root: path.join(__dirname, './views'),
  });
  
  fastifyApp.route({
    method: 'GET',
    url: '/stats/sama-server',
    handler: (req, reply) => {
      reply.view('sama-server-stats.ejs', {
        updateTime: process.env.CLIENT_UPDATE_INTERVAL ?? 10_000,
      });
    },
  });

  fastifyApp.route({
    method: 'GET',
    url: '/stats/health',
    handler: async (req, reply) => {
      const stats = await checkHealth()
      reply.send(stats)
    },
  });
  
  fastifyApp.route({
    method: 'GET',
    url: '/stats/data/sama-server',
    handler: async (req, reply) => {  
      reply.send({ fetchDate: lastFetchDate, stats: formatStats(lastServerStats) })
    },
  });

  startFetchingServerStats()
}