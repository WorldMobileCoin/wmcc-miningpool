/*!
 * Copyright (c) 2017, Park Alter (pseudonym)
 * Distributed under the MIT software license, see the accompanying
 * file COPYING or http://www.opensource.org/licenses/mit-license.php
 *
 * https://github.com/worldmobilecoin/wmcc-miningpool
 * db.js - stats, user, share and payment database for wmcc_miningpool.
 */

'use strict';

const assert = require('assert');
const path = require('path');
const {include} = require('../util');
const User = require('./user');
const Share = require('./share');
const layouts = require('./layout');
const Payout = require('./payout');

const Core = include('wmcc-core');

const {LDB} = Core.db;
const {Network} = Core.protocol;
const {encoding, util} = Core.utils;

const BUFFER_MIN = Buffer.alloc(0);
const BUFFER_MAX = Buffer.alloc(254, 0xff);

class Database {
  constructor(options) {
    this.options = new DatabaseOptions(options);
    this.logger = options.logger;
    this.db = LDB(this.options);

    this.usermap = new Map(); // cache user
    this.usersize = 0;
  }

  async open() {
    await this.db.open();
    await this.loadUser();
  }

  close() {
    return this.db.close();
  }

  batch() {
    return this.db.batch();
  }

  /**
   * @param {layout} db layout
   * @param {data} raw data
   * @returns {Promise}
   */
  save(layout, data) {
    return this.db.put(layout, data);
  }

  /**
   * @return {Promise}
   */
  delete(layout) {
    return this.db.del(layout);
  }

  /**
   * @return {Promise}
   */
  get(layout) {
    return this.db.get(layout);
  }

  // Backup
  /**
   * @return {Boolean | Object}
   */
  async getBackup() {
    const layout = layouts.b();
    const backup = await this.get(layout);

    if (!backup)
      return false;

    return Share.fromBackup(backup);
  }

  /**
   * @param {Usermap} user shares
   * @return {Promise}
   */
  async saveBackup(usermap) {
    const layout = layouts.b();
    const backup = Share.toBackup(usermap);
    return this.save(layout, backup);
  }

  /**
   * @return {Promise}
   */
  async deleteBackup() {
    const layout = layouts.b();
    return this.delete(layout);
  }

  /**
   * @return {Promise}
   */
  saveShare(share) {
    const layout = layouts.o(share.entry.height);
    const raw = share.toRaw();

    this.logger.info(
      'Committing payouts to database for block %d.', share.entry.height);

    return this.save(layout, raw);
  }

  async getShare(min,max,reverse) {
    let iter = this.db.iterator({
      gte: layouts.o(min),
      lte: layouts.o(max),
      keys: true,
      values: true,
      reverse: reverse || false
    });

    const shares = [];

    for (;;) {
      const data = await iter.next();

      if (!data)
        break;

      const share = Share.fromRaw(data.value);
      shares.push(share);
    }

    return shares;
  }

  async getShareByRange(options) {
    let iter = this.db.iterator({
      gte: options.gte,
      lte: options.lte,
      reverse: options.reverse || true,
      keys: options.merged ? true: false,
      values: true
    });

    const shares = [];
    const max = options.offset+options.limit-2;
    let count = 0;

    for (;;) {
      const data = await iter.next();

      if (!data)
        break;

      if (count < options.offset-1) {
        count++;
        continue;
      }

      if (count > max) {
        await iter.end();
        break;
      }

      const share = Share.fromRaw(data.value);

      if (options.merged)
        share.merged = data.key.readUInt32BE(5);

      shares.push(share);

      count++;
    }

    return shares;
  }

  async updateShares(blocks) {
    let validHeight = 0; // valid block height merged to
    for (let block of blocks) {
      if (block.stale === 0)
        validHeight = block.height;

      const oldlayout = layouts.o(block.height);
      const old = await this.get(oldlayout);
      let layout = layouts.O(block.height);

      if (block.stale === 1)
        layout = layouts.S(block.height, validHeight);

      await this.save(layout, old);
      await this.delete(oldlayout);
    }
  }

  /**
   * @return {Object|Null} Share
   */
  async getShareLast(reverse) {
    let iter = this.db.iterator({
      gte: layouts.o(encoding.MIN_U32),
      lte: layouts.o(encoding.MAX_U32),
      limit: 1,
      reverse: reverse || false,
      keys: false,
      values: true
    });

    const data = await iter.next();

    if (!data)
      return null;

    return Share.fromRaw(data.value);
  }

  /**
   * @return {Promise}
   */
  getShareByType(type, limit, offset, reverse) {
    let gte, lte, merged;
    switch (type) {
      case 0xdf:
      case 0x4f:
        gte = layouts.I(type, encoding.MIN_U32);
        lte = layouts.I(type, encoding.MAX_U32);
        merged = false;
        break;
      case 0x53:
        gte = layouts.II(type, encoding.MIN_U32, encoding.MIN_U32);
        lte = layouts.II(type, encoding.MAX_U32, encoding.MAX_U32);
        merged = true;
        break;
    }

    return this.getShareByRange({
      gte: gte,
      lte: lte,
      limit: limit,
      offset: offset,
      reverse: reverse || true,
      merged: merged
    });
  }

  /**
   * @param {Boolean} Including unprocess share
   * @return {Number}
   */
  async getShareSize(bool) {
    let size = await this.db.count({
      gte: layouts.O(encoding.MIN_U32),
      lte: layouts.O(encoding.MAX_U32)
    });

    if (!bool)
      return size;

    size += await this.db.count({
      gte: layouts.o(encoding.MIN_U32),
      lte: layouts.o(encoding.MAX_U32)
    });

    return size;
  }

  async getSharesUntil(until, bool) {
    const shares = await this.getSharesByTime({
      gte: layouts.O(encoding.MIN_U32),
      lte: layouts.O(encoding.MAX_U32),
      until: until
    });

    if (!bool)
      return shares;

    const uShares =  await this.getSharesByTime({
      gte: layouts.o(encoding.MIN_U32),
      lte: layouts.o(encoding.MAX_U32),
      until: until
    });

    return shares.concat(uShares);
  }

  async getSharesByTime(options) {
    let iter = this.db.iterator({
      gte: options.gte,
      lte: options.lte,
      reverse: true,
      keys: false,
      values: true
    });

    const shares = [];

    for (;;) {
      const data = await iter.next();

      if (!data)
        break;

      const share = Share.fromRaw(data.value);

      if (share.time < options.until) {
        await iter.end();
        break;
      }

      shares.push(share);
    }

    return shares;
  }

  // User
  async loadUser() {
    let iter = this.db.iterator({
      gte: layouts.u(BUFFER_MIN),
      lte: layouts.u(BUFFER_MAX),
      keys: true,
      values: true,
      reverse: true
    });

    for (;;) {
      const data = await iter.next();

      if (!data)
        break;

      const user = User.fromRaw(data.value);
      if (!this.usermap.has(user.username))
        this.usersize += 1;

      this.usermap.set(user.username, user);
    }
  }

  getUser(username) {
    return this.usermap.get(username);
  }

  hasUser(username) {
    return this.usermap.has(username);
  }

  addUser(options) {
    const user = new User(options);

    assert(!this.usermap.has(user.username), 'User already exists.');

    this.logger.debug(
      'Adding new user (%s).',
      user.username);

    this.usermap.set(user.username, user);
    this.usersize += 1;

    const layout = layouts.u(user.username);

    return this.save(layout, user.toRaw());
  }

  removeUser(username) {
    assert(this.usermap.has(username), 'User not exists.');

    this.logger.debug(
      'Removing user (%s).',
      username);

    this.usermap.delete(username);
    this.usersize -= 1;

    return this.deleteUser(username);
  }

  deleteUser(username) {
    const layout = layouts.u(username);
    return this.delete(layout);
  }

  // Stats
  saveStats(time, stats) {
    const layout = layouts.m(time);
    return this.save(layout, stats);
  }

  async getStats(time) {
    const raw = await this.db.get(layouts.m(time));

    if (!raw)
      return null;

    return Stats.fromRaw(raw);
  }

  async getStatsByLimit(limit) {
    const stats = [];
    let iter = this.db.iterator({
      gte: layouts.m(encoding.MIN_U32),
      lte: layouts.m(encoding.MAX_U32),
      limit: limit,
      keys: true,
      values: true
    });

    for (;;) {
      const data = await iter.next();

      if (!data)
        break;

      stats.push({
        time: data.key.readUInt32BE(1),
        stats: data.value
      })
    }

    return stats;
  }

  // Payment
  async getUnpaid() {
    const payments = new Map();

    let iter = this.db.iterator({
      gte: layouts.U(User.MIN_HASH, encoding.MIN_U32),
      lte: layouts.U(User.MAX_HASH, encoding.MAX_U32),
      keys: true,
      values: true
    });

    for (;;) {
      const data = await iter.next();

      if (!data)
        break;

      const user = User.getUser(data.key);
      const payment = User.fromPayment(data.value);
      const amount = Share.getAmount(payment);

      const value = {
        total: amount,
        heights: [user.height]
      };

      if (payments.has(user.username)) {
        const val = payments.get(user.username);
        value.total = value.total+val.total;
        value.heights = val.heights;
        value.heights.push(user.height);
      }

      payments.set(user.username, value);
    }

    return payments;
  }

  async getUnpaidAmount(addr) {
    const userhash = User.toHash(addr);
    let amount = 0;

    if (!userhash)
      return amount;

    let iter = this.db.iterator({
      gte: layouts.U(userhash, encoding.MIN_U32),
      lte: layouts.U(userhash, encoding.MAX_U32),
      keys: false,
      values: true
    });

    for (;;) {
      const data = await iter.next();

      if (!data)
        break;

      const payment = User.fromPayment(data.value);
      amount += Share.getAmount(payment);
    }

    return amount;
  }

  /**
   * @return {Promise}
   */
  async setUnpaid(username, share) {
    const userhash = User.toHash(username);
    const layout = layouts.U(userhash, share.height);
    const raw = User.toPayment(username, share);

    const summary = await this.getUserSummary(username);
    const payment = User.fromPayment(raw);
    const ntotal = User.toSummary(0, payment.amount, payment.value, summary);
    const ulayout = layouts.h(userhash);
    await this.delete(ulayout);
    await this.save(ulayout, ntotal);

    return this.save(layout, raw);
  }

  async addPaid(batch, payout) {
    for (let user of payout.users) {
      for (let height of user.heights) {
        const userhash = User.toHash(user.username);
        const u = layouts.U(userhash, height);
        const p = layouts.P(userhash, height);
        const payment = await this.get(u);
        const offset = User.paymentIDOffset();

        if (!payment){
          console.log(payout)
          this.logger.info( 'Cannot load unpaid data for user %s at %d block height.', user.username, height);
          continue;
        }

        batch.del(u);
        batch.put(p, payout.commit(payment, offset));

        await this._paidUser(batch, user.username, user.total);
      }
    }

    const layout = layouts.p(payout.time, payout.hash);
    const raw = payout.toRaw();

    batch.put(layout, raw);
  }

  async _paidUser(batch, username, amount) {
    const userhash = User.toHash(username);
    const layout = layouts.h(userhash);
    const summary = await this.getUserSummary(username);
    const ntotal = User.toSummary(amount, 0, 0, summary);

    batch.del(layout);
    batch.put(layout, ntotal);
  }

  async getUserSummary(username) {
    const userhash = User.toHash(username);
    const summary = {
      txn: 0,
      amount: 0,
      pending: 0,
      share: 0
    };

    if (!userhash)
      return summary;

    const layout = layouts.h(userhash);
    const raw = await this.get(layout);

    if (!raw)
      return summary;

    return User.fromSummary(raw);
  }

  async resetUserSummary(username) {
    const userhash = User.toHash(username);

    if (!userhash)
      return;

    const layout = layouts.h(userhash);
    const summary = {
      txn: 0,
      amount: 0,
      pending: 0,
      share: 0
    };

    const payments = await this.getPaidByAddress(username, encoding.MAX_U32, 0);

    for (let payment of payments) {
      summary.txn+=1;
      summary.amount+=payment.amount;
      summary.share+=payment.value;
    }

    summary.pending = await this.getUnpaidAmount(username);
    summary.amount*=26
    const raw = User.toSummary(0, 0, 0, summary);

    await this.delete(layout);
    return this.save(layout, raw);

  }

  /**
   * @return {Promise}
   */
  getPayoutSize() {
    return this.db.count({
      gte: layouts.p(encoding.MIN_U32, encoding.NULL_HASH),
      lte: layouts.p(encoding.MAX_U32, encoding.HIGH_HASH)
    });
  }

  async getPayouts(limit, offset, reverse) {
    let iter = this.db.iterator({
      gte: layouts.p(encoding.MIN_U32, encoding.NULL_HASH),
      lte: layouts.p(encoding.MAX_U32, encoding.HIGH_HASH),
      keys: true,
      values: true,
      reverse: reverse || true
    });

    const payouts = [];
    const max = offset+limit-2;
    let count = 0;

    for (;;) {
      const data = await iter.next();

      if (!data)
        break;

      if (count < offset-1) {
        count++;
        continue;
      }

      if (count > max) {
        await iter.end();
        break;
      }

      const payout = Payout.fromRaw(data.key, data.value);
      payouts.push(payout.toJSON());

      count++;
    }

    return payouts;
  }

  async getPaidByAddress(address, limit, offset, reverse) {
    const payouts = [];
    const userhash = User.toHash(address);

    if (!userhash)
      return payouts;

    let iter = this.db.iterator({
      gte: layouts.P(userhash, encoding.MIN_U32),
      lte: layouts.P(userhash, encoding.MAX_U32),
      keys: false,
      values: true,
      reverse: reverse || true
    });

    const max = offset+limit-2;
    let count = 0;

    for (;;) {
      const data = await iter.next();

      if (!data)
        break;

      if (count < offset-1) {
        count++;
        continue;
      }

      if (limit > 0 && count > max) {
        await iter.end();
        break;
      }

      const payout = User.fromPayment(data.value);
      payouts.push(payout);

      count++;
    }

    return payouts;
  }

  getPaidSizeByAddress(address) {
    const userhash = User.toHash(address);

    if (!userhash)
      return 0;

    return this.db.count({
      gte: layouts.P(userhash, encoding.MIN_U32),
      lte: layouts.P(userhash, encoding.MAX_U32)
    });
  }

  /* might be used later
  updatePaymentHeight(batch, payment, height) {
    assert(payment === 'object');
    assert(height === 'number');

    const layout = layouts.p(payment.time, payment.hash);
    // @marked #13
    const data = Buffer.allocUnsafe(16);
    data.writeUIntLE(payment.total, 0, 8);
    data.writeUInt32LE(payment.miner, 8, true);
    data.writeUInt32LE(height, 12, true);

    batch.del(layout);
    batch.put(layout, data);
  }*/

  /**
   * @param {Object|Json} Summary
   * @return {Promise}
   */
  async setPaymentSummary(payment) {
    const raw = payment.toRaw();
    await this.delete(layouts.s());
    return this.save(layouts.s(), raw);
  }

  /**
   * @return {Object} Payment summary
   */
  async getPaymentSummary(summary) {
    const raw = await this.db.get(layouts.s());

    if (!raw) 
      return;

    return summary.fromRaw(raw);
  }
}

class DatabaseOptions {
  constructor(options) {
    this.prefix = null;
    this.location = null;
    this.network = Network.primary;
    this.db = 'leveldb';
    this.compression = true;
    this.bufferKeys = layouts.binary;
    this.maxFiles = 64;
    this.cacheSize = 16 << 20;

    this.fromOptions(options);
  }

  fromOptions(options) {
    assert(options, 'Options are required.');

    if (options.prefix != null) {
      assert(typeof options.prefix === 'string');
      this.prefix = options.prefix;
      this.location = path.join(this.prefix, 'database');
    }

    if (options.location != null) {
      assert(typeof options.location === 'string');
      this.location = options.location;
    }

    if (options.db != null) {
      assert(typeof options.db === 'string');
      this.db = options.db;
    }

    if (options.compression != null) {
      assert(typeof options.compression === 'boolean');
      this.compression = options.compression;
    }

    if (options.maxFiles != null) {
      assert(util.isU32(options.maxFiles));
      this.maxFiles = options.maxFiles;
    }

    if (options.cacheSize != null) {
      assert(util.isU64(options.cacheSize));
      this.cacheSize = options.cacheSize;
    }

    return this;
  }
}

/**
 * Expose
 */

module.exports = Database;