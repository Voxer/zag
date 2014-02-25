#!/usr/bin/env node
var path      = require('path')
  , APIClient = require('../client/api')
  , admin     = require('../client/admin')
  , request   = require('../lib/request')
var argv      = process.argv
  , runner    = argv[0] + " " + path.basename(argv[1])
  , args      = argv.slice(2)
  , command   = args[0]
  , subcom    = args[1]
  , host      = process.env.METRICS_HOST
  , api       = host && new APIClient(request(host))
  , l         = console.error

if (!command || !host) usage()

var AdminClient = admin[command]
if (!AdminClient) usage()

var adminClient = new AdminClient(api)
if (args.length === 1
 || subcom      === "help"
 || !adminClient[subcom]) subUsage()

var error = adminClient[subcom](args.slice(2))
if (error) subUsage()

////////////////////////////////////////////////////////////////////////////////

function usage() {
  l("Usage: " + runner + " <command> [arguments]")
  l("")
  l("Commands:")
  l("  dashboard")
  l("  keys")
  l("  monitor")
  l("  tag")
  l("  tagtype")
  l("")
  l("$METRICS_HOST=" + (host || "?"))
  l("")
  l("Documentation can be found at https://github.com/Voxer/zag")
  process.exit(1)
}

function subUsage() {
  l("Usage: " + runner + " " + command + " <command> [arguments]")
  l("")
  l("Commands:")
  l(adminClient.help.map(prefix("  " + command + " ")).join("\n"))
  process.exit(1)
}

function prefix(pref) {
  return function(str) { return pref + str }
}
