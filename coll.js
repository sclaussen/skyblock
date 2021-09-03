'use strict'
process.env.DEBUG = 'skyblock';
const d = require('debug')('skyblock');

const fs = require('fs');
const util = require('util');
const _ = require('lodash');

const YAML = require('yaml');
const moment = require('moment');
const clicolor = require('cli-color');
const program = require('commander');

const rj = require('./lib/util').rj;
const lj = require('./lib/util').lj;

const curl = require('./lib/curl');
const casey = require('./lib/casey');
const p = require('./lib/pr').p(d);
const e = require('./lib/pr').e(d);
const p4 = require('./lib/pr').p4(d);

const { sortBy, deburr, groupBy, orderBy, toLower, map, uniq, filter } = _

var options;

collections(process.argv);

async function collections(args) {

    options = parse(args);

    let skyblockCollections = await readSkyblockCollections();
    let sortedSkyblockCollections = sortBy(skyblockCollections, [ 'group', 'name' ]);
    let collections = YAML.parse(fs.readFileSync('./collections.yaml', 'utf8'));

    for (let collection of sortedSkyblockCollections) {

        if (!collections[collection.name]) {
            console.log('ERROR: Unable to find ' + collection.name + ' in collections.yaml');
            process.exit(1);
        }

        // See if the collection has already been completed
        let collectionCompleted = '';
        if (collections[collection.name] === collection.tiers) {
            collectionCompleted = '✓';
        }

        console.log(lj(collectionCompleted, 2) + collection.name + ' (' + collections[collection.name] + ' of ' + collection.tiers + ' tiers)');
        if (collectionCompleted === '✓') {
            if (options.unlocked) {
                console.log();
                continue;
            }
        }

        for (let tier of _.keys(collection.unlocks)) {
            for (let unlock of collection.unlocks[tier]) {

                let tierCompleted = '';
                if (tier <= collections[collection.name]) {
                    tierCompleted = '✓';
                }

                if (options.locked && tierCompleted === '✓') {
                    continue;
                }

                console.log('  ' + lj(tierCompleted, 3) + rj(tier, 2) + ' ' + lj(collection.group + ' ' + collection.name, 20) + ' ' +  unlock.toLowerCase());
            }
        }
        console.log();
    }
}

async function readSkyblockCollections() {
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
                collection.unlocks[tier.tier] = tier.unlocks;
            }

            collections.push(collection);
        }
    }

    return collections;
}

function parse(args) {

    program
        .option('-l, --locked', 'Only list the locked tiers')
        .parse(args);

    let options = program.opts();

    // p4(options);

    return options;
}
