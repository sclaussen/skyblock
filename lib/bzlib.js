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

const getTrackerUrl = require('./util').getTrackerUrl;
const getFandomUrl = require('./util').getFandomUrl;
const round = require('./util').round;

const curl = require('./curl');
const p = require('./pr').p(d);
const p4 = require('./pr').p4(d);



const { sortBy, deburr, groupBy, orderBy, toLower, map, uniq, filter } = _



async function writeBazaarItemsCache() {
    let bazaarItems = (await curl.get('https://api.hypixel.net/skyblock/bazaar')).body;

    let items = {};
    for (let itemName of _.keys(bazaarItems.products)) {
        if (itemName === 'BAZAAR_COOKIE') {
            continue;
        }

        let itemNameLowerCase = itemName.toLowerCase().replace('enchanted', 'e');
        let item = bazaarItems.products[itemName].quick_status;
        items[itemNameLowerCase] = {
            name: itemNameLowerCase,
            cost: item.sellPrice,
            sell: item.buyPrice,
            margin: ((item.buyPrice - item.sellPrice) / item.sellPrice),
            volume: item.buyVolume,
            quantity2M: round(2000000 / item.sellPrice),
            trackerUrl: getTrackerUrl(itemName),
            fandomUrl: getFandomUrl(itemName)
        };
        items[itemNameLowerCase].name_with_quantity = items[itemNameLowerCase].name + ' (' + items[itemNameLowerCase].quantity2M + ')';
    }

    // Cache the bazaar
    fs.writeFileSync('./.bazaar-items', JSON.stringify(items, null, 4));
}

async function readBazaarItemsCache() {
    let items = JSON.parse(fs.readFileSync('./.bazaar-items'));
    return items;
}

function getBazaarItem(bazaarItems, name) {
    let item = bazaarItems[name];
    if (!item) {
        console.log('Item not found: ' + name);
        process.exit(1);
    }
    return item;
}

module.exports.writeBazaarItemsCache = writeBazaarItemsCache;
module.exports.readBazaarItemsCache = readBazaarItemsCache;
module.exports.getBazaarItem = getBazaarItem;
