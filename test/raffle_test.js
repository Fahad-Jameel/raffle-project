const DecentralizedProgressiveJackpotRaffle = artifacts.require("DecentralizedProgressiveJackpotRaffle");
const truffleAssert = require('truffle-assertions');

contract("DecentralizedProgressiveJackpotRaffle", accounts => {
  const owner = accounts[0];
  const player1 = accounts[1];
  const player2 = accounts[2];
  
  let raffleInstance;
  const ticketPrice = web3.utils.toWei('0.01', 'ether');
  const jackpotPercentage = 90;
  
  before(async () => {
    // For testing, use a shorter duration
    const maxTicketsPerPurchase = 10;
    const raffleDuration = 600; // 10 minutes
    const claimPeriod = 300; // 5 minutes
    
    raffleInstance = await DecentralizedProgressiveJackpotRaffle.new(
      ticketPrice,
      jackpotPercentage,
      maxTicketsPerPurchase,
      raffleDuration,
      claimPeriod,
      { from: owner }
    );
  });
  
  describe("Initialization", () => {
    it("should set the correct owner", async () => {
      const contractOwner = await raffleInstance.owner();
      assert.equal(contractOwner, owner, "Owner not set correctly");
    });
    
    it("should set the correct ticket price", async () => {
      const price = await raffleInstance.ticketPrice();
      assert.equal(price.toString(), ticketPrice.toString(), "Ticket price not set correctly");
    });
  });
  
  describe("Ticket Purchasing", () => {
    it("should allow purchase of tickets", async () => {
      const numTickets = 3;
      const totalCost = web3.utils.toBN(ticketPrice).mul(web3.utils.toBN(numTickets));
      
      const balanceBefore = await raffleInstance.jackpotAmount();
      
      const tx = await raffleInstance.purchaseTickets(numTickets, { 
        from: player1, 
        value: totalCost 
      });
      
      // Check if the TicketsPurchased event was emitted
      truffleAssert.eventEmitted(tx, 'TicketsPurchased', (ev) => {
        return ev.buyer === player1 && ev.amount.toNumber() === numTickets;
      });
      
      // Check if tickets were assigned correctly
      const tickets = await raffleInstance.getTicketsByOwner(player1);
      assert.equal(tickets.length, numTickets, "Incorrect number of tickets assigned");
      
      // Check total tickets
      const totalTickets = await raffleInstance.totalTickets();
      assert.equal(totalTickets.toNumber(), numTickets, "Total tickets count not updated correctly");
    });
    
    it("should reject purchase if value sent is incorrect", async () => {
      const numTickets = 2;
      const incorrectAmount = web3.utils.toWei('0.015', 'ether'); // Incorrect amount
      
      await truffleAssert.reverts(
        raffleInstance.purchaseTickets(numTickets, { 
          from: player2, 
          value: incorrectAmount 
        }),
        "Incorrect ETH amount sent"
      );
    });
  });
  
  describe("Jackpot Allocation", () => {
    it("should allocate correct percentage to jackpot", async () => {
      // Get jackpot amount before
      const jackpotBefore = await raffleInstance.jackpotAmount();
      
      const numTickets = 2;
      const totalCost = web3.utils.toBN(ticketPrice).mul(web3.utils.toBN(numTickets));
      
      await raffleInstance.purchaseTickets(numTickets, { 
        from: player2, 
        value: totalCost 
      });
      
      // Get jackpot amount after
      const jackpotAfter = await raffleInstance.jackpotAmount();
      
      // Calculate expected increase in jackpot
      const expectedIncrease = totalCost.mul(web3.utils.toBN(jackpotPercentage)).div(web3.utils.toBN(100));
      const actualIncrease = web3.utils.toBN(jackpotAfter).sub(web3.utils.toBN(jackpotBefore));
      
      assert.equal(
        actualIncrease.toString(), 
        expectedIncrease.toString(), 
        "Jackpot increase not calculated correctly"
      );
    });
  });
});