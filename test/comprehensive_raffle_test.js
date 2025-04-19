const DecentralizedProgressiveJackpotRaffle = artifacts.require("DecentralizedProgressiveJackpotRaffle");
const truffleAssert = require('truffle-assertions');

contract("DecentralizedProgressiveJackpotRaffle - Comprehensive Tests", accounts => {
  const owner = accounts[0];
  const player1 = accounts[1];
  const player2 = accounts[2];
  const player3 = accounts[3];
  const nonWinner = accounts[4];
  
  let raffleInstance;
  const ticketPrice = web3.utils.toWei('0.01', 'ether');
  const jackpotPercentage = 90;
  const maxTicketsPerPurchase = 10;
  const raffleDuration = 600; // 10 minutes for most tests
  const claimPeriod = 300; // 5 minutes for most tests
  
  // Helper function to advance time in ganache
  const advanceTime = async (timeInSeconds) => {
    await web3.currentProvider.send({
      jsonrpc: '2.0',
      method: 'evm_increaseTime',
      params: [timeInSeconds],
      id: new Date().getTime()
    });
    
    // Mine a new block to update the timestamp
    await web3.currentProvider.send({
      jsonrpc: '2.0',
      method: 'evm_mine',
      params: [],
      id: new Date().getTime()
    });
  };
  
  describe("Initialization & Deployment", () => {
    it("should fail deployment with 0 ticket price", async () => {
      await truffleAssert.reverts(
        DecentralizedProgressiveJackpotRaffle.new(
          0, // 0 ticket price
          jackpotPercentage,
          maxTicketsPerPurchase,
          raffleDuration,
          claimPeriod,
          { from: owner }
        ),
        "Ticket price must be greater than zero"
      );
    });
    
    it("should fail deployment with jackpotPercentage = 0", async () => {
      await truffleAssert.reverts(
        DecentralizedProgressiveJackpotRaffle.new(
          ticketPrice,
          0, // 0 jackpot percentage
          maxTicketsPerPurchase,
          raffleDuration,
          claimPeriod,
          { from: owner }
        ),
        "Jackpot percentage must be between 1 and 99"
      );
    });
    
    it("should fail deployment with jackpotPercentage = 100", async () => {
      await truffleAssert.reverts(
        DecentralizedProgressiveJackpotRaffle.new(
          ticketPrice,
          100, // 100 jackpot percentage
          maxTicketsPerPurchase,
          raffleDuration,
          claimPeriod,
          { from: owner }
        ),
        "Jackpot percentage must be between 1 and 99"
      );
    });
    
    it("should fail deployment with claim period = 0", async () => {
      await truffleAssert.reverts(
        DecentralizedProgressiveJackpotRaffle.new(
          ticketPrice,
          jackpotPercentage,
          maxTicketsPerPurchase,
          raffleDuration,
          0, // 0 claim period
          { from: owner }
        ),
        "Claim period must be greater than zero"
      );
    });
    
    it("should fail deployment with raffle duration = 0", async () => {
      await truffleAssert.reverts(
        DecentralizedProgressiveJackpotRaffle.new(
          ticketPrice,
          jackpotPercentage,
          maxTicketsPerPurchase,
          0, // 0 raffle duration
          claimPeriod,
          { from: owner }
        ),
        "Raffle duration must be greater than zero"
      );
    });
    
    it("should fail deployment with maxTicketsPerPurchase = 0", async () => {
      await truffleAssert.reverts(
        DecentralizedProgressiveJackpotRaffle.new(
          ticketPrice,
          jackpotPercentage,
          0, // 0 max tickets per purchase
          raffleDuration,
          claimPeriod,
          { from: owner }
        ),
        "Max tickets per purchase must be greater than zero"
      );
    });
  });
  
  // For each test section, create a fresh contract instance
  describe("Ticket Purchase Tests", () => {
    beforeEach(async () => {
      raffleInstance = await DecentralizedProgressiveJackpotRaffle.new(
        ticketPrice,
        jackpotPercentage,
        maxTicketsPerPurchase,
        raffleDuration,
        claimPeriod,
        { from: owner }
      );
    });
    
    it("should fail if numTickets = 0", async () => {
      await truffleAssert.reverts(
        raffleInstance.purchaseTickets(0, { from: player1, value: 0 }),
        "Must purchase at least one ticket"
      );
    });
    
    it("should fail if numTickets > maxTicketsPerPurchase", async () => {
      const numTickets = maxTicketsPerPurchase + 1;
      const totalCost = web3.utils.toBN(ticketPrice).mul(web3.utils.toBN(numTickets));
      
      await truffleAssert.reverts(
        raffleInstance.purchaseTickets(numTickets, { from: player1, value: totalCost }),
        "Cannot purchase more than maximum tickets per transaction"
      );
    });
    
    it("should fail if raffle time has expired", async () => {
      // Advance time past the raffle duration
      await advanceTime(raffleDuration + 1);
      
      const numTickets = 1;
      const totalCost = ticketPrice;
      
      await truffleAssert.reverts(
        raffleInstance.purchaseTickets(numTickets, { from: player1, value: totalCost }),
        "Raffle time has expired"
      );
    });
    
    it("should fail if raffle already ended", async () => {
      // First purchase tickets so we can end the raffle
      const numTickets = 1;
      const totalCost = ticketPrice;
      await raffleInstance.purchaseTickets(numTickets, { from: player1, value: totalCost });
      
      // Advance time past the raffle duration
      await advanceTime(raffleDuration + 1);
      
      // End the raffle
      await raffleInstance.endRaffle();
      
      // Try to purchase more tickets
      await truffleAssert.reverts(
        raffleInstance.purchaseTickets(numTickets, { from: player2, value: totalCost }),
        "Raffle has already ended"
      );
    });
    
    it("user buys multiple times - tickets should accumulate correctly", async () => {
      // First purchase
      const firstPurchase = 2;
      const firstCost = web3.utils.toBN(ticketPrice).mul(web3.utils.toBN(firstPurchase));
      await raffleInstance.purchaseTickets(firstPurchase, { from: player1, value: firstCost });
      
      // Second purchase
      const secondPurchase = 3;
      const secondCost = web3.utils.toBN(ticketPrice).mul(web3.utils.toBN(secondPurchase));
      await raffleInstance.purchaseTickets(secondPurchase, { from: player1, value: secondCost });
      
      // Check total tickets owned
      const tickets = await raffleInstance.getTicketsByOwner(player1);
      assert.equal(tickets.length, firstPurchase + secondPurchase, "Tickets didn't accumulate correctly");
      
      // Check total tickets sold
      const totalTickets = await raffleInstance.totalTickets();
      assert.equal(totalTickets.toNumber(), firstPurchase + secondPurchase, "Total tickets count incorrect");
    });
    
    it("multiple users buy, ticket IDs should not overlap", async () => {
      // Player 1 buys tickets
      const player1Purchase = 2;
      const player1Cost = web3.utils.toBN(ticketPrice).mul(web3.utils.toBN(player1Purchase));
      await raffleInstance.purchaseTickets(player1Purchase, { from: player1, value: player1Cost });
      
      // Player 2 buys tickets
      const player2Purchase = 3;
      const player2Cost = web3.utils.toBN(ticketPrice).mul(web3.utils.toBN(player2Purchase));
      await raffleInstance.purchaseTickets(player2Purchase, { from: player2, value: player2Cost });
      
      // Get tickets owned by each player
      const player1Tickets = await raffleInstance.getTicketsByOwner(player1);
      const player2Tickets = await raffleInstance.getTicketsByOwner(player2);
      
      // Check that player 1's tickets are exactly 0, 1
      assert.equal(player1Tickets[0].toNumber(), 0, "Player 1's first ticket ID is incorrect");
      assert.equal(player1Tickets[1].toNumber(), 1, "Player 1's second ticket ID is incorrect");
      
      // Check that player 2's tickets are exactly 2, 3, 4
      assert.equal(player2Tickets[0].toNumber(), 2, "Player 2's first ticket ID is incorrect");
      assert.equal(player2Tickets[1].toNumber(), 3, "Player 2's second ticket ID is incorrect");
      assert.equal(player2Tickets[2].toNumber(), 4, "Player 2's third ticket ID is incorrect");
      
      // Check ticket owners through mapping
      assert.equal(await raffleInstance.ticketOwner(0), player1, "Ticket 0 owner incorrect");
      assert.equal(await raffleInstance.ticketOwner(2), player2, "Ticket 2 owner incorrect");
    });
  });
  
  describe("Raffle Ending Tests", () => {
    beforeEach(async () => {
      raffleInstance = await DecentralizedProgressiveJackpotRaffle.new(
        ticketPrice,
        jackpotPercentage,
        maxTicketsPerPurchase,
        raffleDuration,
        claimPeriod,
        { from: owner }
      );
    });
    
    it("should fail endRaffle() if no tickets were sold", async () => {
      // Advance time past the raffle duration
      await advanceTime(raffleDuration + 1);
      
      await truffleAssert.reverts(
        raffleInstance.endRaffle(),
        "No tickets were sold"
      );
    });
    
    it("should fail endRaffle() if raffle is still active", async () => {
      // Purchase a ticket
      const numTickets = 1;
      const totalCost = ticketPrice;
      await raffleInstance.purchaseTickets(numTickets, { from: player1, value: totalCost });
      
      // Try to end the raffle before time expires
      await truffleAssert.reverts(
        raffleInstance.endRaffle(),
        "Raffle is still active"
      );
    });
    
    it("should fail endRaffle() if already ended", async () => {
      // Purchase a ticket
      const numTickets = 1;
      const totalCost = ticketPrice;
      await raffleInstance.purchaseTickets(numTickets, { from: player1, value: totalCost });
      
      // Advance time past the raffle duration
      await advanceTime(raffleDuration + 1);
      
      // End the raffle
      await raffleInstance.endRaffle();
      
      // Try to end the raffle again
      await truffleAssert.reverts(
        raffleInstance.endRaffle(),
        "Raffle has already ended"
      );
    });
    
    it("only first call to endRaffle() should trigger winner selection", async () => {
      // Purchase tickets from multiple players
      const numTickets = 3;
      const totalCost = web3.utils.toBN(ticketPrice).mul(web3.utils.toBN(numTickets));
      
      await raffleInstance.purchaseTickets(numTickets, { from: player1, value: totalCost });
      await raffleInstance.purchaseTickets(numTickets, { from: player2, value: totalCost });
      
      // Advance time past the raffle duration
      await advanceTime(raffleDuration + 1);
      
      // End the raffle and check for RaffleEnded event
      const tx = await raffleInstance.endRaffle();
      truffleAssert.eventEmitted(tx, 'RaffleEnded');
      
      // Get the winner and winning ticket ID
      const winner = await raffleInstance.winner();
      const winningTicketId = await raffleInstance.winningTicketId();
      
      // Check that winner is either player1 or player2
      assert(winner === player1 || winner === player2, "Winner is not a valid player");
      
      // Check that the winning ticket ID is valid (0-5)
      assert(winningTicketId >= 0 && winningTicketId <= 5, "Winning ticket ID out of range");
      
      // Ensure the winner matches the ticket owner
      const ticketOwner = await raffleInstance.ticketOwner(winningTicketId);
      assert.equal(winner, ticketOwner, "Winner does not match ticket owner");
    });
    
    it("ensure winner is from valid ticket ID range", async () => {
      // Purchase different numbers of tickets from different players
      const player1Tickets = 2;
      const player2Tickets = 3;
      const player3Tickets = 1;
      
      await raffleInstance.purchaseTickets(player1Tickets, { 
        from: player1, 
        value: web3.utils.toBN(ticketPrice).mul(web3.utils.toBN(player1Tickets)) 
      });
      
      await raffleInstance.purchaseTickets(player2Tickets, { 
        from: player2, 
        value: web3.utils.toBN(ticketPrice).mul(web3.utils.toBN(player2Tickets)) 
      });
      
      await raffleInstance.purchaseTickets(player3Tickets, { 
        from: player3, 
        value: web3.utils.toBN(ticketPrice).mul(web3.utils.toBN(player3Tickets)) 
      });
      
      // Advance time past the raffle duration
      await advanceTime(raffleDuration + 1);
      
      // End the raffle
      await raffleInstance.endRaffle();
      
      // Get the winning ticket ID
      const winningTicketId = await raffleInstance.winningTicketId();
      
      // Ensure the winning ticket ID is within the valid range (0-5)
      const totalTickets = await raffleInstance.totalTickets();
      assert(
        winningTicketId >= 0 && winningTicketId < totalTickets,
        "Winning ticket ID outside valid range"
      );
    });
    
    it("ensure emitted winner matches ticket owner", async () => {
      // Purchase tickets
      const numTickets = 5;
      const totalCost = web3.utils.toBN(ticketPrice).mul(web3.utils.toBN(numTickets));
      await raffleInstance.purchaseTickets(numTickets, { from: player1, value: totalCost });
      
      // Advance time past the raffle duration
      await advanceTime(raffleDuration + 1);
      
      // End the raffle
      const tx = await raffleInstance.endRaffle();
      
      // Get winner and winning ticket from event
      let winner, winningTicketId;
      truffleAssert.eventEmitted(tx, 'RaffleEnded', (ev) => {
        winningTicketId = ev.winningTicketId;
        winner = ev.winner;
        return true;
      });
      
      // Check that the winner is the ticket owner
      const ticketOwner = await raffleInstance.ticketOwner(winningTicketId);
      assert.equal(winner, ticketOwner, "Winner in event does not match ticket owner");
    });
  });
  
  describe("Jackpot Claim Tests", () => {
    beforeEach(async () => {
      raffleInstance = await DecentralizedProgressiveJackpotRaffle.new(
        ticketPrice,
        jackpotPercentage,
        maxTicketsPerPurchase,
        raffleDuration,
        claimPeriod,
        { from: owner }
      );
      
      // Purchase tickets from multiple players to set up the raffle
      const player1Tickets = 2;
      const player2Tickets = 3;
      
      await raffleInstance.purchaseTickets(player1Tickets, { 
        from: player1, 
        value: web3.utils.toBN(ticketPrice).mul(web3.utils.toBN(player1Tickets)) 
      });
      
      await raffleInstance.purchaseTickets(player2Tickets, { 
        from: player2, 
        value: web3.utils.toBN(ticketPrice).mul(web3.utils.toBN(player2Tickets)) 
      });
    });
    
    it("should fail claim before raffle ends", async () => {
      await truffleAssert.reverts(
        raffleInstance.claimJackpot({ from: player1 }),
        "Raffle has not ended yet"
      );
    });
    
    it("should fail if caller is not the winner", async () => {
      // Advance time and end the raffle
      await advanceTime(raffleDuration + 1);
      await raffleInstance.endRaffle();
      
      // Get the winner
      const winner = await raffleInstance.winner();
      
      // Try to claim jackpot from a non-winner account
      const nonWinnerAccount = winner === player1 ? player2 : player1;
      
      await truffleAssert.reverts(
        raffleInstance.claimJackpot({ from: nonWinnerAccount }),
        "Only the winner can claim the jackpot"
      );
    });
    
    it("should fail if jackpot already claimed", async () => {
      // Advance time and end the raffle
      await advanceTime(raffleDuration + 1);
      await raffleInstance.endRaffle();
      
      // Get the winner
      const winner = await raffleInstance.winner();
      
      // Claim the jackpot
      await raffleInstance.claimJackpot({ from: winner });
      
      // Try to claim again
      await truffleAssert.reverts(
        raffleInstance.claimJackpot({ from: winner }),
        "Jackpot has already been claimed"
      );
    });
    
    it("check jackpot is transferred to winner", async () => {
      // Advance time and end the raffle
      await advanceTime(raffleDuration + 1);
      await raffleInstance.endRaffle();
      
      // Get the winner
      const winner = await raffleInstance.winner();
      
      // Get jackpot amount
      const jackpotAmount = await raffleInstance.jackpotAmount();
      
      // Get winner's balance before claiming
      const balanceBefore = web3.utils.toBN(await web3.eth.getBalance(winner));
      
      // Claim the jackpot
      const tx = await raffleInstance.claimJackpot({ from: winner });
      
      // Calculate gas used
      const gasUsed = web3.utils.toBN(tx.receipt.gasUsed);
      const txInfo = await web3.eth.getTransaction(tx.tx);
      const gasPrice = web3.utils.toBN(txInfo.gasPrice);
      const gasCost = gasUsed.mul(gasPrice);
      
      // Get winner's balance after claiming
      const balanceAfter = web3.utils.toBN(await web3.eth.getBalance(winner));
      
      // Expected balance: original + jackpot - gas costs
      const expectedBalance = balanceBefore.add(jackpotAmount).sub(gasCost);
      
      assert.equal(
        balanceAfter.toString(),
        expectedBalance.toString(),
        "Winner did not receive the correct jackpot amount"
      );
      
      // Check that jackpot amount in contract is now 0
      const jackpotAfter = await raffleInstance.jackpotAmount();
      assert.equal(jackpotAfter, 0, "Jackpot not reset to 0 after claim");
    });
    
    it("contract balance is reduced by jackpot amount after claim", async () => {
      // Advance time and end the raffle
      await advanceTime(raffleDuration + 1);
      await raffleInstance.endRaffle();
      
      // Get the winner
      const winner = await raffleInstance.winner();
      
      // Get jackpot amount
      const jackpotAmount = await raffleInstance.jackpotAmount();
      
      // Get contract balance before claiming
      const contractBalanceBefore = web3.utils.toBN(await web3.eth.getBalance(raffleInstance.address));
      
      // Claim the jackpot
      await raffleInstance.claimJackpot({ from: winner });
      
      // Get contract balance after claiming
      const contractBalanceAfter = web3.utils.toBN(await web3.eth.getBalance(raffleInstance.address));
      
      // Expected balance: original - jackpot
      const expectedBalance = contractBalanceBefore.sub(jackpotAmount);
      
      assert.equal(
        contractBalanceAfter.toString(),
        expectedBalance.toString(),
        "Contract balance not reduced correctly after jackpot claim"
      );
    });
  });
  
  describe("Handle Unclaimed Jackpot Tests", () => {
    beforeEach(async () => {
      raffleInstance = await DecentralizedProgressiveJackpotRaffle.new(
        ticketPrice,
        jackpotPercentage,
        maxTicketsPerPurchase,
        raffleDuration,
        claimPeriod,
        { from: owner }
      );
      
      // Purchase tickets
      const numTickets = 3;
      const totalCost = web3.utils.toBN(ticketPrice).mul(web3.utils.toBN(numTickets));
      await raffleInstance.purchaseTickets(numTickets, { from: player1, value: totalCost });
      
      // Advance time and end the raffle
      await advanceTime(raffleDuration + 1);
      await raffleInstance.endRaffle();
    });
    
    it("fails if not owner", async () => {
      await truffleAssert.reverts(
        raffleInstance.handleUnclaimedJackpot({ from: player1 }),
        "Only owner can call this function"
      );
    });
    
    it("fails if called before claimPeriod expires", async () => {
      await truffleAssert.reverts(
        raffleInstance.handleUnclaimedJackpot({ from: owner }),
        "Claim period not yet expired"
      );
    });
    
    it("fails if jackpot already claimed", async () => {
      // Get the winner
      const winner = await raffleInstance.winner();
      
      // Winner claims the jackpot
      await raffleInstance.claimJackpot({ from: winner });
      
      // Advance time past claim period
      await advanceTime(claimPeriod + 1);
      
      // Try to handle unclaimed jackpot
      await truffleAssert.reverts(
        raffleInstance.handleUnclaimedJackpot({ from: owner }),
        "Jackpot has already been claimed"
      );
    });
    
    it("ensure amount is transferred to owner correctly", async () => {
      // Advance time past claim period
      await advanceTime(claimPeriod + 1);
      
      // Get jackpot amount
      const jackpotAmount = await raffleInstance.jackpotAmount();
      
      // Get owner's balance before handling unclaimed jackpot
      const balanceBefore = web3.utils.toBN(await web3.eth.getBalance(owner));
      
      // Handle unclaimed jackpot
      const tx = await raffleInstance.handleUnclaimedJackpot({ from: owner });
      
      // Calculate gas used
      const gasUsed = web3.utils.toBN(tx.receipt.gasUsed);
      const txInfo = await web3.eth.getTransaction(tx.tx);
      const gasPrice = web3.utils.toBN(txInfo.gasPrice);
      const gasCost = gasUsed.mul(gasPrice);
      
      // Get owner's balance after handling unclaimed jackpot
      const balanceAfter = web3.utils.toBN(await web3.eth.getBalance(owner));
      
      // Expected balance: original + jackpot - gas costs
      const expectedBalance = balanceBefore.add(jackpotAmount).sub(gasCost);
      
      assert.equal(
        balanceAfter.toString(),
        expectedBalance.toString(),
        "Owner did not receive the correct unclaimed jackpot amount"
      );
      
      // Check that jackpot amount in contract is now 0
      const jackpotAfter = await raffleInstance.jackpotAmount();
      assert.equal(jackpotAfter, 0, "Jackpot not reset to 0 after handling unclaimed jackpot");
    });
  });
  
  describe("Platform Fee Withdrawal Tests", () => {
    beforeEach(async () => {
      raffleInstance = await DecentralizedProgressiveJackpotRaffle.new(
        ticketPrice,
        jackpotPercentage,
        maxTicketsPerPurchase,
        raffleDuration,
        claimPeriod,
        { from: owner }
      );
      
      // Purchase tickets to generate platform fees
      const numTickets = 5;
      const totalCost = web3.utils.toBN(ticketPrice).mul(web3.utils.toBN(numTickets));
      await raffleInstance.purchaseTickets(numTickets, { from: player1, value: totalCost });
    });
    
    it("fails if not owner", async () => {
      await truffleAssert.reverts(
        raffleInstance.withdrawPlatformFees({ from: player1 }),
        "Only owner can call this function"
      );
    });
    
    it("withdraws correct platform fee amount", async () => {
      // Calculate expected platform fees (10% of total ticket sales)
      const totalTicketSales = web3.utils.toBN(ticketPrice).mul(web3.utils.toBN(5));
      const expectedPlatformFees = totalTicketSales.mul(web3.utils.toBN(100 - jackpotPercentage)).div(web3.utils.toBN(100));
      
      // Check platform fees in contract
      const platformFees = await raffleInstance.platformFees();
      assert.equal(
        platformFees.toString(),
        expectedPlatformFees.toString(),
        "Platform fees calculated incorrectly"
      );
      
      // Get owner's balance before withdrawal
      const balanceBefore = web3.utils.toBN(await web3.eth.getBalance(owner));
      
      // Withdraw platform fees
      const tx = await raffleInstance.withdrawPlatformFees({ from: owner });
      
      // Calculate gas used
      const gasUsed = web3.utils.toBN(tx.receipt.gasUsed);
      const txInfo = await web3.eth.getTransaction(tx.tx);
      const gasPrice = web3.utils.toBN(txInfo.gasPrice);
      const gasCost = gasUsed.mul(gasPrice);
      
      // Get owner's balance after withdrawal
      const balanceAfter = web3.utils.toBN(await web3.eth.getBalance(owner));
      
      // Expected balance: original + platform fees - gas costs
      const expectedBalance = balanceBefore.add(platformFees).sub(gasCost);
      
      assert.equal(
        balanceAfter.toString(),
        expectedBalance.toString(),
        "Owner did not receive the correct platform fee amount"
      );
    });
    
    it("ensure platform fees reset to 0 after withdrawal", async () => {
      // Withdraw platform fees
      await raffleInstance.withdrawPlatformFees({ from: owner });
      
      // Check platform fees after withdrawal
      const platformFees = await raffleInstance.platformFees();
      assert.equal(platformFees, 0, "Platform fees not reset to 0 after withdrawal");
    });
  });
  
  describe("View Functions", () => {
    beforeEach(async () => {
      raffleInstance = await DecentralizedProgressiveJackpotRaffle.new(
        ticketPrice,
        jackpotPercentage,
        maxTicketsPerPurchase,
        raffleDuration,
        claimPeriod,
        { from: owner }
      );
      
      // Purchase tickets
      const numTickets = 3;
      const totalCost = web3.utils.toBN(ticketPrice).mul(web3.utils.toBN(numTickets));
      await raffleInstance.purchaseTickets(numTickets, { from: player1, value: totalCost });
    });
    
    it("getRaffleState() shows accurate time remaining and flags", async () => {
      // Get raffle state
      const state = await raffleInstance.getRaffleState();
      
      // Check total tickets
      assert.equal(state[0], 3, "Total tickets count incorrect");
      
      // Check jackpot amount
      const expectedJackpot = web3.utils.toBN(ticketPrice)
        .mul(web3.utils.toBN(3))
        .mul(web3.utils.toBN(jackpotPercentage))
        .div(web3.utils.toBN(100));
      assert.equal(state[1].toString(), expectedJackpot.toString(), "Jackpot amount incorrect");
      
      // Check time remaining
      const endTime = await raffleInstance.endTime();
      const currentBlock = await web3.eth.getBlock('latest');
      const expectedTimeRemaining = endTime - currentBlock.timestamp;
      // Allow for a small time difference due to block mining
      assert(
        Math.abs(state[2] - expectedTimeRemaining) <= 2,
        "Time remaining significantly different from expected"
      );
      
      // Check raffle ended flag
      assert.equal(state[3], false, "Raffle ended flag incorrect");
      
      // Advance time and end the raffle
      await advanceTime(raffleDuration + 1);
      await raffleInstance.endRaffle();
      
      // Get raffle state again
      const stateAfter = await raffleInstance.getRaffleState();
      
      // Check raffle ended flag
      assert.equal(stateAfter[3], true, "Raffle ended flag not updated after ending");
      
      // Check time remaining is 0
      assert.equal(stateAfter[2], 0, "Time remaining not 0 after raffle ended");
    });
    
    it("getTicketsByOwner() returns correct list", async () => {
      // Purchase additional tickets from player2
      const numTickets = 2;
      const totalCost = web3.utils.toBN(ticketPrice).mul(web3.utils.toBN(numTickets));
      await raffleInstance.purchaseTickets(numTickets, { from: player2, value: totalCost });
      
      // Get tickets for player1
      const player1Tickets = await raffleInstance.getTicketsByOwner(player1);
      assert.equal(player1Tickets.length, 3, "Player 1 should have 3 tickets");
      assert.equal(player1Tickets[0], 0, "First ticket ID incorrect");
      assert.equal(player1Tickets[1], 1, "Second ticket ID incorrect");
      assert.equal(player1Tickets[2], 2, "Third ticket ID incorrect");
      
      // Get tickets for player2
      const player2Tickets = await raffleInstance.getTicketsByOwner(player2);
      assert.equal(player2Tickets.length, 2, "Player 2 should have 2 tickets");
      assert.equal(player2Tickets[0], 3, "First ticket ID incorrect");
      assert.equal(player2Tickets[1], 4, "Second ticket ID incorrect");
      
      // Check a player with no tickets
      const player3Tickets = await raffleInstance.getTicketsByOwner(player3);
      assert.equal(player3Tickets.length, 0, "Player 3 should have 0 tickets");
    });
  });
  
  describe("Boundary Conditions", () => {
    let exactEndRaffle;
    let exactClaimPeriod;
    
    beforeEach(async () => {
      // Create a raffle with precise timing for boundary tests
      exactEndRaffle = await DecentralizedProgressiveJackpotRaffle.new(
        ticketPrice,
        jackpotPercentage,
        maxTicketsPerPurchase,
        raffleDuration,
        claimPeriod,
        { from: owner }
      );
      
      // Purchase tickets
      const numTickets = 3;
      const totalCost = web3.utils.toBN(ticketPrice).mul(web3.utils.toBN(numTickets));
      await exactEndRaffle.purchaseTickets(numTickets, { from: player1, value: totalCost });
    });
    
    it("test exactly at endTime", async () => {
      // Get the exact end time
      const endTime = await exactEndRaffle.endTime();
      const currentBlock = await web3.eth.getBlock('latest');
      
      // Calculate the exact time to advance to reach endTime
      const timeToAdvance = endTime - currentBlock.timestamp;
      await advanceTime(timeToAdvance);
      
      // Try to purchase tickets - should fail
      const numTickets = 1;
      const totalCost = ticketPrice;
      
      await truffleAssert.reverts(
        exactEndRaffle.purchaseTickets(numTickets, { from: player2, value: totalCost }),
        "Raffle time has expired"
      );
      
      // Try to end the raffle - should succeed
      const tx = await exactEndRaffle.endRaffle();
      truffleAssert.eventEmitted(tx, 'RaffleEnded');
    });
    
    it("test exactly at endTime + claimPeriod", async () => {
      // End the raffle first
      await advanceTime(raffleDuration + 1);
      await exactEndRaffle.endRaffle();
      
      // Get the end time and calculate the claim period end
      const endTime = await exactEndRaffle.endTime();
      const claimPeriodEnd = Number(endTime) + Number(claimPeriod);
      
      // Get current time
      const currentBlock = await web3.eth.getBlock('latest');
      
      // Calculate the exact time to advance to reach claimPeriodEnd
      const timeToAdvance = claimPeriodEnd - currentBlock.timestamp;
      await advanceTime(timeToAdvance);
      
      // Try to handle unclaimed jackpot - should succeed
      // First check if the jackpot has been claimed by the winner
      const winner = await exactEndRaffle.winner();
      const jackpotClaimed = await exactEndRaffle.jackpotClaimed();
      
      if (!jackpotClaimed) {
        const tx = await exactEndRaffle.handleUnclaimedJackpot({ from: owner });
        truffleAssert.eventEmitted(tx, 'JackpotUnclaimed');
      }
    });
    
    it("high number of tickets to ensure performance", async () => {
      // Create a new raffle with a high max tickets per purchase
      const highVolumeRaffle = await DecentralizedProgressiveJackpotRaffle.new(
        ticketPrice,
        jackpotPercentage,
        50, // Higher max tickets per purchase
        raffleDuration,
        claimPeriod,
        { from: owner }
      );
      
      // Purchase maximum number of tickets allowed
      const numTickets = 50;
      const totalCost = web3.utils.toBN(ticketPrice).mul(web3.utils.toBN(numTickets));
      
      // Purchase from multiple players to ensure a high total ticket count
      await highVolumeRaffle.purchaseTickets(numTickets, { from: player1, value: totalCost });
      await highVolumeRaffle.purchaseTickets(numTickets, { from: player2, value: totalCost });
      await highVolumeRaffle.purchaseTickets(numTickets, { from: player3, value: totalCost });
      
      // Check total tickets
      const totalTickets = await highVolumeRaffle.totalTickets();
      assert.equal(totalTickets, 150, "Total ticket count incorrect");
      
      // Advance time and end the raffle
      await advanceTime(raffleDuration + 1);
      const tx = await highVolumeRaffle.endRaffle();
      
      // Verify raffle ended successfully
      truffleAssert.eventEmitted(tx, 'RaffleEnded');
      
      // Get the winner and winning ticket
      const winner = await highVolumeRaffle.winner();
      const winningTicketId = await highVolumeRaffle.winningTicketId();
      
      // Verify the winner is a valid participant
      assert(
        winner === player1 || winner === player2 || winner === player3,
        "Winner is not a valid participant"
      );
      
      // Verify winning ticket ID is in the valid range
      assert(
        winningTicketId >= 0 && winningTicketId < 150,
        "Winning ticket ID outside valid range"
      );
    });
  });
  
  describe("Integration Tests", () => {
    it("full raffle lifecycle with multiple participants", async () => {
      // Create a new raffle
      const lifecycleRaffle = await DecentralizedProgressiveJackpotRaffle.new(
        ticketPrice,
        jackpotPercentage,
        maxTicketsPerPurchase,
        raffleDuration,
        claimPeriod,
        { from: owner }
      );
      
      // Multiple players purchase tickets
      await lifecycleRaffle.purchaseTickets(3, { 
        from: player1, 
        value: web3.utils.toBN(ticketPrice).mul(web3.utils.toBN(3)) 
      });
      
      await lifecycleRaffle.purchaseTickets(5, { 
        from: player2, 
        value: web3.utils.toBN(ticketPrice).mul(web3.utils.toBN(5)) 
      });
      
      await lifecycleRaffle.purchaseTickets(2, { 
        from: player3, 
        value: web3.utils.toBN(ticketPrice).mul(web3.utils.toBN(2)) 
      });
      
      // Check total tickets and jackpot
      const totalTickets = await lifecycleRaffle.totalTickets();
      assert.equal(totalTickets, 10, "Total tickets incorrect");
      
      const expectedJackpot = web3.utils.toBN(ticketPrice)
        .mul(web3.utils.toBN(10))
        .mul(web3.utils.toBN(jackpotPercentage))
        .div(web3.utils.toBN(100));
      
      const jackpotAmount = await lifecycleRaffle.jackpotAmount();
      assert.equal(
        jackpotAmount.toString(),
        expectedJackpot.toString(),
        "Jackpot amount incorrect"
      );
      
      // Advance time and end raffle
      await advanceTime(raffleDuration + 1);
      const endTx = await lifecycleRaffle.endRaffle();
      
      // Get winner and winning ticket
      let winner, winningTicketId;
      truffleAssert.eventEmitted(endTx, 'RaffleEnded', (ev) => {
        winningTicketId = ev.winningTicketId;
        winner = ev.winner;
        return true;
      });
      
      // Verify winner is one of the participants
      assert(
        winner === player1 || winner === player2 || winner === player3,
        "Winner is not a valid participant"
      );
      
      // Verify winning ticket belongs to winner
      const ticketOwner = await lifecycleRaffle.ticketOwner(winningTicketId);
      assert.equal(winner, ticketOwner, "Winner does not match ticket owner");
      
      // Get winner's balance before claiming
      const balanceBefore = web3.utils.toBN(await web3.eth.getBalance(winner));
      
      // Winner claims jackpot
      const claimTx = await lifecycleRaffle.claimJackpot({ from: winner });
      
      // Calculate gas used
      const gasUsed = web3.utils.toBN(claimTx.receipt.gasUsed);
      const txInfo = await web3.eth.getTransaction(claimTx.tx);
      const gasPrice = web3.utils.toBN(txInfo.gasPrice);
      const gasCost = gasUsed.mul(gasPrice);
      
      // Get winner's balance after claiming
      const balanceAfter = web3.utils.toBN(await web3.eth.getBalance(winner));
      
      // Expected balance: original + jackpot - gas costs
      const expectedBalance = balanceBefore.add(expectedJackpot).sub(gasCost);
      
      assert.equal(
        balanceAfter.toString(),
        expectedBalance.toString(),
        "Winner did not receive correct jackpot amount"
      );
      
      // Owner withdraws platform fees
      const platformFees = await lifecycleRaffle.platformFees();
      const ownerBalanceBefore = web3.utils.toBN(await web3.eth.getBalance(owner));
      
      const withdrawTx = await lifecycleRaffle.withdrawPlatformFees({ from: owner });
      
      // Calculate gas used for withdrawal
      const withdrawGasUsed = web3.utils.toBN(withdrawTx.receipt.gasUsed);
      const withdrawTxInfo = await web3.eth.getTransaction(withdrawTx.tx);
      const withdrawGasPrice = web3.utils.toBN(withdrawTxInfo.gasPrice);
      const withdrawGasCost = withdrawGasUsed.mul(withdrawGasPrice);
      
      // Get owner's balance after withdrawal
      const ownerBalanceAfter = web3.utils.toBN(await web3.eth.getBalance(owner));
      
      // Expected owner balance: original + platform fees - gas costs
      const expectedOwnerBalance = ownerBalanceBefore.add(platformFees).sub(withdrawGasCost);
      
      assert.equal(
        ownerBalanceAfter.toString(),
        expectedOwnerBalance.toString(),
        "Owner did not receive correct platform fees"
      );
      
      // Verify contract balance is 0
      const contractBalance = await web3.eth.getBalance(lifecycleRaffle.address);
      assert.equal(contractBalance, 0, "Contract balance not zero after all withdrawals");
    });
  });
});