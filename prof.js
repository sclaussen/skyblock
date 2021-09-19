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


const { lfilter, sortBy, values,  } = _


var options;


var levels = [
    {
        name: 1,
        points: 50
    },
    {
        name: 2,
        points: 175
    },
    {
        name: 3,
        points: 375
    },
    {
        name: 4,
        points: 675
    },
    {
        name: 5,
        points: 1175
    },
    {
        name: 6,
        points: 1925
    },
    {
        name: 7,
        points: 2925
    },
    {
        name: 8,
        points: 4425
    },
    {
        name: 9,
        points: 6425
    },
    {
        name: 10,
        points: 9925
    },
    {
        name: 11,
        points: 14925
    },
    {
        name: 12,
        points: 22425
    },
    {
        name: 13,
        points: 32425
    },
    {
        name: 14,
        points: 47425
    },
    {
        name: 15,
        points: 67425
    },
    {
        name: 16,
        points: 97425
    },
    {
        name: 17,
        points: 147425
    },
    {
        name: 18,
        points: 222425
    },
    {
        name: 19,
        points: 322425
    },
    {
        name: 20,
        points: 522425
    },
    {
        name: 21,
        points: 822425
    },
    {
        name: 22,
        points: 1222425
    },
    {
        name: 23,
        points: 1722425
    },
    {
        name: 24,
        points: 2322425
    },
    {
        name: 25,
        points: 3022425
    },
    {
        name: 26,
        points: 3822425
    },
    {
        name: 27,
        points: 4722425
    },
    {
        name: 28,
        points: 5722425
    },
    {
        name: 29,
        points: 6822425
    },
    {
        name: 30,
        points: 8022425
    },
    {
        name: 31,
        points: 9322425
    },
    {
        name: 32,
        points: 10722425
    },
    {
        name: 33,
        points: 12222425
    },
    {
        name: 34,
        points: 13822425
    },
    {
        name: 35,
        points: 15522425
    },
    {
        name: 36,
        points: 17322425
    },
    {
        name: 37,
        points: 19222425
    },
    {
        name: 38,
        points: 21222425
    },
    {
        name: 39,
        points: 23322425
    },
    {
        name: 40,
        points: 25522425
    },
    {
        name: 41,
        points: 27822425
    },
    {
        name: 42,
        points: 30222425
    },
    {
        name: 43,
        points: 32722425
    },
    {
        name: 44,
        points: 35322425
    },
    {
        name: 45,
        points: 38072425
    },
    {
        name: 46,
        points: 40972425
    },
    {
        name: 47,
        points: 44072425
    },
    {
        name: 48,
        points: 47472425
    },
    {
        name: 49,
        points: 51172425
    },
    {
        name: 50,
        points: 55172425
    },
    {
        name: 51,
        points: 59472425
    },
    {
        name: 52,
        points: 64072425
    },
    {
        name: 53,
        points: 68972425
    },
    {
        name: 54,
        points: 74172425
    },
    {
        name: 55,
        points: 79672425
    },
    {
        name: 56,
        points: 85472425
    },
    {
        name: 57,
        points: 91572425
    },
    {
        name: 58,
        points: 97972425
    },
    {
        name: 59,
        points: 104672425
    },
    {
        name: 60,
        points: 111672425
    },
];


profile(process.argv);


function getLevel(points) {
    return _.filter(levels, function(o) {
        return o.points > points;
    })[0].name;
}


async function profile(args) {

    options = parse(args);

    let user = (await curl.get('https://api.hypixel.net/skyblock/profiles?uuid=' + process.env.SKYBLOCK_UUID + '&key=' + process.env.SKYBLOCK_KEY)).body;


    let output = {};

    let profile = _.values(_.filter(user.profiles, { cute_name: 'Zucchini' })[0].members)[0];

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
        .arguments('[user]', 'Username', 'PsychoticKizar')
        .arguments('[profile]', 'Profile', 'Zucchini')
        .parse(args);

    let options = program.opts();

    p4(options);

    return options;
}
