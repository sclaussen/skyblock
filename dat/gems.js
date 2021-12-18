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



gems(process.argv);



async function bz(args) {
    options = parse(args);
    try {
        auctionItems = await getAuctionItems();
        bazaarItems = await getBazaarItems();
    } catch (ENOTFOUND) {
    }

}


async function getBazaarItemCost(name) {
    if (bazaarItems && bazaarItems[name]) {
        // p('    ' + name + ' bazaar cost: ' + bazaarItems[name].cost);
        return bazaarItems[name].sell;
    }

    return 0;
}
