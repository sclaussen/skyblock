'use strict';
process.env.DEBUG = 'skyblock';
const d = require('debug')('skyblock');

const _ = require('lodash');

const YAML = require('yaml');
const program = require('commander');

const writeAuctionItemsCache = require('./lib/auclib').writeAuctionItemsCache;
const readAuctionItemsCache = require('./lib/auclib').readAuctionItemsCache;
const print = require('./lib/auclib').print;

const table = require('./lib/util').table;
const rj = require('./lib/util').rj;
const lj = require('./lib/util').lj;
const coins = require('./lib/util').coins;

const p = require('./lib/pr').p(d);
const p4 = require('./lib/pr').p4(d);


const { sortBy, values,  } = _


auc(process.argv);


var options;


// Usage: node auction keyword [r]
async function auc(args) {

    // Parse the options
    options = parse(args);

    // Call the skyblock API to fetch and cache the auctions if the
    // -R flag was specified
    if (options.retrieve) {
        await writeAuctionItemsCache();
    }

    // Read in the auction items from the cache
    let items = await readAuctionItemsCache();

    // filter, sort, and print
    print(values(sort(filter(items))), options.output);
}

function augment(items) {
    for (let item of items) {
        item.margin = 0;
        item.sell = 0;
    }
}

function filter(items) {

    // Find the auctions containing the user specified phrase
    return _.filter(items, function(o) {

        // If there's no auction flag indicating we should be
        // including auctions, and the current item isn't a BIN item,
        // skip it
        if (o.type === 'AUC' && !options.auctions) {
            return false;
        }

        if (o.type !== 'AUC' && options.auctions) {
            return false;
        }

        // Match correct phrase
        if (!o.name.includes(options.phrase)) {
            return false;
        }

        // Match the pet level if it was provided
        if (options.petLevel && !o.pet_level.includes(options.petLevel)) {
            return false;
        }

        // If searching for an enchantment make sure and only include enchanted books
        if (options.book && !o.name.includes('enchanted book')) {
            return false;
        }

        // Match the reforge if it was provided
        if (options.reforge && !o.reforge.includes(options.reforge)) {
            return false;
        }

        // Match the star rating if it was provided
        if (options.stars) {
            switch (options.stars) {
            case '5':
                if (o.stars !== '✪✪✪✪✪') {
                    return false;
                }
                break;
            case '4':
                if (o.stars !== '✪✪✪✪') {
                    return false;
                }
                break;
            case '3':
                if (o.stars !== '✪✪✪') {
                    return false;
                }
                break;
            case '2':
                if (o.stars !== '✪✪') {
                    return false;
                }
                break;
            case '1':
                if (o.stars !== '✪') {
                    return false;
                }
                break;
            }
        }

        // Match the tier it it was provided
        if (options.tier && !o.tier.includes(options.tier)) {
            return false;
        }

        // Match the extra metadata if values were provided
        if (options.extraMatch) {
            for (let match of options.extraMatch) {
                if (!o.extra.includes(match)) {
                    return false;
                }
            }
        }

        return true;
    });
}

function sort(items) {
    // If auction, sort by auction ending time
    if (options.auctions) {
        return sortBy(items, [ 'category', 'name', 'end' ]);
    }

    // If BIN, sort by cost (within each unique item).
    return sortBy(items, [ 'category', 'name', 'cost' ]);
}

function parse(args) {

    program
        .argument('<phrase>', 'The phrase to search for')

        .option('-a, --auctions', 'List auctions instead of BIN items (BIN is the default)')

        .option('-b, --book', 'Search for an enchantment book that contains the phrase')
        .option('-p, --pet', 'Search for a pet')
        .option('-P, --pet-level <pet-level>', 'Search for a pet at a specific level')
        .option('-r, --reforge <reforge>', 'Only include items with the reforge')
        .option('-t, --tier <tier>', 'Only include items in the tier level (eg comm, unco, rare, epic, lege)')
        .option('-s, --stars <stars>', 'Only include items with the star count')
        .option('-x, --extra', 'Include extra metadata')
        .option('-X, --extra-match <string...>', 'Include extra metadata containing all the strings')

        .option('-o, --output <output>', 'Limit output to the first N items', 20)
        .option('-O, --output-all', 'Override output to all items')
        .option('-1, --output-1', 'Limit output to the first line')


        .option('-L, --loop', 'Loop continually')
        .option('-K, --thousands', 'Express coins in terms of K (useful for calculating avg/total cost)')
        .option('-R, --retrieve', 'Refresh the local auction cache using the skyblock API')
        .parse(args);

    let options = program.opts();

    // Single CLI argument is the phrase to search for
    options.phrase = program.args[0].toLowerCase();

    // If the pet level is specified, normalize the string (eg 7 -> L007)
    if (options.petLevel) {
        options.pet = true;
        options.petLevel = 'L' + options.petLevel.padStart(3, '0');
    }

    if (options.extraMatch) {
        options.extra = true;
    }

    if (options.output1) {
        options.output = 1;
    }

    if (options.outputAll) {
        delete options.output;
    }

    // If pet is specified, append pet to the search criteria
    if (options.pet && !options.phrase.includes(' pet')) {
        options.phrase = options.phrase + ' pet';
    }

    // p4(options);

    return options;
}
