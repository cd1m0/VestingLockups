// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.24;

import 'hardhat/console.sol';

library UnlockLibrary {
  function min(uint256 a, uint256 b) internal pure returns (uint256 _min) {
    _min = (a <= b) ? a : b;
  }

  /// @notice function to calculate the end date of a plan based on its start, amount, rate and period
  function endDate(uint256 start, uint256 amount, uint256 rate, uint256 period) internal pure returns (uint256 end) {
    end = (amount % rate == 0) ? (amount / rate) * period + start : ((amount / rate) * period) + period + start;
  }


  /// @notice function to validate the end date of a vesting lock 
  /// @param start is the start date of the lockup
  /// @param cliff is the cliff date of the lockup
  /// @param amount is the total amount of tokens in the lockup, which would be the entire amount of the vesting plan
  /// @param rate is the amount of tokens that unlock per period
  /// @param period is the seconds in each period, a 1 is a period of 1 second whereby tokens unlock every second
  /// @param vestingEnd is the end date of the vesting plan
  /// @dev this function validates the lockup end date against 0 entry values, plus ensures that the cliff date is at least the same as the end date
  /// and finally it chekcs that if the lock isn't a single date unlock, that the end date is beyond the vesting end date
  function validateEnd(
    uint256 start,
    uint256 cliff,
    uint256 amount,
    uint256 rate,
    uint256 period,
    uint256 vestingEnd
  ) internal pure returns (uint256 end) {
    require(amount > 0, '0_amount');
    require(rate > 0, '0_rate');
    require(rate <= amount, 'rate > amount');
    require(period > 0, '0_period');
    end = endDate(start, amount, rate, period);
    require(cliff <= end, 'cliff > end');
    if (rate < amount) {
      require(end >= vestingEnd, 'end error');
    }
  }

  /// @notice function to calculate the unlocked (claimable) balance, still locked balance, and the most recent timestamp the unlock would take place
  /// the most recent unlock time is based on the periods, so if the periods are 1, then the unlock time will be the same as the redemption time,
  /// however if the period more than 1 second, the latest unlock will be a discrete time stamp
  /// @param start is the start time of the plan
  /// @param cliffDate is the timestamp of the cliff of the plan
  /// @param totalAmount is the total amount of tokens in the vesting plan
  /// @param availableAmount is the total unclaimed amount tokens still in the vesting plan
  /// @param rate is the amount of tokens that unlock per period
  /// @param period is the seconds in each period, a 1 is a period of 1 second whereby tokens unlock every second
  /// @param redemptionTime is the time requested for the plan to be redeemed, this can be the same as the current time or prior to it for partial redemptions
  function balanceAtTime(
    uint256 start,
    uint256 cliffDate,
    uint256 totalAmount,
    uint256 availableAmount,
    uint256 rate,
    uint256 period,
    uint256 redemptionTime
  ) internal pure returns (uint256 unlockedBalance, uint256 lockedBalance, uint256 unlockTime) {
    if (start > redemptionTime || cliffDate > redemptionTime) {
      lockedBalance = availableAmount;
      unlockTime = start;
      unlockedBalance = 0;
    } else if (availableAmount < rate && totalAmount > rate) {
      lockedBalance = availableAmount;
      unlockTime = start;
      unlockedBalance = 0;
    } else if (totalAmount <= rate && availableAmount <= rate) {
      lockedBalance = 0;
      unlockTime = start;
      unlockedBalance = availableAmount;
    } else {
      /// need to make sure clock is set correctly
      uint256 periodsElapsed = (redemptionTime - start) / period;
      uint256 calculatedBalance = periodsElapsed * rate;
      if (availableAmount < calculatedBalance) {
        // determine how many periods can be unlocked with the available amount
        uint256 availablePeriods = availableAmount / rate;
        unlockedBalance = availablePeriods * rate;
        lockedBalance = availableAmount - unlockedBalance;
        unlockTime = start + (period * availablePeriods);
      } else {
        unlockedBalance = calculatedBalance;
        lockedBalance = availableAmount - unlockedBalance;
        unlockTime = start + (period * periodsElapsed);
      }
    }
  }
}
