'use strict';
process.env.DEBUG = 'skyblock';
const d = require('debug')('skyblock');
const { parse, writeUncompressed } = require('prismarine-nbt')


const curl = require('./lib/curl');
const p = require('./lib/pr').p(d);
const p4 = require('./lib/pr').p4(d);


main();


// https://github.com/PrismarineJS/prismarine-nbt/blob/master/sample/readmeExample.js
async function main() {
    let auctions = (await curl.get('https://api.hypixel.net/skyblock/auctions')).body.auctions;
    let auction1 = auctions[0];
    p4(auction1);

    let data = auction1.item_bytes;


}
