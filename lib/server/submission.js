/*!
 * Copyright (c) 2017, Park Alter (pseudonym)
 * Distributed under the MIT software license, see the accompanying
 * file COPYING or http://www.opensource.org/licenses/mit-license.php
 *
 * https://github.com/worldmobilecoin/wmcc-miningpool
 * submission.js - packet submission for wmcc_miningpool.
 */

'use_strict';

const assert = require('assert');

const {utils} = require('../util');

/**
 * Submission Packet
 */

const NONCE_SIZE = 4;

class Submission {
  /**
   * Create a submission packet.
   */
  constructor() {
    this.username = '';
    this.job = '';
    this.nonce2 = 0;
    this.time = 0;
    this.nonce = 0;
  }

  static fromPacket(msg) {
    const subm = new Submission();

    assert(msg.params.length >= 5, 'Invalid parameters.');

    assert(utils.isUsername(msg.params[0]), 'Name must be a string.');
    assert(utils.isJob(msg.params[1]), 'Job ID must be a string.');

    assert(typeof msg.params[2] === 'string', 'Nonce2 must be a string.');
    assert(msg.params[2].length === NONCE_SIZE * 2, 'Nonce2 must be a string.');
    assert(utils.isHex(msg.params[2]), 'Nonce2 must be a string.');

    assert(typeof msg.params[3] === 'string', 'Time must be a string.');
    assert(msg.params[3].length === 8, 'Time must be a string.');
    assert(utils.isHex(msg.params[3]), 'Time must be a string.');

    assert(typeof msg.params[4] === 'string', 'Nonce must be a string.');
    assert(msg.params[4].length === 8, 'Nonce must be a string.');
    assert(utils.isHex(msg.params[4]), 'Nonce must be a string.');

    subm.username = msg.params[0];
    subm.job = msg.params[1];
    subm.nonce2 = parseInt(msg.params[2], 16);
    subm.time = parseInt(msg.params[3], 16);
    subm.nonce = parseInt(msg.params[4], 16);

    return subm;
  }
}

/*
 * Expose
 */

module.exports = Submission;