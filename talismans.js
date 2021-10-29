'use strict';
// process.env.DEBUG = 'skyblock';
const d = require('debug')('skyblock');

const fs = require('fs');
const _ = require('lodash');

const YAML = require('yaml');
var program = require('commander');
const { parse, writeUncompressed } = require('prismarine-nbt')

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



talismans(process.argv);



async function talismans(args) {

    // Parse the command line options
    options = await parseArguments(args);

    let user = (await curl.get('https://api.hypixel.net/skyblock/profiles?uuid=' + options.uuid + '&key=' + options.key)).body;
    let profile = _.values(_.filter(user.profiles, { cute_name: options.profile })[0].members)[0];

    let buffer = new Buffer.from(profile.talisman_bag.data, 'base64');
    const { parsed, type } = await parse(buffer);


    let talismans = [];

    for (let o of parsed.value.i.value.value) {
        if (!o.tag) {
            continue;
        }


        // Get several of the key fields
        let metadataList = o.tag.value.display.value.Lore.value.value;
        let name = removeSpecialCharacters(o.tag.value.display.value.Name.value).toLowerCase();
        let tier = removeSpecialCharacters(metadataList[metadataList.length - 1]).toLowerCase();
        tier = getTier(tier.substring(0, tier.indexOf(' ')));
        let tierDisplay = tier.substring(2);
        let reforge = getReforgeFromName(name);
        if (reforge) {
            name = name.substring(reforge.length + 1);
        }


        // Remove the tier from the metadata list
        delete metadataList[metadataList.length - 1];


        let talisman = {};
        let description = ''
        for (let metadata of metadataList) {
            if (metadata === '' || !metadata) {
                continue;
            }

            let specialFieldFound = false;
            let metadata2 = removeSpecialCharacters(metadata);
            let fields = [ 'Strength', 'Crit Chance', 'Crit Damage', 'Health', 'Intelligence', 'Mining Speed' ];
            for (let field of fields) {
                if (metadata2.startsWith(field)) {
                    specialFieldFound = true;

                    // Handle the special fields
                    let key = field.toLowerCase().replaceAll(' ', '_');
                    let value = metadata2.replaceAll(field + ': ', '').replace('+', '');
                    if (value.indexOf(' ') > 0) {
                        value = value.substring(0, value.indexOf(' '));
                    }
                    talisman[key] = value;
                    break;
                }
            }

            if (!specialFieldFound) {
                // If not a special field add the value to the description
                description += ' ' + metadata2;
            }
        }

        talisman.name = name;
        talisman.tier = tier;
        talisman.tier_display = tierDisplay;
        talisman.reforge = reforge;
        talisman.description = description.trim();

        talismans.push(talisman);
    }

    y4(talismans);

    console.log(print(_.sortBy(talismans, [ 'tier', 'name' ])));
}


function clone(o) {
    return JSON.parse(JSON.stringify(o));
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
