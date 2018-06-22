/*!
 * Copyright (c) 2017, Park Alter (pseudonym)
 * Distributed under the MIT software license, see the accompanying
 * file COPYING or http://www.opensource.org/licenses/mit-license.php
 *
 * https://github.com/worldmobilecoin/wmcc-miningpool
 * utils.js - utils for wmcc_miningpool.
 */

'use_strict';

const assert = require('assert');

class Utils {
  static isJob(id) {
    if (typeof id !== 'string')
      return false;

    return id.length >= 12 && id.length <= 21;
  }

  static isSID(sid) {
    if (typeof sid !== 'string')
      return false;

    return sid.length === 8 && this.isHex(sid);
  }

  static isUsername(username) {
    if (typeof username !== 'string')
      return false;

    return username.length > 0 && username.length <= 100;
  }

  static isPassword(password) {
    if (typeof password !== 'string')
      return false;

    return password.length > 0 && password.length <= 255;
  }

  static isAgent(agent) {
    if (typeof agent !== 'string')
      return false;

    return agent.length > 0 && agent.length <= 255;
  }

  static isHex(str) {
    return typeof str === 'string'
      && str.length % 2 === 0
      && /^[0-9A-Fa-f]+$/.test(str);
  }

  static hex32(num) {
    assert((num >>> 0) === num);
    num = num.toString(16);
    switch (num.length) {
      case 1:
        return `0000000${num}`;
      case 2:
        return `000000${num}`;
      case 3:
        return `00000${num}`;
      case 4:
        return `0000${num}`;
      case 5:
        return `000${num}`;
      case 6:
        return `00${num}`;
      case 7:
        return `0${num}`;
      case 8:
        return `${num}`;
      default:
        throw new Error();
    }
  }

  static now() {
    return Math.floor(Date.now() / 1000);
  }

  static toDifficulty(bits) {
    let shift = (bits >>> 24) & 0xff;
    let diff = 0x0000ffff / (bits & 0x00ffffff);

    while (shift < 29) {
      diff *= 256.0;
      shift++;
    }

    while (shift > 29) {
      diff /= 256.0;
      shift--;
    }

    return diff;
  }
}

/*
 * Expose
 */

module.exports = Utils;