/*!
 * Copyright (c) 2017, Park Alter (pseudonym)
 * Distributed under the MIT software license, see the accompanying
 * file COPYING or http://www.opensource.org/licenses/mit-license.php
 *
 * https://github.com/worldmobilecoin/wmcc-miningpool
 * payment.js - payment processor for wmcc_miningpool.
 */

'use_strict';

const assert = require('assert');
const {include} = require('../util');
const Core = include('wmcc-core');
const {util, StaticWriter, BufferReader} = Core.utils;

/**
 * Payout
 */
class Payout {
  constructor(options) {
    this.users = [];
    this.hash = null;
    this.height = 0;
    this.version = 1;
    this.time = 0;
    this.total = 0;
    this.miner = 0;
  }

  add(username, heights, total) {
    this.users.push({
      username: username,
      heights: heights,
      total: total
    });
    this.miner++;
    this.total+=total;
  }

  setTX(tx, height) {
    this.hash = tx.hash('hex');
    this.height = height;
    this.time = util.now();
  }

  commit(raw, offset) {
    raw.writeInt32LE(this.time, 4);
    raw.write(this.hash, offset, 'hex');
    return raw;
  }

  clear() {
    this.users = [];
    this.hash = null;
    this.height = 0;
    this.time = 0;
    this.total = 0;
    this.miner = 0;
  }

  toRaw() {
    const bw = new StaticWriter(24);

    for (let user of this.users) {
      this.total += user.total;
      this.miner++;
    }

    bw.writeU32(this.version);
    bw.writeU64(this.total);
    bw.writeU32(this.miner);
    bw.writeU64(this.height);

    return bw.render();
  }

  toJSON() {
    return {
      time: this.time,
      hash: this.hash.toString('hex'),
      version: this.version,
      total: this.total,
      miner: this.miner,
      height: this.height
    }
  }

  fromRaw(key, value) {
    const raw = Buffer.concat([key, value]);
    const br = new BufferReader(raw, true);

    br.readU8(); // ch

    this.time = br.readU32BE();
    this.hash = br.readHash('hex');
    this.version = br.readU32();
    this.total = br.readU64();
    this.miner = br.readU32();
    this.height = br.readU64();

    return this;
  }

  static fromRaw(key, value) {
    return new this().fromRaw(key, value);
  }
}
/*
 * Expose
 */

module.exports = Payout;