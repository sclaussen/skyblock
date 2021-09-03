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

const retrieveAuctionItemsFromSkyblock = require('./lib/auctionlib').retrieveAuctionItemsFromSkyblock;
const retrieveBazaarItemsFromSkyblock = require('./lib/bazaarlib').retrieveBazaarItemsFromSkyblock;

const readSkyblockAuctionItemsCache = require('./lib/auctionlib').readSkyblockAuctionItemsCache;
const readSkyblockBazaarItemsCache = require('./lib/bazaarlib').readSkyblockBazaarItemsCache;

var options;
var bazaarItems;


flip(process.argv);


async function flip(args) {

    options = parse(args);

    if (options.retrieve) {
        process.stdout.write('Retrieving auction items from skyblock');
        await retrieveAuctionItemsFromSkyblock()
        console.log('Retrieving bazaar items from skyblock');
        await retrieveBazaarItemsFromSkyblock();
        process.exit(1);
    }

    p('Reading auctionItems');
    auctionItems = await readSkyblockAuctionItemsCache();
    p('Reading bazaarItems');
    bazaarItems = await readSkyblockBazaarItemsCache();

    let combos = YAML.parse(fs.readFileSync('./recipes.yaml', 'utf8'));

    process(auctionItems, bazaarItems, recipes)
}

function process(auctionItems, bazaarItems, recipes) {
    // let analysis = [];

    // for (let recipeName of _.keys(recipes)) {
    //     if (!bazaar) {
    //         continue;
    //     }

    //     let bazaarItem = getItem(bazaarItems, recipeName);
    //     let recipe = recipes[recipeName];

    //     // Determine the cumulative ingredient cost
    //     let cost = 0;
    //     for (let ingredientName of _.keys(recipe.ingredients)) {
    //         let ingredientBuy = getBuy(ingredientName);
    //         let quantity = recipe[ingredientName];
    //         let ingredientCost = ingredient.buy * quantity
    //         recipe.ingredients[ingredientName + '_cost'] = ingredientCost;
    //         cost += ingredientCost;
    //     }

    //     let sell = getSell(recipeName);

    //     analysis.push({
    //         name: recipeName,
    //         ingredients: recipe,
    //         cost: cost,
    //         sell: sell,
    //         profit: sell - cost,
    //         margin: Number.parseFloat(((sell - cost) / cost) * 100).toFixed(0),
    //     });
    // }

    // p4(analysis);
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
