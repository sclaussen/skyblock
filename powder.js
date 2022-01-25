'use strict';
// process.env.DEBUG = 'skyblock';
const d = require('debug')('skyblock');

const _ = require('lodash');
const fs = require('fs');

const YAML = require('yaml');
var program = require('commander');
const moment = require('moment');
const { parse, writeUncompressed } = require('prismarine-nbt')

const userlib = require('./lib/user');

const getUser = require('./lib/user').getUser;
const getUuid = require('./lib/user').getUuid;

const table = require('./lib/util').table;
const getTier = require('./lib/util').getTier;
const getenv = require('./lib/util').getenv;

const curl = require('./lib/curl');
const p = require('./lib/pr').p(d);
const p4 = require('./lib/pr').p4(d);
const y4 = require('./lib/pr').y4(d);


var user;
var uuid;
var options;



powder(process.argv);



async function powder(args) {

    // Parse the command line options
    options = await parseArguments(args);

    let user = (await curl.get('https://api.hypixel.net/skyblock/profiles?uuid=' + options.uuid + '&key=' + options.key)).body;
    let profile = _.values(_.filter(user.profiles, { cute_name: options.profile })[0].members)[0];

    let mithril1 = parseInt(profile.mining_core.powder_spent_mithril);
    let mithril2 = parseInt(profile.mining_core.powder_mithril);
    let gem1 = parseInt(profile.mining_core.powder_spent_gemstone);
    let gem2 = parseInt(profile.mining_core.powder_gemstone);

    console.log('Mithril:        ', Number(mithril2).toLocaleString());
    console.log('Gem:            ', Number(gem2).toLocaleString());

    console.log('Mithril Powder: ', Number(mithril1 + mithril2).toLocaleString());
    console.log('Gem Powder:     ', Number(gem1 + gem2).toLocaleString());
}


async function parseArguments(args) {

    program
        .parse(args);

    let options = program.opts();

    // Get the environment variables
    options.user = userlib.getUser();
    options.uuid = await userlib.getUuid();
    options.profile = userlib.getProfile();
    options.key = userlib.getKey();

    p4(options);

    return options;
}
