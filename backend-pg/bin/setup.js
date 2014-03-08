#!/usr/bin/env node

var path    = require('path')
  , psql    = require('pg')
  , Backend = require('../')

var argv = process.argv
  , args = argv.slice(2)
  , host = args[0]
  , env  = args[1]
  , l    = console.log

if (!host || !env) usage()

var ms = new Backend(
  { db:  host
  , env: env
  })

ms.setup(function(err) {
  if (err) throw err
  ms.close()
})

function usage() {
  l("Usage: " + argv[0] + " " + path.basename(argv[1]) + " <tcp://user:password@hostname/dbname> <env>")
  process.exit()
}
