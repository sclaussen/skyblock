'use strict';
process.env.DEBUG = 'skyblock';
const d = require('debug')('skyblock');

const fs = require('fs');
const util = require('util');
const _ = require('lodash');

const YAML = require('yaml');
const moment = require('moment');
const clicolor = require('cli-color');
const program = require('commander');

const curl = require('./curl');
const casey = require('./casey');
const p = require('./pr').p(d);
const e = require('./pr').e(d);
const p4 = require('./pr').p4(d);

var options;

minion(process.argv);

async function minion(args) {

    options = parse(args);

    if (options.retrieve) {
        await cacheSkyblockBazaarItems();
    }

    let items = await readSkyblockBazaarCache();
    let minions = YAML.parse(fs.readFileSync('./minions.yaml', 'utf8'));
    let combos = YAML.parse(fs.readFileSync('./combos.yaml', 'utf8'));

    process(minions, items, combos);
}

function process(minions, items, combos) {
    let analysis = [];

    let output = {};
    for (let minionName of _.keys(minions)) {
        let minion = minions[minionName];

        let action_time_adjusted = (minion.action_time * 2);
        if (minion.lava_bucket) {
            action_time_adjusted *= .75;
        }

        let o = {};
        o.action_time = minion.action_time;
        o.items_per_action = minion.items_per_action;
        o.lava_bucket = minion.lava_bucket;
        o.action_time_adjusted = action_time_adjusted;
        o.items_per_second = Number.parseFloat(items_per_action / action_time_adjusted).toFixed(4);
        o.items_per_day = Number.parseFloat(items_per_second * 86400);
        o.diamonds_per_action = Number.parseFloat(minion.items_per_action * .1).toFixed(1);
        o.diamonds_per_second = Number.parseFloat(output[minionName].diamonds_per_action / action_time_adjusted).toFixed(4);
        o.diamonds_per_day = Number.parseFloat(diamonds_per_second * 86400);
        output[minionName] = o;
    }

    p4(output);
}

function getItem(items, name) {
    let item = items[name];
    if (!item) {
        console.log('Item not found: ' + name);
        process.exit(1);
    }
    return item;
}

async function cacheSkyblockBazaarItems() {
    // Get the items from the bazaar
    let bazaarItems = (await curl.get('https://api.hypixel.net/skyblock/bazaar')).body;

    // products:
    //     GOLD:
    //         product_id: GOLD
    //         sell_summary:
    //           ...
    //         buy_summary:
    //           ...
    //         quick_status:
    //             productId: "ENCHANTED_BAKED_POTATO"
    //             sellPrice: 24748.946948999233
    //             sellVolume: 2336256
    //             sellMovingWeek: 447388
    //             sellOrders: 688
    //             buyPrice: 26146.401687160418
    //             buyVolume: 150287
    //             buyMovingWeek: 303975
    //             buyOrders: 33

    let items = {};
    for (let itemName of _.keys(bazaarItems.products)) {
        if (itemName === 'BAZAAR_COOKIE') {
            continue;
        }

        let itemNameLowerCase = itemName.toLowerCase().replace('enchanted', 'e');
        items[itemNameLowerCase] = {
            name: itemNameLowerCase,
            buy: Number.parseFloat(bazaarItems.products[itemName].quick_status.sellPrice).toFixed(1),
            sell: Number.parseFloat(bazaarItems.products[itemName].quick_status.buyPrice).toFixed(1),
        };
    }

    fs.writeFileSync('./.minion', JSON.stringify(items, null, 4));
}


async function readSkyblockBazaarCache() {
    let items = JSON.parse(fs.readFileSync('./.minion'));
    for (let item of _.values(items)) {
        item.trackerUrl = getTrackerUrl(item.name);
        item.fandomUrl = getFandomUrl(item.name);
    }
    return items;
}


function analyze1(items) {
    p4('analyze');
    for (let item of _.values(items)) {

        if (item.name.startsWith('e_')) {
            continue;
        }

        let enchanted = _.find(items, { name: 'e_' + item.name });
        if (!enchanted) {
            continue;
        }

        let cost = item.buy * 160;
        let profit = enchanted.sell - cost;
        let margin = ((profit / cost) * 100).toFixed(0);

        // console.log(lj(item.name, 30), rj(coins(item.buy), 8), rj(coins(cost), 8), rj(coins(enchanted.sell), 8), rj(coins(profit), 8), rj(margin, 5), lj(item.fandomUrl, 70), enchanted.fandomUrl);
        console.log(lj(item.name, 30), rj(coins(item.buy), 8), rj(coins(cost), 8), rj(coins(enchanted.sell), 8), rj(coins(profit), 8), rj(margin, 5), lj(item.fandomUrl, 70));
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
        .option('-R, --retrieve', 'Refresh the local bazaar cache using the skyblock API')
        .parse(args);

    let options = program.opts();

    p4(options);

    return options;
}
