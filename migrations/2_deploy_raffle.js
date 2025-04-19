const DecentralizedProgressiveJackpotRaffle = artifacts.require("DecentralizedProgressiveJackpotRaffle");

module.exports = function(deployer) {
  // Constructor parameters:
  // ticketPrice (in wei) - 0.01 ETH
  const ticketPrice = web3.utils.toWei('0.01', 'ether');
  // jackpotPercentage - 90% goes to jackpot
  const jackpotPercentage = 90;
  // maxTicketsPerPurchase - 10 tickets max per transaction
  const maxTicketsPerPurchase = 10;
  // raffleDuration - 24 hours (in seconds)
  const raffleDuration = 86400;
  // claimPeriod - 7 days (in seconds)
  const claimPeriod = 604800;

  deployer.deploy(
    DecentralizedProgressiveJackpotRaffle,
    ticketPrice,
    jackpotPercentage,
    maxTicketsPerPurchase,
    raffleDuration,
    claimPeriod
  );
};