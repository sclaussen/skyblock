'use strict';
process.env.DEBUG = 'skyblock';
const d = require('debug')('skyblock');

const fs = require('fs');
const _ = require('lodash');

const YAML = require('yaml');
var program = require('commander');

const table = require('./lib/util').table;
const getTier = require('./lib/util').getTier;

const curl = require('./lib/curl');
const p = require('./lib/pr').p(d);
const p4 = require('./lib/pr').p4(d);
const y4 = require('./lib/pr').y4(d);


const { lfilter, sortBy, values,  } = _


var options;




profile(process.argv);


function getLevel(points) {
    return _.filter(levels, function(o) {
        return o.points > points;
    })[0].name;
}


async function profile(args) {

    options = parse(args);

    let levels = YAML.parse(fs.readFileSync('dat/skill_levels.yaml', 'utf8'), { prettyErrors: true });
    let user = (await curl.get('https://api.hypixel.net/skyblock/profiles?uuid=' + process.env.SKYBLOCK_UUID + '&key=' + process.env.SKYBLOCK_KEY)).body;


    let output = {};

    let profile = _.values(_.filter(user.profiles, { cute_name: 'Zucchini' })[0].members)[0];
    y4(profile);
    process.exit(1);

    // console.log(YAML.stringify(user, null, 4));
    // process.exit(1);

    // output.objectives = _.map(_.filter(_.map(profile.objectives, function(o, k) {
    //     return { key: k, status: o.status };
    // }), { status: 'ACTIVE' }), 'key');

    // output.quests = _.map(_.filter(_.map(profile.quests, function(o, k) {
    //     return { key: k, status: o.status };
    // }), { status: 'ACTIVE' }), 'key');

    output.fairy_souls_collected = profile.fairy_souls_collected;

    p4(profile.slayer_quest);

    output.pets = _.mapValues(profile.pets, function(o) {
        return {
            name: o.type.toLowerCase(),
            tier: getTier(o.tier.toLowerCase()),
            xp: o.exp,
        };
    });

    // acacia 7
    // birch 9
    // dark oak 6
    // jungle 9
    // oak 9
    // spruce 5

    // let x = profile.unlocked_coll_tiers.map(function(name) {
    //     if (name.includes('LOG_2')) {
    //         return name.replaceAll('LOG_2', 'Acacia Wood');
    //     }
    //     return name;
    // });
    // p4(x.sort());


    output.skills = [
        {
            name: 'combat',
            level: getLevel(profile.experience_skill_combat)
        },
        {
            name: 'mining',
            level: getLevel(profile.experience_skill_mining)
        },
        {
            name: 'farming',
            level: getLevel(profile.experience_skill_farming)
        },
        {
            name: 'foraging',
            level: getLevel(profile.experience_skill_foraging)
        },
        {
            name: 'fishing',
            level: getLevel(profile.experience_skill_fishing)
        },
        {
            name: 'alchemy',
            level: getLevel(profile.experience_skill_alchemy)
        },
        {
            name: 'enchanting',
            level: getLevel(profile.experience_skill_enchanting)
        },
        // {
        //     name: 'runecrafting',
        //     level: profile.experience_skill_runecrafting
        // },
        {
            name: 'taming',
            level: getLevel(profile.experience_skill_taming)
        },
        {
            name: 'carpentry',
            level: getLevel(profile.experience_skill_carpentry)
        },
    ];

    print(output);
}


function print(output) {
    // p4(output);

    console.log('fairy_souls_collected: ' + output.fairy_souls_collected);

    _.forEach(output.objectives, function(o) {
        console.log('objective: ' + o);
    });

    _.forEach(output.quests, function(o) {
        console.log('quests: ' + o);
    });

    console.log(printSkills(output.skills));
    console.log(printPets(output.pets));
}


function printPets(items) {
    console.log();
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


function printSkills(items) {
    console.log();
    return table(items, [
        {
            name: 'level',
            alias: '#',
            width: 2,
        },
        {
            name: 'name',
            alias: 'skill',
            width: -17,
        },
    ]);
}


function parse(args) {

    program
        .parse(args);

    let options = program.opts();

    p4(options);

    return options;
}
