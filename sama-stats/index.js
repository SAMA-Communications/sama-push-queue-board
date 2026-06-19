const path = require('node:path')
const Redis = require('ioredis')
const pointOfView = require('@fastify/view')

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
    url: '/stats/data/sama-server',
    handler: async (req, reply) => {  
      reply.send({ fetchDate: lastFetchDate, stats: lastServerStats })
    },
  });

  startFetchingServerStats()
}