/*!
 * Copyright (c) 2017, Park Alter (pseudonym)
 * Distributed under the MIT software license, see the accompanying
 * file COPYING or http://www.opensource.org/licenses/mit-license.php
 *
 * https://github.com/worldmobilecoin/wmcc-miningpool
 * layouts.js - userdb, sharedb and stats database layouts for wmcc_miningpool.
 */

'use strict';

const assert = require('assert');

/**
 * Database layouts structure:
 * Basic:
 * I -> Index Pair
 * User:
 * u[username] -> ascii username
 * Stats:
 * H -> Hash Pair
 * m[time] -> stats time
 * o[height] -> unprocess mined block
 * O[height] -> process mined block - valid block
 * S[height, validHeight] -> processed staled to merge to valid block, for record only
 * p[time, txid] -> payments made
 * U[userhash, height] -> processed unpaid
 * P[userhash, height] -> processed paid
 * h[userhash] -> paid summary for user to reduce db heap
 * s[] -> store payment summary for last height to reduce db heap
 */

const layouts = {
  binary: true,
  I: function I(ch, index) {
    assert(typeof index === 'number');
    const key = Buffer.allocUnsafe(5);
    key[0] = ch;
    key.writeUInt32BE(index, 1, true);
    return key;
  },
  II: function II(ch, index, subindex) {
    assert(typeof index === 'number');
    assert(typeof subindex === 'number');
    const key = Buffer.allocUnsafe(9);
    key[0] = ch;
    key.writeUInt32BE(index, 1, true);
    key.writeUInt32BE(subindex, 5, true);
    return key;
  },
  IH: function IH(ch, index, hash) {
    assert(typeof index === 'number');
    assert(typeof hash === 'string');
    assert(hash.length === 64);
    const key = Buffer.allocUnsafe(37);
    key[0] = ch;
    key.writeUInt32BE(index, 1, true);
    key.write(hash, 5, 32, 'hex');
    return key;
  },
  H: function H(ch, userhash) {
    if (Buffer.isBuffer(userhash))
      userhash = userhash.toString('hex');

    assert(userhash.length === 44);

    const key = Buffer.allocUnsafe(23);

    key[0] = ch;
    key.write(userhash, 1, 22, 'hex');
    return key;
  },
  TT: function TT(ch, len, fill) {
    assert(typeof len === 'number');
    const key = Buffer.allocUnsafe(len).fill(fill);
    key[0] = ch;
    return key;
  },
  UP: function UP(ch, userhash, height) {
    if (Buffer.isBuffer(userhash))
      userhash = userhash.toString('hex');

    assert(typeof height === 'number');
    assert(userhash.length === 44);

    const key = Buffer.allocUnsafe(1 + 22 + 4);

    key[0] = ch;
    key.write(userhash, 1, 22, 'hex');
    key.writeUInt32BE(height, 23);

    return key;
  },
  u: function u(username) {
    if (Buffer.isBuffer(username)) {
      assert(username.length < 255, 'Invalid length for database key.');
      const ch = Buffer.alloc(1, 0x75);
      if (username.length > 0)
        return Buffer.concat([ch, username]);
      return ch;
    }

    assert(typeof username === 'string');
    const len = Buffer.byteLength(username, 'ascii');
    const key = Buffer.allocUnsafe(1 + len);
    key[0] = 0x75;
    if (len > 0)
      key.write(username, 1, 'ascii');
    return key;
  },
  m: function m(time){
    return this.I(0x6d, time);
  },
  o: function o(height){
    return this.I(0xdf, height);
  },
  b: function b(){
    return Buffer.from([0x62]);
  },
  O: function O(height){
    return this.I(0x4f, height);
  },
  p: function p(time, hash) {
    return this.IH(0x70, time, hash);
  },
  S: function S(height, validHeight){
    return this.II(0x53, height, validHeight);
  },
  U: function U(userhash, height) {
    return this.UP(0x55, userhash, height);
  },
  P: function P(userhash, height) {
    return this.UP(0x50, userhash, height);
  },
  h: function h(userhash) {
    return this.H(0x68, userhash);
  },
  s: function s() {
    return Buffer.from([0x73]);
  }
};

module.exports = layouts;