var test      = require('tap').test
  , APIClient = require('../client/api')

test("APIClient", function(t) {
  var api = new APIClient(ajax)
  t.equals(api.ajax, ajax)
  t.end()

  function ajax() {}
})
