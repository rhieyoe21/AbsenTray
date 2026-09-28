const { EventEmitter } = require('events');

class SseService extends EventEmitter {
  constructor() {
    super();
    this.clients = new Set();
  }

  addClient(req, res) {
    res.status(200);
    res.set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no'
    });
    res.flushHeaders();
    res.write(`event: ready\ndata: ${JSON.stringify({ timestamp: new Date().toISOString() })}\n\n`);

    const client = { req, res };
    this.clients.add(client);
    const heartbeat = setInterval(() => {
      if (!res.writableEnded) res.write(': heartbeat\n\n');
    }, 25000);

    const remove = () => {
      clearInterval(heartbeat);
      this.clients.delete(client);
    };
    req.on('close', remove);
    res.on('close', remove);
  }

  publish(type, data = {}) {
    const message = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const client of this.clients) {
      if (client.res.writableEnded || client.res.destroyed) {
        this.clients.delete(client);
        continue;
      }
      try {
        client.res.write(message);
      } catch (error) {
        this.clients.delete(client);
      }
    }
  }
}

module.exports = new SseService();
