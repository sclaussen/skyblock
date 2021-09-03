'use strict';
process.env.DEBUG = 'skyblock';
const d = require('debug')('skyblock');

const fs = require('fs');
const util = require('util');
const _ = require('lodash');
const { execSync } = require('child_process');

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



const { sortBy, deburr, groupBy, orderBy, toLower, map, uniq, filter } = _


var items = [];


async function writeAuctionItemsCache() {

    // Get the first (0th) page of auctions, and transform all its auction entries
    let body = (await curl.get('https://api.hypixel.net/skyblock/auctions')).body;
    addItemsToCache(body.auctions);

    // Now get the remaining pages, transforming each auction entry as we go
    for (let page = 1; page < body.totalPages; page++) {
        process.stdout.write('.');
        body = (await curl.get('https://api.hypixel.net/skyblock/auctions?page=' + page)).body;
        addItemsToCache(body.auctions);
    }
    console.log();


    // Cache the auctions array to a file
    console.log('Caching ' + _.keys(items).length + ' auctions.');
    fs.writeFileSync('./.auction-items', JSON.stringify(items, null, 4));
}

function addItemsToCache(skyblockItems) {
    for (let item of skyblockItems) {

        let bin = 'BIN';
        if (!item.bin) {
            bin = 'AUC';
        }

        if (item.claimed) {
            continue;
        }

        items.push({
            name: item.item_name.toLowerCase(),
            type: bin,
            cost: item.starting_bid,
            category: item.category.toLowerCase(),
            tier: item.tier.toLowerCase(),
            extra: item.extra.toLowerCase(),
            highest_bid: item.highest_bid,
            end: item.end,
        });
    }
}

async function readAuctionItemsCache() {
    let items = JSON.parse(fs.readFileSync('./.auction-items'));
    for (let item of items) {

        let extra = getExtra(item.extra);
        let name = getName(item.name, extra);
        extra = removeName(extra, name);
        let reforge = getReforge(item.name);
        name = renameEnchantmentBookToEnchantment(name, extra);

        item.reforge = reforge;
        item.upgraded = getUpgraded(item.name);
        item.stars = getStars(item.name);
        item.pet_level = getPetLevel(item.name);
        item.extra = extra;
        item.category = getCategory(item.category);
        item.tier = getTier(item.tier);
        item.trackerUrl = getTrackerUrl(name);
        item.fandomUrl = getFandomUrl(name);
        item.sell = 0;
        item.margin = 0;
        item.name = name;
    }

    return items;
}


function augmentName(items) {
    // Augment the name field with tier, reforge, and pet level
    _.map(items, function(item, key, coll) {
        if (item.tier) {
            item.name += ' [' + item.tier.substring(2) + ']';
        }
        if (item.reforge) {
            item.name += ' [' + item.reforge + ']';
        }
        if (item.pet_level) {
            item.name += ' [' + item.pet_level + ']';
        }
    });
    return items;
}


function print(items, max) {
    items = augmentName(items);
    table(items, [
        {
            name: 'upgraded',
            alias: 'U',
            width: 1,
        },
        {
            name: 'stars',
            width: 7,
            extra_spaces: 1,
        },
        {
            name: 'cost',
            width: 5,
            format: { mix: true },
            extra_spaces: 1
        },
        {
            name: 'sell',
            width: 5,
            format: { mix: true, hide_zero: true },
        },
        {
            name: 'margin',
            alias: '%',
            width: 3,
            format: { percent: true, hide_zero: true },
            highlight_green_above: 15,
            highlight_red_below: 10,
        },
        {
            name: 'name',
            width: -45,
        },
        {
            name: 'extra',
            width: -40,
            format: { shorten: 76, shorten_append: '...]' }
        },
    ], max);
}

function renameEnchantmentBookToEnchantment(name, extra) {
    if (name !== 'enchanted book') {
        return name;
    }

    // If this is the case there are multiple enchantments so we will not rename the book
    if (extra.includes(' ')) {
        return name;
    }

    name = name + ' ' + extra.substring(1, extra.length - 1);
    return name;
}


function getReforge(name) {
    let reforges = [
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
        'perfect',
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
        'very',

        // Stonk
        'fruitful',
        'refined',
        'magnetic',

        // Salmon armor
        'submerged',

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

        // zombie ring
        'demonic',
        'hurtful',
        'itchy',
        'pretty',
        'shaded',
        'simple',
        'zealous',

        // shark toothed necklace
        'bloody',
        'bizarre',

        // red claw
        'shiny',
        'strange',

        // bat artifact
        'keen',
        'ominous',
        'pleasant',

        // spider artifact
        'silky',

        // feature artifact
        'vivid',

        // refined titanium pickaxe
        'fleet',
        'even more',
        'heated',
        'stellar',

        // rod of legends
        'lucky',
    ];

    let exceptions = [
        'refined amber'
    ];

    if (exceptions.includes(name)) {
        return '';
    }

    for (let reforge of reforges) {
        if (name.startsWith(reforge + ' ')) {
            return reforge;
        }
    }

    return '';
}

function getPetLevel(itemName) {
    if (itemName.startsWith('[lvl')) {
        let rightSquareBracketIndex = itemName.indexOf(']');
        return 'L' + itemName.substring(itemName.indexOf(' ') + 1, rightSquareBracketIndex).padStart(3, '0');
    }

    return '';
}

function getStars(itemName) {
    if (itemName.includes('✪✪✪✪✪ ✦')) {
        return '✪✪✪✪✪ ✦';
    }

    if (itemName.includes('✦')) {
        return '✦';
    }

    if (itemName.includes('✪✪✪✪✪')) {
        return '✪✪✪✪✪';
    }

    if (itemName.includes('✪✪✪✪')) {
        return '✪✪✪✪';
    }

    if (itemName.includes('✪✪✪')) {
        return '✪✪✪';
    }

    if (itemName.includes('✪✪')) {
        return '✪✪';
    }

    if (itemName.includes('✪')) {
        return '✪';
    }

    return '';
}

function getUpgraded(itemName) {
    if (itemName.includes('⚚')) {
        return '⚚'
    }

    return '';
}

function getName(itemName) {

    // Remove all special characters
    itemName = removeSpecialCharacters(itemName);

    // Remove [lvl x] from the item name for pets, add " pet" to name
    if (itemName.startsWith('[lvl')) {
        let rightSquareBracketIndex = itemName.indexOf(']');
        itemName = itemName.substring(rightSquareBracketIndex + 2) + ' pet';
    }

    // Remove all the reforge names
    let reforge = getReforge(itemName);
    if (reforge !== '') {
        itemName = itemName.substring(reforge.length + 1);
    }

    return itemName.trim();
}

function removeName(extra, itemName) {
    if (extra.startsWith(itemName)) {
        return extra.substring(itemName.length + 1);
    }

    return extra;
}


function getExtra(extra) {

    if (!extra) {
        return '';
    }

    // Remove all special characters
    extra = removeSpecialCharacters(extra);

    // Remove all the reforge names
    let reforge = getReforge(extra);
    if (reforge !== '') {
        extra = extra.substring(reforge.length + 1);
    }

    // Remove "enchanted book"
    if (extra.startsWith('enchanted book ')) {
        extra = extra.substring('enchanted book '.length);
    }

    // Transform/sort all the enchantments
    let allEnchantments = {
        'angler': 'angler',
        'aqua affinity': 'aqua-affinity',
        'bane of arthropods': 'bane-of-arthropods',
        'bank': 'bank',
        'big brain': 'big-brain',
        'blast protection': 'blast-protection',
        'blessing': 'blessing',
        'caster': 'caster',
        'chance': 'chance',
        'chimera': 'chimera',
        'cleave': 'cleave',
        'combo': 'combo',
        'compact': 'compact',
        'counter-strike': 'counter-strike',
        'critical': 'critical',
        'cubism': 'cubism',
        'cultivating': 'cultivating',
        'delicate': 'delicate',
        'depth strider': 'depth-strider',
        'dragon hunter': 'dragon-hunter',
        'dragon tracer': 'dragon-tracer',
        'efficiency': 'efficiency',
        'ender slayer': 'ender-slayer',
        'execute': 'execute',
        'experience': 'experience',
        'expertise': 'expertise',
        'feather falling': 'feather-falling',
        'fire aspect': 'fire-aspect',
        'fire protection': 'fire-protection',
        'first strike': 'first-strike',
        'flame': 'flame',
        'fortune': 'fortune',
        'frail': 'frail',
        'frost walker': 'frost-walker',
        'giant killer': 'giant-killer',
        'growth': 'growth',
        'harvesting': 'harvesting',
        'pristine': 'pristine',
        'impaling': 'impaling',
        'infinite quiver': 'infinite-quiver',
        'knockback': 'knockback',
        'last stand': 'last-stand',
        'legion': 'legion',
        'lethality': 'lethality',
        'life steal': 'life-steal',
        'looting': 'looting',
        'luck of the sea': 'luck-of-the-sea',
        'luck': 'luck',
        'lure': 'lure',
        'mana steal': 'mana-steal',
        'magnet': 'magnet',
        'no pain no gain': 'no-pain-no-gain',
        'one for all': 'one-for-all',
        'overload': 'overload',
        'piercing': 'piercing',
        'power': 'power',
        'projectile protection': 'projectile-protection',
        'prosecute': 'prosecute',
        'true protection': 'true-protection',
        'protection': 'protection',
        'punch': 'punch',
        'rainbow': 'rainbow',
        'rejuvenate': 'rejuvenate',
        'rend': 'rend',
        'replenish': 'replenish',
        'respiration': 'respiration',
        'respite': 'respite',
        'scavenger': 'scavenger',
        'sharpness': 'sharpness',
        'silk touch': 'silk-touch',
        'smelting touch': 'smelting-touch',
        'smarty pants': 'smarty-pants',
        'smite': 'smite',
        'snipe': 'snipe',
        'spiked hook': 'spiked-hook',
        'sugar rush': 'sugar-rush',
        'soul eater': 'soul-eater',
        'syphon': 'syphon',
        'swarm': 'swarm',
        'telekinesis': 'telekinesis',
        'thorns': 'thorns',
        'thunderbolt': 'thunderbolt',
        'thunderlord': 'thunderlord',
        'titan killer': 'titan killer',
        'triple strike': 'triple-strike',
        'triple-strike': 'triple-strike',
        'true': 'true',
        'turbo-crop': 'turbo-crop',
        'turbo-potato': 'turbo-potato',
        'turbo-wheat': 'turbo-wheat',
        'turbo-warts': 'turbo-warts',
        'turbo-coco': 'turbo-coco',
        'turbo-pumpkin': 'turbo-pumpkin',
        'turbo-cacti': 'turbo-cacti',
        'turbo-melon': 'turbo-melon',
        'turbo-carrot': 'turbo-carrot',
        'turbo-mushrooms': 'turbo-mushrooms',
        'turbo-cane': 'turbo-cane',
        'ultimate jerry': 'ultimate-jerry',
        'ultimate wise': 'ultimate wise',
        'vampirism': 'vampirism',
        'vicious': 'vicious',
        'venomous': 'venomous',
        'wisdom': 'wisdom',
        'wool': 'wool',
    };

    let exclusions = [
        'sea creature chance enrichment',
        'compactor'
    ];

    // TODO: Fix this line:
    //             2.5M   3.2M  22 personal compactor 6000 [epic]                personal or 6000 dropper [compact]

    let enchantments = [];
    for (let enchantment of _.keys(allEnchantments)) {

        let exclusion = false;
        for (let exclusion of exclusions) {
            if (extra.includes(exclusions)) {
                exclusion = true;
            }
        }
        if (exclusion) {
            continue;
        }

        if (extra.includes(enchantment)) {
            extra = extra.replace(enchantment, '');
            enchantments.push(allEnchantments[enchantment]);
        }
    }

    if (enchantments.length > 0) {
        return extra.trim() + ' [' + enchantments.sort().join(' ') + ']';
    }

    return extra.trim();
}

function removeSpecialCharacters(s) {
    for (let rm of [ ' ✪✪✪✪✪ ✦', ' ✦', ' ✪✪✪✪✪', ' ✪✪✪✪', ' ✪✪✪', ' ✪✪', ' ✪', '§d§l', '⚚ ' ]) {
        s = s.replaceAll(rm, '');
    }
    return s.trim();
}


let books = {
    'cubism 4': 'common',
    'cubism 5': 'uncommon',

    'chance 2-4': 'common',

    'dragon tracer 4': 'common',
    'dragon tracer 5': 'uncommon',

    'flame 1': 'common',

    'impaling 2': 'common',
    'impaling 3': 'common',

    'infinite-query 6': 'rare',
    'infinite-quiver 7': 'epic',
    'infinite-quiver 8': 'legendary',
    'infinite-quiver 9': 'mythic',

    'piercing 1': 'common',

    'power 4': 'common',
    'power 5': 'uncommon',

    'punch 1': 'common',
    'punch 2': 'common',

    'snipe 2': 'common',
    'snipe 3': 'common',
}


module.exports.writeAuctionItemsCache = writeAuctionItemsCache;
module.exports.readAuctionItemsCache = readAuctionItemsCache;
module.exports.print = print;
