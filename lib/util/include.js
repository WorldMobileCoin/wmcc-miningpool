/*!
 * Copyright (c) 2017, Park Alter (pseudonym)
 * Distributed under the MIT software license, see the accompanying
 * file COPYING or http://www.opensource.org/licenses/mit-license.php
 *
 * https://github.com/worldmobilecoin/wmcc-miningpool
 * include.js - include node modules.
 */

'use strict';

const path = require('path');
const _root = '../../../..';

function include (name) {
  try {
    // desktop
    return require(path.join(_root, `app.asar/node_modules/${name}`));
  } catch (e) {
    // daemon
    return require(path.join(_root, `app/node_modules/${name}`));
  }
}

module.exports = include;