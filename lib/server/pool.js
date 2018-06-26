/*!
 * Copyright (c) 2017, Park Alter (pseudonym)
 * Distributed under the MIT software license, see the accompanying
 * file COPYING or http://www.opensource.org/licenses/mit-license.php
 *
 * https://github.com/worldmobilecoin/wmcc-miningpool
 * pool.js - mining pool servers for wmcc_miningpool.
 */

'use strict';

const EventEmitter = require('events');
const assert = require('assert');
const path = require('path');

const Submission = require('./submission');
const Connection = require('./connection');
const Stats = require('./stats');
const Job = require('./job');
const Share = require('./share');
const {utils, include} = require('../util');

const {Lock} = include('wmcc-mutex');
const TCP = include('wmcc-tcp');
const IP = include('wmcc-inet');
const Logger = include('wmcc-logger');
const Core = include('wmcc-core');

const {hash256, ccmp} = Core.crypto;
const {List, util} = Core.utils;
const {Network} = Core.protocol;
const {Address} = Core.primitives;

/*
 * Constants
 */

const NONCE_SIZE = 4;

/**
 * Mining Pool Servers
 * @extends {EventEmitter}
 */

class Pool extends EventEmitter {
  /**
   * Create mining pool servers.
   * @constructor
   * @param {Object} options
   */
  constructor(options) {
    super();

    this.options = new PoolOptions(options);

    this.node = this.options.node;
    this.chain = this.options.chain;
    this.miner = this.options.miner;
    this.network = this.options.network;
    this.logger = this.options.logger.context('poolServer');
    this.pools = this.options.pools;
    this.db = this.options.db;

    this.stats = new Stats(this.options);
    this.locker = new Lock();
    this.jobMap = new Map();
    this.banned = new Map();
    this.jobs = new List();
    this.current = null;
    this.lastActive = 0;
    this.subscribed = false;
    this.uid = 0;
    this.suid = 0;

    this.__init();
  }

  __init() {
    for (let pool of this.pools) {
      this.createServer(pool);
      pool.conn.on('connection', (socket) => {
        this.handleSocket(socket, pool);
      });
    }

    this.node.on('connect', async () => {
      try {
        await this.handleBlock();
      } catch (e) {
        this.emit('error', e);
      }
    });

    this.node.on('tx', async () => {
      try {
        await this.handleTX();
      } catch (e) {
        this.emit('error', e);
      }
    });
  }

  createServer(pool) {
    pool.conn = TCP.createServer();
    pool.inbound = new List();
  }

  async handleSocket(socket, pool) {
    if (!socket.remoteAddress) {
      this.logger.debug('Ignoring disconnected client at port %d.', pool.port);
      socket.destroy();
      return;
    }

    const host = IP.normalize(socket.remoteAddress);

    if (pool.inbound.size >= pool.maxInbound) {
      this.logger.debug('Ignoring client: too many inbound (%s) at port %d.', host, pool.port);
      socket.destroy();
      return;
    }

    if (this.isBanned(host)) {
      this.logger.debug('Ignoring banned client (%s) at port %d.', host, pool.port);
      socket.destroy();
      return;
    }

    socket.setKeepAlive(true);
    socket.setNoDelay(true);

    this.addClient(socket, pool);
  }

  addClient(socket, pool) {
    const conn = new Connection(this, socket, pool);

    conn.on('error', (err) => {
      this.emit('error', err);
    });

    conn.on('close', () => {
      assert(pool.inbound.remove(conn));
    });

    conn.on('ban', () => {
      this.handleBan(conn);
    });

    pool.inbound.push(conn);
  }

  handleBan(conn) {
    this.logger.warning('Banning client (%s).', conn.id());
    this.banned.set(conn.host, util.now());
    conn.destroy();
  }

  isBanned(host) {
    const time = this.banned.get(host);

    if (time == null)
      return false;

    if (util.now() - time > Pool.BAN_TIME) {
      this.banned.delete(host);
      return false;
    }

    return true;
  }

  async handleBlock() {
    const unlock = await this.locker.lock();
    try {
      return await this._handleBlock();
    } finally {
      unlock();
    }
  }

  async _handleBlock() {
    const now = util.now();

    if (!this.subscribed) {
      this.lastActive = now;
      return;
    }

    this.current = null;
    this.lastActive = now;

    await this.notifyAll(true);
  }

  async handleTX() {
    const unlock = await this.locker.lock();
    try {
      return await this._handleTX();
    } finally {
      unlock();
    }
  }

  async _handleTX() {
    const now = util.now();

    if (!this.subscribed) {
      this.lastActive = now;
      return;
    }

    if (now > this.lastActive + Pool.ACTIVE_TIME) {
      this.current = null;
      this.lastActive = now;

      await this.notifyAll(false);
    }
  }

  async open() {
    const addr = this.options.rewardsAddress;

    if (addr)
      this.miner.addresses = [addr];

    if (this.miner.addresses.length === 0)
      throw new Error('No addresses available for coinbase.');

    await this.stats.open();
    await this.listen();

    if (this.options.password) {
      if (!this.db.getUser('admin')) {
        await this.db.addUser({
          username: 'admin',
          hash: this.options.password
        });
      }
    }

    this.lastActive = util.now();
    this.createJob();
  }

  async listen() {
    let ports = [];
    for (let server of this.pools) {
      server.maxConnections = server.maxInbound;
      await server.conn.listen(server.port, this.options.host);
      ports.push(server.port);
    }
    this.logger.info('Server %s listening on %s.', this.options.host, ports.toString());
  }

  async close() {
    let conn, next;

    for (let server of this.pools) {
      for (conn = server.inbound.head; conn; conn = next) {
        next = conn.next;
        conn.destroy();
      }
      await server.conn.close();
    }
  }

  notify(conn, msg, sid) {
    setTimeout(async() => {
      if (conn.destroyed)
        return;
      // sending minimum msg to notify miner
      conn.sendResponse(msg, [
        [
          ['mining.notify', sid]
        ],
        sid,
        NONCE_SIZE
      ]);

      this.notify(conn, msg, sid);
    }, Pool.NOTIFY_INTERVAL * 1000);
  }

  async notifyAll(cleanJob) {
    const job = await this.getJob();
    let conn;

    this.logger.debug('Notifying all clients of new job: %s.', job.id);

    await this.stats.refreshEntries();
    this.emit('block', job);

    for (let server of this.pools) {
      for (conn = server.inbound.head; conn; conn = conn.next) {
        if (conn.sid === -1)
          continue;
        conn.sendJob(job, cleanJob);
      }
    }
  }

  async getJob() {
    if (!this.current) {
      const attempt = await this.createBlock();

      const job = Job.fromTemplate(this.jid(), attempt);

      this.addJob(job);

      this.logger.debug(
        'New job (id=%s, prev=%s).',
        job.id, util.revHex(job.attempt.prevBlock));
    }

    return this.current;
  }

  createJob() {
    const now = util.now();

    setTimeout(async() => {
      if (now >= this.lastActive + Pool.JOB_TIMEOUT) {
        this.current = null;
        this.lastActive = now;

        await this.notifyAll(false);
      }

      this.createJob();
    }, Pool.JOB_TIMEOUT * 1000);
  }

  addJob(job) {
    if (this.jobs.size >= Pool.MAX_JOBS)
      this.removeJob(this.jobs.head);

    assert(this.jobs.push(job));

    assert(!this.jobMap.has(job.id));
    this.jobMap.set(job.id, job);

    this.current = job;
  }

  removeJob(job) {
    assert(this.jobs.remove(job));

    assert(this.jobMap.has(job.id));
    this.jobMap.delete(job.id);

    if (job === this.current)
      this.current = null;
  }

  createBlock() {
    if (this.miner.addresses.length === 0)
      throw new Error('No addresses available for coinbase.');

    return this.miner.createBlock();
  }

  jid() {
    const now = util.now();
    const id = this.uid;
    this.uid += 1;
    this.uid >>>= 0;
    return `${now}:${id}`;
  }

  // handler
  sid() {
    const sid = this.suid;
    this.suid += 1;
    this.suid >>>= 0;
    return sid;
  }

  auth(username, password) {
    const user = this.db.getUser(username);

    if (!user && !this.options.autoAddUser)
      return false;

    if (!user && this.options.autoAddUser) {
      try {
        this.db.addUser({
          username: username,
          password: password
        });
      } catch (e) {
        this.logger.debug(e);
        return false;
      }
      return true;
    }

    const passwd = Buffer.from(password, 'utf8');
    const hash = hash256(passwd);

    if (!ccmp(hash, user.password))
      return false;

    return true;
  }

  authAdmin(password) {
    if (!this.options.password)
      return false;

    const data = Buffer.from(password, 'utf8');
    const hash = hash256(data);

    if (!ccmp(hash, this.options.password))
      return false;

    return true;
  }

  async addBlock(conn, block, username) {
    // Broadcast immediately.
    this.node.broadcast(block);

    let entry;
    try {
      entry = await this.chain.add(block);
    } catch (e) {
      if (e.type === 'VerifyError') {
        switch (e.reason) {
          case 'high-hash':
            return new PoolError(23, 'high-hash');
          case 'duplicate':
            return new PoolError(22, 'duplicate');
        }
        return new PoolError(20, e.reason);
      }
      throw e;
    }

    if (!entry)
      return new PoolError(21, 'stale-prevblk');

    if (entry.hash !== this.chain.tip.hash)
      return new PoolError(21, 'stale-work');

    this.tryCommit(entry, block, username);

    this.logger.info('Client found block %s (%d) (%s).',
      entry.rhash(),
      entry.height,
      conn.id());

    await this.db.deleteBackup();

    return null;
  }

  async tryCommit(entry, block, username) {
    const founder = {
      username: username,
      reward: this.options.founderReward
    };

    const share = new Share({
      entry: entry,
      block: block,
      founder: founder,
      fee: this.options.fee
    });

    try {
      await this.stats.addShare(share);
      this.emit('share', share);
    } catch (e) {
      this.emit('error', e);
    }
  }

  async handlePacket(conn, msg) {
    const unlock = await this.locker.lock();
    try {
      return await this._handlePacket(conn, msg);
    } finally {
      unlock();
    }
  }

  async _handlePacket(conn, msg) {
    switch (msg.method) {
      case 'mining.authorize':
        return this.handleAuthorize(conn, msg);
      case 'mining.subscribe':
        return this.handleSubscribe(conn, msg);
      case 'mining.extranonce.subscribe':
        return this.handleExtranonceSubscribe(conn, msg);
      case 'mining.submit':
        return this.handleSubmit(conn, msg);
      case 'mining.get_transactions':
        return this.handleTransactions(conn, msg);
      case 'mining.authorize_admin':
        return this.handleAuthAdmin(conn, msg);
      case 'mining.add_user':
        return this.handleAddUser(conn, msg);
      default:
        return this.handleUnknown(conn, msg);
    }
  }

  async handleAuthorize(conn, msg) {
    if (typeof msg.params.length < 2) {
      conn.sendError(msg, 0, 'invalid params');
      return;
    }

    const user = msg.params[0];
    const pass = msg.params[1];

    if (!utils.isUsername(user) || !utils.isPassword(pass)) {
      conn.sendError(msg, 0, 'invalid params');
      return;
    }

    try {
      Address.fromString(user);
    } catch (e) {
      console.log(e)
      conn.sendError(msg, 26, 'invalid address');
      return;
    }

    if (!this.auth(user, pass)) {
      this.logger.debug(
        'Client failed auth for user %s (%s).',
        user, conn.id());
      conn.sendResponse(msg, false);
      return;
    }

    this.logger.debug(
      'Client successfully auth for %s (%s).',
      user, conn.id());

    conn.addUser(user);
    conn.sendResponse(msg, true);
  }

  async handleSubscribe(conn, msg) {
    /*if (!this.chain.synced) {
      conn.sendError(msg, 0, 'not up to date');
      return;
    }*/

    if (!conn.agent && msg.params.length > 0) {
      if (!utils.isAgent(msg.params[0])) {
        conn.sendError(msg, 0, 'invalid params');
        return;
      }
      conn.agent = msg.params[0];
    }

    if (msg.params.length > 1) {
      if (!utils.isSID(msg.params[1])) {
        conn.sendError(msg, 0, 'invalid params');
        return;
      }
      conn.sid = this.sid();
    } else {
      conn.sid = this.sid();
    }

    if (!this.subscribed) {
      this.logger.debug('First subscriber (%s).', conn.id());
      this.subscribed = true;
    }

    const sid = utils.hex32(conn.sid);
    const job = await this.getJob();

    this.logger.debug(
      'Client is subscribing with sid=%s (%s).',
      sid, conn.id());

    conn.sendResponse(msg, [
      [
        ['mining.notify', sid],
        ['mining.set_difficulty', sid]
      ],
      sid,
      NONCE_SIZE
    ]);

    conn.setDifficulty(conn.serverDifficulty);
    conn.sendJob(job, false);

    this.notify(conn, msg, sid);
  }

  async handleExtranonceSubscribe(conn, msg) {
    conn.sendError(msg, 20, 'Not supported.');
  }

  async handleSubmit(conn, msg) {
    const now = this.network.now();

    let subm;
    try {
      subm = Submission.fromPacket(msg);
    } catch (e) {
      conn.sendError(msg, 0, 'invalid params');
      return;
    }

    this.logger.spam(
      'Client submitted job %s (%s).',
      subm.job, conn.id());

    if (!conn.hasUser(subm.username)) {
      conn.sendError(msg, 24, 'unauthorized user');
      return;
    }

    if (conn.sid === -1) {
      conn.sendError(msg, 25, 'not subscribed');
      return;
    }

    const job = this.jobMap.get(subm.job);

    if (!job || job.committed) {
      conn.sendError(msg, 21, 'job not found');
      return;
    }

    if (job !== this.current) {
      this.logger.warning(
        'Client is submitting a stale job %s (%s).',
        job.id, conn.id());
    }

    // Non-consensus sanity check.
    // 2 hours should be less than MTP in 99% of cases.
    if (subm.time < now - 7200) {
      conn.sendError(msg, 20, 'time too old');
      return;
    }

    if (subm.time > now + 7200) {
      conn.sendError(msg, 20, 'time too new');
      return;
    }

    const share = job.check(conn.sid, subm);
    const difficulty = share.getDifficulty();

    if (difficulty < conn.difficulty - 1) {
      this.logger.debug(
        'Client submitted a low share of %d, hash=%s, ban=%d (%s).',
        difficulty, share.rhash(), conn.banScore, conn.id());

      conn.increaseBan(1);
      conn.sendError(msg, 23, 'high-hash');
      conn.sendDifficulty(conn.difficulty);

      return;
    }

    if (!job.insert(share.hash)) {
      this.logger.debug(
        'Client submitted a duplicate share: %s (%s).',
        share.rhash(), conn.id());
      conn.increaseBan(10);
      conn.sendError(msg, 22, 'duplicate');
      return;
    }

    const diff = share.getDifficulty(6);

    this.stats.addUserShare(subm.username, diff);
    this.stats.totalShare += diff;

    this.logger.debug(
      'Client submitted share of %d, hash=%s (%s).',
      difficulty, share.rhash(), conn.id());

    let error;
    if (share.verify(job.target)) {
      const block = job.commit(share);
      error = await this.addBlock(conn, block, subm.username);
    }

    if (error) {
      this.logger.warning(
        'Client found an invalid block: %s (%s).',
        error.reason, conn.id());
      conn.sendError(msg, error.code, error.reason);
    } else {
      conn.sendResponse(msg, true);
    }

    if (this.options.dynamic) {
      if (conn.retarget(job.difficulty)) {
        this.logger.debug(
          'Retargeted client to %d (%s).',
          conn.nextDifficulty, conn.id());
      }
    }
  }

  async handleTransactions(conn, msg) {
    if (conn.sid === -1) {
      conn.sendError(msg, 25, 'not subscribed');
      return;
    }

    if (msg.params.length < 1) {
      conn.sendError(msg, 21, 'job not found');
      return;
    }

    const id = msg.params[0];

    if (!isJob(id)) {
      conn.sendError(msg, 21, 'job not found');
      return;
    }

    const job = this.jobMap.get(id);

    if (!job || job.committed) {
      conn.sendError(msg, 21, 'job not found');
      return;
    }

    this.logger.debug(
      'Sending tx list (%s).',
      conn.id());

    const attempt = job.attempt;
    const result = [];

    for (const item of attempt.items)
      result.push(item.tx.hash('hex'));

    conn.sendResponse(msg, result);
  }

  async handleAuthAdmin(conn, msg) {
    if (typeof msg.params.length < 1) {
      conn.sendError(msg, 0, 'invalid params');
      return;
    }

    const password = msg.params[0];

    if (!isPassword(password)) {
      conn.sendError(msg, 0, 'invalid params');
      return;
    }

    if (!this.authAdmin(password)) {
      this.logger.debug(
        'Client sent bad admin password (%s).',
        conn.id());
      conn.increaseBan(10);
      conn.sendError(msg, 0, 'invalid password');
      return;
    }

    conn.admin = true;
    conn.sendResponse(msg, true);
  }

  async handleAddUser(conn, msg) {
    if (typeof msg.params.length < 3) {
      conn.sendError(msg, 0, 'invalid params');
      return;
    }

    const user = msg.params[0];
    const pass = msg.params[1];

    if (!utils.isUsername(user) || !utils.isPassword(pass)) {
      conn.sendError(msg, 0, 'invalid params');
      return;
    }

    if (!conn.admin) {
      this.logger.debug(
        'Client is not an admin (%s).',
        conn.id());
      conn.sendError(msg, 0, 'invalid password');
      return;
    }

    try {
      this.db.addUser({
        username: user,
        password: pass
      });
    } catch (e) {
      conn.sendError(msg, 0, e.message);
      return;
    }

    conn.sendResponse(msg, true);
  }

  async handleUnknown(conn, msg) {
    this.logger.debug(
      'Client sent an unknown message (%s):',
      conn.id());

    this.logger.debug(msg);

    conn.send({
      id: msg.id,
      result: null,
      error: true
    });
  }

  totalInbound() {
    let total = 0;
    for (let pool of this.pools)
      total += pool.inbound.size;

    return total;
  }

  getNetworkStats() {
    return {
      hashRate: this.stats.getNetworkHashRate(),
      blockFound: this.chain.tip.time,
      difficulty: utils.toDifficulty(this.chain.tip.bits),
      height: this.chain.tip.height,
      rewards: this.stats.rewards
    }
  }

  getPoolStats(time) {
    const block = this.stats.getBlockTime();
    return {
      sharesReceived: this.stats.getAverageShare(),
      blockFound: block.last,
      connected: this.totalInbound(),
      poolFee: this.options.fee,
      foundAverage: block.average,
      totalFound: this.stats.getShareSize()
    }
  }

  getUpdateStats() {
    return this.stats.updateStats();
  }

  getPoolActivity() {
    return this.stats.getActivity();
  }

  getPayoutSummary(addr) {
    return this.stats.getUserSummary(addr);
  }

  async getPayoutList(addr, limit, offset) {
    const list = await this.stats.getUserList(addr, limit, offset);
    list.explorer = this.options.explorer;

    return list;
  }

  getBlockSummary() {
    const block = this.stats.getBlockTime();
    return {
      height: this.chain.tip.height,
      poolFound: block.last,
      foundAverage: block.average,
      totalFound: this.stats.getShareSize()
    }
  }

  async getBlockList(type, limit, offset) {
    const list = await this.stats.getBlockList(type, limit, offset);
    list.explorer = this.options.explorer;

    return list;
    //return this.stats.getBlockList(type, limit, offset);
  }

  getMiningPorts() {
    return this.options.settings;
  }
}

Pool.ACTIVE_TIME = 60;
Pool.MAX_JOBS = 6;
Pool.BAN_TIME = 10 * 60;
Pool.NOTIFY_INTERVAL = 60;
Pool.JOB_TIMEOUT = 1 * 60 * 60;


/**
 * Pool Options
 */

class PoolOptions {
  /**
   * Create pool options.
   * @constructor
   * @param {Object} options
   */

  constructor(options) {
    this.node = null;
    this.chain = null;
    this.miner = null;
    this.network = Network.primary;
    this.logger = Logger.global;
    this.prefix = null;
    this.pools = [];
    this.settings = [];
    this.host = '0.0.0.0';
    this.publicHost = '127.0.0.1';
    this.password = null;
    this.rewardsAddress = null;
    this.threshold = 1;
    this.explorer = "http://wmcc.network";

    this.backupExpired = 24 * 60 * 60;
    this.backupInternval = 60 * 1000;

    this.statsInterval = 60 * 1000;
    this.statsAverage = 10;
    this.maxActivityHours = 48;
    this.fee = 1;
    this.founderReward = 0;
    this.autoAddUser = true;

    this.fromOptions(options);
  }

  fromOptions(options) {
    assert(options, 'Options are required.');
    assert(options.prefix, 'Prefix is required.');
    assert(options.node && typeof options.node === 'object',
      'Node is required.');
    assert(options.db && typeof options.db === 'object',
      'Database is required.');

    this.node = options.node;
    this.chain = this.node.chain;
    this.miner = this.node.miner;
    this.network = this.node.network;
    this.logger = this.node.logger;
    this.prefix = options.prefix;
    this.db = options.db;

    if (options.pool.host != null) {
      assert(typeof options.pool.host === 'string');
      this.host = options.pool.host;
    }

    if (options.pool.publicHost != null) {
      assert(typeof options.pool.publicHost === 'string');
      this.publicHost = options.pool.publicHost;
    }

    if (options.pool.password != null) {
      assert(utils.isPassword(options.pool.password));
      this.password = hash256(Buffer.from(options.pool.password, 'utf8'));
    }

    if (options.pool.rewardsAddress != null) {
      assert(typeof options.pool.rewardsAddress === 'string');
      this.rewardsAddress = options.pool.rewardsAddress;
    }

    if (options.payment.threshold != null) {
      assert(typeof options.payment.threshold === 'number');
      this.threshold = options.payment.threshold;
    }

    if (options.pool.backupExpired != null) {
      assert(typeof options.pool.backupExpired === 'number');
      this.backupExpired = options.pool.backupExpired;
    }

    if (options.pool.backupInternval != null) {
      assert(typeof options.pool.backupInternval === 'number');
      this.backupInternval = options.pool.backupInternval*1000;
    }

    if (options.pool.statsInterval != null) {
      assert(typeof options.pool.statsInterval === 'number');
      this.statsInterval = options.pool.statsInterval*1000;
    }

    if (options.pool.statsAverage != null) {
      assert(typeof options.pool.statsAverage === 'number');
      this.statsAverage = options.pool.statsAverage;
    }

    if (options.pool.maxActivityHours != null) {
      assert(typeof options.pool.maxActivityHours === 'number');
      this.maxActivityHours = options.pool.maxActivityHours;
    }

    if (options.pool.fee != null) {
      assert(typeof options.pool.fee === 'number');
      this.fee = options.pool.fee;
    }

    if (options.pool.founderReward != null) {
      assert(typeof options.pool.founderReward === 'number');
      this.founderReward = options.pool.founderReward;
    }

    if (options.pool.autoAddUser != null) {
      assert(typeof options.pool.autoAddUser === 'boolean');
      this.autoAddUser = options.pool.autoAddUser;
    }

    if (options.web.explorer != null) {
      assert(typeof options.web.explorer === 'string');
      this.explorer = options.web.explorer;
    }

    if (options.pool.settings != null) {
      assert(Array.isArray(options.pool.settings));
      this.pools = options.pool.settings;
      for(let pool of this.pools) {
        if (pool.port != null)
          assert(typeof pool.port === 'number');
        if (pool.difficulty != null)
          assert(typeof pool.difficulty === 'number');
        if (pool.dynamic != null)
          assert(typeof pool.dynamic === 'boolean');
        if (pool.maxInbound != null)
          assert(typeof pool.maxInbound === 'number');
        if (pool.desc != null)
          assert(typeof pool.desc === 'string');

        this.settings.push({
          port: pool.port,
          difficulty: pool.difficulty,
          dynamic: pool.dynamic,
          title: pool.title,
          recommended: pool.recommended || false,
          desc: pool.desc || '-'
        });
      }
    }

    return this;
  }

  static fromOptions(options) {
    return new this().fromOptions(options);
  }
}

/**
 * Pool Error
 */

class PoolError {
  /**
   * Create a stratum error.
   * @constructor
   * @param {Number} code
   * @param {String} reason
   */

  constructor(code, reason) {
    this.code = code;
    this.reason = reason;
  }
}

/*
 * Expose
 */

module.exports = Pool;