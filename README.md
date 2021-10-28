# Installation

1. Install Node.js
1. `mkdir ~/src && cd ~/src` (as an example)
1. `git clone git@github.com:sclaussen/skyblock.git`
1. `cd ~/src/skyblock`
1. `npm i`
1. `node ah --help` (see dat/ah-*.yaml)
1. `node bz --help`
1. `node collections --help`
1. `node minions --help` (work in progress, see dat/minions.yaml)
1. `node myminions --help`
1. `node objectives --help` (work in progress)
1. `node pets --help`
1. `node quests --help` (work in progress)
1. `node skills --help` (work in progress)
1. `node talismans --help`

Running the commands requires the following environment variables:
- SKYBLOCK_USER (eg Wisedom)
- SKYBLOCK_PROFILE (eg Zucchini)
- SKYBLOCK_UUID (can get from ???)
- SKYBLOCK_KEY (run api command?)
- SKYBLOCK_SLACK=true/false

To turn debug on:
- export DEBUG="skyblock"
