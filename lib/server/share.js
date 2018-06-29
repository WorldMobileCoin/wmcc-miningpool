/*!
 * Copyright (c) 2017, Park Alter (pseudonym)
 * Distributed under the MIT software license, see the accompanying
 * file COPYING or http://www.opensource.org/licenses/mit-license.php
 *
 * https://github.com/worldmobilecoin/wmcc-miningpool
 * share.js - share for wmcc_miningpool.
 */

'use_strict';

const assert = require('assert');
const {utils, include} = require('../util');

const Core = include('wmcc-core');
const {Network} = Core.protocol;
const {util, StaticWriter, BufferReader} = Core.utils;

/**
 * Share
 */

class Share {
  /**
   * Create a share.
   * @constructor
   * @param {Object} options
   */
  constructor(options) {
    this.version = 1;
    this.network = Network.primary;
    this.entry = null;
    this.block = null;
    this.shares = null;
    this.founder = null;
    this.fee = 1;

    if (options)
      this.fromOptions(options);
  }

  fromOptions(options) {
    assert(options, 'Options required.');
    assert(options.entry, 'Entry is required.');
    assert(options.block, 'Block is required.');

    if (options.network)
      this.network = options.network;

    this.setEntry(options.entry);
    this.setBlock(options.block);

    if (options.founder != null) {
      assert(typeof options.founder === 'object');
      this.founder = options.founder;
    }

    if (options.fee != null) {
      assert(typeof options.fee === 'number');
      this.fee = options.fee;
    }
  }

  static fromOptions(options) {
    return new this().fromOptions(options);
  }

  setEntry(entry) {
    assert(typeof entry === 'object', 'Entry must be an object.');
    this.entry = entry;
  }

  setBlock(block) {
    assert(typeof block === 'object', 'Block must be an object.');
    this.block = block;
  }

  add(options) {
    assert(typeof options.map === 'object');
    assert(typeof options.size === 'number');
    assert(typeof options.total === 'number');

    this.shares = options;
  }

  toJSON() {
    const cb = this.block.txs[0];
    const addr = cb.outputs[0].getAddress();

    assert(addr, 'Coinbase address not found!');

    return {
      network: this.network.type,
      height: this.entry.height,
      block: this.block.rhash(),
      ts: this.block.time,
      time: util.now(),
      txid: cb.txid(),
      address: addr.toString(this.network),
      reward: cb.outputs[0].value,
      founderReward: this.founder.reward,
      founderAddress: this.founder.username,
      fee: this.fee,
      size: this.shares.size,
      total: Math.floor(this.shares.total),
      shares: this.shares.map
    };
  }

  fromJSON(json) {
    // temp: get entry and block (or network) from supllied json
    assert(json);
    this.fromOptions(json);
    return this;
  }

  static fromJSON(json) {
    return new this().fromJSON(json);
  }

  toRaw() {
    const json = this.toJSON();
    const bw = new StaticWriter(this.getLength(json));

    bw.writeU32(this.version);
    bw.writeU8(json.network.length);
    bw.writeString(json.network, 'utf8');
    bw.writeU32(json.height);
    bw.writeHash(json.block);
    bw.writeU32(json.ts);
    bw.writeU32(json.time);
    bw.writeHash(json.txid);
    bw.writeU8(json.address.length);
    bw.writeString(json.address, 'utf8');
    bw.writeU64(json.reward);
    bw.writeFloat(json.founderReward);
    bw.writeU8(json.founderAddress.length);
    bw.writeString(json.founderAddress, 'utf8');
    bw.writeFloat(json.fee);
    bw.writeU32(json.size);
    bw.writeU64(json.total);

    for (let share in json.shares) {
      bw.writeU8(share.length);
      bw.writeString(share, 'utf8');
      bw.writeU64(Math.floor(json.shares[share]));
    }

    return bw.render();
  }

  fromRaw(raw) {
    // temp: get entry and block (or network) from supllied raw data
    const br = new BufferReader(raw, true);
    const share = {};
    let len = 0;

    share.version = br.readU32();
    len = br.readU8();
    share.network = br.readString('utf8', len);
    share.height = br.readU32();
    share.block = br.readHash('hex');
    share.ts = br.readU32();
    share.time = br.readU32();
    share.txid = br.readHash('hex');
    len = br.readU8();
    share.address = br.readString('utf8', len);
    share.reward = br.readU64();
    share.founderReward = br.readFloat();
    len = br.readU8();
    share.founderAddress = br.readString('utf8', len);
    share.fee = br.readFloat();
    share.size = br.readU32();
    share.total = br.readU64();

    share.shares = Object.create(null);
    while (br.left() > 0) {
      len = br.readU8();
      const user = br.readString('utf8', len);
      share.shares[user] = br.readU64();
    }

    return share;
  }

  getLength(json) {
    let len = 0;

    len += 4; // version
    len += 1+json.network.length; // size+string
    len += 4+32+4+4+32; // height + block hash + ts + curr time + tx id
    len += 1+json.address.length; // size+string
    len += 8+4; // reward + founderReward
    len += 1+json.founderAddress.length; // size+string
    len += 4+4+8; //fee + size + total
    len += this.getShareLen(json.shares)

    return len;
  }

  getShareLen(shares) {
    let len = 0;

    for (let share in shares) {
      len += 1+share.length; // size+user/addr length
      len += 8; // shares value length
    }

    return len;
  }

  static fromRaw(raw) {
    return new this().fromRaw(raw);
  }

  fromBackup(raw) {
    const br = new BufferReader(raw, true);
    let len = 0;
    const usermap = {};

    usermap.time = br.readU32();
    usermap.shares = Object.create(null);

    while (br.left() > 0) {
      len = br.readU8();
      const user = br.readString('utf8', len);
      usermap.shares[user] = br.readU64();
    }

    return usermap;
  }

  static fromBackup(raw) {
    return new this().fromBackup(raw);
  }

  toBackup(usermap) {
    const bw = new StaticWriter(4+this.getShareLen(usermap));

    bw.writeU32(utils.now());
    for (let share in usermap) {
      bw.writeU8(share.length);
      bw.writeString(share, 'utf8');
      bw.writeU64(usermap[share]);
    }

    return bw.render();
  }

  static toBackup(shares) {
    return new this().toBackup(shares);
  }

  getAmount(share) {
    // note: make proper calculation
    let luck = 0;
    if (share.founder)
      luck = share.reward*(share.founderReward/100);

    const misc = (share.fee+share.founderReward)/100;
    return Math.floor(share.value/share.total*(share.reward-share.reward*misc) + luck);
  }

  static getAmount(share) {
    return new this().getAmount(share);
  }
}

/*
 * Expose
 */
module.exports = Share;