'use strict';
// process.env.DEBUG = 'skyblock';
const d = require('debug')('skyblock');

const fs = require('fs');
const util = require('util');
const _ = require('lodash');

const YAML = require('yaml');
const moment = require('moment');
const clicolor = require('cli-color');
const program = require('commander');

const curl = require('./lib/curl');
const p = require('./lib/pr').p(d);
const e = require('./lib/pr').e(d);
const p4 = require('./lib/pr').p4(d);

const rj = require('./lib/util').rj;
const lj = require('./lib/util').lj;
const coins = require('./lib/util').coins;

const writeBazaarItemsCache = require('./lib/bazaarlib').writeBazaarItemsCache;
const readBazaarItemsCache = require('./lib/bazaarlib').readBazaarItemsCache;

const retrieveAuctionItemsFromSkyblock = require('./lib/auctionlib').retrieveAuctionItemsFromSkyblock;
const readSkyblockAuctionItemsCache = require('./lib/auctionlib').readSkyblockAuctionItemsCache;

const getBazaarItem = require('./lib/bazaarlib').getBazaarItem;
// const getAuctionItem = require('./lib/auctionlib').getAuctionItem;

const getTrackerUrl = require('./lib/util').getTrackerUrl;
const getFandomUrl = require('./lib/util').getFandomUrl;

const { sortBy } = _



var options;
var bazaarItems;
var auctionItems;
var flips;



flip(process.argv);


async function flip(args) {

    options = parse(args);

    if (options.retrieve) {
        console.log('Retrieving auction items from skyblock');
        await retrieveAuctionItemsFromSkyblock()
        console.log('Retrieving bazaar items from skyblock');
        await writeBazaarItemsCache();
        process.exit(1);
    }

    bazaarItems = await readBazaarItemsCache();
    auctionItems = await readSkyblockAuctionItemsCache();
    flips = YAML.parse(fs.readFileSync('./flips.yaml', 'utf8'));

    let sortedFlips = process();
    print(sortedFlips);
}

function process() {
    let newFlips = [];
    for (let flip of _.values(flips)) {

        if (flip['bazaar_flip']) {
            let bazaarItem = getBazaarItem(bazaarItems, flip.name);
            p4(bazaarItem);
            newFlips.push({
                name: flip.name,
                type: 'bazaar',
                cost: bazaarItem.buy,
                sell: bazaarItem.sell,
                margin: Number.parseFloat(((bazaarItem.sell - bazaarItem.buy) / bazaarItem.buy) * 100).toFixed(0)
            });
        }

        if (flip['crafted_bazaar_flip']) {
            let bazaarItem = getBazaarItem(bazaarItems, flip.name);
            let craftCost = getCraftCost(flip.crafted_bazaar_flip.ingredients);
            newFlips.push({
                name: flip.name,
                type: 'crafted_bazaar',
                cost: Number.parseFloat(craftCost).toFixed(0),
                sell: Number.parseFloat(bazaarItem.sell).toFixed(0),
                ingredients: flip.crafted_bazaar_flip.ingredients,
                margin: Number.parseFloat(((bazaarItem.sell - craftCost) / craftCost) * 100).toFixed(0)
            });
        }

        if (flip['crafted_auction_flip']) {
            // let craftCost = getCraftCost(flip.crafted_auction_flip.ingredients);
            // flip.crafted_auction_flip.cost = craftCost;
            // flip.crafted_auction_flip.margin = Number.parseFloat(((flip.crafted_auction_flip.sell - craftCost) / craftCost) * 100).toFixed(0);
            // p4('crafted_auction_flip result', flip);
        }

        if (flip['auction_flip']) {
        }
    }

    // p4(newFlips);
    let sortedFlips = sortBy(newFlips, function(o) {
        return parseInt(o.margin, 10);
    }).reverse();
    p4('after sort', sortedFlips);

    return sortedFlips;
}

function print(flips) {
    for (let flip of flips) {
        let s = '';
        s += lj(flip.name, 30);
        s += lj(flip.type, 20);
        s += rj(coins(flip.cost, {}), 10);
        s += rj(coins(flip.sell, {}), 10);
        s += rj(flip.margin, 10);
        console.log(s);
    }
}

function getCraftCost(ingredients) {
    let cost = 0;
    for (let ingredientName of _.keys(ingredients)) {
        let ingredient = ingredients[ingredientName];
        let ingredientBazaarItem = getBazaarItem(bazaarItems, ingredientName);
        ingredient.unit_cost = ingredientBazaarItem.buy;
        ingredient.cost = ingredientBazaarItem.buy * ingredient.quantity;
        cost += ingredient.cost;
    }
    return cost;
}

function parse(args) {

    program
        .option('-l, --loop', 'Loop continually')
        .option('-R, --retrieve', 'Refresh the local bazaar cache using the skyblock API')
        .parse(args);

    let options = program.opts();

    p4(options);

    return options;
}
