module.exports = Client

function Client(req, res) {
  this.req = req
  this.res = res
}

Client.prototype.send_header = function(code) {
  this.res.writeHead(code)
}

Client.prototype.res_write = function(data) {
  this.res.write(data)
}

Client.prototype.res_end = function(data) {
  if (data) this.res_write(data)
  this.res.end()
}
