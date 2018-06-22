/*!
 * Copyright (c) 2017, Park Alter (pseudonym)
 * Distributed under the MIT software license, see the accompanying
 * file COPYING or http://www.opensource.org/licenses/mit-license.php
 *
 * https://github.com/worldmobilecoin/wmcc-miningpool
 * job.js - job for wmcc_miningpool.
 */

'use_strict';

const assert = require('assert');
const {utils, include} = require('../util');
const Core = include('wmcc-core');
const {consensus} = Core.protocol;
const {common} = Core.mining;

/**
 * Job
 */

class Job {
  /**
   * Create a job.
   * @constructor
   */
  constructor(id) {
    assert(typeof id === 'string');

    this.id = id;
    this.attempt = null;
    this.target = consensus.ZERO_HASH;
    this.difficulty = 0;
    this.submissions = {};
    this.committed = false;
    this.prev = null;
    this.next = null;
  }

  fromTemplate(attempt) {
    this.attempt = attempt;
    this.attempt.refresh();
    this.target = attempt.target;
    this.difficulty = attempt.getDifficulty();
    return this;
  }

  static fromTemplate(id, attempt) {
    return new this(id).fromTemplate(attempt);
  }

  insert(hash) {
    hash = hash.toString('hex');

    if (this.submissions[hash])
      return false;

    this.submissions[hash] = true;

    return true;
  }

  check(nonce1, subm) {
    const nonce2 = subm.nonce2;
    const ts = subm.time;
    const nonce = subm.nonce;
    return this.attempt.getProof(nonce1, nonce2, ts, nonce);
  }

  commit(share) {
    assert(!this.committed, 'Already committed.');
    this.committed = true;
    return this.attempt.commit(share);
  }

  toJSON() {
    return [
      this.id,
      common.swap32hex(this.attempt.prevBlock),
      this.attempt.left.toString('hex'),
      this.attempt.right.toString('hex'),
      this.attempt.tree.toJSON(),
      utils.hex32(this.attempt.version),
      utils.hex32(this.attempt.bits),
      utils.hex32(Math.max(this.attempt.time, this.attempt.mtp + 1)),
      false
    ];
  }
}

/*
 * Expose
 */

module.exports = Job;