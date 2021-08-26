!'use strict';
process.env.DEBUG = 'skyblock';
const d = require('debug')('skyblock');

const fs = require('fs');
const util = require('util');
const _ = require('lodash');

const YAML = require('yaml');
const moment = require('moment');
const clicolor = require('cli-color');
const program = require('commander');

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

    let collections = await readSkyblockCollections();
    let sortedCollections = sortBy(collections, [ 'name' ]);

    for (let collection of sortedCollections) {
        console.log(collection.name + ' (' + collection.tiers + ' tiers)');
        for (let tier of _.keys(collection.unlocks)) {
            for (let unlock of collection.unlocks[tier]) {
                // console.log('  ' + tier + ': ' + unlock);
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
                name: skyblockCollectionGroup.name + '::' + skyblockCollection.name,
                tiers: skyblockCollection.maxTiers,
                unlocks: {}
            };

            for (let tier of _.values(skyblockCollection.tiers)) {
                collection.unlocks[tier.tier] = tier.unlocks;
            }

            // item.trackerUrl = getTrackerUrl(item.name);
            // item.fandomUrl = getFandomUrl(item.name);

            collections.push(collection);
        }
    }

    // p4(collections);
    return collections;
}

// Right justify
function rj(s, n) {
    return s.toString().padStart(n, ' ');
}

// Left justify
function lj(s, n) {
    return s.toString().padEnd(n, ' ');
}

function getTrackerUrl(itemName) {
    let url = {
        enchanted_endstone: 'enchanted_end_stone'
    };

    let baseUrl = itemName.toLowerCase();
    if (url[baseUrl]) {
        baseUrl = url[baseUrl];
    }

    return 'https://bazaartracker.com/product/' + baseUrl;
}

function getFandomUrl(itemName) {
    let url = {
        Enchanted_Slime_Ball: 'Enchanted_Slimeball',
        Pork: 'Raw_Porkchop',
        Hay_Block: 'Hay_Bale',
    };

    let snakeCased = casey(itemName).snakeCased;
    let baseUrl = casey(snakeCased).capitalizedWithUnderscores;
    if (url[baseUrl]) {
        baseUrl = url[baseUrl];
    }

    return 'https://hypixel-skyblock.fandom.com/wiki/' + baseUrl + '#Usage';
}

function parse(args) {

    program
        .parse(args);

    let options = program.opts();

    p4(options);

    return options;
}
