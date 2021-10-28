'use strict';
// process.env.DEBUG = 'skyblock';
const d = require('debug')('skyblock');

const fs = require('fs');
const _ = require('lodash');

const YAML = require('yaml');
var program = require('commander');

const sleep = require('./lib/util').sleep;
const table = require('./lib/util').table;

const writeBazaarItemsCache = require('./lib/bzlib').writeBazaarItemsCache;
const readBazaarItemsCache = require('./lib/bzlib').readBazaarItemsCache;

const p = require('./lib/pr').p(d);
const p4 = require('./lib/pr').p4(d);



var options;



bz(process.argv);



async function bz(args) {

    options = parse(args);

    while (true) {
        if (!options.phrase) {
            console.clear();
        }

        if (!options.useCache) {
            await writeBazaarItemsCache();
        }

        let items = await readBazaarItemsCache();
        console.log(print(_.values(sort(filter(items)))));

        if (options.phrase) {
            process.exit(0);
        }

        sleep(30);
    }
}


function filter(items) {

    return _.filter(items, function(o) {

        if (options.volume && o.volume < parseInt(options.volume)) {
            return false;
        }

        if (options.costMinimum && o.cost < parseInt(options.costMinimum)) {
            return false;
        }

        if (options.costMaximum && o.cost > parseInt(options.costMaximum)) {
            return false;
        }

        if (options.marginMaximum && (o.margin * 100) > parseInt(options.marginMaximum)) {
            return false;
        }

        if (options.marginMinimum && (o.margin * 100) < parseInt(options.marginMinimum)) {
            return false;
        }

        if (options.phrase && !o.name.includes(options.phrase)) {
            return false;
        }

        return true;
    });
}


function sort(items) {
    let sortedItems = _.sortBy(items, [ 'margin' ]).reverse();
    return sortedItems;
}


function getBazaarItem(bazaarItems, name) {
    let item = bazaarItems[name];
    if (!item) {
        console.log('Item not found: ' + name);
        process.exit(1);
    }
    return item;
}


function print(items) {
    return table(items, [
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
            format: { mix: true },
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
    ]);
}


function parse(args) {

    program
        .option('-a, --all', 'Return all the items unfiltered')
        .option('-c, --cost-minimum <cost>', 'Add a minimum cost filter', 250)
        .option('-C, --cost-maximum <cost>', 'Add a maximum cost filter', 1000000)
        .option('-m, --margin-minimum <margin-minimum>', 'Add a minimum margin filter', 10)
        .option('-M, --margin-maximum <margin-maximum>', 'Add a maximum margin filter', 35)
        .option('-v, --volume <volume>', 'Add a minimum sales volume filter', 37500)
        .option('-o, --output <output>', 'Limit items returned', 35)
        .option('-U, --use-cache', 'Use cached items vs. the skyblock API')
        .argument('[item]', 'Filter the bazaar by an item')
        .addHelpText('after', `
Watch bazaar prices (loops every 30 seconds):
  $ node bz
Use -c/-C to change the filter for the min/max cost.
Use -m/-M to change the filter for the min/max margin.
Use -v to change the filter for the minimum sales.
Use -o to change the number of items returned.

Search for a specific bazaar item (does not loop):
  $ node bz birch

Use the -U options when searching offline without an internet connection:
  $ node bz -U birch
`)
        .parse(args);

    let options = program.opts();

    if (program.args.length === 1) {
        options.phrase = program.args[0];
        options.all = true;
    }

    if (options.all) {
        delete options.output;
        delete options.costMinimum;
        delete options.costMaximum;
        delete options.volume;
        delete options.marginMinimum;
        delete options.marginMaximum;
    }

    p4(options);

    return options;
}
