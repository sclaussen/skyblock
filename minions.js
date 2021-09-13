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


const { sortBy, values,  } = _


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
            if (prices[product.name]) {
                product.cost = decimal(prices[product.name].cost, 1);
            } else {
                product.cost = decimal(bz[product.name].cost, 1);
            }
            minion.craft_cost += integer(product.count * product.cost);
        }


        let profitPerDay = 0;
        let profitPerWeek = 0;
        for (let product of minion.generates) {
            product.items_per_second = decimal(product.items_per_harvest / minion.harvest_time, 4);
            product.items_per_day_precompacted = integer(product.items_per_second * 86400);
            product.items_per_day = product.items_per_day_precompacted;
        }

        let primaryGeneratedProduct = _.find(minion.generates, { name: minion.generated_product });
        let compactedProduct = {};
        compactedProduct.name = minion.generated_product_compacted_form;
        compactedProduct.items_per_day = parseInt(primaryGeneratedProduct.items_per_day / 160);
        compactedProduct.sell = decimal(bz[compactedProduct.name].sell, 1);
        compactedProduct.profit_per_day = integer(compactedProduct.items_per_day * compactedProduct.sell);
        compactedProduct.profit_per_week = compactedProduct.profit_per_day * 7;
        primaryGeneratedProduct.items_per_day = primaryGeneratedProduct.items_per_day % 160;
        minion.generates.push(compactedProduct);

        if (minion.diamond_spreading) {
            let diamonds = {};
            diamonds.name = 'diamond';
            diamonds.items_per_action = decimal(primaryGeneratedProduct.items_per_harvest * .1, 1);
            diamonds.items_per_second = decimal(diamonds.items_per_action / minion.harvest_time, 4);
            diamonds.items_per_day = integer(diamonds.items_per_second * 86400);

            diamonds.sell = decimal(bz['diamond'].sell, 1);
            diamonds.profit_per_day = integer(diamonds.items_per_day * diamonds.sell);
            diamonds.profit_per_week = diamonds.profit_per_day * 7;
            minion.generates.push(diamonds);

            if (diamonds.items_per_day >= 160) {
                let enchantedDiamonds = {};
                enchantedDiamonds.name = 'e_diamond';
                enchantedDiamonds.items_per_day = parseInt(diamonds.items_per_day / 160);
                enchantedDiamonds.sell = decimal(bz['e_diamond'].sell, 1);
                enchantedDiamonds.profit_per_day = integer(enchantedDiamonds.items_per_day * enchantedDiamonds.sell);
                enchantedDiamonds.profit_per_week = enchantedDiamonds.profit_per_day * 7;
                diamonds.items_per_day = diamonds.items_per_day % 160;
                minion.generates.push(enchantedDiamonds);
            }
        }


        minion.profit_per_day = 0;
        minion.profit_per_week = 0;
        for (let product of minion.generates) {
            if (prices[product.name]) {
                product.sell = decimal(prices[product.name].sell, 1);
            } else {
                product.sell = decimal(bz[product.name].sell, 1);
            }

            product.profit_per_day = integer(product.items_per_day * product.sell);
            product.profit_per_week = product.profit_per_day * 7;

            minion.profit_per_day += product.profit_per_day;
            minion.profit_per_week += product.profit_per_week;
        }

        minion.profit_per_day_n = minion.profit_per_day * 20;
        minion.profit_per_week_n = minion.profit_per_week * 20;

        minion.payoff_days = integer(minion.craft_cost / minion.profit_per_day);

    }

    console.log(print(minions));

    // y4(minions);
}

function print(minions, max) {
    return table(minions, [
        {
            name: 'level',
            alias: '#',
            width: 2,
        },
        {
            name: 'minion',
            width: -20,
        },
        {
            name: 'action_time',
            alias: 'AT',
            width: 4,
            extra_spaces: 1
        },
        {
            name: 'harvest_time',
            alias: 'HT',
            width: 4,
            extra_spaces: 1
        },
        {
            name: 'craft_cost',
            alias: '$ to craft',
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
            name: 'profit_per_day_n',
            alias: '$/day xN',
            width: 11,
            format: { integer: true },
        },
        {
            name: 'profit_per_week_n',
            alias: '$/week xN',
            width: 11,
            format: { integer: true },
        },
        {
            name: 'payoff_days',
            alias: 'payoff',
            width: 9,
            format: { integer: true },
        },
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
