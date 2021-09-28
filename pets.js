'use strict';
process.env.DEBUG = 'skyblock';
const d = require('debug')('skyblock');

const _ = require('lodash');
const YAML = require('yaml');
var program = require('commander');

const table = require('./lib/util').table;
const getTier = require('./lib/util').getTier;

const curl = require('./lib/curl');
const p = require('./lib/pr').p(d);
const p4 = require('./lib/pr').p4(d);


var options;




pets(process.argv);


async function pets(args) {

    options = parse(args);

    let user = (await curl.get('https://api.hypixel.net/skyblock/profiles?uuid=' + process.env.SKYBLOCK_UUID + '&key=' + process.env.SKYBLOCK_KEY)).body;
    let output = {};
    let profile = _.values(_.filter(user.profiles, { cute_name: 'Zucchini' })[0].members)[0];

    let pets = _.mapValues(profile.pets, function(o) {
        return {
            name: o.type.toLowerCase(),
            tier: getTier(o.tier.toLowerCase()),
            xp: o.exp,
        };
    });

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

function parse(args) {

    program
        .arguments('[user]', 'Username', 'Wisedom')
        .arguments('[profile]', 'Profile', 'Zucchini')
        .parse(args);

    let options = program.opts();

    p4(options);

    return options;
}
