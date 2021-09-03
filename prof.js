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


profile(process.argv);


async function profile(args) {

    options = parse(args);

    let user = (await curl.get('https://api.hypixel.net/skyblock/profiles?uuid=' + process.env.SKYBLOCK_UUID + '&key=' + process.env.SKYBLOCK_KEY)).body;


    let output = {};

    let profile = _.values(_.filter(user.profiles, { cute_name: 'Zucchini' })[0].members)[0];
    console.log(YAML.stringify(user, null, 4));
    process.exit(1);

    output.objectives = _.map(_.filter(_.map(profile.objectives, function(o, k) {
        return { key: k, status: o.status };
    }), { status: 'ACTIVE' }), 'key');

    output.quests = _.map(_.filter(_.map(profile.quests, function(o, k) {
        return { key: k, status: o.status };
    }), { status: 'ACTIVE' }), 'key');

    output.fairySoulsCollected = profile.fairy_souls_collected;

    // let slayerTier = profile.slayer_quest.tier;

    output.pets = _.mapValues(profile.pets, function(o) {
        return {
            name: o.type.toLowerCase(),
            tier: getTier(o.tier.toLowerCase()),
            xp: o.exp,
        };
    });

    output.unlockedCollectionTiers = profile.unlocked_coll_tiers;

    output.skills = {
        runecrafting: profile.experience_skill_runecrafting,
        mining: profile.experience_skill_mining,
        alchemy: profile.experience_skill_alchemy,
        taming: profile.experience_skill_taming,
        combat: profile.experience_skill_combat,
        farming: profile.experience_skill_farming,
        enchanting: profile.experience_skill_enchanting,
        fishing: profile.experience_skill_fishing,
        foraging: profile.experience_skill_foraging,
        carpentry: profile.experience_skill_carpentry,
    };

    print(output);
}

function print(output) {
    p4(output);

    console.log('fairy_soles_collected: ' + output.fairy_soles_collected);

    _.forEach(output.objectives, function(o) {
        console.log('objective: ' + o);
    });

    _.forEach(output.quests, function(o) {
        console.log('quests: ' + o);
    });

    _.forEach(_.keys(output.skills), function(key) {
        console.log(key + ': ' + Number.parseFloat(output.skills[key]).toFixed(0));
    });

    printPets(output.pets);
}

function printPets(items) {
    items = _.sortBy(items, [ 'tier' ]).reverse();
    table(items, [
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
    ], {});
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
