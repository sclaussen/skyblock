!'use strict';
process.env.DEBUG = 'skyblock';
const d = require('debug')('skyblock');

const fs = require('fs');
const util = require('util');
const _ = require('lodash');

const YAML = require('yaml');
const moment = require('moment');
const clicolor = require('cli-color');
const program = require('commander');

const curl = require('./lib/curl');
const casey = require('./lib/casey');
const p = require('./lib/pr').p(d);
const e = require('./lib/pr').e(d);
const p4 = require('./lib/pr').p4(d);

const { sortBy, deburr, groupBy, orderBy, toLower, map, uniq, filter } = _

var options;

skills(process.argv);

async function skills(args) {

    options = parse(args);

    let skills = await readSkyblockSkills();

    for (let skill of skills) {
        console.log(skill.name + ' (' + skill.maxLevel + ' levels)');
        for (let level of _.values(skill.levels)) {

            // Level
            process.stdout.write('  ' + rj(level.name, 2) + '  ');

            // Print out each unlock
            let first = true;
            for (let unlock of level.unlocks) {
                if (first) {
                    process.stdout.write(lj(unlock, 90));
                    first = false;
                } else {
                    process.stdout.write(lj(unlock, 20));
                }
            }
            console.log();
        }
        console.log();
    }
}

async function readSkyblockSkills() {
    let skills = [];
    let responseBody = (await curl.get('https://api.hypixel.net/resources/skyblock/skills')).body;
    for (let skyblockSkill of _.values(responseBody.skills, { name: 'Fishing' })) {

        p4(skyblockSkill);

        let skill = {
            name: skyblockSkill.name,
            maxLevel: skyblockSkill.maxLevel,
            levels: []
        };

        for (let skyblockLevel of _.values(skyblockSkill.levels)) {

            // p4(skyblockLevel);
            let level = {
                name: skyblockLevel.level,
                xp: skyblockLevel.totalExpRequired,
                unlocks: []
            };

            for (let unlock of skyblockLevel.unlocks) {
                if (unlock === '??? Sea Creature') {
                    continue;
                }

                level.unlocks.push(transformUnlockName(unlock));
            }

            skill.levels.push(level);
        }

        skills.push(skill);
    }

    p4(skills);
    return skills;
}

function transformUnlockName(s) {

    s = s.trim();

    if (s.startsWith('Farmhand') ||
        s.startsWith('Spelunker') ||
        s.startsWith('Warrior') ||
        s.startsWith('Logger') ||
        s.startsWith('Conjurer') ||
        s.startsWith('Brewer') ||
        s.startsWith('Zoologist')) {
        let index = s.indexOf(' ');
        index = s.indexOf(' ', index + 1);
        return s.substring(index).trim();
    }

    if (s.includes('Treasure Hunter')) {
        let index = s.indexOf(' ');
        index = s.indexOf(' ', index + 1);
        index = s.indexOf(' ', index + 1);
        return s.substring(index).trim();
    }

    if (s.startsWith('Furniture Recipe (COMING SOON)')) {
        return '';
    }

    return s;
}

// Right justify
function rj(s, n) {
    if (!s) {
        return '';
    }
    return s.toString().padStart(n, ' ');
}

// Left justify
function lj(s, n) {
    if (!s) {
        return '';
    }
    return s.toString().padEnd(n, ' ');
}

function parse(args) {

    program
        .parse(args);

    let options = program.opts();

    // p4(options);

    return options;
}
