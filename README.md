# Installation

1. Install Node.js
1. `mkdir ~/src && cd ~/src` (as an example)
1. `git clone git@github.com:sclaussen/skyblock.git`
1. `cd ~/src/skyblock`
1. `npm i`
1. `node bazaar --help`
1. `node auction --help`



# Overview

The primary CLIs are bazaar.js and auction.js (and there are a couple
other .js scripts that support the primaries).  In addition, there are
several shell scripts that invoke these two scripts.



# Usage

Here's how I use the scripts:

1. In terminal 1: I run the `bz` script to continually monitor the
   bazaar.

1. In terminal 2: I run the `ah` script.  It retrieves the auction
   information every minute or so and caches it locally in the
   auction.json file.

1. In terminal 3 through N: I run various auction commands or use
   scripts to monitor particular items.  I also create a shell alias
   to keep it simple `alias auc="node auction"`.

Here's some of the existing scripts (ever evolving) to monitor
particular auction items (I encourage you to `cat` or edit these and
create other like scripts based on what you're looking to
acquire/sell):

- aotd*
- aote*
- armor*
- flower*
- giants*
- guardian*
- juju*
- livid*
- loop*
- pet*
- pets*
- raider*
- strong*
- superior*
- unstable*
