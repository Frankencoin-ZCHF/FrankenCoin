# Audits

This file lists all the performed audits as well as their results.

## Blockbite

Blockbite was the [first audit](blockbite-audit.pdf). It found a few major issues that all have been fixed in the meantime. However, we decided to not address some of the light issues found. The reasoning is provided here.

### L-2 DOS in StablecoinBridge minting

This describes an attack where the attacker irrevocably sends CryptoFrancs to the stablecoin bridge until the limit is reached in order to prevent others from exchanging their CryptoFrancs into Frankencoins. This is like DOSing someones mailbox by stuffing it with cash, so the cost of the attack is in no proportion to the damage done. Furthermore, even if the proposed fix was implemented, it would still be possible to perform this attack by converting the same amount of XCHF into ZCHF using the bridge and then burning the ZCHF.

### L-4 Improper Verification of Cryptographic Signature

It is true that elliptic curve signatures are malleable, i.e. that it is possible to find a second valid signature for the same transaction given a first one. However, this would only be a problem if the signatures was used to identify transactions, which is not the case.

### L-5 Suggestion spamming

As noted in the audit, there already is an application fee in place to prevent spamming attacks.


