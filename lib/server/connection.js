/*!
 * Copyright (c) 2017, Park Alter (pseudonym)
 * Distributed under the MIT software license, see the accompanying
 * file COPYING or http://www.opensource.org/licenses/mit-license.php
 *
 * https://github.com/worldmobilecoin/wmcc-miningpool
 * connection.js - mining pool connection for wmcc_miningpool.
 */

'use strict';

const EventEmitter = require('events');
const assert = require('assert');
const {StringDecoder} = require('string_decoder');
const {format} = require('util');

const {include} = require('../util');

const {Lock} = include('wmcc-mutex');
const IP = include('wmcc-inet');

/**
 * Pool Connection
 */

class Connection extends EventEmitter {
  /**
   * Create a stratum pool connection.
   * @constructor
   * @param {pool} pool
   * @param {net.Socket} socket
   * @param {object} server
   */

  constructor(pool, socket, server) {
    super();

    this.locker = new Lock();
    this.pool = pool;
    this.logger = pool.logger;
    this.socket = socket;
    this.server = server;
    this.host = IP.normalize(socket.remoteAddress);
    this.port = socket.remotePort;
    this.hostname = IP.toHostname(this.host, this.port);
    this.decoder = new StringDecoder('utf8');
    this.agent = '';
    this.recv = '';
    this.admin = false;
    this.users = new Set();
    this.sid = -1;
    this.difficulty = -1;
    this.serverDifficulty = server.difficulty;
    this.nextDifficulty = -1;
    this.banScore = 0;
    this.lastBan = 0;
    this.drainSize = 0;
    this.destroyed = false;
    this.lastRetarget = -1;
    this.submissions = 0;
    this.prev = null;
    this.next = null;
    this.job = null;

    this._init();
  }

  _init() {
    this.on('packet', async (msg) => {
      try {
        await this.readPacket(msg);
      } catch (e) {
        this.error(e);
      }
    });

    this.socket.on('data', (data) => {
      this.feed(data);
    });

    this.socket.on('error', (err) => {
      this.emit('error', err);
    });

    this.socket.on('close', () => {
      this.logger.debug('Client (%s) socket hangup.', this.id());
      this.destroy();
    });

    this.socket.on('drain', () => {
      this.drainSize = 0;
    });
  }

  async readPacket(msg) {
    const unlock = await this.locker.lock();
    try {
      this.socket.pause();
      await this.handlePacket(msg);
    } finally {
      if (!this.destroyed)
        this.socket.resume();
      unlock();
    }
  }

  async handlePacket(msg) {
    return await this.pool.handlePacket(this, msg);
  }

  feed(data) {
    this.recv += this.decoder.write(data);

    if (this.recv.length >= 100000) {
      this.error('Too much data buffered (%s).', this.id());
      this.destroy();
      return;
    }

    if (/HTTP\/1\.1/i.test(this.recv)) {
      this.redirect();
      return;
    }

    const lines = this.recv.replace(/\r+/g, '').split(/\n+/);

    this.recv = lines.pop();

    for (const line of lines) {
      if (line.length === 0)
        continue;

      let msg;
      try {
        msg = ClientPacket.fromRaw(line);
      } catch (e) {
        this.error(e);
        continue;
      }

      this.emit('packet', msg);
    }
  }

  redirect() {
    const host = this.pool.options.publicHost;
    const port = this.server.port;

    const res = [
      'HTTP/1.1 200 OK',
      `X-Stratum: stratum+tcp://${host}:${port}`,
      'Connection: Close',
      'Content-Type: application/json; charset=utf-8',
      'Content-Length: 38',
      '',
      '',
      '{"error":null,"result":false,"id":0}'
    ];

    this.write(res.join('\r\n'));

    this.logger.debug('Redirecting client (%s).', this.id());

    this.destroy();
  }

  write(text) {
    if (this.destroyed)
      return;

    if (this.socket.write(text, 'utf8') === false) {
      this.drainSize += Buffer.byteLength(text, 'utf8');
      if (this.drainSize > (5 << 20)) {
        this.logger.warning(
          'Client is not reading (%s).',
          this.id());
        this.destroy();
      }
    }
  }

  addUser(username) {
    if (this.users.has(username))
      return false;

    this.users.add(username);

    return true;
  }

  hasUser(username) {
    return this.users.has(username);
  }

  increaseBan(score) {
    const now = Date.now();

    this.banScore *= Math.pow(1 - 1 / 60000, now - this.lastBan);
    this.banScore += score;
    this.lastBan = now;

    if (this.banScore >= Connection.BAN_SCORE) {
      this.logger.debug(
        'Ban score exceeds threshold %d (%s).',
        this.banScore, this.id());
      this.ban();
    }
  }

  ban() {
    this.emit('ban');
  }

  send(json) {
    if (this.destroyed)
      return;

    json = JSON.stringify(json);
    json += '\n';

    this.write(json);
  }

  sendResponse(msg, result) {
    this.logger.spam(
      'Sending response %s (%s).',
      msg.id, this.id());

    this.send({
      id: msg.id,
      result: result,
      error: null
    });
  }

  sendMethod(method, params) {
    this.logger.spam(
      'Sending method %s (%s).',
      method, this.id());

    this.send({
      id: null,
      method: method,
      params: params
    });
  }

  sendDifficulty(difficulty) {
    assert(difficulty > 0, 'Difficulty must be at least 1.');

    this.logger.debug(
      'Setting difficulty=%d for client (%s).',
      difficulty, this.id());

    this.sendMethod('mining.set_difficulty', [difficulty]);
  }

  setDifficulty(difficulty) {
    this.nextDifficulty = difficulty;
  }

  sendJob(job) {
    if (!this.job)
      this.job = job;

    this.logger.debug(
      'Sending job %s to client (%s).',
      job.id, this.id());

    if (this.nextDifficulty !== -1) {
      this.submissions = 0;
      this.lastRetarget = Date.now();
      this.sendDifficulty(this.nextDifficulty);
      this.difficulty = this.nextDifficulty;
      this.nextDifficulty = -1;
    }

    this.sendMethod('mining.notify', job.toJSON());
  }

  sendError(msg, code, reason) {
    this.logger.spam(
      'Sending error %s (%s).',
      reason, this.id());

    this.send({
      id: msg.id,
      result: null,
      error: [code, reason, false]
    });
  }

  retarget(max) {
    const now = Date.now();
    const pm = Connection.SHARES_PER_MINUTE;

    assert(this.difficulty > 0);
    assert(this.lastRetarget !== -1);

    this.submissions += 1;

    if (this.submissions % pm === 0) {
      const target = (this.submissions / pm) * 60000;
      let actual = now - this.lastRetarget;
      let difficulty = 0x100000000 / this.difficulty;

      if (max > (-1 >>> 0))
        max = -1 >>> 0;

      if (Math.abs(target - actual) <= 5000)
        return false;

      if (actual < target / 4)
        actual = target / 4;

      if (actual > target * 4)
        actual = target * 4;

      difficulty *= actual;
      difficulty /= target;
      difficulty = 0x100000000 / difficulty;
      difficulty >>>= 0;
      difficulty = Math.min(max, difficulty);
      difficulty = Math.max(1, difficulty);

      this.setDifficulty(difficulty);

      return true;
    }

    return false;
  }

  destroy() {
    if (this.destroyed)
      return;

    this.destroyed = true;

    this.locker.destroy();
    this.socket.destroy();
    this.socket = null;

    this.emit('close');
  }

  error(err) {
    if (this.destroyed)
      return;

    if (err instanceof Error) {
      err.message += ` (${this.id()})`;
      this.emit('error', err);
      return;
    }

    let msg = format.apply(null, arguments);

    msg += ` (${this.id()})`;

    this.emit('error', new Error(msg));
  }

  id() {
    let id = this.host;

    if (this.agent)
      id += '/' + this.agent;

    return id;
  }
}

Connection.BAN_SCORE = 1000;
Connection.SHARES_PER_MINUTE = 8;

/**
 * ClientPacket
 */

class ClientPacket {
  /**
   * Create a packet.
   */

  constructor() {
    this.id = null;
    this.method = 'unknown';
    this.params = [];
  }

  static fromRaw(json) {
    const packet = new ClientPacket();
    const msg = JSON.parse(json);

    if (msg.id != null) {
      assert(typeof msg.id === 'string'
        || typeof msg.id === 'number');
      packet.id = msg.id;
    }

    assert(typeof msg.method === 'string');
    assert(msg.method.length <= 50);
    packet.method = msg.method;

    if (msg.params) {
      assert(Array.isArray(msg.params));
      packet.params = msg.params;
    }

    return packet;
  }
}

/*
 * Expose
 */

module.exports = Connection;