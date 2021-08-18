'use strict';
process.env.DEBUG = 'skyblock';
const d = require('debug')('skyblock');

const fs = require('fs');
const util = require('util');
const _ = require('lodash');

const YAML = require('yaml');
const moment = require('moment');
const program = require('commander');

const curl = require('./curl');
const p = require('./pr').p(d);
const p4 = require('./pr').p4(d);

const { sortBy, deburr, groupBy, orderBy, toLower, map, uniq, filter } = _


auction(process.argv);


var auctions = [];
var options;


// Usage: node auction keyword [r]
async function auction(args) {

    // Parse the options
    options = parse(args);

    // Call the skyblock API to retrieve and cache the auctions if the
    // -r flag was specified
    if (options.retrieve) {
        await writeCache();
    }

    // Read in the auction items from the cache
    auctions = await readCache();

    // Find the auctions containing the user specified phrase
    let auctionsMatchingPhrase = filter(auctions, function(o) {
        if (options.noreforge) {
            return o.item_name.includes(options.phrase) && o.reforge === 'NA' && !o.claimed;
        }

        if (options.level) {
            let level = 'L' + options.level.padStart(3, '0');
            return o.item_name.includes(options.phrase) && o.reforge === level && !o.claimed;
        }

        return o.item_name.includes(options.phrase) && !o.claimed;
    });


    // If BIN matches are requested (with or without the auction
    // items), sort by cost (within each unique item).  If auction
    // only, sort by time until the auction ends.
    // auction.
    let sortedAuctions;
    if (options.auctions && !options.cost) {
        sortedAuctions = sortBy(auctionsMatchingPhrase, [ 'category', 'item_name', 'tier', 'end' ]);
    } else {
        sortedAuctions = sortBy(auctionsMatchingPhrase, [ 'category', 'item_name', 'tier', 'starting_bid' ]);
    }

    // Print everything out that matched the criteria
    printAuctions(sortedAuctions);
}

function printAuctions(auctions) {
    for (let auction of auctions) {

        // If there's no auction flag indicating we should be
        // including auctions, and the current item isn't a BIN item,
        // skip it
        if (auction.type === 'AUC' && !options.auctions) {
            continue;
        }

        // Build this string to print out a row
        let s = '';

        // UUID
        if (options.uuid) {
            s += lj(auction.uuid, 34);
        }

        // RAW STARTING BID
        if (auction.average) {
            s += rj(auction.starting_bid, 10);
        }

        // CATEGORY
        s += lj(auction.category, 7);

        // TIER
        s += lj(auction.tier, 5);

        // STARTING_BID (FORMATTED)
        s += rj(coins(auction.starting_bid), 9);

        // BIN or NOT
        if (options.auctions) {
            s += ' ' + lj(auction.type, 5);
        }

        // REFORGE
        s += rj(auction.reforge, 20);
        s += ' ';

        // ITEM NAME
        s += lj(auction.item_name.replace(/ /g, 'X').replace(/\W/g, '+').replace(/X/g, ' '), 40);

        if (options.auctions) {

            // HIGHEST BID AMOUNT
            if (options.auctions) {
                s += rj(coins(auction.highest_bid_amount), 7) + ' ';
            }

            // BIDS
            if (auction.bids > 0) {
                s += rj(auction.bids, 3) + ' ';
            } else {
                s += rj('', 3) + ' ';
            }

            // AUCTION END TIME
            s += lj(time(auction.end), 15)
        }

        // EXTRA METADATA
        if (options.extra) {
            s += auction.extra.toLowerCase();
        }

        console.log(s);
    }
}

// Right justify
function rj(s, n) {
    return s.toString().padStart(n, ' ');
}

// Left justify
function lj(s, n) {
    return s.toString().padEnd(n, ' ');
}

function coins(n) {
    let s = '';
    if (n === 0) {
        return s;
    }

    if (options.thousands) {
        s = 'K';
        n = (n / 1000).toFixed(0);
    } else {

        if (n < 1000) {
            s = 'K';
            n = (n / 1000).toFixed(1);
        } else if (n < 1000000) {
            s = 'K';
            n = (n / 1000).toFixed(0);
        } else {
            s = 'M';
            n = (n / 1000000).toFixed(1);
        }
    }

    return (n.toLocaleString("en-US") + s);
}

function time(n) {
    let datetime = moment(n);
    return datetime.fromNow();
}

async function writeCache() {
    process.stdout.write('Retrieving auctions.');

    // Get the first (0th) page of auctions, and transform all its auction entries
    let skyblockAuctions = (await curl.get('https://api.hypixel.net/skyblock/auctions')).body;
    let pages = skyblockAuctions.totalPages;
    parseResponse(skyblockAuctions);

    // Now get the remaining pages, transforming each auction entry as we go
    for (let page = 1; page < pages; page++) {
        process.stdout.write('.');
        skyblockAuctions = (await curl.get('https://api.hypixel.net/skyblock/auctions?page=' + page)).body;
        parseResponse(skyblockAuctions);
    }

    // Cache the auctions array to a file
    fs.writeFileSync('./auction.json', JSON.stringify(auctions, null, 4));
}

function parseResponse(skyblockAuctions) {
    for (let auction of skyblockAuctions.auctions) {
        let bin = 'BIN';
        if (!auction.bin) {
            bin = 'AUC';
        }

        auctions.push({
            uuid: auction.uuid,
            profile_id: auction.profile_id,
            start: auction.start,
            end: auction.end,
            item_name: auction.item_name.toLowerCase(),
            extra: auction.extra,
            category: auction.category.toLowerCase(),
            tier: auction.tier.toLowerCase(),
            starting_bid: auction.starting_bid,
            claimed: auction.claimed,
            highest_bid_amount: auction.highest_bid_amount,
            bids: auction.bids.length,
            type: bin
        });
    }
}


async function readCache() {

    let auctions = [];

    let auctionsString = fs.readFileSync('./auction.json');
    let skyblockAuctions = JSON.parse(auctionsString);
    for (let auction of skyblockAuctions) {

        let itemName = auction.item_name;
        let reforge = '';
        if (itemName.startsWith('[lvl')) {
            // Convert pet names from
            // FROM: [Lvl 1] Monkey
            //   TO: [001] monkey
            let rightSquareBracketIndex = itemName.indexOf(']');
            reforge = 'L' + itemName.substring(itemName.indexOf(' ') + 1, rightSquareBracketIndex).padStart(3, '0'); // converts the 1 to 001
            itemName = itemName.substring(rightSquareBracketIndex + 2) + ' pet';
        } else {
            let reforgeAndItemName = parseReforge(itemName);
            reforge = reforgeAndItemName[0];
            itemName = reforgeAndItemName[1];
        }

        let categoryAlias = {
            weapon: '1-weap',
            armor: '2-armo',
            accessories: '3-acce',
            misc: '4-misc',
            blocks: '5-bloc',
            consumables: '6-cons',
        };
        let category = categoryAlias[auction.category];
        if (!category) {
            console.log('Unknown category: ' + auction.category);
        }


        let tierAlias = {
            common: '1-comm',
            uncommon: '2-unco',
            rare: '3-rare',
            epic: '4-epic',
            legendary: '5-lege',
            mythic: '6-myth',
            supreme: '7-supr',
            special: '8-spec',
            very_special: '9-vspe'
        };
        let tier = tierAlias[auction.tier];
        if (!category) {
            console.log('Unknown tier: ' + auction.tier);
        }

        auctions.push({
            uuid: auction.uuid,
            profile_id: auction.profile_id,
            start: auction.start,
            end: auction.end,
            item_name: itemName,
            reforge: reforge,
            extra: auction.extra,
            category: category,
            tier: tier,
            starting_bid: auction.starting_bid,
            claimed: auction.claimed,
            highest_bid_amount: auction.highest_bid_amount,
            bids: auction.bids,
            type: auction.type
        });
    }

    return auctions;
}


function parseReforge(itemName) {
    let reforges = [
        // 'dirty',
        // 'epic',
        // 'fabled',
        // 'fair',
        // 'fast',
        // 'gentle',
        // 'heroic',
        // 'legendary',
        // 'odd',
        // 'sharp',
        // 'spicy',
        // 'jaded',
        // 'mythic',
        // 'ancient',
        // 'fierce',
        // 'loving',
        // 'light',
        // 'necrotic',
        // 'smart',
        // 'renowned',
        // 'spiked',
        // 'suspicious',
        // 'warped',
        // 'wise',

        // 'pure',
        // 'reinforced',
        // 'heavy',
        // 'godly',
        // 'clean',
        // 'superior',
        // 'titanic',
        // 'cubic',

        // Bat person
        'candied',

        // Flower of truth
        'withered',

        // Unstable
        'light',
        'titanic',
        'reinforced',
        'forceful',
        'unpleasant',

        // Magna Bow
        'grand',
        'hasty',
        'neat',
        'precise',
        'rapid',
        'spiritual',
        'unreal',
        'rich',
        'deadly',
        'awkward',
        'fine',

        // Juju
        'headstrong',

        // Superior Dragon Armor
        'jaded',
        'ridiculous',
        'loving',
        'strong',

        // Strong Dragon Armor
        'smart',
        'renowned',
        'clean',
        'giant',
        'necrotic',
        'godly',
        'ancient',
        'cubic',
        'fierce',
        'mythic',
        'pure',
        'spiked',
        'wise',

        // Aspect of the End
        'dirty',
        'epic',
        'fabled',
        'fair',
        'fast',
        'gentle',
        'heroic',
        'legendary',
        'odd',
        'sharp',
        'superior',
        'spicy',
        'suspicious',
        'warped',
    ];

    for (let reforge of reforges) {
        if (itemName.startsWith(reforge)) {
            return [ reforge, itemName.substring(reforge.length + 1) ];
        }
    }

    return [ 'NA', itemName ];
}


function parse(args) {

    program
        .argument('<phrase>', 'The phrase to search for')
        .option('-a, --auctions', 'Include auctions (BIN is the default)')
        .option('-c, --cost', 'If including auctions, sort by cost (default is auction ending time)')
        .option('-l, --level <level>', 'Pet level (eg 1, 99, 100)')
        .option('-n, --noreforge', 'Exclude reforges')
        .option('-x, --extra', 'Add the additional metadata to the match')
        .option('-r, --retrieve', 'Refresh the local auction cache using the skyblock API')
        .option('-v, --average', 'Include the raw selling price to support averaging')
        .option('-u, --uuid', 'Add uuid to the output')
        .option('-k, --thousands', 'Express coins in terms of K')
        .parse(args);

    let options = program.opts();
    options.phrase = program.args[0];

    // p4(options);

    return options;
}
