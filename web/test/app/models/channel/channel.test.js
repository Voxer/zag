var test           = require('tap').test
  , EventEmitter   = require('events').EventEmitter
  , MetricsChannel = require('../../../../app/models/channel/channel')


test("MetricsChannel#isExpired, MetricsChannel#touch", function(t) {
  var pool = new MockDaemonPool()
    , es   = new EventEmitter()
    , mc   = new MetricsChannel(pool, 5000, es)
  t.equals(mc.isExpired(), false)
  mc._touch -= 30 * 60 * 1000
  t.equals(mc.isExpired(), true)
  mc.touch()
  t.equals(mc.isExpired(), false)
  t.end()
})

function MockDaemonPool() { }
