const Raffle = artifacts.require("DecentralizedProgressiveJackpotRaffle");
const { expectRevert, time } = require("@openzeppelin/test-helpers");
const { assert } = require("chai");

contract("DecentralizedProgressiveJackpotRaffle", (accounts) => {
  const owner = accounts[0];
  const user1 = accounts[1];
  const user2 = accounts[2];

  const ticketPrice = web3.utils.toWei("1", "ether"); // 1 ETH per ticket
  const jackpotPercentage = 90; // 90%
  const maxTickets = 5;
  const raffleDuration = 60 * 60; // 1 hour
  const claimPeriod = 60 * 60; // 1 hour

  let raffle;

  beforeEach(async () => {
    raffle = await Raffle.new(
      ticketPrice,
      jackpotPercentage,
      maxTickets,
      raffleDuration,
      claimPeriod,
      { from: owner }
    );
  });

  it("should initialize the contract correctly", async () => {
    const tp = await raffle.ticketPrice();
    assert.equal(tp.toString(), ticketPrice);
  });

  it("should allow a user to purchase tickets", async () => {
    const numTickets = 3;
    const value = web3.utils.toWei((numTickets).toString(), "ether");

    const receipt = await raffle.purchaseTickets(numTickets, {
      from: user1,
      value: value,
    });

    const tickets = await raffle.getTicketsByOwner(user1);
    assert.equal(tickets.length, numTickets);

    const state = await raffle.getRaffleState();
    assert.equal(state[0].toString(), numTickets.toString());
    assert.equal(
      state[1].toString(),
      ((parseInt(value) * jackpotPercentage) / 100).toString()
    );

    assert.equal(receipt.logs[0].event, "TicketsPurchased");
  });

  it("should not allow purchase of 0 or too many tickets", async () => {
    await expectRevert(
      raffle.purchaseTickets(0, {
        from: user1,
        value: 0,
      }),
      "Must purchase at least one ticket"
    );

    const tooMany = maxTickets + 1;
    const value = web3.utils.toWei(tooMany.toString(), "ether");

    await expectRevert(
      raffle.purchaseTickets(tooMany, {
        from: user1,
        value: value,
      }),
      "Cannot purchase more than maximum tickets per transaction"
    );
  });

  it("should not allow incorrect ETH payment", async () => {
    const numTickets = 2;
    const value = web3.utils.toWei("1", "ether"); // Should be 2

    await expectRevert(
      raffle.purchaseTickets(numTickets, {
        from: user1,
        value: value,
      }),
      "Incorrect ETH amount sent"
    );
  });

  it("should end the raffle and select a winner", async () => {
    // Buy tickets first
    await raffle.purchaseTickets(2, {
      from: user1,
      value: web3.utils.toWei("2", "ether"),
    });

    await time.increase(raffleDuration + 1);
    const receipt = await raffle.endRaffle({ from: user2 });

    assert.equal(receipt.logs[0].event, "RaffleEnded");

    const ended = await raffle.raffleEnded();
    assert.equal(ended, true);

    const winner = await raffle.winner();
    assert.isTrue([user1].includes(winner));
  });

  it("should allow the winner to claim the jackpot", async () => {
    await raffle.purchaseTickets(1, {
      from: user1,
      value: web3.utils.toWei("1", "ether"),
    });

    await time.increase(raffleDuration + 1);
    await raffle.endRaffle({ from: owner });

    const winner = await raffle.winner();

    const beforeBalance = web3.utils.toBN(await web3.eth.getBalance(winner));
    const receipt = await raffle.claimJackpot({ from: winner });
    const afterBalance = web3.utils.toBN(await web3.eth.getBalance(winner));

    assert.equal(receipt.logs[0].event, "JackpotClaimed");
    assert.isTrue(afterBalance.gt(beforeBalance));
  });

  it("should not allow non-winner to claim the jackpot", async () => {
    await raffle.purchaseTickets(1, {
      from: user1,
      value: web3.utils.toWei("1", "ether"),
    });

    await time.increase(raffleDuration + 1);
    await raffle.endRaffle({ from: owner });

    await expectRevert(
      raffle.claimJackpot({ from: user2 }),
      "Only the winner can claim the jackpot"
    );
  });

  it("should allow the owner to handle unclaimed jackpot after timeout", async () => {
    await raffle.purchaseTickets(1, {
      from: user1,
      value: web3.utils.toWei("1", "ether"),
    });

    await time.increase(raffleDuration + 1);
    await raffle.endRaffle({ from: owner });

    await time.increase(claimPeriod + 1);

    const receipt = await raffle.handleUnclaimedJackpot({ from: owner });
    assert.equal(receipt.logs[0].event, "JackpotUnclaimed");
  });

  it("should allow the owner to withdraw platform fees", async () => {
    const value = web3.utils.toWei("2", "ether");
    await raffle.purchaseTickets(2, {
      from: user1,
      value: value,
    });

    const receipt = await raffle.withdrawPlatformFees({ from: owner });
    assert.isTrue(receipt.receipt.status);
  });

  it("should revert handleUnclaimedJackpot if claim period not over", async () => {
    await raffle.purchaseTickets(1, {
      from: user1,
      value: web3.utils.toWei("1", "ether"),
    });

    await time.increase(raffleDuration + 1);
    await raffle.endRaffle({ from: owner });

    await expectRevert(
      raffle.handleUnclaimedJackpot({ from: owner }),
      "Claim period not yet expired"
    );
  });
});
