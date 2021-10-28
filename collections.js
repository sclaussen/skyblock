'use strict'
// process.env.DEBUG = 'skyblock';
const d = require('debug')('skyblock');

const fs = require('fs');
const util = require('util');
const _ = require('lodash');

const YAML = require('yaml');
const moment = require('moment');
const clicolor = require('cli-color');
const program = require('commander');

const userlib = require('./lib/user');

const table = require('./lib/util').table;
const rj = require('./lib/util').rj;
const lj = require('./lib/util').lj;

const curl = require('./lib/curl');
const casey = require('./lib/casey');

const p = require('./lib/pr').p(d);
const e = require('./lib/pr').e(d);
const p4 = require('./lib/pr').p4(d);
const y4 = require('./lib/pr').y4(d);



var options;



collections(process.argv);



async function collections(args) {

    options = await parseArguments(args);

    let skyblockCollections = await getSkyblockCollections();
    let sortedSkyblockCollections = _.sortBy(skyblockCollections, [ 'group', 'name' ]);

    let collections = await getPlayerCollections();

    printCollections(skyblockCollections, collections, options);
}


// Returns an array of something like this:
//
// - group: fishing
//   name: sponge
//   tiers: 9
//   unlocks:
//     "01":
//       - Sponge Rod Recipe
//     "02":
//       - Sponge Trade
//     "03":
//       - Enchanted Sponge Recipe
//     "04":
//       - Sea Creature Talisman Recipe
//     "05":
//       - Stereo Pants Recipe
//     "06":
//       - Sea Creature Ring Recipe
//     "07":
//       - Enchanted Wet Sponge Recipe
//     "08":
//       - Sea Creature Artifact Recipe
//     "09":
//       - Sponge Helmet Recipe
//       - Sponge Chestplate Recipe
//       - Sponge Leggings Recipe
//       - Spongy Shoes Recipe
async function getSkyblockCollections() {
    let collections = [];

    let responseBody = (await curl.get('https://api.hypixel.net/resources/skyblock/collections')).body;

    for (let skyblockCollectionGroup of _.values(responseBody.collections)) {
        for (let skyblockCollection of _.values(skyblockCollectionGroup.items)) {

            let collection = {
                group: skyblockCollectionGroup.name.toLowerCase().replaceAll(' ', '_'),
                name: skyblockCollection.name.toLowerCase().replaceAll(' ', '_'),
                tiers: skyblockCollection.maxTiers,
                unlocks: {}
            };

            for (let tier of _.values(skyblockCollection.tiers)) {
                let level = tier.tier;
                if (parseInt(level) < 10) {
                    level = '0' + level;
                }
                collection.unlocks[level] = tier.unlocks;
            }

            collections.push(collection);
        }
    }
    y4(collections);

    return collections;
}


// Returns an array of items like this:
//
// - name: rotten_flesh
//   level: "07"
// - name: ghast_tear
//   level: "07"
// - name: pufferfish
//   level: "07"
// - name: nether_wart
//   level: "09"
async function getPlayerCollections(args) {

    let aliases = YAML.parse(fs.readFileSync('./dat/item_aliases.yaml', 'utf8'));
    let user = (await curl.get('https://api.hypixel.net/skyblock/profiles?uuid=' + options.uuid + '&key=' + options.key)).body;
    let profile = _.values(_.filter(user.profiles, { cute_name: options.profile })[0].members)[0];
    let collection = profile.unlocked_coll_tiers;


    //-------------------------------------------------------------------------------
    // The collection names returned by one API differ from those
    // returned from a different API so they need to be canonicalized,
    // that happens here.
    //
    // Names are lower cased.
    //
    // The level is also separated form the name.
    let newCollection = [];
    for (let name of collection) {

        if (name.includes('-1')) {
            continue;
        }


        let level = name.substring(name.lastIndexOf('_') + 1);
        if (parseInt(level) < 10) {
            level = '0' + level;
        }

        name = name.substring(0, name.lastIndexOf('_'));

        let newName = null;
        for (let alias of _.keys(aliases)) {
            if (name.includes(alias)) {
                p('replacing ' + alias  + ' with ' + aliases[alias]);
                newName = name.replace(alias, aliases[alias]);
                break;
            }
        }

        if (newName) {
            newCollection.push({
                name: newName,
                level: level
            });
        } else {
            newCollection.push({
                name: name.toLowerCase(),
                level: level
            });
        }
    }


    let levels = [];
    let collectionNames = _.uniq(_.map(newCollection, 'name'));
    for (let collectionName of collectionNames) {
        p(collectionName);
        let matches = _.sortBy(_.filter(newCollection, { name: collectionName }), [ 'level' ]);
        levels.push(matches[matches.length - 1]);
    }
    y4(levels);


    // Adding these because the API for the profile has not been
    // updated to return this new collection type yet.
    levels.push({
        name: 'gemstone',
        level: '04'
    });
    levels.push({
        name: 'gunpowder',
        level: '01'
    });

    return levels;
}


function printCollections(skyblockCollections, collections, options) {
    for (let skyblockCollection of skyblockCollections) {

        let playerCollection = _.find(collections, { name: skyblockCollection.name });
        if (!playerCollection) {
            console.log('ERROR: Unable to find the player collection: ' + skyblockCollection.name);
            process.exit(1);
        }

        // See if the collection has already been completed
        let collectionCompleted = '';
        if (playerCollection.level === skyblockCollection.tiers) {
            collectionCompleted = '✓';
        }

        if (playerCollection.level.startsWith('0')) {
            playerCollection.level = playerCollection.level.substring(1);
        }
        console.log(lj(collectionCompleted, 2) + skyblockCollection.name + ' (' + playerCollection.level + ' of ' + skyblockCollection.tiers + ' tiers)');
        if (collectionCompleted === '✓') {
            if (options.unlocked) {
                console.log();
                continue;
            }
        }

        for (let tier of _.keys(skyblockCollection.unlocks).sort()) {
            for (let unlock of skyblockCollection.unlocks[tier]) {

                let tierCompleted = '';
                if (parseInt(tier) <= playerCollection.level) {
                    tierCompleted = '✓';
                }

                if (options.locked && tierCompleted === '✓') {
                    continue;
                }

                if (tier.startsWith('0')) {
                    tier = tier.substring(1);
                }
                console.log('  ' + lj(tierCompleted, 3) + rj(tier, 2) + ' ' + lj(skyblockCollection.group + ' ' + skyblockCollection.name, 20) + ' ' +  unlock.toLowerCase());
            }
        }

        console.log();
    }
}


async function parseArguments(args) {

    program
        .option('-l, --locked', 'Only list the locked tiers')
        .addHelpText('after', `
List all collections and both unlocked and locked tiers:
  $ node collections

Only list the incomplete locked collection tiers:
  $ node collections -l
`)
        .parse(args);

    let options = program.opts();

    // Get the environment variables
    options.user = userlib.getUser();
    options.uuid = await userlib.getUuid();
    options.profile = userlib.getProfile();
    options.key = userlib.getKey();


    // p4(options);

    return options;
}
