var http         = require('http')
  , Poolee       = require('lb_pool').Pool
  , MetricsAgent = require('./lib/agent')
  , PacketQueue  = require('./lib/packet-queue')

module.exports = makeAgent

// The daemon needs the PacketQueue
makeAgent.PacketQueue = PacketQueue

function makeAgent(hosts) {
  var pool = new Poolee(http, hosts,
    { max_pending: 100
    , ping:       "/ping"
    , timeout:     20000
    , max_sockets: 5
    , name:       "metrics"
    })
  var agent = new MetricsAgent(pool)

  setTimeout(function () {
    if (agent.currentNode && !agent.currentNode.healthy) {
      agent.goOnline()
    }
  }, 1000)

  // Ping loop.
  /*
  ;(function pingAll() {
    setTimeout(function () {
      agent.pingAll(pingAll)
    }, 10000)
  })()
  */

  return agent
}
