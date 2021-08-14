'use strict';
const d = require('debug')('skyblock');

const fs = require('fs');
const util = require('util');
const _ = require('lodash');

const YAML = require('yaml');
const moment = require('moment');
const clicolor = require('cli-color');

const curl = require('./curl');
const p = require('./pr').p(d);
const p4 = require('./pr').p4(d);


var options = {
    marginMinimum: 0,
    buyMinimum: 250,
    buyMaximum: 10000000,
    volumeMinimum: 1000000,
    ordersMaximum: 1500
};


bazaar(process.argv);


async function bazaar(args) {
    let bazaar = (await curl.get('https://api.hypixel.net/skyblock/bazaar')).body;
    // skyblock             "quick_status": {
    // skyblock                 "productId": "ENCHANTED_BAKED_POTATO",
    // skyblock                 "sellPrice": 24748.946948999233,
    // skyblock                 "sellVolume": 2336256,
    // skyblock                 "sellMovingWeek": 447388,
    // skyblock                 "sellOrders": 688,
    // skyblock                 "buyPrice": 26146.401687160418,
    // skyblock                 "buyVolume": 150287,
    // skyblock                 "buyMovingWeek": 303975,
    // skyblock                 "buyOrders": 332
    // skyblock             }
    // skyblock         },

//     let url = 'https://bazaartracker.com/product/';
//     let bazaarTracker = {
// whale_bait
//     }


    let products = {};
    for (let product of _.keys(bazaar.products)) {
        if (product === 'BAZAAR_COOKIE') {
            continue;
        }

        products[product] = {
            name: product.toLowerCase().replace('enchanted', 'e') + ' (' + (1000000 / bazaar.products[product].quick_status.sellPrice).toFixed(0) + ')',
            margin: ~~(((bazaar.products[product].quick_status.buyPrice - bazaar.products[product].quick_status.sellPrice) / bazaar.products[product].quick_status.sellPrice) * 100),
            // ratio0: ((bazaar.products[product].quick_status.sellOrders - bazaar.products[product].quick_status.buyOrders) / bazaar.products[product].quick_status.buyOrders),
            buyToSellOrdersRatio: bazaar.products[product].quick_status.sellOrders / bazaar.products[product].quick_status.buyOrders,
            buyToSellOrdersRatioFormatted: (bazaar.products[product].quick_status.sellOrders / bazaar.products[product].quick_status.buyOrders).toFixed(1),
            buyToSellVolumeRatio: bazaar.products[product].quick_status.sellVolume / bazaar.products[product].quick_status.buyVolume,
            buyToSellVolumeRatioFormatted: (bazaar.products[product].quick_status.sellVolume / bazaar.products[product].quick_status.buyVolume).toFixed(1),
            buyPrice: Number.parseFloat(bazaar.products[product].quick_status.sellPrice).toFixed(1),
            sellPrice: Number.parseFloat(bazaar.products[product].quick_status.buyPrice).toFixed(1),
            buyOrders: bazaar.products[product].quick_status.sellOrders,
            sellOrders: bazaar.products[product].quick_status.buyOrders,
            totalOrders: bazaar.products[product].quick_status.buyOrders + bazaar.products[product].quick_status.sellOrders,
            sellVolume: (bazaar.products[product].quick_status.buyVolume / 1000000).toFixed(1) + 'M',
            buyVolume: (bazaar.products[product].quick_status.sellVolume / 1000000).toFixed(1) + 'M',
            buyVolumeWeek: bazaar.products[product].quick_status.sellMovingWeek,
            sellVolumeWeek: bazaar.products[product].quick_status.buyMovingWeek,
            volumeWeek: (bazaar.products[product].quick_status.buyMovingWeek / 1000000).toFixed(1) + 'M',
            quantity100: (100000 / bazaar.products[product].quick_status.sellPrice).toFixed(0),
            quantity500: (500000 / bazaar.products[product].quick_status.sellPrice).toFixed(0),
            quantity1M: (1000000 / bazaar.products[product].quick_status.sellPrice).toFixed(0),
            url: 'https://bazaartracker.com/product/' + product.toLowerCase()
        };
    }

    // p4(products);

    var filteredProducts = _.orderBy(_.filter(products, function(o) {
        return o.margin > options.marginMinimum && o.buyPrice > options.buyMinimum && o.buyPrice < options.buyMaximum && o.sellVolumeWeek > options.volumeMinimum && o.totalOrders < options.ordersMaximum
    }), 'margin', 'desc');

    table(filteredProducts);
}


function table(products) {
    let fields = {
        margin: {
            padding: 3,
            alias: '%',
            highlight_green_above: 12,
            highlight_red_below: 8
        },
        buyToSellOrdersRatioFormatted: {
            padding: 5,
            alias: 'b/s o',
            highlight: 'normal',
            highlight_green_above: 1.0,
            highlight_red_below: 0.8
        },
        buyToSellVolumeRatioFormatted: {
            padding: 5,
            alias: 'b/s v',
            highlight: 'normal',
            highlight_green_above: 1.0,
            highlight_red_below: 0.8
        },
        totalOrders: {
            padding: 5,
            alias: 'ord',
            highlight_green_below: 500,
            highlight_red_above: 1200,
        },
        buyOrders: {
            padding: 5,
            alias: 'bor',
        },
        sellOrders: {
            padding: 5,
            alias: 'sor',
        },
        name: {
            padding: -25,
            alias: 'product',
        },
        buyPrice: {
            padding: 7,
            alias: 'buy',
        },
        sellPrice: {
            padding: 7,
            alias: 'sell',
        },
        buyVolume: {
            padding: 5,
            alias: 'bvol',
        },
        sellVolume: {
            padding: 5,
            alias: 'svol',
        },
        url: {
            padding: -80,
            alias: 'url',
        },
    };

    let header = '';
    for (let field of _.keys(fields)) {
        let padding = fields[field].padding;
        let alias = fields[field].alias;
        if (padding < 0) {
            header += alias.padEnd(0 - padding, ' ') + ' ';
        } else {
            header += alias.padStart(padding, ' ') + ' ';
        }
    }
    console.log(header);

    for (let product of products) {
        if (product.name === 'jacobs_ticket') {
            continue;
        }
        let row = '';
        for (let fieldName of _.keys(fields)) {
            let value = product[fieldName];
            let padding = fields[fieldName].padding;
            if (padding < 0) {
                row += highlight(fields[fieldName], value, value.toString().padEnd(0 - padding, ' ') + ' ');
            } else {
                row += highlight(fields[fieldName], value, value.toString().padStart(padding, ' ') + ' ');
            }
        }

        console.log(row);
    }
}


function highlight(field, value, s) {
    if (field.highlight_green_above && value >= field.highlight_green_above) {
        return clicolor.yellowBright(s);
    }

    if (field.highlight_green_below && value <= field.highlight_green_below) {
        return clicolor.yellowBright(s);
    }

    if (field.highlight_red_above && value >= field.highlight_red_above) {
        return clicolor.red(s);
    }

    if (field.highlight_red_below && value <= field.highlight_red_below) {
        return clicolor.red(s);
    }

    return s;
}
