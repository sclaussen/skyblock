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



slayers(process.argv);



async function slayers(args) {

    // Parse the command line options
    options = await parseArguments(args);

    let user = (await curl.get('https://api.hypixel.net/skyblock/profiles?uuid=' + options.uuid + '&key=' + options.key)).body;
    p4(user);
    let profile = _.values(_.filter(user.profiles, { cute_name: options.profile })[0].members)[0];

    y4(profile.slayer_bosses);
    let slayers = [];
    for (let slayerName of _.keys(profile.slayer_bosses)) {
        let slayer = profile.slayer_bosses[slayerName];
        let level = _.keys(slayer.claimed_levels).pop();
        if (!level) {
            level = 'level_0';
        }
        level = level.replace('level_', '');
        slayers.push({
            name: slayerName,
            level: parseInt(level)
        });
    }

    console.log(print(slayers));
}


function print(items) {
    items = _.sortBy(items, [ 'level' ]).reverse();
    return table(items, [
        {
            name: 'name',
            width: -17,
        },
        {
            name: 'level',
            width: -10,
        },
    ]);
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
