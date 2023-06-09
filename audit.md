## Functional Changes

The audit has lead us to do a number of functional changes that are quickly described herein.

### Relative Challenger Reward

Before, the challenger reward was 2% of the challenged collateral value at the liquidation price. Now, it is 2% of the
highest bid. This is the fix for the most severe issue found in the audit. Previously, the challenger reward was calculated
relative to what the position owner could have minted given the collateral amount and the liquidation price. Since positions
can be challenged immediately after they have been proposed without any sanity check on the price, this allowed an attacker
to create arbitrary amounts of Frankencoins in the form of challenger rewards, simply by proposing a position with an
exorbitant liquidation price and then immediately challenging it to reap the reward. We fixed this by calculating the
challenger reward relative to the acutal bid size, and not relative to the challenged minting volume.

### Switch from Minting Fee to Interest

Before, minting Frankencoins was always subject for the same percent fee for a given position, regardless for how long the
position was intended to be kept open. This is how the Liquity system does it. However, economically, such a fee is very
unattractive to short-term borrowers. It is also not entirely fair when the fee for minting 1000 ZCHF against a position
that expires in two years as the fee for minting 1000 ZCHF for the same position one year later. The latest version of the
Frankencoin treats the fee as a yearly interest. It still needs to be paid up front, but it gets smaller and smaller for
a given position the closer we get to the expiration date. Furthermore, we also added the possibility to shorten the 
duration when cloning a position.

For example, if there is a position with a 1% (or 10_000 ppm) interest per year and an expiration in three years, minting
1000 ZCHF costs 30 ZCHF up front. However, if someone clones that position and sets the expiration of the clone only one
year into the future, the up front fee is only 10 ZCHF for each 1000 ZCHF minted.

### No More Limit Splitting

Previously, when cloning a position, the remaining limit was split among both of them. This is not wrong, but it caused
some confusion. Instead, it is more straightforward to only shift as much of the limit to the clone as necessary. This
leads to less flexibility for the clones position, but it is simpler and helps the remaining potential limit amount to
stay concentrated with the original position.

### Vote Kamikaze

In order to prevent a minority to block the system with their veto power, a 'kamikaze' function was introduced. This allows
and FPS holder to wipe out the accumulated voting power while sacrificing his own. For example, if Alice keeps vetoing good
proposals with her 5% stake, Bob might do a kamikaze on Alice with his 4% stake, thereby reducing Alice's voting power to
1% and his own to 0%. This also has the side effect of making both of their tokens unredeemable until they accumulated
90 holding days again. In effect, this leads to a system that yields the same game-theoretic outcome as democratic governance
with majority votes, but without having to vote all the time.

### FPS Slippage Protection

### Transfer Safety and exotic tokens

ERC777 re-entrancy, blacklists, etc.

### Restrict minting after successful challenge



## Implementation Changes

### Move from block number to timestamp

## Critical Issues

### Set price to max


https://github.com/code-423n4/2023-04-frankencoin-findings/issues/155
https://github.com/code-423n4/2023-04-frankencoin-findings/issues/302

