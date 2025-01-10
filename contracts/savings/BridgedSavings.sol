// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title SavingsSatellite
 *
 * Module to enable savings based on a Leadrate ("Leitzins") module.
 *
 * As the interest rate changes, the speed at which 'ticks' are accumulated is
 * adjusted. The ticks counter serves as the basis for calculating the interest
 * due for the individual accoutns.
 *
 * The saved ZCHF are subject to a lockup of up to 3 days and only start to yield
 * an interest after the lockup ended. The purpose of this lockup is to discourage
 * short-term holdings and to avoid paying interest to transactional accounts.
 * Transactional accounts typically do not need an incentive to hold Frankencoins.
 */
contract SavingsSatellite {


}