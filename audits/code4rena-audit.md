# Comment on Code4arena Audit

The [report](https://code4rena.com/reports/2023-04-frankencoin).

## High-Risk Findings

### H-01

Fixed in 2ec00c82ef5fbd111ec3cf1108e89f6575610037

### H-02

Fixed in b4d7b3852e0f2818c9604526dbd0e3217d002a67

### H-03

Fixed in 2f2694f435fb53e6f616244a2854e8b11253a392

### H-04

Fixed in 4ee5e07ded87ebdd6ecbf9952d94f7614058191b

Related to this issue: what happens if a challenge cannot be ended because the token cannot be transferred to the bidder?
- In case this is about the challenger's collateral: one can set the postponed return flag to postpone the return of the collateral
- In case this is about the position's collateral: the call fails and we need to distinguish further cases:
  - The collateral asset was paused: in this case we just need to wait until it is unpaused again. If it is never unpaused,
    the position is lost and will never be repaid. Also, the bid and the collateral are stuck forever.
  - The position address was blacklisted: same as above. Position is essentially lost.
  - The bidder is blacklisted: a person not blacklisted must outbid the bidder
    This was made always possible with 0ec62677a724c4b964d51d14bccfd32824e8e554

### H-05

Fixed in 856c7a9d92069aee2549d58da7a7ce81a1de42b8

### H-06

Fixed by making the challenger reward depend on the highest bid and not the price any more.

### M-01

Fixed.

### M-02

Fixed. Adjusted method. Still possible to make limit of original go to zero, but slower. The limit is a hard limit after all.

### M-03

Wont. Not relevant.

### M-04

Fixed. Switched to timestamp.

### M-05

Fixed.

### M-06

Fixed.

### M-07

Partially fixed. Maybe worth checking again?

### M-08

Fixed.

### M-09

I think I did something here. Not sure any more. :)

### M-10

Fixed.

### M-11

Wont.

### M-12

Wont for now. Maybe in future versions.

### M-13

Wont.

### M-14

Wont. The initial transfer is done safely as part of the transaction that creates the new position or a new clone.

### M-15

Wont. Should be rare enough requires quite some commitment from the frontrunner (investing 90 days in advance).

### L-01

WONT: If someone frontruns the initial deployment process, we will just deploy again.

### L-02

WONT: We control the initial deployment parameters. No need for sanity check.

### L-03

Fixed, we are now using seconds instead of blocks to measure time.

### L-04

Fixed.

### L-05

We should think about smarter bridges in the future.

### L-06

Added limit of 24 digits for collateral tokens.

### L-07

WONT: Work-around is easy. Just make a bid of more than 0.00000000000000199 ZCHF to break the cycle.

### L-08

Reentrancy: addressed by rearranging state changes within relevant methods.

### L-09

WONT: Attack is more expensive than the damage done.

