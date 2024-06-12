const { ethers } = require('hardhat');
const { setBalance } = require("@nomicfoundation/hardhat-network-helpers");

const managerAddress = "0xAaaaAaAAaaaAAaAAaAaaaaAAAAAaAaaaAaAaaAA0";
const userAddress = "0xAaAaaAAAaAaaAaAaAaaAAaAaAAAAAaAAAaaAaAa2";

async function createVestingPlan(
  vestingPlanId,
  manager,
  user_address,
  vestingPlan,
  token,
  amount,
  adminTransferOBO,
  adminRedeem,
  vestingLockTransferable,
  vestingLock,
  createVestingLockup = true,
) {
  await vestingPlan.connect(manager).createPlan(
    user_address,  // recipient
    token.target,  // token
    amount,  // amount
    0,  // start
    600,  // cliff, 10 minutes
    1000000,  // rate
    1800,  // period, 30 minutes
    manager.address,  // vestingAdmin
    true,  // adminTransferOBO
  );

  await vestingPlan.connect(manager).transferFrom(userAddress, vestingLock.target, vestingPlanId);
  // await vestingPlan.connect(manager).approve(vestingLock.target, vestingPlanId);

  if (createVestingLockup) {
    await vestingLock.connect(manager).createVestingLock(
      {
        beneficiary: user_address,
        adminRedeem,
      }, // recipient
      vestingPlanId, // vestingTokenId
      60 * 60, // start, 1 hour
      40 * 60, // cliff, 40 minutes
      1, // rate
      45 * 60, // period, 45 minutes
      vestingLockTransferable, // transferable
      adminTransferOBO // adminTransferOBO
    );
  }
}


async function lesson() {
  const VestingLock = await ethers.getContractFactory('TokenVestingLock');
  const vestingLock = VestingLock.attach("0x610178dA211FEF7D417bC0e6FeD39F05609AD788");
  const nonVotingVestingLock = VestingLock.attach("0xB7f8BC63BbcaD18155201308C8f3540b07f84F5e");

  const VotingTokenVestingPlans = await ethers.getContractFactory('VotingTokenVestingPlans');
  const votingTokenVestingPlans = VotingTokenVestingPlans.attach("0x2279B7A0a67DB372996a5FaB50D91eAA73d2eBe6");

  const NonVotingTokenVestingPlans = await ethers.getContractFactory('TokenVestingPlans');
  const nonVotingTokenVestingPlans = NonVotingTokenVestingPlans.attach("0x8A791620dd6260079BF849Dc5567aDC3F2FdC318");

  const Token = await ethers.getContractFactory('Token');
  const tok = await Token.attach("0x5FbDB2315678afecb367f032d93F642f64180aa3")
  const nonVotingToken = await Token.attach("0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9")
  const amount = 10000000;

  const manager = await ethers.getImpersonatedSigner(managerAddress);
  await setBalance(managerAddress, ethers.parseEther("100"));
  // make transactions as the manager
  await tok.connect(manager).approve(votingTokenVestingPlans.target, amount * 5);
  await nonVotingToken.connect(manager).approve(nonVotingTokenVestingPlans.target, amount * 5);

  // create a vesting lock for voting token
  await createVestingPlan(
    1,
    manager,
    userAddress,
    votingTokenVestingPlans,
    tok,
    amount,
    false,
    false,
    false,
    vestingLock,
    true,
  );
  // create a vesting lock for non-voting token
  await createVestingPlan(
    1,
    manager,
    userAddress,
    nonVotingTokenVestingPlans,
    nonVotingToken,
    amount,
    false,
    false,
    false,
    nonVotingVestingLock,
    true,
  );

  // create a vesting plan without a vesting lock, for harvey to fuzz `createVestingLock`
  await createVestingPlan(
    2,
    manager,
    userAddress,
    votingTokenVestingPlans,
    tok,
    amount,
    false,
    false,
    false,
    vestingLock,
    false,
  );

  // create a vesting plan without a vesting lock, for harvey to fuzz `createVestingLock`
  await createVestingPlan(
    2,
    manager,
    userAddress,
    nonVotingTokenVestingPlans,
    nonVotingToken,
    amount,
    false,
    false,
    false,
    nonVotingVestingLock,
    false,
  );
}

lesson().then(() => process.exit(0)).catch(error => {console.error(error); process.exit(1);});
