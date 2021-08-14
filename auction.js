'use strict';
process.env.DEBUG = 'skyblock';
const d = require('debug')('skyblock');

const fs = require('fs');
const util = require('util');
const _ = require('lodash');

const YAML = require('yaml');
const moment = require('moment');

const curl = require('./curl');
const p = require('./pr').p(d);
const p4 = require('./pr').p4(d);

const { sortBy, deburr, groupBy, orderBy, toLower, map, uniq, filter } = _

auction(process.argv);


var items = [];


// Usage: node auction keyword [r]
async function auction(args) {

    // What search phrase are we looking for???
    let searchPhrase = args[2].toLowerCase();

    // Either redo all the calls and cache them, or just read the cache
    if (args[3] && args[3] === 'r') {
        await writeCache();
    }

    items = await readCache();

    let filteredItems = sortBy(filter(items, function(o) {
        return toLower(deburr(o.item_name)).includes(searchPhrase);
    }), 'category', 'item_name', 'tier', 'end');

    for (let item of filteredItems) {
        console.log((item.starting_bid + '').padStart(10, ' '),
                    item.category.padEnd(5, ' '),
                    item.tier.padEnd(5, ' '),
                    item.bin.padStart(5, ' '),
                    priceFmt(item.starting_bid),
                    priceFmt(item.highest_bid_amount),
                    item.reforge.padStart(20, ' '),
                    item.item_name.padEnd(40, ' '),
                    dateFmt(item.end).padEnd(15, ' '));
    }
}

function priceFmt(n) {
    let s = '';
    if (n && n !== 0) {
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

    return (n.toLocaleString("en-US") + s).padStart(7, ' ') + ' ';
}

function dateFmt(n) {
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
    console.log();

    // Cache the items array to a file
    fs.writeFileSync('./auction.json', JSON.stringify(items, null, 4));
}

function parseResponse(skyblockAuctions) {
    for (let auction of skyblockAuctions.auctions) {
        items.push({
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
            bin: auction.bin
        });
    }
}


async function readCache() {
    let tier = {
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

    let category = {
        weapon: 'weap',
        armor: 'armo',
        accessories: 'acce',
        misc: 'misc',
        blocks: 'bloc',
        consumables: 'cons',
    };

    let items = [];

    let auctionsString = fs.readFileSync('./auction.json');
    let auctions = JSON.parse(auctionsString);
    for (let auction of auctions) {

        // Convert pet names from
        // FROM: [Lvl 1] Monkey
        //   TO: [001] monkey
        let itemName = auction.item_name;
        let reforge = '';
        if (itemName.startsWith('[lvl')) {
            let rightSquareBracketIndex = itemName.indexOf(']');
            reforge = 'L' + itemName.substring(itemName.indexOf(' ') + 1, rightSquareBracketIndex).padStart(3, '0'); // converts the 1 to 001
            itemName = itemName.substring(rightSquareBracketIndex + 2) + ' pet';
        } else {
            let reforgeAndItemName = parseReforge(itemName);
            reforge = reforgeAndItemName[0];
            itemName = reforgeAndItemName[1];
        }

        if (!tier[auction.tier]) {
            console.log('Unknown tier: ' + auction.tier);
            process.exit(1);
        }

        let bin = '';
        if (auction.bin) {
            bin = 'BIN';
        }

        items.push({
            uuid: auction.uuid,
            profile_id: auction.profile_id,
            start: auction.start,
            end: auction.end,
            item_name: itemName,
            reforge: reforge,
            extra: auction.extra,
            category: category[auction.category],
            tier: tier[auction.tier],
            starting_bid: auction.starting_bid,
            claimed: auction.claimed,
            highest_bid_amount: auction.highest_bid_amount,
            bids: auction.bids,
            bin: bin
        });
    }

    return items;
}


function parseReforge(itemName) {
    let reforges = [
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
        'spicy',
        'jaded',
        'mythic',
        'ancient',
        'fierce',
        'loving',
        'light',
        'necrotic',
        'smart',
        'renowned',
        'spiked',
        'suspicious',
        'warped',
        'wise',

        'pure',
        'reinforced',
        'heavy',
        'godly',
        'clean',
        'superior',
        'titanic',
        'cubic'
    ];

    for (let reforge of reforges) {
        if (itemName.startsWith(reforge)) {
            return [ reforge, itemName.substring(reforge.length) + 4 ]
        }
    }

    return [ 'NOR', itemName ];
}
