/*!
 * Copyright (c) 2017, Park Alter (pseudonym)
 * Distributed under the MIT software license, see the accompanying
 * file COPYING or http://www.opensource.org/licenses/mit-license.php
 *
 * https://github.com/worldmobilecoin/wmcc-miningpool
 * cache.js - cache for wmcc_miningpool.
 */

'use_strict';

const {include} = require('../util');

const Core = include('wmcc-core');

const {util} = Core.utils;

class Cache {  
  constructor(options) {
    this.activity = [];
    this.stats = [];

    this.usermap = Object.create(null);
    this.usersize = 0;
    this.usershare = 0;

    this.average = options.statsAverage;
    this.interval = options.statsInterval;
    this.maxActivityHours = options.maxActivityHours;

    this.db = options.db;
  }

  async open() {
    this.stats = await this.cacheStats();
    this.activity = await this.cacheActivity();
  }

  cacheStats() {
    return this.db.getStatsByLimit(this.average);
  }

  async addShare(share) {
    share.add({
      map: this.usermap,
      size: this.usersize,
      total: this.usershare
    });

    await this.db.saveShare(share);
    this.activity.unshift(share.toJSON());
  }

  cacheActivity() {
    return this.db.getSharesUntil(this.pastActivity(), true);
  }

  cleanActivity() {
    for (let i=this.activity.length-1; i>-1; i--) {
      if (this.activity[i].time>this.pastActivity())
        break;
      else
        this.activity.pop();
    }
  }

  pastActivity() {
    return util.now()-(this.maxActivityHours * 60 * 60);
  }

  addUserShare(username, diff) {
    if (!this.usermap[username]) {
      this.usermap[username] = 0;
      this.usersize++;
    }

    this.usermap[username] += diff;
    this.usershare += diff;
  }

  clearUserShare() {
    this.usermap = Object.create(null);
    this.usersize = 0;
    this.usershare = 0;
  }
}

/*
 * Expose
 */
module.exports = Cache;