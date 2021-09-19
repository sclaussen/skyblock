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

const writeBazaarItemsCache = require('./lib/bzlib').writeBazaarItemsCache;
const readBazaarItemsCache = require('./lib/bzlib').readBazaarItemsCache;
const readAuctionItemsCache = require('./lib/auclib').readAuctionItemsCache;

const table = require('./lib/util').table;

const getBazaarItem = require('./lib/bzlib').getBazaarItem;

const getTrackerUrl = require('./lib/util').getTrackerUrl;
const getFandomUrl = require('./lib/util').getFandomUrl;
const format = require('./lib/util').format;


var options;
var bzItems;



item(process.argv);


async function item(args) {
    options = parse(args);
    await writeBazaarItemsCache();
    bzItems = await readBazaarItemsCache();
    let items = YAML.parse(fs.readFileSync('./items.yaml', 'utf8'));

    console.log(print(sort(process(items))));
}

function process(items) {
    let results = [];

    for (let item of items) {


        let result = {
            name: item.name,
            trackerUrl: getTrackerUrl(item.name),
            fandomUrl: getFandomUrl(item.name),
        };


        // Bazaar item?
        let bzItem = bzItems[item.name];
        if (bzItem) {
            result.bz_cost = getBazaarItem(bzItems, item.name).cost;
            result.bz_sell = getBazaarItem(bzItems, item.name).sell;
            result.bz_margin = (result.bz_sell - result.bz_cost) / result.bz_cost;
        }


        // NPC item?
        if (item.npc) {
            result.npc_cost = item.npc_cost;
            result.npc_margin = (result.bz_sell - result.npc_cost) / result.npc_cost;
        }


        // Can the item be crafted?
        if (item.ingredients) {

            result.ingredient_name = item.ingredients[0].name;
            result.ingredient_quantity = item.ingredients[0].quantity;
            result.ingredient_name_quantity = result.ingredient_name + ' x' + result.ingredient_quantity;


            // Is the ingredient sold in the bazaar?
            let bzIngredientItem = _.find(bzItems, { name: result.ingredient_name });
            if (bzIngredientItem) {
                result.ingredient_bz_cost = bzIngredientItem.cost;
                result.ingredient_bz_crafted_cost = result.ingredient_bz_cost * result.ingredient_quantity;
                result.ingredient_bz_crafted_margin = (result.bz_sell - result.ingredient_bz_crafted_cost) / result.ingredient_bz_crafted_cost;
            }


            // Is the ingredient sold by an npc?
            let npcIngredientItem = _.find(items, function(o) {
                if (o.name === result.ingredient_name && o.npc) {
                    return o;
                }
            });
            if (npcIngredientItem) {
                result.ingredient_npc_cost = npcIngredientItem.npc_cost;
                result.ingredient_npc_crafted_cost = npcIngredientItem.npc_cost * result.ingredient_quantity;
                result.ingredient_npc_crafted_margin = (result.bz_sell - result.ingredient_npc_crafted_cost) / result.ingredient_npc_crafted_cost;
            }
        }

        results.push(result);
    }

    p4(results);
    return results;
}

function sort(items) {
    return _.sortBy(items, [ 'ingredient_bz_crafted_margin' ]).reverse();
    // return _.sortBy(items, [ 'name' ]);
}

function print(items) {
    return table(items, [
        {
            name: 'name',
            alias: 'output',
            width: -25,
        },
        {
            name: 'bz_cost',
            alias: 'bz c',
            width: 7,
            format: { integer: true, hide_zero: true },
            extra_spaces: 1
        },
        {
            name: 'bz_sell',
            alias: 'bz s',
            width: 7,
            format: { integer: true, hide_zero: true },
        },
        {
            name: 'bz_margin',
            alias: '%',
            width: 5,
            format: { percent: true, hide_zero: true },
            extra_spaces: 5
        },
        {
            name: 'npc_cost',
            alias: 'npc c',
            width: 7,
            format: { integer: true, hide_zero: true },
        },
        {
            name: 'bz_sell',
            alias: 'bz s',
            width: 7,
            format: { integer: true, hide_zero: true },
        },
        {
            name: 'npc_margin',
            alias: 'm %',
            width: 5,
            format: { percent: true, hide_zero: true },
            extra_spaces: 5
        },
        {
            name: 'ingredient_name_quantity',
            alias: 'ingredient/#',
            width: -23,
        },
        {
            name: 'ingredient_bz_cost',
            alias: 'bz c',
            width: 7,
            format: { integer: true, hide_zero: true },
            extra_spaces: 1
        },
        {
            name: 'ingredient_bz_crafted_cost',
            alias: 'bz cc',
            width: 7,
            format: { integer: true, hide_zero: true },
            extra_spaces: 1
        },
        {
            name: 'bz_sell',
            alias: 'bz s',
            width: 7,
            format: { integer: true, hide_zero: true },
        },
        {
            name: 'ingredient_bz_crafted_margin',
            alias: 'm %',
            width: 5,
            format: { percent: true, hide_zero: true },
            extra_spaces: 5
        },
        {
            name: 'ingredient_npc_cost',
            alias: 'npc c',
            width: 7,
            format: { integer: true, hide_zero: true },
            extra_spaces: 1
        },
        {
            name: 'ingredient_npc_crafted_cost',
            alias: 'npc cc',
            width: 7,
            format: { integer: true, hide_zero: true },
            extra_spaces: 1
        },
        {
            name: 'ingredient_npc_crafted_margin',
            alias: 'm %',
            width: 5,
            format: { percent: true, hide_zero: true },
            extra_spaces: 5
        },
        // {
        //     name: 'trackerUrl',
        //     width: -60,
        //     alias: 'Tracker URL'
        // },
        // {
        //     name: 'fandomUrl',
        //     width: -70,
        //     alias: 'Fandom URL'
        // },
    ]);
}

function parse(args) {
    program
        .parse(args);

    let options = program.opts();

    // p4(options);

    return options;
}
