'use strict';
process.env.DEBUG = 'skyblock';
const d = require('debug')('skyblock');

const moment = require('moment');
const clicolor = require('cli-color');

const casey = require('./casey');
const p = require('./pr').p(d);
const p4 = require('./pr').p4(d);
const e = require('./pr').e(d);


function format(n, options) {

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
        if (s === '1,000K') {
            return '1M';
        }
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
        } else if (n < 1000000) {
            // < 1M
            let s = Number(Number.parseFloat(n / 1000).toFixed(0)).toLocaleString() + 'K';
            if (s === '1,000K') {
                return '1M';
            }
            return s;
        } else if (n < 20000000) {
            return Number(Number.parseFloat(n / 1000000).toFixed(1)).toLocaleString() + 'M';
        }
        return Number(Number.parseFloat(n / 1000000).toFixed(0)).toLocaleString() + 'M';
    }

    console.log('ERROR: Unknown format option');
    process.exit(1);
}

function table(items, columns, max) {

    let limit = false;
    if (max) {
        max = parseInt(max);
        limit =  true;
    }

    let output = '';

    // Print out the header for each field
    // console.log();
    // for (let column of columns) {

    //     let columnName = column.name;
    //     if (column.alias) {
    //         columnName = column.alias;
    //     }

    //     // Negative width means left justify
    //     if (column.width < 0) {
    //         output += lj(columnName, 0 - column.width) + ' ';
    //         continue;
    //     }

    //     // Positive width means right justify
    //     output += rj(columnName, column.width) + ' ';
    // }

    // console.log(output);


    // For each item, print each column according to the column metadata
    let count = 1;
    for (let item of items) {

        output = '';
        for (let column of columns) {

            let value = item[column.name];
            if (column.format) {
                value = format(value, column.format);
            }

            if (column.number) {
                value = number(value);
            }
            let width = column.width;

            if (column.number) {
                value = number(value, column.number);
            }


            if (width < 0) {
                // Negative width means left justify
                output += lj(highlight(column, value), 0 - width) + ' ';
            } else {
                // Positive width means right justify
                output += rj(highlight(column, value), width) + ' ';
            }

            if (column.extra_spaces) {
                output += rj(' ', column.extra_spaces);
            }
        }

        console.log(output);

        if (limit) {
            count++;
            if (count > max) {
                return;
            }
        }
    }
}

function sleep(n) {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, n * 1000);
}

// Right justify
function rj(s, n) {
    if (!s) {
        s = ' ';
    }
    return s.toString().padStart(n, ' ');
}

// Left justify
function lj(s, n) {
    if (!s) {
        s = ' ';
    }
    return s.toString().padEnd(n, ' ');
}

function round(n) {
    return Math.round(n / 100) * 100;
}

function getCategory(category) {
    let categoryAlias = {
        weapon: '1-weap',
        armor: '2-armo',
        accessories: '3-acce',
        misc: '4-misc',
        blocks: '5-bloc',
        consumables: '6-cons',
    };
    category = categoryAlias[category];
    if (!category) {
        console.log('Unknown category: ' + category);
    }
    return category;
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
        console.log('Unknown tier: ' + tier);
    }
    return tier;
}

function highlight(column, value) {
    return value;

    if (column.highlight_green_above && value >= column.highlight_green_above) {
        return clicolor.yellowBright(value);
    }

    if (column.highlight_green_below && value <= column.highlight_green_below) {
        return clicolor.yellowBright(value);
    }

    if (column.highlight_red_above && value >= column.highlight_red_above) {
        return clicolor.red(value);
    }

    if (column.highlight_red_below && value <= column.highlight_red_below) {
        return clicolor.red(value);
    }

    return clicolor.white(value);
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
    let url = {
        Enchanted_Slime_Ball: 'Enchanted_Slimeball',
        Pork: 'Raw_Porkchop',
        Hay_Block: 'Hay_Bale',
    };

    let capitalizedWithSpaces = casey(itemName.toLowerCase()).capitalizedWithSpaces;
    let baseUrl = casey(capitalizedWithSpaces).capitalizedWithUnderscores;
    if (url[baseUrl]) {
        baseUrl = url[baseUrl];
    }

    return 'https://hypixel-skyblock.fandom.com/wiki/' + baseUrl + '#Obtaining';
}

function number(n, options) {
    if (!options) {
        options = {};
    }

    let s = '';
    if (n === 0) {
        return s;
    }

    if (options.thousands) {
        s = 'K';
        n = (n / 1000).toFixed(0);
    } else {

        if (n < 100000) {
            // s = 'K';
            // n = (n / 1000).toFixed(1);
            n = (n * 1).toFixed(0);
        } else if (n < 1000000) {
            s = 'K';
            n = (n / 1000).toFixed(0);
        } else {
            s = 'M';
            n = (n / 1000000).toFixed(1);
        }
    }

    return (n.toLocaleString("en-US") + s);
}

function timeFromNow(n) {
    let datetime = moment(n);
    return datetime.fromNow();
}

module.exports.sleep = sleep;
module.exports.rj = rj;
module.exports.lj = lj;
module.exports.getTrackerUrl = getTrackerUrl;
module.exports.getFandomUrl = getFandomUrl;
module.exports.number = number;
module.exports.timeFromNow = timeFromNow;
module.exports.table = table;
module.exports.round = round;
module.exports.getTier = getTier;
module.exports.getCategory = getCategory;
