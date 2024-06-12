const { ethers } = require('hardhat');

// 10 ^ 24
const alot = 1000000000000000000000000n
const rich_attackers = ["0xAaAaaAAAaAaaAaAaAaaAAaAaAAAAAaAAAaaAaAa2", "0xAaaaAaAAaaaAAaAAaAaaaaAAAAAaAaaaAaAaaAA0", "0xafFEaFFEAFfeAfFEAffeaFfEAfFEaffeafFeAFfE"];

async function dpl(name, args) {
  const factory = await ethers.getContractFactory(name);
  const contract = await factory.deploy(...args);
  await contract.waitForDeployment();

  console.error(`Deployed ${name} to ${contract.target}`);

  return contract;
}

async function deployTokens() {
  const res = [];

  for (const [name, args] of [
      ['Token', ['VT', alot, 3]],
      ['NonVotingToken', ['NVT', alot, 3]],
    ]) {
      const tok = await dpl(name, [name, ...args]);

      for (let richie of rich_attackers) {
        const amt = alot / 10n;
        console.error(`Giving ${richie} ${amt} of token ${name}`)
        await tok.transfer(richie, amt);
      }

      res.push();
  }


  return res;
}

async function deployAll(admin_address) {
  await deployTokens();
  const vestingPlan = await dpl('VotingTokenVestingPlans', ['VTV', 'VTV'])
  const nonVotingVestingPlan = await dpl('TokenVestingPlans', ['NVTV', 'NVTV'])

  await dpl(
    'TokenVestingLock',
    [
      'VestingLockup1',
      'VL1',
      vestingPlan.target,
      "0xAaaaAaAAaaaAAaAAaAaaaaAAAAAaAaaaAaAaaAA0",
      "0xafFEaFFEAFfeAfFEAffeaFfEAfFEaffeafFeAFfE"
    ]
  );
  await dpl(
    'TokenVestingLock',
    [
      'VestingLockup2',
      'VL2',
      nonVotingVestingPlan.target,
      "0xAaaaAaAAaaaAAaAAaAaaaaAAAAAaAaaaAaAaaAA0",
      "0xafFEaFFEAFfeAfFEAffeaFfEAfFEaffeafFeAFfE"
    ]
  );
}

deployAll().then(() => {
  console.error("Done");
  process.exit(0);
}).catch((e) => {console.error(e); process.exit(1);});
