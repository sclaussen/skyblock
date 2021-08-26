'use strict';
process.env.DEBUG = 'skyblock';
const d = require('debug')('skyblock');

const fs = require('fs');
const util = require('util');
const _ = require('lodash');
const { execSync } = require('child_process');

const YAML = require('yaml');
const moment = require('moment');
const program = require('commander');

const curl = require('./lib/curl');
const p = require('./lib/pr').p(d);
const p4 = require('./lib/pr').p4(d);

const { sortBy, deburr, groupBy, orderBy, toLower, map, uniq, filter } = _


auction(process.argv);


var auctions = [];
var options;


// Usage: node auction keyword [r]
async function auction(args) {

    // Parse the options
    options = parse(args);

    // Call the skyblock API to fetch and cache the auctions if the
    // -R flag was specified
    if (options.retrieve) {
        await retrieveAuctionsFromSkyblock();
    }

    while (true) {

        // Read in the auction items from the cache
        auctions = await readSkyblockAuctionCache();

        // Find the auctions containing the user specified phrase
        let auctionsMatchingPhrase = filter(auctions, function(o) {

            // Do not include the item if it was already claimed
            if (o.claimed) {
                return false;
            }

            // Match correct phrase
            if (!o.item_name.includes(options.phrase)) {
                return false;
            }

            // Match the pet level if it was provided
            if (options.petLevel && !o.pet_level.includes(options.petLevel)) {
                return false;
            }

            // Match the reforge if it was provided
            if (options.reforge && !o.reforge.includes(options.reforge)) {
                return false;
            }

            // Match the star rating if it was provided
            if (options.stars) {
                switch (options.stars) {
                case '5':
                    if (o.stars !== '✪✪✪✪✪') {
                        return false;
                    }
                    break;
                case '4':
                    if (o.stars !== '✪✪✪✪') {
                        return false;
                    }
                    break;
                case '3':
                    if (o.stars !== '✪✪✪') {
                        return false;
                    }
                    break;
                case '2':
                    if (o.stars !== '✪✪') {
                        return false;
                    }
                    break;
                case '1':
                    if (o.stars !== '✪') {
                        return false;
                    }
                    break;
                }
            }

            // Match the tier it it was provided
            if (options.tier && !o.tier.includes(options.tier)) {
                return false;
            }

            // Match the extra metadata if values were provided
            if (options.extraMatch) {
                for (let match of options.extraMatch) {
                    if (!o.extra.includes(match)) {
                        return false;
                    }
                }
            }

            return true;
        });


        // If BIN, sort by cost (within each unique item).
        // If auction, sort by auction ending time
        let sortedAuctions;
        if (options.auctions) {
            sortedAuctions = sortBy(auctionsMatchingPhrase, [ 'category', 'item_name', 'end' ]);
        } else {
            sortedAuctions = sortBy(auctionsMatchingPhrase, [ 'category', 'item_name', 'starting_bid' ]);
        }

        if (options.loop) {
            console.clear();
        }

        printAuctions(sortedAuctions);

        if (!options.loop) {
            process.exit(0);
        }

        console.log();
        process.stdout.write('Sleeping for 15 seconds');
        let count = 0;
        while (count < 15) {
            sleep(1);
            process.stdout.write('.');
            count++;
        }
    }
}

function sleep(n) {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, n * 1000);
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
        if (options.auctions && auction.type !== 'AUC') {
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

        // PET LEVEL
        if (options.pet) {
            s += rj(auction.pet_level, 6);
            s += '  ';
        } else {
            // REFORGE
            s += rj(auction.reforge, 12);
            s += ' ';

            // UPGRADED
            s += lj(auction.upgraded, 1);

            // STARS
            s += lj(auction.stars, 5);
            s += ' ';
        }

        // ITEM NAME
        s += lj(auction.item_name, 40);

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

        // EXTRA
        if (options.extra) {
            s += auction.extra;
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

async function retrieveAuctionsFromSkyblock() {
    process.stdout.write('Retrieving auctions.');

    // Get the first (0th) page of auctions, and transform all its auction entries
    let skyblockAuctions = (await curl.get('https://api.hypixel.net/skyblock/auctions')).body;
    let pages = skyblockAuctions.totalPages;
    cacheSkyblockAuctions(skyblockAuctions);

    // Now get the remaining pages, transforming each auction entry as we go
    for (let page = 1; page < pages; page++) {
        process.stdout.write('.');
        skyblockAuctions = (await curl.get('https://api.hypixel.net/skyblock/auctions?page=' + page)).body;
        cacheSkyblockAuctions(skyblockAuctions);
    }
    console.log();


    // Cache the auctions array to a file
    fs.writeFileSync('./.auction', JSON.stringify(auctions, null, 4));
}

function cacheSkyblockAuctions(skyblockAuctions) {
    for (let auction of skyblockAuctions.auctions) {

        let bin = 'BIN';
        if (!auction.bin) {
            bin = 'AUC';
        }

        auctions.push({
            end: auction.end,
            item_name: auction.item_name.toLowerCase(),
            extra: auction.extra.toLowerCase(),
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

async function readSkyblockAuctionCache() {
    let skyblockAuctions = JSON.parse(fs.readFileSync('./.auction'));

    let auctions = [];
    for (let auction of skyblockAuctions) {
        let extra = getExtra(auction.extra);
        let itemName = getItemName(auction.item_name, extra);
        extra = removeItemName(extra, itemName);

        auctions.push({
            end: auction.end,
            item_name: itemName,
            pet_level: getPetLevel(auction.item_name),
            reforge: getReforge(auction.item_name),
            upgraded: getUpgraded(auction.item_name),
            stars: getStars(auction.item_name),
            extra: extra,
            category: getCategory(auction.category),
            tier: getTier(auction.tier),
            starting_bid: auction.starting_bid,
            claimed: auction.claimed,
            highest_bid_amount: auction.highest_bid_amount,
            bids: auction.bids,
            type: auction.type
        });
    }

    return auctions;
}

function getCategory(category) {
    let categoryAlias = {
        weapon: '1-weap',
        armor: '2-armo',
        accessories: '3-acce',
        misc: '4-misc',
        blocks: '5-bloc',
        consumables: '6-cons',
    };
    category = categoryAlias[category];
    if (!category) {
        console.log('Unknown category: ' + auction.category);
    }
    return category;
}

function getTier(tier) {
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
    tier = tierAlias[tier];
    if (!tier) {
        console.log('Unknown tier: ' + tier);
    }
    return tier;
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

function getItemName(itemName) {

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

function removeItemName(extra, itemName) {
    if (extra.startsWith(itemName)) {
        return extra.substring(itemName.length + 1);
    }

    return extra;
}


function getExtra(extra) {

    if (!extra) {
        return '';
    }

    // Remove all the reforge names
    let reforge = getReforge(extra);
    if (reforge !== '') {
        extra = extra.substring(reforge.length + 1);
    }

    // Remove all special characters
    extra = removeSpecialCharacters(extra);

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

    let enchantments = [];
    for (let enchantment of _.keys(allEnchantments)) {
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

function parse(args) {

    program
        .argument('<phrase>', 'The phrase to search for')
        .option('-a, --auctions', 'List auctions instead of BIN items (BIN is the default)')
        .option('-p, --pet', 'Search for a pet')
        .option('-P, --pet-level <pet-level>', 'Search for a pet at a specific level')
        .option('-r, --reforge <reforge>', 'Only include items with the reforge')
        .option('-t, --tier <tier>', 'Only include items in the tier level (eg comm, unco, rare, epic, lege)')
        .option('-o, --output <output>', 'Limit output to the first N items')
        .option('-1, --output-1', 'Limit output to the first line')
        .option('-s, --stars <stars>', 'Only include items with the star count')
        .option('-x, --extra', 'Include extra metadata')
        .option('-X, --extra-match <string...>', 'Include extra metadata containing all the strings')
        .option('-L, --loop', 'Loop continually')
        .option('-K, --thousands', 'Express coins in terms of K (useful for calculating avg/total cost)')
        .option('-R, --retrieve', 'Refresh the local auction cache using the skyblock API')
        .parse(args);

    let options = program.opts();

    // Single CLI argument is the phrase to search for
    options.phrase = program.args[0].toLowerCase();

    // If the pet level is specified, normalize the string (eg 7 -> L007)
    if (options.petLevel) {
        options.pet = true;
        options.petLevel = 'L' + options.petLevel.padStart(3, '0');
    }

    if (options.extraMatch) {
        options.extra = true;
    }

    if (options.output1) {
        options.output = 1;
    }

    // If pet is specified, append pet to the search criteria
    if (options.pet && !options.phrase.includes(' pet')) {
        options.phrase = options.phrase + ' pet';
    }

    // p4(options);

    return options;
}
