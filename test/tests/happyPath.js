const C = require('../constants');
const { deploy } = require('../fixtures');
const setup = require('../fixtures');
const { expect } = require('chai');
const { time } = require('@nomicfoundation/hardhat-network-helpers');
const { ethers } = require('hardhat');

module.exports = (params) => {
  let deployed, admin, a, b, c, d, token, nvt, vesting, batch, lock;
  let amount, vestingStart, vestingCliff, vestingRate, period, vestingEnd, vestingAdmin;
  let lockStart, lockCliff, lockRate, lockEnd;
  it('should deploy contracts and setup an initial vesting plan with a lockup', async () => {
    deployed = await deploy(params.decimals);
    admin = deployed.admin;
    a = deployed.a;
    b = deployed.b;
    c = deployed.c;
    d = deployed.d;
    token = deployed.token;
    nvt = deployed.nvt;
    batch = deployed.batch;
    vesting = params.voting ? deployed.vvp : deployed.tvp;
    lock = params.voting ? deployed.votingLock : deployed.vestingLock;
    let now = BigInt(await time.latest());
    amount = params.amount;
    vestingStart = now + BigInt(params.start);
    vestingCliff = vestingStart + BigInt(params.cliff);
    vestingRate = C.getRate(amount, params.period, params.duration);
    period = BigInt(params.period);
    vestingEnd = C.planEnd(vestingStart, amount, vestingRate, period);
    vestingAdmin = admin;
    const vestingPlan = {
      amount,
      start: vestingStart,
      cliff: vestingCliff,
      rate: vestingRate,
    };

    lockStart = now + BigInt(params.lockStart);
    lockCliff = lockStart + BigInt(params.lockCliff);
    lockRate = C.getRate(amount, period, params.lockDuration);
    lockEnd = C.planEnd(lockStart, amount, lockRate, period);

    const lockupPlan = {
      amount,
      start: lockStart,
      cliff: lockCliff,
      rate: lockRate,
    };
    const recipient = {
      beneficiary: a.address,
      adminRedeem: params.adminRedeem,
    };
    const tx = await batch.createVestingLockupPlans(
      vesting.target,
      lock.target,
      token.target,
      period,
      vestingAdmin,
      true,
      [vestingPlan],
      [recipient],
      [lockupPlan],
      false,
      amount,
      1
    );
    const plan = await vesting.plans(1);
    expect(plan.token).to.eq(token.target);
    expect(plan.amount).to.equal(amount);
    expect(plan.start).to.equal(vestingStart);
    expect(plan.cliff).to.equal(vestingCliff);
    expect(plan.rate).to.equal(vestingRate);
    expect(plan.period).to.equal(period);
    expect(plan.vestingAdmin).to.equal(vestingAdmin);
    expect(plan.adminTransferOBO).to.equal(true);
    expect(await vesting.ownerOf(1)).to.equal(lock.target);
    const lockup = await lock.getVestingLock(1);
    expect(lockup.token).to.equal(token.target);
    expect(lockup.availableAmount).to.eq(0);
    expect(lockup.totalAmount).to.eq(amount);
    expect(lockup.start).to.eq(lockStart);
    expect(lockup.cliff).to.eq(lockCliff);
    expect(lockup.rate).to.eq(lockRate);
    expect(lockup.period).to.eq(period);
    expect(lockup.vestingAdmin).to.eq(vestingAdmin);
    expect(lockup.vestingTokenId).to.eq(1);
    expect(lockup.adminTransferOBO).to.eq(true);
    expect(lockup.transferable).to.eq(false);
    expect(await lock.ownerOf(1)).to.eq(a.address);
  });
  it('redeems and unlocks the vesting and lockup plan over time', async () => {
    // move time forward to pre unlock date and check the vesting balance
    await time.increaseTo(vestingCliff + C.bigMax(100, period * BigInt(10)));
    // stil pre lock
    await expect(lock.connect(a).redeemAndUnlock(['1'])).to.be.revertedWith('no_unlocked_balance');
    await expect(lock.connect(a).unlock(['1'])).to.be.revertedWith('no_unlocked_balance');
    let now = BigInt(await time.latest());
    let vestingBalance = await vesting.planBalanceOf('1', now + BigInt(1), now + BigInt(1));
    console.log(`vesting balance: ${vestingBalance}`);
    let preBalance = await token.balanceOf(lock.target);
    let tx = await lock.connect(a).redeemVestingPlans(['1']);
    let postBalance = await token.balanceOf(lock.target);
    expect(postBalance - preBalance).to.eq(vestingBalance.balance);
    console.log(`token balancein lockup: ${await token.balanceOf(lock.target)}`);
    await expect(lock.connect(a).unlock(['1'])).to.be.revertedWith('no_unlocked_balance');
    await time.increaseTo(lockCliff);
    tx = await lock.connect(a).unlock(['1']);
    expect(await token.balanceOf(a.address)).to.eq(vestingBalance.balance);
    vestingBalance = await vesting.planBalanceOf('1', now + BigInt(1), now + BigInt(1));
    tx = await lock.connect(a).redeemAndUnlock(['1']);
    expect(tx).to.emit(token, 'Transfer').withArgs(vesting.target, lock.target, vestingBalance.balance);
    expect(tx).to.emit(token, 'Transfer').withArgs(lock.target, a.address, vestingBalance.balance);

    let remainingVetingBalance = await vesting.plans(1).amount;
    await time.increaseTo(vestingEnd);
    tx = await lock.connect(a).redeemAndUnlock(['1']);
    expect(tx).to.emit(token, 'Transfer').withArgs(vesting.target, lock.target, remainingVetingBalance);
    expect(tx).to.emit(token, 'Transfer').withArgs(lock.target, a.address, remainingVetingBalance);
  });
  it('can create a vesting plan with a single date lock', async () => {
    let now = BigInt(await time.latest());
    amount = params.amount;
    vestingStart = now + BigInt(params.start);
    vestingCliff = vestingStart + BigInt(params.cliff);
    vestingRate = C.getRate(amount, params.period, params.duration);
    period = BigInt(params.period);
    vestingEnd = C.planEnd(vestingStart, amount, vestingRate, period);
    vestingAdmin = admin;
    const vestingPlan = {
      amount,
      start: vestingStart,
      cliff: vestingCliff,
      rate: vestingRate,
    };
    lockStart = vestingCliff + C.bigMax(1000, period * BigInt(2));
    lockCliff = lockStart;
    lockRate = amount;
    lockEnd = C.planEnd(lockStart, amount, lockRate, 1);
    const lockupPlan = {
      amount,
      start: lockStart,
      cliff: lockCliff,
      rate: lockRate,
    };
    const recipient = {
      beneficiary: a.address,
      adminRedeem: params.adminRedeem,
    };

    const tx = await batch.createVestingLockupPlans(
      vesting.target,
      lock.target,
      token.target,
      period,
      vestingAdmin,
      true,
      [vestingPlan],
      [recipient],
      [lockupPlan],
      false,
      amount,
      2
    );
    const plan = await vesting.plans(2);
    expect(plan.token).to.eq(token.target);
    expect(plan.amount).to.equal(amount);
    expect(plan.start).to.equal(vestingStart);
    expect(plan.cliff).to.equal(vestingCliff);
    expect(plan.rate).to.equal(vestingRate);
    expect(plan.period).to.equal(period);
    expect(plan.vestingAdmin).to.equal(vestingAdmin);
    expect(plan.adminTransferOBO).to.equal(true);
    expect(await vesting.ownerOf(2)).to.equal(lock.target);
    const lockup = await lock.getVestingLock(2);
    expect(lockup.token).to.equal(token.target);
    expect(lockup.availableAmount).to.eq(0);
    expect(lockup.totalAmount).to.eq(amount);
    expect(lockup.start).to.eq(lockStart);
    expect(lockup.cliff).to.eq(lockCliff);
    expect(lockup.rate).to.eq(lockRate);
    expect(lockup.period).to.eq(1);
    expect(lockup.vestingAdmin).to.eq(vestingAdmin);
    expect(lockup.vestingTokenId).to.eq(2);
    expect(lockup.adminTransferOBO).to.eq(true);
    expect(lockup.transferable).to.eq(false);
    expect(await lock.ownerOf(2)).to.eq(a.address);
  });
  it('redeems and unlocks the single date lockup plan over time', async () => {
    // move time forward to pre unlock date and check the vesting balance
    await time.increaseTo(vestingCliff + C.bigMax(100, period * BigInt(10)));
    // stil pre lock
    await expect(lock.connect(a).redeemAndUnlock(['2'])).to.be.revertedWith('no_unlocked_balance');
    await expect(lock.connect(a).unlock(['2'])).to.be.revertedWith('no_unlocked_balance');
    let now = BigInt(await time.latest());
    let vestingBalance = await vesting.planBalanceOf('2', now + BigInt(1), now + BigInt(1));
    console.log(`vesting balance: ${vestingBalance}`);
    let preBalance = await token.balanceOf(lock.target);
    let tx = await lock.connect(a).redeemVestingPlans(['2']);
    let postBalance = await token.balanceOf(lock.target);
    expect(postBalance - preBalance).to.eq(vestingBalance.balance);
    console.log(`token balancein lockup: ${await token.balanceOf(lock.target)}`);
    await expect(lock.connect(a).unlock(['2'])).to.be.revertedWith('no_unlocked_balance');
    await time.increaseTo(lockCliff);
    tx = await lock.connect(a).unlock(['2']);
    expect(tx).to.emit(token, 'Transfer').withArgs(lock.target, a.address, vestingBalance.balance);
    vestingBalance = await vesting.planBalanceOf('2', now + BigInt(1), now + BigInt(1));
    tx = await lock.connect(a).redeemAndUnlock(['2']);
    expect(tx).to.emit(token, 'Transfer').withArgs(vesting.target, lock.target, vestingBalance.balance);
    expect(tx).to.emit(token, 'Transfer').withArgs(lock.target, a.address, vestingBalance.balance);

    let remainingVetingBalance = await vesting.plans(2).amount;
    await time.increaseTo(vestingEnd);
    tx = await lock.connect(a).redeemAndUnlock(['2']);
    expect(tx).to.emit(token, 'Transfer').withArgs(vesting.target, lock.target, remainingVetingBalance);
    expect(tx).to.emit(token, 'Transfer').withArgs(lock.target, a.address, remainingVetingBalance);
  });
  it('creates a vesting plan individually, and then the admin transfers into and creates a lockup plan', async () => {
    let now = BigInt(await time.latest());
    amount = params.amount;
    vestingStart = now + BigInt(params.start);
    vestingCliff = vestingStart + BigInt(params.cliff);
    vestingRate = C.getRate(amount, params.period, params.duration);
    period = BigInt(params.period);
    vestingEnd = C.planEnd(vestingStart, amount, vestingRate, period);
    vestingAdmin = admin;
    await token.approve(vesting.target, amount);
    let tx = await vesting.createPlan(
      b.address,
      token.target,
      amount,
      vestingStart,
      vestingCliff,
      vestingRate,
      period,
      vestingAdmin,
      true
    );
    const plan = await vesting.plans(3);
    await vesting.transferFrom(b.address, lock.target, 3);
    const recipient = {
      beneficiary: b.address,
      adminRedeem: params.adminRedeem,
    };
    let lockupStart = now + BigInt(params.lockStart);
    let lockupCliff = lockupStart + BigInt(params.lockCliff);
    let lockupRate = C.getRate(amount, period, params.lockDuration);
    let lockTx = await lock.createVestingLock(recipient, 3, lockupStart, lockupCliff, lockupRate, false, true);
    const lockupPlan = await lock.getVestingLock(3);
    expect(lockupPlan.token).to.equal(token.target);
    expect(lockupPlan.availableAmount).to.eq(0);
    expect(lockupPlan.totalAmount).to.eq(amount);
    expect(lockupPlan.start).to.eq(lockupStart);
    expect(lockupPlan.cliff).to.eq(lockupCliff);
    expect(lockupPlan.rate).to.eq(lockupRate);
    expect(lockupPlan.period).to.eq(period);
    expect(lockupPlan.vestingAdmin).to.eq(vestingAdmin);
    expect(lockupPlan.vestingTokenId).to.eq(3);
    expect(lockupPlan.adminTransferOBO).to.eq(true);
    expect(lockupPlan.transferable).to.eq(false);
    expect(await lock.ownerOf(3)).to.eq(b.address);
  });
};
