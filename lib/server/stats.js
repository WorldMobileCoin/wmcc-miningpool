/*!
 * Copyright (c) 2017, Park Alter (pseudonym)
 * Distributed under the MIT software license, see the accompanying
 * file COPYING or http://www.opensource.org/licenses/mit-license.php
 *
 * https://github.com/worldmobilecoin/wmcc-miningpool
 * stats.js - stats handler for wmcc_miningpool.
 */

'use strict';

const assert = require('assert');
const path = require('path');
const Cache = require('./cache');
const {include} = require('../util');

const Core = include('wmcc-core');

const {util, StaticWriter, BufferReader} = Core.utils;

class Stats{
  /**
   * Create stats handler for pool.
   * @constructor
   * @param {Object} options
   */
  constructor(options) {
    this.version = 1;
    this.entries = [];
    this.lookup = 120;
    this.totalShare = 0;
    this.rewards = 0;

    this.blockList = new BlockList(options);
    this.cache = new Cache(options);

    this.interval = options.statsInterval;
    this.expired = options.backupExpired;
    this.backupInternval = options.backupInternval;

    this.chain = options.chain;
    this.db = options.db;
    this.logger = options.logger;
    this.threshold = options.threshold;
  }

  async open() {
    await this.backup();
    await this.refreshEntries();
    await this.cache.open();
    await this.blockList.open();

    this._loop();
  }

  async backup() {
    const backup = await this.db.getBackup();

    if (backup) {
      const expired = (util.now() - backup.time) > this.expired;
      this.logger.info('Restoring backup for contributed share...');
      await this.restoreBackup(backup.shares, expired);
    }

    this.createBackup();
  }

  createBackup() {
    setTimeout(async() => {
      this.logger.spam('Creating backup for contributed share...');
      await this.saveBackup();
      this.createBackup();
    }, this.backupInternval);
  }

  restoreBackup(shares, expired) {
    if (expired)
      return this.db.deleteBackup();

    for (let share in shares)
      this.addUserShare(share, shares[share]);
  }

  async saveBackup() {
    if (!this.cache.usersize)
      return;

    await this.db.deleteBackup();
    await this.db.saveBackup(this.cache.usermap);
  }

  _loop() {
    const delay = this.interval - (new Date().getSeconds()*1000);

    setTimeout(async() => {
      await this._saveStats();
      this._loop();
    }, delay);
  }

  updateBlockList(share, prevType, type) {
    return this.blockList.update(share, prevType, type);
  }

  /**
   * @Private
   */
  async _saveStats() {
    const stats = this.toRaw();
    const time = Math.round(util.now() / 60) * 60;

    this.totalShare = 0;
    this.cache.stats.unshift({
      time: time,
      stats: stats
    });

    if (this.average < this.cache.stats.length)
      this.cache.stats.pop();

    await this.db.saveStats(time, stats);
  }

  getHashRate(shares, seconds) {
    assert(typeof shares === 'number', 'Shares must be a number.');
    assert(typeof seconds === 'number', 'Seconds must be a number.');

    const hashes = shares * Math.pow(2, 32);
    return Math.floor(hashes/seconds);
  }

  getAverageShare() {
    let shares = 0,
        minutes = 0;

    for (let cache of this.cache.stats) {
      const stats = this.fromRaw(cache.stats);
      shares += stats.shares;
      minutes += stats.seconds/60;
    }
    return shares / Math.max(1/60, minutes);
  }

  getNetworkHashRate() {
    if (!this.entries.length)
      return 0;

    let entry = this.entries[0];
    let min = entry.time;
    let max = min;

    for (let i=1; i<this.entries.length; i++) {
      entry = this.entries[i];
      min = Math.min(entry.time, min);
      max = Math.max(entry.time, max);
    }

    const diff = max - min;

    if (diff === 0)
      return 0;

    const work = this.entries[0].chainwork.sub(entry.chainwork);

    return Number(work.toString()) / diff;
  }

  async refreshEntries() {
    let entry = this.chain.tip;
    let index = 0;

    const height = this.entries.length ? this.entries[0].height: entry.height - this.lookup - 1;

    if (this.entries[0] !== entry) {
      const block = await this.chain.getBlock(entry.hash);
      if (block)
        this.rewards = block.txs[0].outputs[0].value/1e8;
    }

    while(height<entry.height) {
      this.entries.splice(index++, 0, entry);
      this.entries.splice(this.lookup + 1);
      entry = await this.chain.getPrevious(entry);
    }
  }

  addUserShare(username, diff) {
    this.cache.addUserShare(username, diff);
  }

  async getUserSummary(addr) {
    const summary = await this.db.getUserSummary(addr);

    summary.threshold = this.threshold;
    summary.current = this.cache.usermap[addr] || 0;
    summary.share += summary.current;

    return summary;
  }

  async getUserList(addr, limit, offset) {
    const data = {
      payouts: [],
      size: 0
    };

    data.payouts = await this.db.getPaidByAddress(addr, limit, offset);
    data.size = await this.db.getPaidSizeByAddress(addr);

    return data;
  }

  /**
   * Add share to block and activity cache
   * @param {Object} Block
   */
  addShare(share) {
    this.cache.addShare(share);
    this.cache.clearUserShare();
    this.cache.cleanActivity();
    this.blockList.add(share.toJSON());
  }

  getActivity() {
    return {
      shares: this.cache.activity,
      max: this.cache.maxActivityHours
    }
  }

  /**
   * Get block time for unprocess and valid block by default
   * @return {json} last block time, average time
   */
  getBlockTime(types) {
    types = types || [0, 1];
    return this.blockList.getTime(types);
  }

  getBlockList(type, limit, offset) {
    return this.blockList.get(type, limit, offset);
  }

  getShareSize(types) {
    types = types || [0, 1];

    let size = 0;
    for (let type in types)
      size += this.blockList.sizes[type];

    return size;
  }

  toRaw() {
    const bw = new StaticWriter(12);

    bw.writeU32(this.version);
    bw.writeU32(this.totalShare); // is 2^31 enough for 1 minute shares?
    bw.writeU32(this.interval/1000);

    return bw.render();
  }

  fromRaw(data) {
    const br = new BufferReader(data, true);
    const stats = {};

    stats.version = br.readU32();
    stats.shares = br.readU32();
    stats.seconds = br.readU32();

    return stats;
  }

  static fromRaw(data) {
    return new Stats().fromRaw(data);
  }

  /**
   * return {Int} next update in milisecond
   */
  updateStats() {
    const date = new Date();
    return this.interval - (date.getSeconds()*1000);
  }
}

class BlockList {  
  constructor(options) {
    this.cacheSize = 300;
    this.shares = [];
    this.sizes = [];
    this.types = [0xdf, 0x4f, 0x53]; //o-unprocess, O-valid, S-stale
    this.db = options.db;
  }

  async open() {
    for (let type in BlockList.TYPES) {
      this.shares[type] = await this.db.getShareByType(BlockList.TYPES[type], this.cacheSize, 0);
      this.sizes[type] = this.shares[type].length;
    }
  }

  /**
   * @return {Promise}
   */
  add(share, type=0) {
    if (this.shares[type].length > this.cacheSize - 2)
      this.shares[type].pop();

    this.shares[type].unshift(share);
    this.sizes[type]++;
  }

  update(share, prevType, type) {
    this.add(share, type);
    this.shares[prevType].find((e, i) => {
      if (!e)
        return;

      if (e.block === share.block)
        this.shares[prevType].splice(i, 1);
    });
    this.sizes[prevType]--;
  }

  /**
   * Calculate average block time
   * Note: Max average count is base on cache size
   * @param {Array} Share types @BlockList.TYPES
   */
  getTime(types) {
    assert(Array.isArray(types));

    const times  = {
      last: 0,
      average: 0,
      lookup: 0
    }

    let next = util.now();
    let diff = 0,
        count = 0;

    for (let type of types) {
      for (let share of this.shares[type]) {
        diff += next-share.ts;
        next = share.ts;
        times.lookup++;
        count++;
      }

      if (!times.last && this.shares[type].length > 0)
        times.last = this.shares[type][0].ts;
    }

    times.average += Math.floor(diff/count);

    return times;
  }

  async get(type, limit, offset) {
    const end = limit+offset;
    const data = {
      shares: [],
      size: this.sizes[type]
    };

    if (end > this.cacheSize) {
      data.shares = await this.db.getShareByType(BlockList.TYPES[type], limit, offset);
      return data;
    }

    if (this.shares[type].length > 0)
      data.shares = this.shares[type].slice(offset, end);

    return data;
  }
}

/**
 * Constants
 */
BlockList.TYPES = [
  0xdf, // o-unprocess
  0x4f, // O-valid
  0x53 // S-stale
]

/**
 * Expose
 */
module.exports = Stats;