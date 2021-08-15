'use strict';
// process.env.DEBUG = 'skyblock';
const d = require('debug')('skyblock');

const fs = require('fs');
const util = require('util');
const _ = require('lodash');

const YAML = require('yaml');
const moment = require('moment');
const clicolor = require('cli-color');
var program = require('commander');

const curl = require('./curl');
const p = require('./pr').p(d);
const p4 = require('./pr').p4(d);


var options;

var config = {

    buyMaximum: 10000000,
    ordersMaximum: 1500
};


bazaar(process.argv);


async function bazaar(args) {
    // Parse the options
    options = parse(args);

    let bazaar = (await curl.get('https://api.hypixel.net/skyblock/bazaar')).body;
    // "quick_status": {
    //     "productId": "ENCHANTED_BAKED_POTATO",
    //     "sellPrice": 24748.946948999233,
    //     "sellVolume": 2336256,
    //     "sellMovingWeek": 447388,
    //     "sellOrders": 688,
    //     "buyPrice": 26146.401687160418,
    //     "buyVolume": 150287,
    //     "buyMovingWeek": 303975,
    //     "buyOrders": 332
    // }


    let products = {};
    for (let itemName of _.keys(bazaar.products)) {
        if (itemName === 'BAZAAR_COOKIE') {
            continue;
        }


        products[itemName] = {
            name: itemName.toLowerCase().replace('enchanted', 'e'),
            margin: ~~(((bazaar.products[itemName].quick_status.buyPrice - bazaar.products[itemName].quick_status.sellPrice) / bazaar.products[itemName].quick_status.sellPrice) * 100),
            buyToSellOrdersRatio: ((bazaar.products[itemName].quick_status.sellOrders - bazaar.products[itemName].quick_status.buyOrders) / bazaar.products[itemName].quick_status.buyOrders),
            buyToSellOrdersRatioFormatted: (((bazaar.products[itemName].quick_status.sellOrders - bazaar.products[itemName].quick_status.buyOrders) / bazaar.products[itemName].quick_status.buyOrders) * 100).toFixed(0),
            buyToSellVolumeRatio: ((bazaar.products[itemName].quick_status.sellVolme - bazaar.products[itemName].quick_status.buyVolume) / bazaar.products[itemName].quick_status.buyVolume),
            buyToSellVolumeRatioFormatted: (((bazaar.products[itemName].quick_status.sellVolume - bazaar.products[itemName].quick_status.buyVolume) / bazaar.products[itemName].quick_status.buyVolume) * 100).toFixed(0),
            buyPrice: Number.parseFloat(bazaar.products[itemName].quick_status.sellPrice).toFixed(1),
            sellPrice: Number.parseFloat(bazaar.products[itemName].quick_status.buyPrice).toFixed(1),
            buyOrders: bazaar.products[itemName].quick_status.sellOrders,
            sellOrders: bazaar.products[itemName].quick_status.buyOrders,
            totalOrders: bazaar.products[itemName].quick_status.buyOrders + bazaar.products[itemName].quick_status.sellOrders,
            sellVolume: (bazaar.products[itemName].quick_status.buyVolume / 1000).toFixed(0),
            buyVolume: (bazaar.products[itemName].quick_status.sellVolume / 1000).toFixed(0),
            buyVolumeWeek: bazaar.products[itemName].quick_status.sellMovingWeek,
            sellVolumeWeek: bazaar.products[itemName].quick_status.buyMovingWeek,
            volumeWeek: (bazaar.products[itemName].quick_status.buyMovingWeek / 1000000).toFixed(1) + 'M',
            url: getUrl(itemName)
        };

        products[itemName].orders = '(' + products[itemName].sellOrders.toString().padStart(3, ' ') + '/' + products[itemName].buyOrders.toString().padStart(3, ' ') + ')';
        products[itemName].volume = '(' + products[itemName].sellVolume.toString().padStart(4, ' ') + '/' + products[itemName].buyVolume.toString().padStart(4, ' ') + ')';

        let millionQuantity = 1000000 / bazaar.products[itemName].quick_status.sellPrice;
        let millionQuantityRounded = Math.round(millionQuantity / 100) * 100;
        products[itemName].name += ' (' + millionQuantityRounded + ')';
    }

    var filteredProducts = _.orderBy(_.filter(products, function(o) {
        // return o.margin > marginMinimum && o.buyPrice > config.buyPriceMinimum && o.buyPrice < config.buyMaximum && o.sellVolumeWeek > config.volumeMinimum && o.totalOrders < config.ordersMaximum
        return o.margin > parseInt(options.marginMinimum) && o.sellVolumeWeek > parseInt(options.volumeMinimum) && o.buyPrice > parseInt(options.buyPriceMinimum)
    }), 'margin', 'desc');

    table(filteredProducts);
}

function getUrl(itemName) {
    let url = {
        enchanted_endstone: 'enchanted_end_stone'
    };

    let baseUrl = itemName.toLowerCase();
    if (url[baseUrl]) {
        baseUrl = url[baseUrl];
    }

    return 'https://bazaartracker.com/product/' + baseUrl;
}

function table(products) {
    let fields = {
        margin: {
            padding: 3,
            alias: '%',
            highlight_green_above: 12,
            highlight_red_below: 8
        },
        buyPrice: {
            padding: 7,
            alias: 'buy',
        },
        sellPrice: {
            padding: 7,
            alias: 'sell',
        },
        // buyToSellOrdersRatioFormatted: {
        //     padding: 5,
        //     alias: 'ord',
        //     highlight: 'normal',
        //     highlight_green_above: 1.0,
        //     highlight_red_below: 0.8
        // },
        // orders: {
        //     padding: 10,
        //     alias: ''
        // },
        // buyToSellVolumeRatioFormatted: {
        //     padding: 5,
        //     alias: 'vol',
        //     highlight: 'normal',
        //     highlight_green_above: 1.0,
        //     highlight_red_below: 0.8
        // },
        // volume: {
        //     padding: 10,
        //     alias: 'K'
        // },
        // totalOrders: {
        //     padding: 5,
        //     alias: 'ord',
        //     highlight_green_below: 500,
        //     highlight_red_above: 1200,
        // },
        // buyOrders: {
        //     padding: 5,
        //     alias: 'bor',
        // },
        // sellOrders: {
        //     padding: 5,
        //     alias: 'sor',
        // },
        name: {
            padding: -25,
            alias: 'product',
        },
        // buyVolume: {
        //     padding: 5,
        //     alias: 'bvol',
        // },
        // sellVolume: {
        //     padding: 5,
        //     alias: 'svol',
        // },
        url: {
            padding: -80,
            alias: 'url',
        },
    };

    let header = '';
    for (let fieldName of _.keys(fields)) {
        let padding = fields[fieldName].padding;
        let alias = fields[fieldName].alias;
        if (padding < 0) {
            header += alias.padEnd(0 - padding, ' ') + ' ';
        } else {
            header += alias.padStart(padding, ' ') + ' ';
        }
    }
    console.log(header);

    let counter = 0;
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

        counter++;
        if (counter > parseInt(options.limit)) {
            process.exit(0);
        }
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


function parse(args) {

    program
        .option('-b, --buy-price-minimum <buy-proce-minimum>', 'Minimum buy price', '250')
        .option('-m, --margin-minimum <margin-minimum>', 'Minimum margin', '3')
        .option('-v, --volume-minimum <volume-minimum>', 'Minimum volume', '1000000')
        .option('-x, --extra', 'Adds extra order/volume fields to the output')
        .option('-l, --limit <limit>', 'Limit items returned', '35')
        .parse(args);

    let options = program.opts();

    p4(options);

    return options;
}
