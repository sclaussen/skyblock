'use strict';
process.env.DEBUG = 'skyblock';
const d = require('debug')('skyblock');

const _ = require('lodash');
const fs = require('fs');

const YAML = require('yaml');
const program = require('commander');

const writeAuctionItemsCache = require('./lib/auclib').writeAuctionItemsCache;
const readAuctionItemsCache = require('./lib/auclib').readAuctionItemsCache;
const print = require('./lib/auclib').print;

const sleep = require('./lib/util').sleep;
const table = require('./lib/util').table;
const rj = require('./lib/util').rj;
const lj = require('./lib/util').lj;
const coins = require('./lib/util').coins;

const p = require('./lib/pr').p(d);
const p4 = require('./lib/pr').p4(d);


mon(process.argv);


var options;


async function mon(args) {

    // Parse the options
    options = parse(args);

    while (true) {


        // Read in the auction items from the cache
        let auctionItems = await readAuctionItemsCache();


        // Read in the query definitions
        let queries = YAML.parse(fs.readFileSync('./items.yaml', 'utf8'), {
            prettyErrors: true
        });


        let matches = [];
        let recordLowCostFound = false;
        for (let queryKey of _.keys(queries)) {
            let query = queries[queryKey];
            if (!query) {
                continue;
            }


            // Add the query key as the name property converting
            // underscores to spaces
            if (!query.name) {
                if (query.book) {
                    query.name = 'enchanted book ' + queryKey.replaceAll('_', '-');
                } else {
                    query.name = queryKey.replaceAll('_', ' ');
                }
                query.name_added = true;
            }
            if (query.name2) {
                query.name_saved = query.name;
                query.name += '\'' + query.name2;
            }


            // Find the auction items that match the query criteria
            let results = filter(auctionItems, query);


            // Three things:
            // - Add sell field from query into match results
            // - Add active field from query into match results
            // - Create a margin field in the match results
            // - Check to see if there's a new low cost
            _.map(results, function(match, key, coll) {

                match.type = 'deal';
                if ('type' in query) {
                    match.type = query.type;
                }

                match.sell = 0;
                if ('sell' in query) {
                    match.sell = query.sell;
                }

                match.margin = 0;
                if (query.sell) {
                    match.margin = Math.abs(match.cost - match.sell) / match.sell;
                }

                match.active = true;
                if ('active' in query) {
                    match.active = query.active;
                }

                if (!query.low || match.cost < query.low) {
                    recordLowCostFound = true;
                    query.low = match.cost;
                    logLowCost(match, query, queryKey);
                }
            });


            matches.push(results);
        }


        // If any new record low auction item costs were found
        // re-serialize the items.yaml file
        if (recordLowCostFound) {
            serializeQueryDefinitions(queries);
        }


        if (options.loop) {
            console.clear();
        }


        // Remove any active=false matches so they aren't displayed
        matches = _.filter(_.flatten(matches), function(match) {
            if ('active' in match) {
                return match.active;
            }
            return true;
        });


        // Sort the matches
        matches = sort(matches);


        console.log('-- Wish --');
        let wishList = _.filter(matches, function(o) {
            return o.type === 'wish';
        });
        print(wishList);
        console.log();

        console.log('-- Watch --');
        let watchList = _.filter(matches, function(o) {
            return o.type === 'watch';
        });
        print(watchList);
        console.log();

        console.log('-- Flip --');
        let dealList = _.filter(matches, function(o) {
            return o.type !== 'watch' && o.type !== 'wish';
        });
        print(dealList);
        console.log();


        if (options.loop) {
            sleep(10);
        } else {
            process.exit(0);
        }
    }
}

function filter(auctionItems, criteria) {

    let count = 1;

    // Find the auctions containing the user specified phrase
    return _.filter(auctionItems, function(o) {

        // If there's no auction flag indicating we should be
        // including auctions, and the current item isn't a BIN item,
        // skip it
        if (o.type === 'AUC') {
            return false;
        }

        // Match correct phrase
        if (!o.name.includes(criteria.name)) {
            return false;
        }

        // Match the tier it it was provided
        if (criteria.tier && !o.tier.includes(criteria.tier)) {
            return false;
        }

        // Verify the reforge
        if (criteria.reforge &&!o.reforge.includes(criteria.reforge)) {
            return false;
        }

        // Match only enchanted book phrases if -b was provided
        if (options.book && !o.name.includes('enchanted book')) {
            return false;
        }

        // Match the extra metadata if values were provided
        if (criteria.extra) {
            for (let extraPhrase of criteria.extra) {
                if (!o.extra.includes(extraPhrase)) {
                    return false;
                }
            }
        }

        // Verify the selling prices is less than the max
        if (criteria.max) {
            if (!(o.cost < criteria.max)) {
                return false;
            }
        }

        // Match the star rating if it was provided
        if (criteria.stars) {
            switch (criteria.stars) {
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

        // Potentially limit the number of returned items
        if (criteria.limit && count > criteria.limit) {
            return false;
        }
        count++;

        return true;
    });
}

function sort(auctionItems) {
    return _.sortBy(auctionItems, [ 'name', 'cost' ]);
}

function logLowCost(match, query, queryKey) {
    let s = '';
    s += rj(Number(Number.parseFloat(query.low).toFixed(0)).toLocaleString(), 13);
    s += rj(Number(Number.parseFloat(match.cost).toFixed(0)).toLocaleString(), 13) + '  ';
    s += lj(queryKey, 50);
    s += lj(query.name, 50);
    s += '\n';
    fs.appendFileSync('./lows.yaml', s, 'utf-8');
}

function serializeQueryDefinitions(queries) {
    // Reset the query back to its initial values so the augmented
    // values don't get serialized into the definitions file.
    _.map(queries, function(query) {

        if (query.name2) {
            query.name = query.name_saved;
            delete query.name_saved;
        }

        if (query.name_added) {
            delete query.name_added;
            delete query.name;
        }
    });

    fs.writeFileSync('./items.yaml', YAML.stringify(queries), 'utf8');
}

function parse(args) {

    program
        .option('-L, --loop', 'Loop continually')
        .parse(args);

    let options = program.opts();

    // p4(options);

    return options;
}
