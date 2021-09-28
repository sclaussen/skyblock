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

const writeBazaarItemsCache = require('./lib/bzlib').writeBazaarItemsCache;
const readBazaarItemsCache = require('./lib/bzlib').readBazaarItemsCache;

const table = require('./lib/util').table;

const p = require('./lib/pr').p(d);
const e = require('./lib/pr').e(d);
const p4 = require('./lib/pr').p4(d);
const y4 = require('./lib/pr').y4(d);


var options;


minions(process.argv);


async function minions(args) {

    options = parse(args);

    await writeBazaarItemsCache();
    let bz = await readBazaarItemsCache();
    let minions = YAML.parse(fs.readFileSync('./minions.yaml', 'utf8'), { prettyErrors: true });
    let prices = YAML.parse(fs.readFileSync('./prices.yaml', 'utf8'), { prettyErrors: true });

    for (let minion of minions) {


        // Determine the action time adjustment due to fuel
        let fuelEfficiency = 1;
        if (minion.enchanted_lava_bucket) {
            fuelEfficiency = 1 / (1 + .25);
        }
        minion.action_time_with_fuel = decimal(minion.action_time * fuelEfficiency, 4);


        // "harvest_time" calculation
        minion.harvest_time = decimal(minion.action_time_with_fuel * 2, 1);


        // "craft_cost" and each product's "cost"
        minion.craft_cost = 0;
        for (let product of minion.craft) {
            product.cost = decimal(getProduct(prices, bz, product.name).cost, 1);
            minion.craft_cost += integer(product.quantity * product.cost);
        }


        let profitPerDay = 0;
        let profitPerWeek = 0;


        // Calculate items/day and xp/day
        for (let product of minion.generates) {
            product.items_per_second = decimal(product.items_per_harvest / minion.harvest_time, 4);
            product.items_per_day_precompacted = integer(product.items_per_second * 86400);
            product.items_per_day = product.items_per_day_precompacted;
            product.xp_per_day = product.items_per_day * product.xp_per_item;
        }

        // Diamond spreading
        if (minion.diamond_spreading) {
            let diamonds = {};
            diamonds.name = 'diamond';
            diamonds.items_per_second = decimal(0.1 / minion.harvest_time, 4);
            diamonds.items_per_day = integer(diamonds.items_per_second * 86400);
            diamonds.compacted_form = {
                name: 'e_diamond',
                quantity: 160
            };
            minion.generates.push(diamonds);
        }

        // Compact items
        for (let product of minion.generates) {
            if (product.compacted_form) {
                let compacted = {};
                compacted.name = product.compacted_form.name;
                compacted.items_per_day = parseInt(product.items_per_day / product.compacted_form.quantity);
                product.items_per_day = product.items_per_day % product.compacted_form.quantity; // adjust due to compaction
                minion.generates.push(compacted);
            }
        }

        minion.profit_per_day = 0;
        minion.profit_per_week = 0;
        for (let product of minion.generates) {

            product.sell = decimal(getProduct(prices, bz, product.name).sell, 1);

            product.profit_per_day = integer(product.items_per_day * product.sell);
            product.profit_per_week = product.profit_per_day * 7;

            minion.profit_per_day += product.profit_per_day;
            minion.profit_per_week += product.profit_per_week;
        }

        minion.profit_per_day_20 = minion.profit_per_day * 20;
        minion.profit_per_week_20 = minion.profit_per_week * 20;

        minion.payoff_days = integer(minion.craft_cost / minion.profit_per_day);

        // Create a summary of what/how much is required to craft the minion
        minion.craft_summary = '';
        for (let product of minion.craft) {
            minion.craft_summary += '[' + product.name + ' x' + product.quantity + '] ';
        }

        // Create a summary of what/how much was generated per day
        minion.daily_generation_summary = '';
        for (let product of minion.generates) {
            minion.daily_generation_summary += '[' + product.name + ' x' + product.items_per_day + ' @ ' + integer(product.sell) + '] ';
        }
    }

    console.log(print(_.sortBy(_.filter(minions, { tier: 7 }), [ 'profit_per_day' ]).reverse()));
    // console.log(print(minions));

    // y4(minions);
}

function getProduct(prices, bz, name) {
    if (prices[name]) {
        return prices[name];
    }
    if (bz[name]) {
        return bz[name];
    }

    console.log('ERROR: Unable to find the product in prices.yaml or the bazaar: ' + name);
    process.exit(1);
}

function print(minions, max) {
    return table(minions, [
        {
            name: 'tier',
            alias: '#',
            width: 2,
        },
        {
            name: 'minion',
            width: -20,
        },
        {
            name: 'action_time',
            alias: 'act',
            width: 4,
            extra_spaces: 1
        },
        {
            name: 'harvest_time',
            alias: 'hvst',
            width: 4,
            extra_spaces: 1
        },
        {
            name: 'craft_cost',
            alias: '$/craft',
            width: 10,
            format: { integer: true },
        },
        {
            name: 'profit_per_day',
            alias: '$/day',
            width: 11,
            format: { integer: true },
        },
        {
            name: 'profit_per_week',
            alias: '$/week',
            width: 11,
            format: { integer: true },
        },
        {
            name: 'profit_per_day_20',
            alias: '$/day x20',
            width: 11,
            format: { integer: true },
        },
        {
            name: 'profit_per_week_20',
            alias: '$/week x20',
            width: 11,
            format: { integer: true },
        },
        {
            name: 'payoff_days',
            alias: 'payoff',
            width: 9,
            format: { integer: true },
        },
        {
            name: 'craft_summary',
            alias: 'craft',
            width: -30,
        },
        // {
        //     name: 'daily_generation_summary',
        //     alias: 'generates/day',
        //     width: -30,
        // },

    ], max);
}

function decimal(n, digits) {
    return parseFloat(Number.parseFloat(n).toFixed(digits));
}

function integer(n) {
    return parseInt(Number.parseFloat(n).toFixed(0));
}

function parse(args) {

    program
        .parse(args);

    let options = program.opts();

    // p4(options);

    return options;
}
