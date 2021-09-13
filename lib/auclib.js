'use strict';
process.env.DEBUG = 'skyblock';
const d = require('debug')('skyblock');

const fs = require('fs');
const util = require('util');
const _ = require('lodash');
const { execSync } = require('child_process');
const { parse, writeUncompressed } = require('prismarine-nbt')

const YAML = require('yaml');
const moment = require('moment');

const getTrackerUrl = require('./util').getTrackerUrl;
const getFandomUrl = require('./util').getFandomUrl;
const getTier = require('./util').getTier;
const getCategory = require('./util').getCategory;
const table = require('./util').table;

const curl = require('./curl');

const p = require('./pr').p(d);
const p4 = require('./pr').p4(d);
const e = require('./pr').e(d);
const ex = require('./pr').ex(d);



const cache = './.auction-items';
const reforges = YAML.parse(fs.readFileSync('reforges.yaml', 'utf8'), { prettyErrors: true });
const enchantments = YAML.parse(fs.readFileSync('enchantments.yaml', 'utf8'), { prettyErrors: true });


async function writeAuctionItemsCache() {

    // Collection of auctions that will be built based on API calls
    // then cached to a file
    let items = [];

    // Get the first (0th) page of auctions, and transform all its auction entries
    let body = (await curl.get('https://api.hypixel.net/skyblock/auctions')).body;
    addItemsToCache(items, body.auctions);

    // Now get the remaining pages, transforming each auction entry as we go
    process.stdout.write('Retrieving auctions (' + body.totalPages + ' pages).');
    for (let page = 1; page < body.totalPages; page++) {
        if (page % 10 === 0) {
            process.stdout.write('.'); // progress bar, one '.' per 10 pages
        }
        body = (await curl.get('https://api.hypixel.net/skyblock/auctions?page=' + page)).body;
        addItemsToCache(items, body.auctions);
    }
    console.log();

    // Cache the auctions array to a file
    console.log('Caching ' + _.keys(items).length + ' auctions.');
    fs.rmSync(cache, { force: true });
    fs.writeFileSync(cache, JSON.stringify(items, null, 4));
}

function addItemsToCache(items, skyblockItems) {
    if (!skyblockItems) {
        return;
    }

    for (let item of skyblockItems) {

        // Skip claimed items
        if (item.claimed) {
            continue;
        }

        let bin = 'BIN';
        if (!item.bin) {
            bin = 'AUC';
        }

        items.push({
            name: item.item_name.toLowerCase(),
            type: bin,
            cost: item.starting_bid,
            tier: item.tier.toLowerCase(),
            extra: item.extra.toLowerCase(),
            lore: item.item_lore.toLowerCase(),
            item_bytes: item.item_bytes,
            highest_bid: item.highest_bid,
            end: item.end,
        });
    }
}

async function readAuctionItemsCache() {
    let items = JSON.parse(fs.readFileSync('./.auction-items'));
    for (let item of items) {
        let enchantmentsFound = getEnchantmentsFromExtra(item.extra);
        item.enchantments = enchantmentsFound.sort().join(' ');
        item.stars = getStarsFromName(item.name) || '';
        item.reforge = getReforgeFromName(item.name) || ''
        item.upgraded = getUpgradedFromName(item.name) || '';
        item.pet_level = getPetLevelFromName(item.name) || '';
        item.tier = getTier(item.tier);
        item.trackerUrl = getTrackerUrl(item.name);
        item.fandomUrl = getFandomUrl(item.name);
        item.sell = 0;
        item.margin = 0;

        // This should be last, many things are extracted from
        // item.name so they should be done prior
        item.name = await getName(item.name, item.item_bytes, enchantmentsFound);
    }

    return items;
}

function getEnchantmentsFromExtra(extra) {
    let enchantmentsFound = [];
    for (let enchantment of _.keys(enchantments)) {
        if (extra.includes(enchantment)) {
            enchantmentsFound.push(enchantments[enchantment]);
        }
    }

    return enchantmentsFound;
}

async function getName(name, enchantmentsFound, itemBytes) {

    // Remove all special characters
    name = removeSpecialCharacters(name);

    // Remove [lvl x] from the item name for pets, add " pet" to name
    if (name.startsWith('[lvl')) {
        let rightSquareBracketIndex = name.indexOf(']');
        name = name.substring(rightSquareBracketIndex + 2) + ' pet';
    }

    // Remove all the reforge names
    let reforge = getReforgeFromName(name);
    if (reforge) {
        name = name.substring(reforge.length + 1);
    }

    if (enchantmentsFound.length === 1) {
        let buffer = new Buffer.from(itemBytes, 'base64');
        const { parsed, type } = await parse(buffer)

        let enchantment = parsed.value.i.value.value[0].tag.value.display.value.Lore.value.value[0];
        enchantment = removeSpecialCharacters(enchantment);
        enchantment = enchantment.toLowerCase();

        enchantment = enchantment.replace(' x', ' 10');
        enchantment = enchantment.replace(' ix', ' 9');
        enchantment = enchantment.replace(' viii', ' 8');
        enchantment = enchantment.replace(' vii', ' 7');
        enchantment = enchantment.replace(' vi', ' 6');
        enchantment = enchantment.replace(' v', ' 5');
        enchantment = enchantment.replace(' iv', ' 4');
        enchantment = enchantment.replace(' iii', ' 3');
        enchantment = enchantment.replace(' ii', ' 2');
        enchantment = enchantment.replace(' i', ' 1');

        enchantment = enchantment.replaceAll(' ', '-');

        name += ' ' + enchantment;
    }

    return name;
}

function getReforgeFromName(name) {

    let exceptions = [
        'refined amber',
        'strong dragon'
    ];
    for (let exception of exceptions) {
        if (name.startsWith(exception)) {
            return;
        }
    }

    for (let reforge of reforges) {
        if (name.startsWith(reforge + ' ')) {
            return reforge;
        }
    }
}

function getUpgradedFromName(name) {
    if (name.includes('⚚')) {
        return '⚚'
    }
}

function getStarsFromName(name) {
    if (name.includes('✪✪✪✪✪ ✦')) {
        return '✪✪✪✪✪ ✦';
    }

    if (name.includes('✦')) {
        return '✦';
    }

    if (name.includes('✪✪✪✪✪')) {
        return '✪✪✪✪✪';
    }

    if (name.includes('✪✪✪✪')) {
        return '✪✪✪✪';
    }

    if (name.includes('✪✪✪')) {
        return '✪✪✪';
    }

    if (name.includes('✪✪')) {
        return '✪✪';
    }

    if (name.includes('✪')) {
        return '✪';
    }
}

function getPetLevelFromName(name) {
    if (name.startsWith('[lvl')) {
        let rightSquareBracketIndex = name.indexOf(']');
        return 'L' + name.substring(name.indexOf(' ') + 1, rightSquareBracketIndex).padStart(3, '0');
    }
}

function removeSpecialCharacters(s) {
    let chars = [ '§6', '§7', '§8', '§9', '§a', '§b', '§c', '§d', '§e', '§l', ' ✪✪✪✪✪ ✦', ' ✦', ' ✪✪✪✪✪', ' ✪✪✪✪', ' ✪✪✪', ' ✪✪', ' ✪', '§d§l', '⚚ ' ];
    for (let ch of chars) {
        s = s.replaceAll(ch, '');
    }
    return s.trim();
}

module.exports.writeAuctionItemsCache = writeAuctionItemsCache;
module.exports.readAuctionItemsCache = readAuctionItemsCache;
module.exports.removeSpecialCharacters = removeSpecialCharacters;
