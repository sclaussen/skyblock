'use strict';
process.env.DEBUG = 'skyblock';
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



const auctionCacheFile = './.auction-items';
const bazaarCacheFile = './.bazaar-items';



var auctionItems;
var bazaarItems;
var stanzas;
var options;



forge(process.argv);



async function forge(args) {
    options = parse(args);

    // Retrieve metadata (auctions items, bazaar items, stanzas)
    try {
        auctionItems = await getAuctionItems();
        bazaarItems = await getBazaarItems();
    } catch (ENOTFOUND) {
    }
    stanzas = YAML.parse(fs.readFileSync('./dat/forge.yaml', 'utf8'), { prettyErrors: true });


    // Process stanzas calculating cost/materials
    let forgeItems = [];
    for (let stanzaName of _.keys(stanzas)) {
        if (options.query && !stanzaName.includes(options.query)) {
            continue;
        }

        let forgeItem = await getForgeItem(stanzaName);
        forgeItems.push(forgeItem);
        // y4(forgeItems);
    }


    // Print output of the calculations
    // p4(forgeItems);
    console.log(print(forgeItems));
    if (options.materials) {
        for (let forgeItem of forgeItems) {
            console.log();
            console.log();
            console.log('Raw Materials:');
            console.log();
            console.log(printMaterials(forgeItem.materials));

            console.log();
            console.log('Forges:');
            for (let forge of forgeItem.forges) {
                let forgeName = forge.name;
                let stanza = stanzas[forgeName];
                console.log();
                console.log('    ' + forgeName + ' (' + forge.count + '):');
                for (let material of _.keys(stanza.materials)) {
                    console.log('        ' + material + ': ' + stanza.materials[material]);
                }
            }
        }
    }
}


async function getForgeItem(stanzaName) {
    let stanza = stanzas[stanzaName];
    let alias = stanza.alias || stanza.name;

    let forgeItem = {
        name: stanzaName,
        alias: alias,
        source: 'forge',
        order: stanza.order,
        duration: money(stanza.duration),
        count: 1,
        cost: 0,
        breaking_power: stanza.breaking_power,
        speed: stanza.speed,
        fortune: stanza.fortune,
        materials: [],
        forges: [],
    };
    forgeItem.forges = updateForges(forgeItem.forges, stanzaName, alias, 1, stanza.order);

    for (let material of _.keys(stanza.materials)) {

        let count = stanza.materials[material];
        let source;
        let cost;


        let materialAcquisitionSource = await getMaterialAcquisitionSource(material);
        switch (materialAcquisitionSource) {

        case 'purse':
            source = 'purse';
            cost = count;
            break;

        case 'bazaar':
            source = 'bazaar';
            cost = await getBazaarItemCost(material);
            break;

        case 'auction':
            source = 'auction';
            cost = await getAuctionPrice(material);
            break;

        case 'forge':
            source = 'forge';
            let forgedMaterial = await getForgeItem(material);
            cost = forgedMaterial.cost;
            let materialStanza = stanzas[material];
            material = materialStanza.alias || materialStanza.name;

            forgeItem.duration += forgedMaterial.duration;

            for (let descendentMaterial of forgedMaterial.materials) {
                forgeItem.materials = updateMaterials(forgeItem.materials, descendentMaterial.alias, descendentMaterial.source, descendentMaterial.count * count, descendentMaterial.cost);
            }

            for (let descendentForge of forgedMaterial.forges) {
                forgeItem.forges = updateForges(forgeItem.forges, descendentForge.name, descendentForge.alias, descendentForge.count * count, descendentForge.order);
            }

            break;
        }

        forgeItem.cost += money(cost * count);

        if (source !== 'forge') {
            forgeItem.materials = updateMaterials(forgeItem.materials, material, source, count, cost);
        }
    }

    forgeItem.forges = _.sortBy(forgeItem.forges, [ 'order' ]);
    // y4(forgeItem);
    return forgeItem;
}


function updateForges(forges, name, alias, count, order) {
    let forge = _.find(forges, { name: alias });
    if (!forge) {
        forges.push({
            name: name,
            alias: alias,
            count: count,
            order: order,
        });
        return forges;
    }

    forge.count += count;
    return forges;
}


function updateMaterials(materials, alias, source, count, cost) {
    let material = _.find(materials, { alias: alias });
    if (!material) {
        materials.push({
            alias: alias,
            source: source,
            count: count,
            cost: cost,
            total_cost: money(cost * count),
        });
        // p4(materials);
        return materials;
    }

    material.count += count;
    material.total_cost = money(material.cost * material.count);
    // p4(materials);
    return materials;
}


async function getMaterialAcquisitionSource(name) {
    if (name === 'coins') {
        return 'purse';
    }

    if (stanzas[name]) {
        return 'forge';
    }

    let cost = await getBazaarItemCost(name);
    if (cost !== 0) {
        return 'bazaar';
    }

    cost = await getAuctionPrice(name);
    if (cost !== 0) {
        return 'auction';
    }

    console.log('WARNING: Unable to find: ' + name);
    return 'auction';
}


async function getBazaarItemCost(name) {
    if (bazaarItems && bazaarItems[name]) {
        // p('    ' + name + ' bazaar cost: ' + bazaarItems[name].cost);
        return bazaarItems[name].sell;
    }

    return 0;
}


function getAuctionPrice(itemName) {
    let itemNameWithSpaces = itemName.replaceAll('_', ' ');
    let matches = sortAuctions(filterAuctionsByCriteria(auctionItems, { query: itemNameWithSpaces }));
    if (matches.length === 0) {
        return 0;
    }

    // p('    ' + itemNameWithSpaces + ' auction price: ' + matches[0].cost);
    return matches[0].cost;
}


async function getAuctionItems() {
    let auctions = JSON.parse(fs.readFileSync(auctionCacheFile));
    return auctions;
}


// async function getBazaarItems() {
//     let bazaarItems = JSON.parse(fs.readFileSync(bazaarCacheFile));
//     return bazaarItems;
// }


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
    return Math.round(n);
    // return Number(Number.parseFloat(Math.round(n)).toFixed(0)).toLocaleString();
}


function print(forgeItems) {
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
            width: 13,
            format: { integer: true },
            extra_spaces: 1,
        },
        {
            name: 'breaking_power',
            alias: 'bp',
            width: 2,
            format: { integer: true },
            extra_spaces: 1,
        },
        {
            name: 'speed',
            width: 6,
            format: { integer: true },
            extra_spaces: 1,
        },
        {
            name: 'fortune',
            alias: 'for',
            width: 6,
            format: { integer: true },
            extra_spaces: 1,
        },
        // {
        //     name: 'sell',
        //     width: 12,
        //     format: { integer: true },
        //     extra_spaces: 1,
        // },
        // {
        //     name: 'profit',
        //     width: 12,
        //     format: { integer: true },
        //     extra_spaces: 1,
        // },
        // {
        //     name: 'full_forge_profit',
        //     alias: '$ for 4',
        //     width: 12,
        //     format: { integer: true },
        //     extra_spaces: 1,
        // },
        // {
        //     name: 'profit_per_hour',
        //     alias: '$/hr',
        //     width: 12,
        //     format: { integer: true },
        //     extra_spaces: 1,
        // },
    ]);
}


function printMaterials(materials) {
    materials = _.orderBy(materials, [ 'total_cost' ], 'desc');
    return table(materials, [
        {
            name: 'alias',
            width: -20,
            indent: 4
        },
        {
            name: 'count',
            alias: '#',
            width: 9,
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
        {
            name: 'source',
            width: -8,
        },
    ]);
}


function parse(args) {
    program
        .option('-m, --materials', 'Show the required raw materials')
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
