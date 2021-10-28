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



const reforges = YAML.parse(fs.readFileSync('./dat/reforges.yaml', 'utf8'), { prettyErrors: true });
const enchantments = YAML.parse(fs.readFileSync('./dat/enchantments.yaml', 'utf8'), { prettyErrors: true });



async function createAuctionObject(auction) {
    let item = {};
    item.seller = auction.auctioneer; // this is the uuid
    item.name = auction.item_name.toLowerCase();
    item.cost = auction.starting_bid;
    item.tier = auction.tier.toLowerCase();
    item.extra = auction.extra.toLowerCase();
    item.item_bytes = auction.item_bytes;

    let enchantmentsFound = getEnchantmentsFromExtra(item.extra);

    item.enchantments = enchantmentsFound.sort().join(' ');
    item.stars = getStarsFromName(item.name) || '';
    item.reforge = getReforgeFromName(item.name) || ''
    item.upgraded = getUpgradedFromName(item.name) || '';
    item.pet_level = getPetLevelFromName(item.name) || '';
    item.tier = getTier(item.tier);
    item.trackerUrl = getTrackerUrl(item.name);
    item.fandomUrl = getFandomUrl(item.name);

    if (item.pet_level !== '') {
        let response = await getPetInfo(item.item_bytes);
        if (response) {
            item.pet_held_item = response.pet_held_item;
            item.pet_candy_used = response.pet_candy_used;
        }
    }

    // This should be last, many things are extracted from
    // item.name so they should be done prior.
    item.name = await getName(item.name, enchantmentsFound, item.item_bytes);

    return item;
}


async function getPetInfo(bytes) {
    let buffer = new Buffer.from(bytes, 'base64');
    const { parsed, type } = await parse(buffer);
    if (parsed.value.i.value.value[0].tag.value.ExtraAttributes.value.petInfo !== undefined) {
        let petInfo = JSON.parse(parsed.value.i.value.value[0].tag.value.ExtraAttributes.value.petInfo.value);
        return {
            pet_held_item: petInfo.heldItem ? petInfo.heldItem.toLowerCase().replace('pet_item_', '').replaceAll('_', ' ') : '',
            pet_candy_used: petInfo.candyUsed
        };
    }
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


    // Use real numbers vs roman numeals
    let replaces = {
        'beacon iv': 'beacon 4',
        'beacon iii': 'beacon 3',
        'beacon ii': 'beacon 2',
        'beacon i': 'beacon 1',
    };
    for (let key of _.keys(replaces)) {
        let value = replaces[key];
        if (name.startsWith(key)) {
            name = name.replace(key, value);
            break;
        }
    }


    // Remove all the reforge names
    let reforge = getReforgeFromName(name);
    if (reforge) {
        name = name.substring(reforge.length + 1);
    }


    // Augment the name with the enchant if there is only one enchant
    if (name.startsWith('enchanted book') && enchantmentsFound.length === 1) {
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

        name += ' [' + enchantment + ']';
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
    let chars = [ '§1', '§2', '§3', '§4', '§5', '§6', '§7', '§8', '§9', '§a', '§b', '§c', '§d', '§e', '§f', '§l',  '§o', ' ✪✪✪✪✪ ✦', ' ✦', ' ✪✪✪✪✪', ' ✪✪✪✪', ' ✪✪✪', ' ✪✪', ' ✪', '§d§l', '⚚ ' ];
    for (let ch of chars) {
        s = s.replaceAll(ch, '');
    }
    return s.trim();
}


module.exports.removeSpecialCharacters = removeSpecialCharacters;
module.exports.getReforgeFromName = getReforgeFromName;
module.exports.createAuctionObject = createAuctionObject;
