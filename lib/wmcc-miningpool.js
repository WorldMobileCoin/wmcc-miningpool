/*!
 * Copyright (c) 2017, Park Alter (pseudonym)
 * Distributed under the MIT software license, see the accompanying
 * file COPYING or http://www.opensource.org/licenses/mit-license.php
 *
 * https://github.com/worldmobilecoin/wmcc-miningpool
 * wmcc_miningpool.js - miningpool plugin for wmcc_core.
 */

'use strict';

const assert = require('assert');
const path = require('path');
const os = require('os');

const {DB, Pool, WebServer, Payment} = require('./server');
const {include} = require('./util');

const fs = include('wmcc-file');
const Logger = include('wmcc-logger');
const Core = include('wmcc-core');

const {Network} = Core.protocol;

/**
 * Miningpool Module Handler for Web Server and Pool Servers
 */

class MiningPool {
  constructor(options) {
    this.options = new MiningPoolOptions(options);
    this.db = new DB(this.options);
    this.options.db = this.db;
    this.pool = new Pool(this.options);
    this.options.pool = this.pool;
    this.payment = new Payment(this.options);
    this.options.payment = this.payment;
    this.web = new WebServer(this.options);
  }

  static init(node) {
    const config = node.config;
    return new MiningPool({
      node: node,
      network: node.network,
      logger: node.logger,
      // mining pool config path
      config: config.path('miningpool-config')
    });
  }

  async open() {
    await this.db.open();
    await this.pool.open();
    await this.payment.open();
    await this.web.open();
  }

  async close() {
    await this.web.close();
    await this.payment.close();
    await this.pool.close();
    await this.db.close();
  }
}

MiningPool.id = 'miningpool';

/**
 * Mining Pool Options
 */

class MiningPoolOptions {  
  /**
   * Create mining pool options.
   * @constructor
   * @param {Object} options
   */
  constructor(options) {
    this.node = null;
    this.network = Network.primary;
    this.logger = Logger.global;
    this.prefix = path.resolve(os.homedir(), '.wmcc', 'miningpool');
    this.config = 'data/config.json';
    this.pool = null;
    this.payment = null;
    this.web = null;

    this.fromOptions(options);
  }

  fromOptions(options) {
    assert(options, 'Options are required.');

    if (options.node != null) {
      assert(typeof options.node === 'object');
      this.node = options.node;
    }

    if (options.network != null) {
      assert(typeof options.network === 'object');
      this.network = options.network;
    }

    if (options.logger != null) {
      assert(typeof options.logger === 'object');
      this.logger = options.logger;
    }

    if (options.prefix != null) {
      assert(typeof options.prefix === 'string');
      this.prefix = options.prefix;
    }

    if (options.config != null) {
      assert(typeof options.config === 'string', 'Config path must be a string');
      this.config = options.config;
    }

    const buf = fs.readFileSync(path.join(this.prefix, this.config));
    const config = JSON.parse(buf.toString());
    this.pool = config.pool;
    this.payment = config.payment;
    this.web = config.web;

    if (options.pool != null) {
      assert(typeof options.pool === 'object');
      this.pool = options.pool;
    }

    if (options.payment != null) {
      assert(typeof options.payment === 'object');
      this.payment = options.payment;
    }

    if (options.web != null) {
      assert(typeof options.web === 'object');
      this.web = options.web;
    }

    if (this.web.ssl) {
      this.web.keyFile = path.join(this.prefix, 'key.pem');
      this.web.certFile = path.join(this.prefix, 'cert.pem');

      if (this.web.keyFileName != null)
        this.web.keyFile = path.join(this.prefix, this.web.keyFileName);

      if (this.web.certFileName != null)
        this.web.certFile = path.join(this.prefix, this.web.certFileName);
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

module.exports = MiningPool;