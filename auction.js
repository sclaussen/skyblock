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

    // Call the skyblock API to fetch and cache the auctions if the
    // -r flag was specified
    if (options.fetch) {
        await writeCache();
    }

    // Read in the auction items from the cache
    auctions = await readCache();

    // Find the auctions containing the user specified phrase
    let auctionsMatchingPhrase = filter(auctions, function(o) {

        // Do not include the item if it was already claimed
        if (o.claimed) {
            return false;
        }


        // Match correct phrase
        let phrase = options.phrase;
        if (options.book) {
            phrase = 'enchanted book';
        }
        if (options.level) {
            if (!phrase.includes(' pet')) {
                phrase = options.phrase + ' pet';
            }
        }
        if (!o.item_name.includes(phrase)) {
            return false;
        }


        // If it is a book, match the specific book enchantment name in the extra field
        if (options.book) {
            if (o.extra.toLowerCase().includes('enchanted book enchanted book ' + options.phrase)) {
                return false;
            }
        }


        // If a level is specified, match the level in the item's name
        if (options.level) {
            let level = 'L' + options.level.padStart(3, '0');
            if (!o.reforge.includes(level)) {
                return false;
            }
        }


        // If a tier is specified match that tier
        if (options.tier) {
            if (!o.tier.includes(options.tier)) {
                return false;
            }
        }

        return true;
    });


    // If BIN, sort by cost (within each unique item).
    // If auction, sort by auction ending time
    let sortedAuctions;
    if (options.auctions && !options.cost) {
        sortedAuctions = sortBy(auctionsMatchingPhrase, [ 'category', 'item_name', 'tier', 'end' ]);
    } else {
        sortedAuctions = sortBy(auctionsMatchingPhrase, [ 'category', 'item_name', 'tier', 'starting_bid' ]);
    }

    printAuctions(sortedAuctions);
}

function printAuctions(auctions) {
    let count = 0;
    for (let auction of auctions) {

        // If there's no auction flag indicating we should be
        // including auctions, and the current item isn't a BIN item,
        // skip it
        if (auction.type === 'AUC' && !options.auctions) {
            continue;
        }

        // Build this string to print out a row
        let s = '';

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

        count++;
        if (options.output) {
            if (count === parseInt(options.output)) {
                return;
            }
        }
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

        // wip
        let bookAlias = {
            sharpness: {
                '1-comm': '1-4',
                '2-unco': 5
            },
            efficiency: {
                '1-comm': '1-4',
                '2-unco': 5
            }
        };


        auctions.push({
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
        'heavy',
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

        // Stonk
        'fruitful',
        'refined',
        'magnetic',

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
        .option('-b, --book', 'Only include enchanted books')
        .option('-c, --cost', 'If including auctions, sort by cost (default is auction ending time)')
        .option('-f, --fetch', 'Refresh the local auction cache using the skyblock API')
        .option('-k, --thousands', 'Express coins in terms of K (useful for calculating avg/total cost)')
        .option('-l, --level <level>', 'Pet level (eg 1, 99, 100)')
        .option('-t, --tier <tier>', 'Tier level (eg epic, lege, comm, unco, rare)')
        .option('-o, --output <output>', 'Limit output to the first N items')
        .option('-x, --extra', 'Add the additional metadata to the match')
        .parse(args);

    let options = program.opts();
    options.phrase = program.args[0].toLowerCase();

    if (options.book) {
        options.extra = true;
    }

    // p4(options);

    return options;
}
