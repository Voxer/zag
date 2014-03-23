## [Zag](http://voxer.github.io/zag/)

Zag is a fast, scalable Node.js application for aggregating and visualizing both real-time and historical metrics.

  * [Install/setup][setup]
  * [Zooming and panning][zooming-and-panning]
  * [Graph types][graph-types]
  * [Metrics keys][metrics-keys]
  * [Intervals][intervals]
  * [Deltas][deltas]
  * [Dashboards][dashboards]
  * [Tags][tags]

This repo is home to the following npm packages:

  * [zag](https://www.npmjs.org/package/zag) _./web_
  * [zag-agent](https://www.npmjs.org/package/zag-agent) _./agent_
  * [zag-daemon](https://www.npmjs.org/package/zag-daemon) _./daemon_
  * [zag-backend-pg](https://www.npmjs.org/package/zag-backend-pg) _./backend-pg_

Backends:

  * [Postgres](https://github.com/voxer/zag/tree/master/backend-pg):
    recommended for production.
  * [LevelDB](https://github.com/sentientwaffle/zag-backend-leveldb):
    recommended for getting started with, testing, and developing Zag.

[setup]:               http://voxer.github.io/zag#setup
[zooming-and-panning]: http://voxer.github.io/zag#zooming-and-panning
[graph-types]:         http://voxer.github.io/zag#graph-types
[metrics-keys]:        http://voxer.github.io/zag#metrics-keys
[intervals]:           http://voxer.github.io/zag#intervals
[deltas]:              http://voxer.github.io/zag#deltas
[dashboards]:          http://voxer.github.io/zag#dashboards
[tags]:                http://voxer.github.io/zag#tags
