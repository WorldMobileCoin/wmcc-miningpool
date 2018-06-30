/*!
 * Copyright (c) 2017, Park Alter (pseudonym)
 * Distributed under the MIT software license, see the accompanying
 * file COPYING or http://www.opensource.org/licenses/mit-license.php
 *
 * https://github.com/worldmobilecoin/wmcc-miningpool
 * webserver.js - mining pool web server for wmcc_miningpool.
 */

'use strict';

const assert = require('assert');
const path = require('path');
const {include} = require('../util');

const Core = include('wmcc-core');
const Logger = include('wmcc-logger');
const fs = include('wmcc-file');

const {Base} = Core.http;
const {util, Validator} = Core.utils;
const {digest, random, ccmp} = Core.crypto;

/**
 * Web Server
 * @extends {wmcc-core::http::Base}
 */
class WebServer extends Base {
  /**
   * Create a pool web server.
   * @constructor
   * @param {Object} options
   */
  constructor(options) {
    super(options.web);
    // handle additional options
    this.options = new WebServerOptions(options);
    this.prefix = this.options.prefix;
    this.pools = this.options.pools;
    this.payment = this.options.payment;
    this.logger = options.logger.context('webServer');

    this.__init();
  }

  __init() {
    this.on('request', (req, res) => {
      if (req.method === 'POST' && req.pathname === '/')
        return;

      this.logger.spam('Request for method=%s path=%s (%s).',
        req.method, req.pathname, req.socket.remoteAddress);
    });

    this.on('listening', (address) => {
      this.logger.info('Web server listening on %s (port=%d).',
        address.address, address.port);
    });

    this.initRouter();
    this.initSockets();
  }

  initRouter() {
    const publicPath = '../../public';

    this.use(this.cors());
    this.use(this.public(publicPath));

    this.use(this.bodyParser({
      contentType: 'html'
    }));

    this.get('/', async (req, res) => {
      const file = fs.readFileSync(path.join(__dirname, publicPath, 'index.html'));
      res.send(200, file, 'html');
    });

    this.get('/reset/summary/:address', async (req, res) => {
      const valid = req.valid();
      const address = valid.str('address');
      await this.payment.resetSummary(address);
      res.send(200, 'Payment summary reset', 'html');
    });

    this.get('/robot.txt', async (req, res) => {
      res.send(200, 'User-agent: * \r\nDisallow: ', 'txt');
    });

    if (this.options.web.ssl) {
      const http = require('http');
      const server = http.createServer((req, res) => {
        res.writeHead(301,{Location: `https://${req.headers.host}${req.url}`});
        res.end();
      });
      server.listen(80);
    }
  }

  initSockets() {
    let IOServer;
    if (!this.io) {
      try {
        IOServer = include('socket.io');
      } catch (e) {
        ;
      }
    }

    if (!IOServer)
      return;

    this.io = new IOServer({
      transports: ['websocket', 'polling'],
      serveClient: false
    });

    this.io.attach(this.server);

    this.io.on('connection', (ws) => {
      this.addSocket(ws);
      this.handleEvent(ws);
    });
  }

  public(staticPath) {
    return async (req, res) => {
      const url = req.url.replace(/\?.*/,'');
      const filePath = path.join(__dirname, staticPath, url);
      const ext = path.extname(filePath).substr(1);

      if (!ext)
        return;

      fs.exists(filePath, function(exists) {
        if(!exists)
          res.send(404);
      });

      this.get(url, async (req, res) => {
        const file = fs.readFileSync(filePath);
        res.send(200, file, ext);
      });
    };
  }
  /** Note: Admin auth will added in next version
  handleSocket(socket) {
      socket.hook('auth', (args) => {
      if (socket.auth)
        throw new Error('Already authed.');

      if (!this.options.noAuth) {
        const valid = new Validator([args]);
        const key = valid.str(0, '');

        if (key.length > 255)
          throw new Error('Invalid API key.');

        const data = Buffer.from(key, 'ascii');
        const hash = digest.hash256(data);

        if (!ccmp(hash, this.config.apiHash))
          throw new Error('Invalid API key.');
      }

      socket.auth = true;

      this.logger.info('Successful auth from %s.', socket.remoteAddress);
      this.handleAuth(socket);

      return null;
    });

    socket.emit('version', {
      version: pkg.version,
      network: this.network.type
    });
  }*/

  handleEvent (ws) {
    const localPath = '../../local';
    const dataPath = path.join(this.prefix, 'data');

    this.pools.on('block', () => {
      ws.emit('c_update_stats');
      ws.emit('c_pool_activity');
    });

    this.pools.on('share', (share) => {
      ws.emit('s_add_share', share.toJSON());
    });

    /*
     * Module event handler
     */
    ws.on('c_module', (obj) => {
      const filePath = path.join(__dirname, localPath, obj.path);
      const data = fs.readFileSync(filePath);
      const ret = {
        html: data.toString(),
        id: obj.id,
        setId: obj.setId || false
      };

      ws.emit('s_module', ret);
    });

    /*
     * Page event handler
     */
    ws.on('c_page', (obj) => {
      const filePath = path.join(__dirname, localPath, obj.path);

      let data;
      try {
        data = fs.readFileSync(filePath);
      } catch (e) {
        data = '<div>Error 404</div>';
      }

      ws.emit('s_page', {html: data.toString(), reload: obj.reload || true});
    });

    ws.on('c_announce', (filePath) => {
      if (!filePath)
        filePath = path.join(this.prefix, 'data', 'announcement.json');

      let data;
      try {
        data = fs.readFileSync(filePath);
      } catch (e) {
        data = JSON.stringify([{
          "title": "No Announcement",
          "date": 1522195200,
          "author": "Dev",
          "excerpt": `Please add announcement.json into ${filePath}.<br>
            See [[https://github.com/worldmobilecoin/wmcc-miningpool#announcement]](this guide).`
        }]);
      }

      ws.emit('s_announce', data.toString());
    });

    ws.on('c_pool_config', () => {
      const data = {
        fee: {
          type: 'percent',
          value: this.pools.options.fee
        },
        founderReward: {
          type: 'percent',
          value: this.pools.options.founderReward
        },
        threshold: {
          type: 'amount',
          value: this.pools.options.threshold
        },
        confirmation: {
          type: 'int',
          value: this.payment.options.confirmation
        },
      }

      ws.emit('s_pool_config', data);
    });

    /*
     * Stats event handler
     */
    ws.on('c_pool_stats', () => {
      const stats = this.pools.getPoolStats();
      ws.emit('s_pool_stats', stats);
    });

    ws.on('c_network_stats', () => {
      const stats = this.pools.getNetworkStats();
      ws.emit('s_network_stats', stats);
    });

    ws.on('c_update_stats', () => {
      const stats = this.pools.getUpdateStats();
      ws.emit('s_update_stats', stats);
    });

    /*
     * Payment event handler
     */
    ws.on('c_payment_summary', () => {
      const summary = this.payment.summary;
      ws.emit('s_payment_summary', summary.toJSON());
    });

    ws.on('c_payment_list', () => {
      ws.emit('s_payment_list');
    });

    ws.on('c_payment_update', async (limit, offset) => {
      const list = await this.payment.list.get(limit, offset);
      list.explorer = this.pools.options.explorer;
      ws.emit('s_payment_update', list);
    });

    /*
     * Payout event handler
     */
    ws.on('c_payout_summary', async (addr) => {
      const summary = await this.pools.getPayoutSummary(addr);
      ws.emit('s_payout_summary', summary);
    });

    ws.on('c_payout_list', (addr) => {
      ws.emit('s_payout_list', addr);
    });

    ws.on('c_payout_update', async (limit, offset, addr) => {
      const list = await this.pools.getPayoutList(addr, limit, offset);
      ws.emit('s_payout_update', list);
    });

    /*
     * Pool activity event handler
     */
    ws.on('c_pool_activity', () => {
      const activity = this.pools.getPoolActivity();
      ws.emit('s_pool_activity', activity);
    });

    /*
     * Block event handler
     */
    ws.on('c_block_summary', () => {
      const summary = this.pools.getBlockSummary();
      ws.emit('s_block_summary', summary);
    });

    ws.on('c_block_list', () => {
      ws.emit('s_block_list');
    });

    ws.on('c_block_update', async (limit, offset, type) => {
      const list = await this.pools.getBlockList(type, limit, offset);
      ws.emit('s_block_update', list);
    });

    /*
     * Connection Details - Mining ports
     */
    ws.on('c_mining_ports', () => {
      const list = this.pools.getMiningPorts();
      ws.emit('s_mining_ports', list.length);
    });

    ws.on('c_mining_port', (index) => {
      const list = this.pools.getMiningPorts();
      ws.emit('s_mining_port', list[index], index);
    });
  }
}

/**
 * Web Server Options
 */
class WebServerOptions {
  /**
   * Create web server options.
   * @constructor
   * @param {Object} options
   */
  constructor(options) {
    this.domain = 'wmccpool.com';
    this.prefix = null;
    /* Note: will be used in admin page later
    this.noAuth = false;
    this.apiKey = base58.encode(random.randomBytes(20));
    this.apiHash = digest.hash256(Buffer.from(this.apiKey, 'ascii'));
    */
    this.logger = Logger.global;

    this.fromOptions(options);
  }

  fromOptions(options) {
    assert(options, 'Options are required.');
    assert(options.prefix, 'Prefix is required.');
    assert(options.pool, 'Pool is required.');

    this.prefix = options.prefix;
    this.pools = options.pool;
    this.payment = options.payment;
    this.web = options.web;

    if (options.logger != null) {
      assert(typeof options.logger === 'object');
      this.logger = options.logger;
    }

    if (options.domain != null) {
      assert(typeof options.domain === 'string');
      this.domain = options.domain;
    }

    return this;
  }

  static fromOptions(options) {
    return new this().fromOptions(options);
  }
}

/*
 * Expose
 */
module.exports = WebServer;