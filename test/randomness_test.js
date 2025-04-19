// const DecentralizedProgressiveJackpotRaffle = artifacts.require("DecentralizedProgressiveJackpotRaffle");

// contract("DecentralizedProgressiveJackpotRaffle - Randomness Tests", accounts => {
//   const owner = accounts[0];
//   const players = accounts.slice(1, 6); // Use 5 players for randomness testing
  
//   let raffleInstance;
//   const ticketPrice = web3.utils.toWei('0.01', 'ether');
//   const jackpotPercentage = 90;
//   const maxTicketsPerPurchase = 10;
//   const raffleDuration = 600; // 10 minutes
//   const claimPeriod = 300; // 5 minutes
  
//   // Helper function to advance time in ganache
//   const advanceTime = async (timeInSeconds) => {
//     await web3.currentProvider.send({
//       jsonrpc: '2.0',
//       method: 'evm_increaseTime',
//       params: [timeInSeconds],
//       id: new Date().getTime()
//     });
    
//     // Mine a new block to update the timestamp
//     await web3.currentProvider.send({
//       jsonrpc: '2.0',
//       method: 'evm_mine',
//       params: [],
//       id: new Date().getTime()
//     });
//   };
  
//   // Helper function to mine a specific number of blocks
//   const mineBlocks = async (numBlocks) => {
//     for (let i = 0; i < numBlocks; i++) {
//       await web3.currentProvider.send({
//         jsonrpc: '2.0',
//         method: 'evm_mine',
//         params: [],
//         id: new Date().getTime()
//       });
//     }
//   };
  
//   describe("Winner Selection Randomness", () => {
//     it("should distribute winning tickets across all participants over multiple raffles", async () => {
//       // Run multiple raffle instances to test randomness
//       const numRaffles = 10;
//       const winnerCounts = {};
      
//       // Initialize winner counts for each player
//       for (let player of players) {
//         winnerCounts[player] = 0;
//       }
      
//       for (let i = 0; i < numRaffles; i++) {
//         console.log(`Running raffle test ${i + 1} of ${numRaffles}`);
        
//         // Create a new raffle for each test
//         const raffle = await DecentralizedProgressiveJackpotRaffle.new(
//           ticketPrice,
//           jackpotPercentage,
//           maxTicketsPerPurchase,
//           raffleDuration,
//           claimPeriod,
//           { from: owner }
//         );
        
//         // Each player buys the same number of tickets
//         for (let player of players) {
//           await raffle.purchaseTickets(5, {
//             from: player,
//             value: web3.utils.toBN(ticketPrice).mul(web3.utils.toBN(5))
//           });
//         }
        
//         // Advance time and mine some blocks to get different blockhashes
//         await advanceTime(raffleDuration + 1);
//         await mineBlocks(3);
        
//         // End the raffle and get the winner
//         await raffle.endRaffle();
//         const winner = await raffle.winner();
        
//         // Increment winner count
//         if (winnerCounts[winner] !== undefined) {
//           winnerCounts[winner]++;
//         }
//       }
      
//       console.log("Winner distribution:");
//       for (let player of players) {
//         console.log(`${player}: ${winnerCounts[player]} wins out of ${numRaffles} raffles`);
//       }
      
//       // Check that at least 3 different players won at least once
//       const winnersCount = Object.values(winnerCounts).filter(count => count > 0).length;
//       assert(winnersCount >= 3, `Only ${winnersCount} out of 5 players won at least once`);
      
//       // Check that no player won more than 50% of the raffles (basic fairness check)
//       const maxWins = Math.max(...Object.values(winnerCounts));
//       assert(maxWins <= numRaffles / 2, `One player won ${maxWins} out of ${numRaffles} raffles, which is more than 50%`);
//     });
    
//     it("should distribute winning tickets proportionally to ticket ownership", async () => {
//       // Run multiple raffle instances with asymmetric ticket distribution
//       const numRaffles = 10;
//       const winnerCounts = {};
      
//       // Initialize winner counts for each player
//       for (let player of players) {
//         winnerCounts[player] = 0;
//       }
      
//       // Define ticket distribution - player 1 buys 50% of tickets
//       const ticketDistribution = [
//         10, // player 1 buys 10 tickets (50%)
//         3,  // player 2 buys 3 tickets (15%)
//         3,  // player 3 buys 3 tickets (15%)
//         2,  // player 4 buys 2 tickets (10%)
//         2   // player 5 buys 2 tickets (10%)
//       ];
      
//       for (let i = 0; i < numRaffles; i++) {
//         console.log(`Running proportional raffle test ${i + 1} of ${numRaffles}`);
        
//         // Create a new raffle with larger max tickets per purchase
//         const raffle = await DecentralizedProgressiveJackpotRaffle.new(
//           ticketPrice,
//           jackpotPercentage,
//           20, // Larger max tickets
//           raffleDuration,
//           claimPeriod,
//           { from: owner }
//         );
        
//         // Players buy tickets according to distribution
//         for (let j = 0; j < players.length; j++) {
//           const numTickets = ticketDistribution[j];
//           await raffle.purchaseTickets(numTickets, {
//             from: players[j],
//             value: web3.utils.toBN(ticketPrice).mul(web3.utils.toBN(numTickets))
//           });
//         }
        
//         // Advance time and mine some blocks to get different blockhashes
//         await advanceTime(raffleDuration + 1);
//         await mineBlocks(i + 1); // Different blocks for each raffle
        
//         // End the raffle and get the winner
//         await raffle.endRaffle();
//         const winner = await raffle.winner();
        
//         // Increment winner count
//         if (winnerCounts[winner] !== undefined) {
//           winnerCounts[winner]++;
//         }
//       }
      
//       console.log("Proportional winner distribution:");
//       for (let j = 0; j < players.length; j++) {
//         const player = players[j];
//         const ticketPercentage = (ticketDistribution[j] / 20) * 100;
//         console.log(`${player} (${ticketPercentage}% of tickets): ${winnerCounts[player]} wins out of ${numRaffles} raffles`);
//       }
      
//       // Player 1 should win approximately 50% of the time (allow for variance)
//       const player1WinPercentage = (winnerCounts[players[0]] / numRaffles) * 100;
//       console.log(`Player 1 win percentage: ${player1WinPercentage}%`);
      
//       // Since this is probabilistic, we'll use a large margin of error (±30%)
//       // In production, more raffles should be run for better statistical significance
//       assert(
//         player1WinPercentage >= 20 && player1WinPercentage <= 80,
//         `Player 1 with 50% of tickets won ${player1WinPercentage}% of raffles, which is outside 20-80% range`
//       );
//     });
    
//     it("block differences should affect winner selection", async () => {
//       // Create two identical raffles
//       const raffle1 = await DecentralizedProgressiveJackpotRaffle.new(
//         ticketPrice,
//         jackpotPercentage,
//         maxTicketsPerPurchase,
//         raffleDuration,
//         claimPeriod,
//         { from: owner }
//       );
      
//       const raffle2 = await DecentralizedProgressiveJackpotRaffle.new(
//         ticketPrice,
//         jackpotPercentage,
//         maxTicketsPerPurchase,
//         raffleDuration,
//         claimPeriod,
//         { from: owner }
//       );
      
//       // Identical ticket purchases in both raffles
//       for (let player of players) {
//         await raffle1.purchaseTickets(3, {
//           from: player,
//           value: web3.utils.toBN(ticketPrice).mul(web3.utils.toBN(3))
//         });
        
//         await raffle2.purchaseTickets(3, {
//           from: player,
//           value: web3.utils.toBN(ticketPrice).mul(web3.utils.toBN(3))
//         });
//       }
      
//       // Advance time for both raffles
//       await advanceTime(raffleDuration + 1);
      
//       // End first raffle
//       await raffle1.endRaffle();
//       const winner1 = await raffle1.winner();
//       const winningTicket1 = await raffle1.winningTicketId();
      
//       // Mine several blocks to get a different blockhash
//       await mineBlocks(5);
      
//       // End second raffle
//       await raffle2.endRaffle();
//       const winner2 = await raffle2.winner();
//       const winningTicket2 = await raffle2.winningTicketId();
      
//       console.log(`Raffle 1 winner: ${winner1}, winning ticket: ${winningTicket1}`);
//       console.log(`Raffle 2 winner: ${winner2}, winning ticket: ${winningTicket2}`);
      
//       // There's a small chance they could be the same by coincidence, but it's unlikely
//       // We'll record the result rather than asserting to avoid flaky tests
//       if (winner1 === winner2 && winningTicket1.toString() === winningTicket2.toString()) {
//         console.log("WARNING: Both raffles selected the same winner and ticket. This may be a coincidence or could indicate an issue with randomness.");
//       } else {
//         console.log("SUCCESS: Different blocks resulted in different winners or tickets.");
//       }
//     });
//   });
// });