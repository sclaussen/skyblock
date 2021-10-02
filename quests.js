'use strict';
process.env.DEBUG = 'skyblock';
const d = require('debug')('skyblock');

const fs = require('fs');
const _ = require('lodash');

const YAML = require('yaml');
var program = require('commander');

const table = require('./lib/util').table;
const getTier = require('./lib/util').getTier;
const removeSpecialCharacters = require('./lib/auclib').removeSpecialCharacters;
const getReforgeFromName = require('./lib/auclib').getReforgeFromName;

const curl = require('./lib/curl');
const p = require('./lib/pr').p(d);
const p4 = require('./lib/pr').p4(d);
const y4 = require('./lib/pr').y4(d);



var options;



quests(process.argv);



async function quests(args) {
    let user = (await curl.get('https://api.hypixel.net/skyblock/profiles?uuid=' + process.env.SKYBLOCK_UUID + '&key=' + process.env.SKYBLOCK_KEY)).body;
    let profile = _.values(_.filter(user.profiles, { cute_name: 'Zucchini' })[0].members)[0];
    y4(_.filter(profile.quests, { status: 'ACTIVE' }));
}


function print(items) {
    return table(items, [
        {
            name: 'tier_display',
            alias: 'Tier',
            width: 4,
            extra_spaces: 3
        },
        {
            name: 'name',
            alias: 'Name',
            width: -33,
            extra_spaces: 3
        },
        {
            name: 'reforge',
            alias: 'Reforge',
            width: -10,
        },
        {
            name: 'health',
            alias: 'Hth',
            width: 5,
        },
        {
            name: 'strength',
            alias: 'Str',
            width: 5,
        },
        {
            name: 'crit_chance',
            alias: 'CritC',
            width: 5,
        },
        {
            name: 'crit_damage',
            alias: 'CritD',
            width: 5,
        },
        {
            name: 'intelligence',
            alias: 'Int',
            width: 5,
        },
        {
            name: 'mining_speed',
            alias: 'MinS',
            width: 5,
        },
        {
            name: 'description',
            alias: 'Description',
            width: -150,
        },
        // {
        //     name: 'speed',
        //     alias: 'S',
        //     width: 15,
        //     extra_spaces: 15
        // },
        // {
        //     name: 'attack_speed',
        //     alias: 'AS',
        //     width: 4,
        //     extra_spaces: 15
        // },
    ]);
}


function parse(args) {
    program
        .arguments('[user]', 'Username', 'PsychoticKizar')
        .arguments('[profile]', 'Profile', 'Zucchini')
        .parse(args);
    let options = program.opts();
    p4(options);
    return options;
}
