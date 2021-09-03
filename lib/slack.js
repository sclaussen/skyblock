'use strict';
process.env.DEBUG = 'skyblock';
const d = require('debug')('skyblock');

const util = require('util');
const _ = require('lodash');

const YAML = require('yaml');
const program = require('commander');

const curl = require('./curl');
const p = require('./pr').p(d);
const p4 = require('./pr').p4(d);

const { sortBy, deburr, groupBy, orderBy, toLower, map, uniq, filter } = _



async function slack(message) {
    await curl.post(process.env.SKYBLOCK_SLACK, null, {
        "text": message
    });
}
