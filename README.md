# Installation

1. Install Node.JS
1. `mkdir ~/src && cd ~/src` (as an example)
1. `git clone git@github.com:sclaussen/skyblock.git` (or get the zip file)
1. `cd ~/src/skyblock`
1. `npm i`



# Setup

Running the commands requires the following environment variables:
- SKYBLOCK_USER (eg Wisedom)
- SKYBLOCK_PROFILE (eg Zucchini)
- SKYBLOCK_UUID (eg can find via https://api.mojang.com/users/profiles/minecraft/Wisedom)
- SKYBLOCK_KEY (run /api command from skyblock command prompt to get the value)
- SKYBLOCK_SLACK (enter slack channel info if using slack)

To turn debug on:
- export DEBUG="skyblock"

Here is an example:

```
export SKYBLOCK_USER=Wisedom
export SKYBLOCK_PROFILE=Zucchini
export SKYBLOCK_UUID=blah
export SKYBLOCK_KEY=blah
```



# Commands

1. `node ah --help` (see dat/ah-*.yaml)
1. `node bz --help`
1. `node collections --help`
1. `node pets --help`
1. `node talismans --help`
1. `node slayers --help`
1. `node myminions --help`
1. `node minions --help` (work in progress, see dat/minions.yaml)
1. `node objectives --help` (work in progress)
1. `node quests --help` (work in progress)
1. `node skills --help` (work in progress)
