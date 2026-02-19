const path = require('node:path')
const pointOfView = require('@fastify/view')

const fetchSamaServerStats = async () => {
  const serverStats = await fetch(
      `${process.env.SAMA_URL}/admin/server-stats`,
      { method: 'GET', headers: {'Admin-Api-Key': process.env.SAMA_ADMIN_API_AUTH_KEY} }  
    )
    .then(response => response.json())
    .then(serverStats => ({ serverStats }))
    .catch(error => {
      console.log('[Error][fetching]', error)
      const message = `SAMA Server: ${error.message}`
      return { error: message }
    })

  return serverStats
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
      reply.view('sama-server-stats.ejs');
    },
  });
  
  fastifyApp.route({
    method: 'GET',
    url: '/stats/data/sama-server',
    handler: async (req, reply) => {
      const serverStats = await fetchSamaServerStats()
  
      reply.send(serverStats)
    },
  });
}