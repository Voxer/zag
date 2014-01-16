var MetricsChannel = require('./channel')

module.exports = MetricsChannels

function MetricsChannels(daemonPool) {
  this.pool     = daemonPool
  this.channels = {} // { channelID : MetricsChannel }
  this.interval = setInterval(this.clean.bind(this), 60000)
}

MetricsChannels.prototype.close = function() {
  clearInterval(this.interval)
}

// Clean up expired channels.
MetricsChannels.prototype.clean = function() {
  var channels   = this.channels
    , channelIDs = Object.keys(channels)
  for (var i = 0; i < channels; i++) {
    var channelID = channels[i]
    if (channels[channelID].isExpired()) {
      this.destroy(channelID)
    }
  }
}

// channelID - String
// delta     - Integer, milliseconds
// es        - EventSource
MetricsChannels.prototype.create = function(channelID, delta, es) {
  return this.channels[channelID] = new MetricsChannel(this.pool, delta, es)
}

// channelID - String
// mkey      - String
MetricsChannels.prototype.add = function(channelID, mkey) {
  var channel = this.channels[channelID]
  if (channel) return channel.add(mkey)
}

// channelID - String
// mkey      - String
MetricsChannels.prototype.remove = function(channelID, mkey) {
  var channel = this.channels[channelID]
  if (channel) return channel.remove(mkey)
}

// channelID - String
MetricsChannels.prototype.destroy = function(channelID) {
  var channel = this.channels[channelID]
  if (channel) {
    channel.destroy()
    delete this.channels[channelID]
  }
}
