'use strict';
// process.env.DEBUG = 'skyblock';
const d = require('debug')('skyblock');

const fs = require('fs');
const _ = require('lodash');

const YAML = require('yaml');
var program = require('commander');

const table = require('./lib/util').table;
const getBazaarItems = require('./lib/bzlib').getBazaarItems;

const p = require('./lib/pr').p(d);
const p4 = require('./lib/pr').p4(d);
const y4 = require('./lib/pr').y4(d);

const curl = require('./lib/curl');



const cacheFile = './.auction-items';



var auctionItems;
var bazaarItems;
var forgeItems;
var options;



bz(process.argv);



async function bz(args) {
    options = parse(args);

    auctionItems = await getAuctionItems();
    bazaarItems = await getBazaarItems();
    forgeItems = YAML.parse(fs.readFileSync('./dat/forge.yaml', 'utf8'), { prettyErrors: true });

    let items = [];
    for (let forgeItemName of _.keys(forgeItems)) {

        if (options.query && !forgeItemName.includes(options.query)) {
            continue;
        }

        let bom = [];
        let forgeItem = await getForgeItemCost(forgeItemName, bom);

        items.push({
            name: forgeItemName,
            duration: money(forgeItem.total_duration),
            cost: forgeItem.total_cost,
            sell: forgeItem.sell,
            profit: forgeItem.profit,
            full_forge_profit: forgeItem.profit * 4,
            profit_per_hour: forgeItem.profit_per_hour,
            bom: bom
        });
    }

    p4(items);

    console.log(print(items));

    if (options.bom) {
        for (let item of items) {
            console.log();
            console.log(item.name + ' ' + item.cost + ' ' + item.sell + ' ' + item.profit);
            console.log(printBom(item.bom));
        }
    }
}


async function getForgeItemCost(forgeItemName, bom) {

    let forgeItem = forgeItems[forgeItemName];
    // if (forgeItem && forgeItem.total_cost) {
    //     return forgeItem;
    // }

    p(' ');
    p(forgeItemName);
    forgeItem.total_cost = 0;
    forgeItem.total_duration = forgeItem.duration;
    for (let subassemblyName of _.keys(forgeItem.craft)) {

        if (subassemblyName === 'coins') {
            updateBom(bom, 'coins', forgeItem.craft[subassemblyName], 'purse');
            forgeItem.total_cost += forgeItem.craft[subassemblyName];
            continue;
        }


        // Determine the cost of the subassembly
        let subassemblyCostResponse = await getItemCost(subassemblyName, bom);
        let subassemblyCost = subassemblyCostResponse.cost;


        // If the subassembly requires forging add its duration
        if (subassemblyCostResponse.source === 'forge') {
            forgeItem.total_duration += subassemblyCostResponse.duration;
        }


        // Retrieve the number of subassembly items required
        let subassemblyCount = forgeItem.craft[subassemblyName];


        // Calculate the cost via subassembly items * their count
        let subassemblyTotalCost = money(subassemblyCount * subassemblyCost);
        forgeItem.total_cost += subassemblyTotalCost;


        p('    ' + subassemblyName + ': ' + subassemblyCost + ' x ' + subassemblyCount + ' = ' + subassemblyTotalCost);


        if (subassemblyCostResponse.source !== 'forge') {
            updateBom(bom, subassemblyName, subassemblyCount, subassemblyCostResponse.source, subassemblyCost, subassemblyTotalCost);
        }
    }


    forgeItem.sell = await getForgeItemSellPrice(forgeItemName);
    forgeItem.profit = 0;
    forgeItem.profit_per_hour = 0;
    if (forgeItem.sell > 0) {
        forgeItem.profit = money(forgeItem.sell - forgeItem.total_cost);
        forgeItem.profit_per_hour = money(forgeItem.profit / forgeItem.total_duration);
    }


    p('    duration: ' + forgeItem.total_duration);
    p('    cost: ' + forgeItem.total_cost);
    p('    sell: ' + forgeItem.sell);
    p('    profit: ' + forgeItem.profit);
    p('    profit per hour: ' + forgeItem.profit_per_hour);
    return forgeItem;
}


function updateBom(bom, name, count, source, cost, totalCost) {
    let x = _.find(bom, { name: name });
    if (x) {
        x.count += count;
        x.totalCost = money(x.count * x.cost);
        return;
    }

    bom.push({
        name: name,
        source: source,
        count: count,
        cost: cost,
        total_cost: totalCost
    });
}


async function getItemCost(name, bom) {
    if (forgeItems[name]) {
        let response = await getForgeItemCost(name, bom);
        return {
            cost: response.total_cost,
            source: 'forge',
            duration: response.total_duration,
        }
    }

    let cost = await getBazaarItemCost(name);
    if (cost !== 0) {
        return {
            cost: cost,
            source: 'bazaar'
        }
    }

    cost = await getAuctionPrice(name);
    if (cost === 0) {
        console.log('WARNING: Unable to find the cost of: ' + name);
    }
    return {
        cost: cost,
        source: 'auction'
    }
}


async function getBazaarItemCost(name) {
    if (bazaarItems[name]) {
        p('    ' + name + ' bazaar cost: ' + bazaarItems[name].cost);
        return bazaarItems[name].cost;
    }

    return 0;
}


function getAuctionPrice(itemName) {
    let itemNameWithSpaces = itemName.replaceAll('_', ' ');
    let matches = sortAuctions(filterAuctionsByCriteria(auctionItems, { query: itemNameWithSpaces }));
    if (matches.length === 0) {
        return 0;
    }

    p('    ' + itemNameWithSpaces + ' auction price: ' + matches[0].cost);
    return matches[0].cost;
}


async function getForgeItemSellPrice(forgeItemName) {
    let sell = await getBazaarItemSellPrice(forgeItemName);
    if (sell !== 0) {
        return sell;
    }

    sell = await getAuctionPrice(forgeItemName);
    if (sell === 0) {
        console.log('WARNING: Unable to find the sell price for: ' + forgeItemName);
    }
    return sell;
}


async function getBazaarItemSellPrice(forgeItemName) {
    if (bazaarItems[forgeItemName]) {
        p('    bazaar sell: ' + bazaarItems[forgeItemName].sell);
        return bazaarItems[forgeItemName].sell;
    }

    return 0;
}


async function getAuctionItems() {
    let auctions = JSON.parse(fs.readFileSync(cacheFile));
    return auctions;
}


function filterAuctionsByCriteria(auctionItems, criteria) {

    // Find the auctions containing the user specified query
    return _.filter(auctionItems, function(o) {

        // Match the name PRECISELY
        if (!(o.name === criteria.query)) {
            return false;
        }

        // // Do not match anything the user running this has for sale
        // if (o.seller === uuid) {
        //     return false;
        // }

        // Match the tier
        if (criteria.tier && !o.tier.includes(criteria.tier)) {
            return false;
        }

        // // Match the seller
        // if (criteria.seller && !o.seller.includes(criteria.seller)) {
        //     return false;
        // }

        // Match the reforge
        if (criteria.reforge && !o.reforge.includes(criteria.reforge)) {
            return false;
        }

        // Match only enchanted book phrases if -e was provided
        if (criteria.enchantment && !o.name.includes('enchanted book')) {
            return false;
        }

        // Match the extra metadata if values were provided
        if (criteria.extra) {
            for (let extraPhrase of criteria.extra) {
                if (!o.enchantments.includes(extraPhrase)) {
                    return false;
                }
            }
        }

        if (criteria.clean) {
            if (o.enchantments !== '') {
                return false;
            }
        }

        // Verify the selling prices is less than the max
        if (criteria.max) {
            if (!(o.cost < criteria.max)) {
                return false;
            }
        }

        // Match the star rating if it was provided
        if (criteria.stars >= 0) {
            switch (criteria.stars) {
            case 0:
                if (o.stars !== '') {
                    return false;
                }
                break;
            case 5:
                if (o.stars !== '✪✪✪✪✪') {
                    return false;
                }
                break;
            case 4:
                if (o.stars !== '✪✪✪✪') {
                    return false;
                }
                break;
            case 3:
                if (o.stars !== '✪✪✪') {
                    return false;
                }
                break;
            case 2:
                if (o.stars !== '✪✪') {
                    return false;
                }
                break;
            case 1:
                if (o.stars !== '✪') {
                    return false;
                }
                break;
            }
        }

        return true;
    });
}


function sortAuctions(auctionItems) {
    return _.sortBy(auctionItems, [ 'name', 'cost' ]);
}


function money(n) {
    return Math.round(100 * n) / 100;
}


function print(forgeItems) {
    forgeItems = _.sortBy(forgeItems, [ 'profit_per_hour' ]);
    return table(forgeItems, [
        {
            name: 'name',
            width: -40,
        },
        {
            alias: 'hrs',
            name: 'duration',
            width: 6,
            extra_spaces: 2
        },
        {
            name: 'cost',
            width: 12,
            format: { integer: true },
            extra_spaces: 1,
        },
        {
            name: 'sell',
            width: 12,
            format: { integer: true },
            extra_spaces: 1,
        },
        {
            name: 'profit',
            width: 12,
            format: { integer: true },
            extra_spaces: 1,
        },
        {
            name: 'full_forge_profit',
            alias: '$ for 4',
            width: 12,
            format: { integer: true },
            extra_spaces: 1,
        },
        {
            name: 'profit_per_hour',
            alias: '$/hr',
            width: 12,
            format: { integer: true },
            extra_spaces: 1,
        },
    ]);
}


function printBom(bom) {
    return table(bom, [
        {
            name: 'name',
            width: -20,
        },
        {
            name: 'source',
            width: -8,
        },
        {
            name: 'count',
            width: 4,
            format: { integer: true },
            extra_spaces: 1,
        },
        {
            name: 'cost',
            width: 12,
            format: { integer: true },
            extra_spaces: 1,
        },
        {
            name: 'total_cost',
            width: 12,
            format: { integer: true },
            extra_spaces: 1,
        },
    ]);
}


function parse(args) {
    program
        .option('-b, --bom', 'Show the bill of materials')
        .addHelpText('after', `
examples here
`)
        .parse(args);

    let options = program.opts();

    if (program.args[0]) {
        options.query = program.args[0].toLowerCase();
    }

    // p4(options);

    return options;
}
