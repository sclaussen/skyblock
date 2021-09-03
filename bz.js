'use strict';
process.env.DEBUG = 'skyblock';
const d = require('debug')('skyblock');

const _ = require('lodash');

const YAML = require('yaml');
var program = require('commander');

const writeBazaarItemsCache = require('./lib/bzlib').writeBazaarItemsCache;
const readBazaarItemsCache = require('./lib/bzlib').readBazaarItemsCache;

const table = require('./lib/util').table;

const p = require('./lib/pr').p(d);
const p4 = require('./lib/pr').p4(d);


const { sortBy, values,  } = _


var options;


bz(process.argv);


async function bz(args) {

    options = parse(args);

    if (!options.useCache) {
        console.log('Retrieving bazaar items from skyblock');
        await writeBazaarItemsCache();
    }

    let items = await readBazaarItemsCache();

    print(values(sort(filter(items))));
}

function filter(items) {
    return _.filter(items, function(o) {
        if (options.volume && o.volume < parseInt(options.volume)) {
            return false;
        }

        if (options.cost && o.cost < parseInt(options.cost)) {
            return false;
        }

        if (options.marginMaximum && o.margin > parseInt(options.marginMaximum)) {
            return false;
        }

        if (options.marginMinimum && o.margin < parseInt(options.marginMinimum)) {
            return false;
        }

        if (options.phrase && !o.name.includes(options.phrase)) {
            return false;
        }

        return true;
    });
}

function sort(items) {
    let sortedItems = sortBy(items, [ 'margin' ]).reverse();
    return sortedItems;
}

function print(items) {
    table(items, [
        {
            name: 'margin',
            alias: '%',
            width: 6,
            highlight_green_above: 15,
            highlight_red_below: 10,
            format: { percent: true },
        },
        {
            name: 'cost',
            width: 10,
            format: { integer: true },
            extra_spaces: 1,
        },
        {
            name: 'sell',
            width: 10,
            format: { integer: true },
            extra_spaces: 1,
        },
        {
            name: 'name',
            width: -40,
        },
        {
            name: 'volume',
            width: 5,
            format: { millions: true },
            extra_spaces: 1,
        },
        {
            name: 'trackerUrl',
            width: -60,
            alias: 'Tracker URL'
        },
        {
            name: 'fandomUrl',
            width: -70,
            alias: 'Fandom URL'
        },
    ], options.output);
}


function parse(args) {

    program
        .option('-a, --all', 'Return all the items unfiltered')
        .option('-b, --cost <cost>', 'Add a minimum cost filter', '250')
        .option('-v, --volume <volume>', 'Add a minimum sales volume filter', '500000')
        .option('-m, --margin-minimum <margin-minimum>', 'Add a minimum margin filter', '0')
        .option('-M, --margin-maximum <margin-maximum>', 'Add a maximum margin filter', '50')
        .option('-o, --output <output>', 'Limit items returned', '35')
        .option('-U, --use-cache', 'Use cached items vs. the skyblock API')
        .argument('[item]', 'Filter the bazaar by an item')
        .parse(args);

    let options = program.opts();

    if (program.args.length === 1) {
        options.phrase = program.args[0];
        options.all = true;
    }

    if (options.all) {
        delete options.output;
        delete options.cost;
        delete options.volume;
        delete options.marginMinimum;
        delete options.marginMaximum;
    }

    // p4(options);

    return options;
}
