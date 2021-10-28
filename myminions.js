'use strict';
// process.env.DEBUG = 'skyblock';
const d = require('debug')('skyblock');

const fs = require('fs');
const _ = require('lodash');

const YAML = require('yaml');
var program = require('commander');

const userlib = require('./lib/user');

const table = require('./lib/util').table;
const getTier = require('./lib/util').getTier;
const removeSpecialCharacters = require('./lib/auclib').removeSpecialCharacters;
const getReforgeFromName = require('./lib/auclib').getReforgeFromName;

const curl = require('./lib/curl');
const p = require('./lib/pr').p(d);
const p4 = require('./lib/pr').p4(d);
const y4 = require('./lib/pr').y4(d);



var options;



myMinions(process.argv);



async function myMinions(args) {
    options = await parseArguments(args);
    let user = (await curl.get('https://api.hypixel.net/skyblock/profiles?uuid=' + options.uuid + '&key=' + options.key)).body;
    let profile = _.values(_.filter(user.profiles, { cute_name: options.profile })[0].members)[0];

    let minions = [];
    let rawMinions = profile.crafted_generators.sort();
    for (let rawMinion of rawMinions) {
        minions.push({
            name: rawMinion.substring(0, rawMinion.lastIndexOf('_')),
            tier: parseInt(rawMinion.substring(rawMinion.lastIndexOf('_') + 1))
        });
    }

    let sorted = _.sortBy(minions, [ 'name', 'tier' ]);
    let grouped = _.groupBy(sorted, function(o) {
        return o.name;
    });

    y4(grouped);

    // console.log(print(grouped));

    let topMinions = [];
    for (let minion of _.keys(grouped)) {
        let tier = grouped[minion][grouped[minion].length - 1].tier;
        topMinions.push({
            name: minion.toLowerCase(),
            tier: tier
        });
        // y4(minion + ': ' + tier);
        // y4(minion + ': ' + grouped[minion][0].tier);
    }

    p4(topMinions);
    console.log(print(topMinions));
}


function print(items) {
    return table(items, [
        {
            name: 'tier',
            alias: '#',
            width: 2,
            extra_spaces: 1
        },
        {
            name: 'name',
            width: -20,
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
