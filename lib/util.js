'use strict';
process.env.DEBUG = 'skyblock';
const d = require('debug')('skyblock');

const colors = require('colors');

const casey = require('./casey');
const p = require('./pr').p(d);
const p4 = require('./pr').p4(d);
const e = require('./pr').e(d);


function table(items, definitions, addHighlight, addHeader) {

    let s = '';

    if (addHeader !== false) {
        // Print out the header for each column
        let header = '';
        for (let definition of definitions) {
            // Negative width means left justify
            // Positive width means right justify
            if (definition.indent) {
                header += rj(' ', definition.indent);
            }

            if (definition.width < 0) {
                header += lj(definition.alias || definition.name, 0 - definition.width) + ' ';
            } else {
                header += rj(definition.alias || definition.name, definition.width) + ' ';
            }
            if (definition.extra_spaces) {
                header += rj(' ', definition.extra_spaces);
            }
        }
        s += header + '\n';
    }


    // For each item, print each row according to the definition metadata
    for (let item of items) {

        let row = '';
        for (let definition of definitions) {

            let value = format(item[definition.name], definition.format);

            if (definition.indent) {
                row += rj(' ', definition.indent);
            }

            // Negative width means left justify
            // Positive width means right justify
            if (definition.width < 0) {
                row += highlight(definition, lj(value, 0 - definition.width), addHighlight) + ' ';
            } else {
                row += highlight(definition, rj(value, definition.width), addHighlight) + ' ';
            }

            if (definition.extra_spaces) {
                row += rj(' ', definition.extra_spaces);
            }
        }

        s += row + '\n'
    }

    return s;
}


function format(n, options) {

    if (!n) {
        return '';
    }

    if (!options) {
        return n;
    }

    if (n && options.shorten) {
        if (n.length > options.shorten) {
            n = n.substring(0, options.shorten) + options.shorten_append;
        }
        return n;
    }

    if (options.hide_zero && n === 0) {
        return '';
    }

    if (options.percent) {
        return Number.parseFloat(n * 100).toFixed(0);
    }

    if (options.decimal) {
        return Number.parseFloat(n).toFixed(1);
    }

    if (options.integer) {
        return Number(Number.parseFloat(n).toFixed(0)).toLocaleString();
    }

    if (options.thousands) {
        n = (n / 1000).toFixed(1);
        let s = Number.parseFloat(n).toFixed(1) + 'K';
        return s;
    }

    if (options.millions) {
        n = (n / 1000000).toFixed(1);
        return Number.parseFloat(n).toFixed(1) + 'M';
    }

    if (options.mix) {

        // < 1,000
        if (n < 1000) {
            return Number(Number.parseFloat(n).toFixed(0)).toLocaleString();
        }

        // < 1M
        if (n < 1000000) {
            let s = Number(Number.parseFloat(n / 1000).toFixed(0)).toLocaleString() + 'K';
            if (s === '1,000K') {
                return '1M';
            }
            return s;
        }

        // < 50M
        if (n < 50000000) {
            return Number(Number.parseFloat(n / 1000000).toFixed(2)).toLocaleString() + 'M';
        }

        // < 1B
        if (n < 1000000000) {
            return Number(Number.parseFloat(n / 1000000).toFixed(0)).toLocaleString() + 'M';
            if (s === '1,000M') {
                return '1B';
            }
        }

        // > 1B
        return Number(Number.parseFloat(n / 1000000000).toFixed(2)).toLocaleString() + 'B';
    }

    if (options.mix2) {

        // < 1,000
        if (n < 1000) {
            return Number(Number.parseFloat(n).toFixed(0)).toLocaleString();
        }

        // < 1M
        if (n < 1000000) {
            let s = Number(Number.parseFloat(n / 1000).toFixed(0)).toLocaleString() + 'K';
            if (s === '1,000K') {
                return '1M';
            }
            return s;
        }

        // < 50M
        if (n < 50000000) {
            return Number(Number.parseFloat(n / 1000000).toFixed(3)).toLocaleString() + 'M';
        }

        // < ...?
        if (n < 1000000000) {
            return Number(Number.parseFloat(n / 1000000).toFixed(0)).toLocaleString() + 'M';
            if (s === '1,000M') {
                return '1B';
            }
        }

        // > 1B
        return Number(Number.parseFloat(n / 1000000000).toFixed(2)).toLocaleString() + 'B';
    }

    console.log('ERROR: Unknown format option: ' + JSON.stringify(options));
    process.exit(1);
}


function highlight(definition, value, addHighlight) {

    if (!addHighlight) {
        return value;
    }

    if (definition.highlight_green_above && parseInt(value) >= definition.highlight_green_above) {
        return value.toString().brightYellow;
    }

    if (definition.highlight_green_below && parseInt(value) <= definition.highlight_green_below) {
        return value.toString().brightYellow;
    }

    if (definition.highlight_red_above && parseInt(value) >= definition.highlight_red_above) {
        return value.toString().red;
    }

    if (definition.highlight_red_below && parseInt(value) <= definition.highlight_red_below) {
        return value.toString().red;
    }

    return value.toString().white;
}


function getTrackerUrl(itemName) {
    let url = {
        enchanted_endstone: 'enchanted_end_stone'
    };

    let baseUrl = itemName.toLowerCase();
    if (url[baseUrl]) {
        baseUrl = url[baseUrl];
    }

    return 'https://bazaartracker.com/product/' + baseUrl;
}


function getFandomUrl(itemName) {
    if (itemName.startsWith('e_')) {
        itemName = 'enchanted' + itemName.substring(1);
    }

    let url = {
        Acacia_Log: 'Acacia_Wood',
        Birch_Log: 'Birch_Wood',
        Cocoa: 'Cocoa_Beans',
        Dark_Oak_Log: 'Dark_Oak_Wood',
        Enchanted_Acacia_Log: 'Enchanted_Acacia_Wood',
        Enchanted_Birch_Log: 'Enchanted_Birch_Wood',
        Enchanted_Cocoa: 'Enchanted_Cocoa_Bean',
        Enchanted_Dark_Oak_Log: 'Enchanted_Dark_Oak_Wood',
        Enchanted_Jungle_Log: 'Enchanted_Jungle_Wood',
        Enchanted_Oak_Log: 'Enchanted_Oak_Wood',
        Enchanted_Slime_Ball: 'Enchanted_Slimeball',
        Enchanted_Spruce_Log: 'Enchanted_Spruce_Wood',
        Hay_Block: 'Hay_Bale',
        Enchanted_Hay_Block: 'Enchanted_Hay_Bale',
        Jungle_Log: 'Jungle_Wood',
        Oak_Log: 'Oak_Log',
        Pork: 'Raw_Porkchop',
        Spruce_Log: 'Spruce_Wood',
    };

    let capitalizedWithSpaces = casey(itemName.toLowerCase()).capitalizedWithSpaces;
    let baseUrl = casey(capitalizedWithSpaces).capitalizedWithUnderscores;
    if (url[baseUrl]) {
        baseUrl = url[baseUrl];
    }

    return 'https://hypixel-skyblock.fandom.com/wiki/' + baseUrl + '#Obtaining';
}


function getTier(tier) {
    let tierAlias = {
        common: '1-comm',
        uncommon: '2-unco',
        rare: '3-rare',
        epic: '4-epic',
        legendary: '5-lege',
        mythic: '6-myth',
        supreme: '7-supr',
        special: '8-spec',
        very_special: '9-vspe'
    };
    tier = tierAlias[tier];
    if (!tier) {
        console.log('ERROR: Unknown tier: ' + tier);
        process.exit(1);
    }
    return tier;
}


function sleep(n) {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, n * 1000);
}


function rj(s, n) {
    if (!s) {
        s = ' ';
    }
    return s.toString().padStart(n, ' ');
}


function lj(s, n) {
    if (!s) {
        s = ' ';
    }
    return s.toString().padEnd(n, ' ');
}


function getenv(s) {
    if (!process.env[s]) {
        console.log('ERROR: The environment variable ' + s + ' must be defined.');
        process.exit(1);
    }

    return process.env[s];
}


module.exports.table = table;
module.exports.format = format;
module.exports.getTrackerUrl = getTrackerUrl;
module.exports.getFandomUrl = getFandomUrl;
module.exports.getTier = getTier;
module.exports.sleep = sleep;

module.exports.rj = rj;
module.exports.lj = lj;
module.exports.getenv = getenv;
