# Installation

1. Install Node.js
1. `mkdir ~/src && cd ~/src` (as an example)
1. `git clone git@github.com:sclaussen/skyblock.git`
1. `cd ~/src/skyblock`
1. `npm i`
1. `node bz --help`
1. `node auc --help`
1. `node prof --help` (work in progress)
1. `node coll --help` (work in progress)
1. `node skills --help` (work in progress)



# Overview

Primary CLIs:
- bz
- auc



# Usage

Here's how I use the scripts:

1. In terminal 1: I run the `node bz` command to continually monitor
   the bazaar.

1. In terminal 2: I run the `node mon` to continually monitor auctions
   of interest (based on the contents of items.yaml).  (Note: this
   depends on the auction cache retrieved by `auc -R`).

1. In terminal 3: I run the `auc -R` script.  It retrieves the auction
   information every minute or so and caches it locally.
