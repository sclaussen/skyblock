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

const rj = require('./lib/util').rj;
const lj = require('./lib/util').lj;

const curl = require('./lib/curl');
const casey = require('./lib/casey');
const p = require('./lib/pr').p(d);
const e = require('./lib/pr').e(d);
const p4 = require('./lib/pr').p4(d);



var options;



skills(process.argv);



async function skills(args) {

    let skills = await readSkyblockSkills();
    let last = 0;
    for (let skill of skills) {

        process.stdout.write(rj(skill.xpDelta, 10) + ' ' + rj(skill.xp, 10) + ' ' + lj(skill.name.toLowerCase() + ' ' + skill.level, 15) + '  ');

        let first = true;
        for (let unlock of skill.unlocks) {
            let width = 20
            if (first) {
                width = 90;
                first = false;
            }

            process.stdout.write(lj(transformUnlockName(unlock), width));
        }
        console.log();
    }
}


async function readSkyblockSkills() {
    let skills = [];

    let responseBody = (await curl.get('https://api.hypixel.net/resources/skyblock/skills')).body;
    _.map(responseBody.skills, function(skill) {
        let lastXp = 0;
        _.map(skill.levels, function(level) {
            skills.push({
                name: skill.name,
                level: level.level,
                xp: level.totalExpRequired,
                xpDelta: level.totalExpRequired - lastXp,
                unlocks: level.unlocks
            });
            lastXp = level.totalExpRequired;
        });
    });

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
