const path = require('node:path')
const pointOfView = require('@fastify/view')

let lastServerStats = {}

const fetchSamaServerStats = async () => {
  const serverStats = await fetch(
      `${process.env.SAMA_URL}/admin/server-stats?format=1`,
      { method: 'GET', headers: {'Admin-Api-Key': process.env.SAMA_ADMIN_API_KEY} }  
    )
    .then(response => response.json())
    .then(serverStats => ({ serverStats: Object.assign(serverStats, { fetchDate: new Date().toISOString() }) }))
    .catch(error => {
      console.log('[Error][fetching]', error)
      const message = `SAMA Server: ${error.message}`
      return { error: message }
    })

  return serverStats
}

const startFetchingServerDate = () => {
  setInterval(async () => {
    lastServerStats = await fetchSamaServerStats()
  }, process.env.SERVER_UPDATE_INTERVAL ?? 30_000)
}

module.exports = (fastifyApp) => {
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
      reply.view('sama-server-stats.ejs', { updateTime: process.env.CLIENT_UPDATE_INTERVAL ?? 10_000 });
    },
  });
  
  fastifyApp.route({
    method: 'GET',
    url: '/stats/data/sama-server',
    handler: async (req, reply) => {  
      reply.send(lastServerStats)
    },
  });

  startFetchingServerDate()
}