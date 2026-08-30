// A Node.js HTTP origin on its DEFAULT --max-http-header-size.
//
// Node is in the probe because its default (16 KB across the WHOLE header
// block, not per line) is a different shape of limit from nginx's per-buffer
// one, and a reader needs to know which shape sits in their own path.
//
// No options are passed to createServer for the same reason the nginx and
// HAProxy configs set no buffer sizes: the default is the thing under test.
const http = require("http");

http
  .createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("ok\n");
  })
  .listen(8080, () => console.error("node origin listening on 8080"));
