module.exports = ScopedAgent

/// ScopedAgent mimics the public API of MetricsAgent. Any metrics sent with
/// it will be prefixed with `SCOPE>`.
///
/// `.close()`ing the scoped agent will close the original agent.
///
/// agent - MetricsAgent
/// scope - String
///
function ScopedAgent(agent, scope) {
  this.agent  = agent
  this.pool   = agent.pool
  this._scope = scope
}

// Proxy to MetricsAgent.
;["close"
, "on", "once"
, "removeListener", "removeAllListeners"
, "listeners", "setMaxListeners"
].forEach(function(fn) {
  ScopedAgent.prototype[fn] = function() {
    this.agent[fn].apply(this.agent, arguments)
  }
})

// scope - String
// Returns ScopedAgent
ScopedAgent.prototype.scope = function(scope) {
  return this.agent.scope(this._scope + ">" + scope)
}

ScopedAgent.prototype.histogram = makeMetric("histogram")
ScopedAgent.prototype.counter   = makeMetric("counter")

function makeMetric(fn) {
  return function(mkey, value) {
    return this.agent[fn](this._scope + ">" + mkey, value)
  }
}
