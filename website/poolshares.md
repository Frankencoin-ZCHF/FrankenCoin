# Pool Share Economics

## Challenge
Anyone can create additional pool shares by depositing reserve capital at any time. Also, as long as the reserve meets the minimum requirement, pool shares can be redeemed again at any time. An important design consideration is the pricing mechanism for pool shares. As having a price implies having a valuation, this boils down to evaluating the Frankencoin system.

## Initial Approach

An early version of the Frankencoin simply valued the Frankencoin system as the sum of all reserves. This would be similar to assuming that the market capitalization of a company is corresponding to its equity capital. Unfortunately, this approach leads to an inefficient use of capital and prevents the net creation of new money.

For example, if the interest rate of the Swiss franc is 5% and 30 million ZCHF have been minted against some collateral, then there would be a flow of about 1.5 million ZCHF per year from the minter into the reserve. This flow does not need to be explicit, it could also be in the form of expected liquidation proceeds or similar. In any case, having such a flow would attract 30 million ZCHF in reserves on the other side in an efficient market, as money that seeks the market interest rate of 5% is flowing in. If there is more than 10 million in the reserve, reserve pool share holders would earn less than 5% and vice versa. In such a scenario, no ZCHF would be left any more for other purposes besides buying pool shares!

## Proportional Capital Valuation

In an approach inspired by the research paper "The Continuous Capital Corporation", the Frankencoin system evaluates itself at a constant multiple of its capital. This multiple is set to three. So if there is 1 million ZCHF in the reserve, anyone can subscribe to new pool shares at a valuation of 3 million ZCHF, or also redeem old shares at that valuation. Mathematically, we impose:

V(K) = 3K

Whereas V(K) is the valuation of the Frankencoinsystem if there are K (for capital) Frankencoins in the reserve. Given the number of pool shares \theta in circulation, the marginal price per share is always given as

p(K) = V(K)/\theta = 3K/\theta

The following equation can be used to calculate the new number of outstanding shares after an investment of \deltaK has been made:

(V(K+\deltaK)/V(K)) = (\theta(K+\deltaK)/\theta(K))^3

Unfortunately, solving for the new number of shares requires us to take the third root, a mathematical operation that is not directly supported in solidity. With this equation, two thirds of the increased valuation comes from the implied price increase and one third from the increased number of shares.

## Equilibrium

Consider again the example with 30 million ZCHF in outstanding mints and an interest of 5%, leading to a reserve inflow of 1.5 million per year. Under these circumstances, rational market participants will value the entire pool at 30 million ZCHF and therefore buy additional pool shares until the valuation hits 30 million ZCHF. Unlike before, this valuation is already reached at a reserve pool size of 10 million ZCHF, leaving 20 million ZCHF in circulation that can be used for other purposes.

This is essentially fractional reserve banking with a reserve of one third. In contract, the tier 1 equity capital of modern banks is usually much less than that, so the Frankencoin system has a much higher reserves. However, unlike in the traditional banking system, this reserve requirement is not strictly enforced by a regulator, but more like a carrot that attracts the equilibrium towards the reserve target.

If the effective interest at which new positions can be opened is at 5% and the reserve is below the targed of one third of the outstanding balance, then it is possible to do interest arbitrage by minting additional ZCHF at an interest of 5% per year and using those to buy pool shares that yield maybe 6% per year. The opposite is the case if the reserve is higher than one third. In that case, minters should think about selling pool shares to repay their debt (if they are able to).

## Limits to Capital Efficiency

What if someone creates a clone of the Frankencoin system with a reserve target of 25%? Would they be able to offer a better deal thanks to a better capital efficiency? Here, one needs to be aware that there is a trade-off. It is certainly more attractive for those who mint some ZCHF to buy pool shares and dump the rest of the coins onto the market. However, one needs to be aware that this implies that there is a buyer for the other 75% of the ZCHF to keep the system in equilibrium. These buyers are typically users that hold ZCHF for transactional purposes. And to them, stability is key. But stability suffers if one aims for an overly ambitious level of capital efficiency, making the clone less attractive for transactional purposes. It is hard to tell where exactly the right equilibrium is, but this is not a race to the bottom where the system with the lowest capital requirements automatically wins. We believe that aiming for a 33% reserve is a robust middle ground, that still allows for plenty of seignorage gains.

