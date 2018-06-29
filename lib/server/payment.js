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

const Payout = require('./payout');
const {include} = require('../util');

const {Lock} = include('wmcc-mutex');
const Core = include('wmcc-core');

const {Address} = Core.primitives;
const {policy, consensus} = Core.protocol;
const {Amount} = Core.wmcc;
const {util, encoding, StaticWriter, BufferReader} = Core.utils;

/**
 * Payment
 */

class Payment {
  /**
   * Create a payment process
   * @constructor
   * @param {Object} options
   */
  constructor(options) {
    this.options = new PaymentOptions(options);
    this.db = this.options.db;
    this.node = this.options.node;
    this.chain = this.node.chain;
    this.pool = this.options.pool;
    this.locker = new Lock();
    this.type = this.options.type;

    this.wallet = null;
    this.passphrase = null;
    this.summary = new Summary(this.options);
    this.list = new PaymentList(this.options);

    this.init();
  }

  init() {
    this.node.on('connect', async(entry, block) => {
      if (this.node.chain.synced) {
        await this.handleShare(entry);
        await this.handlePayment(entry);
      }
    });
  }

  async open() {
    await this.summary.open();
    await this.list.open();
  }

  close() {
    ;
  }

  async handlePayment(entry) {
    const unlock = await this.locker.lock();
    try {
      return await this._handlePayment(entry);
    } finally {
      unlock();
    }
  }

  async _handlePayment(entry) {
    // add newly mined block to 
    assert(this.wallet, 'Wallet object is required.');
    assert(this.passphrase, 'Passphrase object is required.');

    const payments = await this.db.getUnpaid();
    const payout = new Payout();

    if (!payments)
      return;

    const batch = this.db.batch();
    const tx = new Transaction({
      logger: this.options.logger,
      rate: this.options.rate,
      wallet: this.wallet,
      passphrase: this.passphrase
    });

    let count = 0,
        max = 0;

    for (const [address, value] of payments.entries()) {
      count++;
      if (value.total > this.options.threshold) {
        max++;
        tx.addOutput(address, value.total);
        payout.add(address, value.heights, value.total);
      }

      if(payments.size === count || max%this.options.maxAddress === 0) {
        const txn = await tx.commit();
        payout.setTX(txn, entry.height);
        await this.list.add(batch, payout);
        await batch.write();
        await this.summary.update(payout, entry.height);
        tx.clear();
        batch.clear();
        payout.clear();
        max = 0;
      }
    }

    return batch.write();
  }

  async handleShare(entry) {
    const unlock = await this.locker.lock();
    try {
      return await this._handleShare(entry);
    } finally {
      unlock();
    }
  }

  async _handleShare(entry) {
    const merger = new MergeShare();
    const shares = await this.db.getShare(0, entry.height - this.options.confirmation, true);

    for (let share of shares) {
      merger.addShares(share.shares);

      if (await this.isStale(share)) {
        merger.addBlock(1, share.height);
        this.pool.updateBlockList(share, 0, 2);
        continue;
      }

      merger.addBlock(0, share.height);
      this.pool.updateBlockList(share, 0, 1);

      for (let unpaid in merger.shares)
        await this.db.setUnpaid(unpaid, share);

      await this.db.updateShares(merger.blocks);

      merger.reset();
    }
  }

  /**
   * @param {Object} Share
   * @return {Promise} Boolean
   */
  async isStale(share) {
    const hash = await this.chain.getHash(share.height);
    return share.block.toString('hex') !== util.revHex(hash);
  }

  addWallet(wallet, passphrase) {
    assert(typeof wallet === 'object',
      'Wallet object is required.');
    assert(typeof wallet === 'object',
      'Wallet object is required.');
    this.wallet = wallet;
    this.passphrase = passphrase;
  }
}

class PaymentList {
  constructor(options) {
    this.cacheSize = 1000;
    this.payouts = [];
    this.size = 0;
    this.db = options.db;
  }

  async open() {
    this.size = await this.db.getPayoutSize();
    this.payouts = await this.db.getPayouts(this.cacheSize, 0);
  }

  /**
   * @return {Promise}
   */
  add(batch, payout) {
    if (this.payouts.length > this.cacheSize - 2)
      this.payouts.pop();

    this.payouts.unshift(payout.toJSON());
    this.size++;

    return this.db.addPaid(batch, payout);
  }

  async get(limit, offset) {
    const end = limit+offset;
    const data = {
      payouts: [],
      size: this.size
    };

    if (end > this.cacheSize) {
      data.payouts = await this.db.getPayouts(limit, offset);
      return data;
    }

    data.payouts = this.payouts.slice(offset, end);
    return data;
  }
}

class Summary {
  constructor(options) {
    this.version = 1;
    this.height = 0;
    this.miner = 0;
    this.amount = 0;
    this.txn = 0;
    this.next = 0;

    if (options)
      this.fromOptions(options);

    return this;
  }

  /**
   * @return {Promise}
   */
  open() {
    return this.db.getPaymentSummary(this);
  }

  async update(payout, height) {
    const share = await this.db.getShareLast();

    let total = 0;
    for (let user of payout.users)
      total += user.total;

    this.height = height;
    this.miner += payout.users.length;
    this.amount += total;
    this.txn += 1;
    this.next = share ? share.height + this.confirmation: 0;

    return this.db.setPaymentSummary(this);
  }

  /**
    * Warning: Speed depends on db size
    */
  async reset() {
    const payouts = await this.db.getPayouts(encoding.MAX_U64, 0, false);
    const share = await this.db.getShareLast();

    this.clear();

    for (const payout of payouts) {
      this.height = payout.height;
      this.miner += payout.miner;
      this.amount += payout.total;
      this.txn += 1;
    }

    this.next = share ? share.height - this.confirmation: 0;

    return this.db.setPaymentSummary(this);
  }

  clear() {
    this.height = 0;
    this.miner = 0;
    this.amount = 0;
    this.txn = 0;
    this.next = 0;
  }

  toJSON() {
    return {
      height: this.height,
      miner: this.miner,
      amount: this.amount,
      txn: this.txn,
      next: this.next
    }
  }

  toRaw() {
    const bw = new StaticWriter(40);

    bw.writeU32(this.version);
    bw.writeU64(this.height);
    bw.writeU32(this.miner);
    bw.writeU64(this.amount);
    bw.writeU64(this.txn);
    bw.writeU64(this.next);

    return bw.render();
  }

  fromRaw(raw) {
    const br = new BufferReader(raw, true);

    this.version = br.readU32();
    this.height = br.readU64();
    this.miner = br.readU32();
    this.amount = br.readU64();
    this.txn = br.readU64();
    this.next = br.readU64();

    return this;
  }

  static fromRaw(raw) {
    return new this().fromRaw(raw);
  }

  fromOptions(options) {
    assert(typeof options.db === 'object');
    assert(typeof options.confirmation === 'number');

    this.db = options.db;
    this.confirmation = options.confirmation;

    return this;
  }

  static fromOptions(options) {
    return new this().fromOptions(options);
  }
}

/**
 * Share Merger
 */

class MergeShare {
  constructor(options) {
    this.shares = null;
    this.blocks = [];
  }

  addShares(shares) {
    if (!this.shares) {
      this.shares = shares;
      return;
    }

    for (let user in shares) {
      if (this.shares[user])
        this.shares[user] += shares[user];
      else
        this.shares[user] = shares[user];
    }
  }

  addBlock(stale, height) {
    this.blocks.unshift({stale: stale, height: height});
  }

  reset() {
    this.shares = null;
    this.blocks = [];
  }
}

/**
 * Payment Options
 */

class PaymentOptions {
  /**
   * Create payment options.
   * @constructor
   * @param {Object} options
   */
  constructor(options) {
    this.type = Payment.types.DEFAULT;
    this.threshold = Amount.wmcoin(1);
    this.maxAddress = 50;
    this.rate = Amount.wmcoin(0.001);
    this.confirmation = consensus.COINBASE_MATURITY;

    this.fromOptions(options);
  }

  fromOptions(options) {
    assert(options, 'Options required.');
    assert(options.db && typeof options.db === 'object',
      'Database is required.');

    this.node = options.node;
    this.db = options.db;
    this.logger = options.logger;

    if (options.payment.type != null) {
      let type;
      if (typeof options.payment.type === 'number')
        type = Payment.typesByVal[options.payment.type];

      if (typeof options.payment.type === 'string')
        type = options.payment.type.toUpperCase();

      this.type = Payment.types[type];

      assert(this.type !== "undefined", 'Invalid payment type.')
    }

    if (options.payment.threshold != null) {
      assert(typeof options.payment.threshold === 'number');
      this.threshold = Amount.wmcoin(options.payment.threshold);
    }

    if (options.payment.maxAddress != null) {
      assert(typeof options.payment.maxAddress === 'number');
      this.maxAddress = options.payment.maxAddress;
    }

    if (options.payment.txnFeeRate != null) {
      assert(typeof options.payment.txnFeeRate === 'number');
      this.rate = Amount.wmcoin(options.payment.txnFeeRate);
    }

    if (options.payment.confirmation != null) {
      assert(typeof options.payment.confirmation === 'number');
      this.confirmation = options.payment.confirmation;
    }

    return this;
  }

  static fromOptions(options) {
    return new this().fromOptions(options);
  }
}

/**
 * Payment types.
 * @enum {Number}
 */

Payment.types = {
  DEFAULT: 0,
  PPLNS: 1,
  PPS: 2,
  PROPORTIONAL: 3
};

/**
 * Payment types by value.
 * @const {Object}
 */

Payment.typesByVal = [
  'DEFAULT',
  'PPLNS',
  'PPS',
  'PROPORTIONAL'
];


class Transaction {  
  /**
   * Create transaction for payment.
   * @constructor
   * @param {Object} options
   */
  constructor(options) {
    this.outputs = new Map();
    this.logger = options.logger;
    this.wallet = options.wallet;
    this.passphrase = options.passphrase;
    this.rate = options.rate;
  }

  addOutput(address, value) {
    if (typeof address === 'object')
      address = address.toString();

    assert(typeof value === 'number', 'Output value must to be a number.');
    assert(typeof address === 'string', 'Address must to be a string or object.');
    // checking for a valid address. should throw an error
    Address.fromString(address);

    if (this.outputs.has(address))
      value += this.outputs.get(address);

    this.outputs.set(address, value);
  }

  /**
   * @return {Promise}
   */
  commit() {
    if (!this.outputs.size)
      return;

    let outputs = [];

    for (const [address, value] of this.outputs.entries())
      outputs.push({address: address, value: value});

    return this.send(outputs);
  }

  clear() {
    this.outputs.clear();
  }

  async send(outputs) {
    const mtx = await this.wallet.createTX({
      outputs: outputs,
      rate: this.rate
    });

    return this._send(mtx);
  }

  async _send(mtx) {
    try {
      await this.wallet.sign(mtx, this.passphrase.toString('hex'));
      // note: handle this error properly
      //let error;

      if (!mtx.isSigned()) 
        throw new Error('TX could not be fully signed.');

      const tx = mtx.toTX();
      if (tx.getSigopsCost(mtx.view) > policy.MAX_TX_SIGOPS_COST)
        throw new Error('TX exceeds policy sigops.');

      if (tx.getWeight() > policy.MAX_TX_WEIGHT)
        throw new Error('TX exceeds policy weight.');

      const fee = tx.getFee(mtx.view);
      const rate = tx.getRate(mtx.view);
      const minfee = tx.getMinFee();
      if (tx.getMinFee() > fee)
        throw new Error(`Fee below minimum value (${minfee} wmcoin), but got ${fee} at rate ${rate} wmcoin/kb`);

      await this.wallet.db.addTX(tx);
      this.wallet.logger.debug('Sending mining pool payment, tx (%s): %s', this.wallet.id, tx.txid());
      await this.wallet.db.send(tx);
      this.wallet.logger.debug('Pool payment has been sent!');

      return tx;
    } catch (e) {
      this.logger.error('Unable to create TX. Reason: %s', e.message);
    }
  }
}

/*
 * Expose
 */
module.exports = Payment;