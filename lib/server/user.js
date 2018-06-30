/*!
 * Copyright (c) 2017, Park Alter (pseudonym)
 * Distributed under the MIT software license, see the accompanying
 * file COPYING or http://www.opensource.org/licenses/mit-license.php
 *
 * https://github.com/worldmobilecoin/wmcc-miningpool
 * user.js - user for wmcc_miningpool.
 */

'use_strict';

const assert = require('assert');
const {utils, include} = require('../util');

const Core = include('wmcc-core');
//const {encoding} = Core.utils;
const {hash256} = Core.crypto;
const {encoding, StaticWriter, BufferReader} = Core.utils;
const {Address} = Core.primitives;

/**
 * User
 */
class User {
  /**
   * Create a user.
   * @constructor
   * @param {Object} options
   */
  constructor(options) {
    this.version = 1;
    this.username = '';
    this.password = encoding.ZERO_HASH;

    if (options)
      this.fromOptions(options);
  }

  fromOptions(options) {
    assert(options, 'Options required.');
    assert(utils.isUsername(options.username), 'Username required.');
    assert(options.hash || options.password, 'Password required.');

    this.setUsername(options.username);

    if (options.hash != null)
      this.setHash(options.hash);

    if (options.password != null)
      this.setPassword(options.password);

    return this;
  }

  static fromOptions(options) {
    return new this().fromOptions(options);
  }

  setUsername(username) {
    assert(utils.isUsername(username), 'Username must be a string.');
    this.username = username;
  }

  setHash(hash) {
    if (typeof hash === 'string') {
      assert(utils.isHex(hash), 'Hash must be a hex string.');
      assert(hash.length === 64, 'Hash must be 32 bytes.');
      this.password = Buffer.from(hash, 'hex');
      return Buffer.from(hash, 'hex');
    } else {
      assert(Buffer.isBuffer(hash), 'Hash must be a buffer.');
      assert(hash.length === 32, 'Hash must be 32 bytes.');
      this.password = hash;
      return hash;
    }
  }

  setPassword(password) {
    assert(utils.isPassword(password), 'Password must be a string.');
    password = Buffer.from(password, 'utf8');
    this.password = hash256(password);
  }

  toJSON() {
    return {
      username: this.username,
      password: this.password.toString('hex')
    };
  }

  fromJSON(json) {
    assert(json);
    assert(typeof json.username === 'string');
    this.username = json.username;
    this.setHash(json.password);
    return this;
  }

  static fromJSON(json) {
    return new this().fromJSON(json);
  }

  toRaw() {
    const bw = new StaticWriter(4+32+this.username.length);

    bw.writeU32(this.version);
    bw.writeHash(this.password);
    bw.writeString(this.username, 'utf8');

    return bw.render();
  }

  fromRaw(raw) {
    const br = new BufferReader(raw, true);
    const user = {};

    user.version = br.readU32();
    user.password = br.readHash();
    user.username = br.readString('utf8', br.left());

    return user;
  }

  static fromRaw(raw) {
    return new this().fromRaw(raw);
  }
  // SELFNOTE: Create new user payout library starting from here
  toPayment(username, share, paymentID) {
    paymentID = paymentID || encoding.NULL_HASH;

    assert (typeof paymentID === 'string');
    assert(paymentID.length === 64);
    const bw = new StaticWriter(4+4+8+8+8+1+4+4+32+32);

    bw.writeU32(this.version);
    bw.writeU32(utils.now());
    bw.writeU64(share.total);
    bw.writeU64(share.shares[username]);
    bw.writeU64(share.reward);
    bw.writeU8((username === share.founderAddress) ? 1: 0);
    bw.writeFloat(share.founderReward);
    bw.writeFloat(share.fee);
    bw.writeHash(share.block);
    bw.writeHash(paymentID);

    return bw.render();
  }

  static toPayment(username, share) {
    return new this().toPayment(username, share);
  }

  static paymentIDOffset() {
    return 4+4+8+8+8+1+4+4+32;
  }

  fromPayment(raw) {
    const br = new BufferReader(raw, true);
    const share = {};

    share.version = br.readU32();
    share.time = br.readU32();
    share.total = br.readU64();
    share.value = br.readU64();
    share.reward = br.readU64();
    share.founder = br.readU8();
    share.founderReward = br.readFloat();
    share.fee = br.readFloat();
    share.block = br.readHash('hex');
    share.paymentID = br.readHash('hex');
    share.amount = this._getAmount(share);

    return share;
  }

  static fromPayment(raw) {
    return new this().fromPayment(raw);
  }

  _getAmount(share) {
    // note: make proper calculation
    let luck = 0;
    if (share.founder)
      luck = share.reward*(share.founderReward/100);

    const misc = (share.fee+share.founderReward)/100;
    return Math.floor(share.value/share.total*(share.reward-share.reward*misc) + luck);
  }

  getUser(key) {
    assert(Buffer.isBuffer(key), 'Key must be a buffer.');

    const user = {};
    const addr = Address.fromHash(key.toString('hex', 1, 21), key[21], key[22]);

    user.username = addr.toString();
    user.height = key.readInt32BE(23);

    return user;
  }

  static getUser(key) {
    return new this().getUser(key);
  }

  toHash(user) {
    try {
      const addr = Address.fromString(user);
      const hash = Buffer.allocUnsafe(22);

      hash.write(addr.hash.toString('hex'), 0, 20, 'hex');
      hash[20] = addr.type;
      hash[21] = addr.version;

      return hash;
    } catch (e) {
      return null;
    }
  }

  static toHash(user) {
    return new this().toHash(user);
  }

  fromSummary(raw) {
    const br = new BufferReader(raw, true);
    const total = {};

    total.txn = br.readU32();
    total.amount = br.readU64();
    total.pending = br.readU64();
    total.share = br.readU64();

    return total;
  }

  static fromSummary(raw) {
    return new this().fromSummary(raw);
  }

  toSummary(amount, pending, share, summary) {
    const bw = new StaticWriter(28);

    if (amount)
      summary.txn+=1;

    bw.writeU32(summary.txn);
    bw.writeU64(summary.amount+amount);
    bw.writeU64(summary.pending+pending-amount);
    bw.writeU64(summary.share+share);

    return bw.render();
  }

  static toSummary(amount, pending, share, summary) {
    return new this().toSummary(amount, pending, share, summary);
  }
}

/*
 * Constants
 */
User.MIN_HASH = '00000000000000000000000000000000000000000000';
User.MAX_HASH = 'FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF';

/*
 * Expose
 */
module.exports = User;