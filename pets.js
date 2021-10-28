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



pets(process.argv);



async function pets(args) {

    // Parse the command line options
    options = await parseArguments(args);

    let user = (await curl.get('https://api.hypixel.net/skyblock/profiles?uuid=' + options.uuid + '&key=' + options.key)).body;
    p4(user);
    let profile = _.values(_.filter(user.profiles, { cute_name: options.profile })[0].members)[0];

    y4(profile.pets);

    let pets = _.mapValues(profile.pets, function(o) {
        return {
            name: o.type.toLowerCase(),
            tier: getTier(o.tier.toLowerCase()),
            xp: o.exp,
        };
    });

    // for (let pet of pets) {
    //     let response = await getPetInfo(item.item_bytes);
    //     if (response) {
    //         item.pet_held_item = response.pet_held_item;
    //         item.pet_candy_used = response.pet_candy_used;
    //     }

    console.log(print(pets));
}


function print(items) {
    items = _.sortBy(items, [ 'tier', 'xp' ]).reverse();
    return table(items, [
        {
            name: 'name',
            width: -17,
        },
        {
            name: 'tier',
            width: -10,
        },
        {
            name: 'xp',
            width: 10,
            format: { integer: true},
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
