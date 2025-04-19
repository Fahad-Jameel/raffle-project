// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title DecentralizedProgressiveJackpotRaffle
 * @dev A decentralized raffle system with a progressive jackpot
 */
contract DecentralizedProgressiveJackpotRaffle {
    // State variables
    address public owner;
    uint256 public ticketPrice;
    uint8 public jackpotPercentage;
    uint256 public maxTicketsPerPurchase;
    uint256 public endTime;
    uint256 public totalTickets;
    uint256 public jackpotAmount;
    uint256 public platformFees;
    bool public raffleEnded;
    address public winner;
    uint256 public winningTicketId;
    uint256 public claimPeriod;
    bool public jackpotClaimed;

    // Mapping to track tickets owned by addresses
    mapping(address => uint256[]) public ticketsByOwner;
    // Mapping from ticket ID to owner address
    mapping(uint256 => address) public ticketOwner;
    // Array of all tickets for winner selection
    uint256[] private allTickets;

    // Events
    event TicketsPurchased(address indexed buyer, uint256 startTicketId, uint256 amount);
    event RaffleEnded(uint256 indexed winningTicketId, address indexed winner);
    event JackpotClaimed(address indexed winner, uint256 amount);
    event JackpotUnclaimed(uint256 amount);

    // Modifiers
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }

    modifier raffleActive() {
        require(!raffleEnded, "Raffle has already ended");
        require(block.timestamp < endTime, "Raffle time has expired");
        _;
    }

    modifier raffleOver() {
        require(raffleEnded || block.timestamp >= endTime, "Raffle is still active");
        _;
    }

    /**
     * @dev Constructor to initialize the raffle parameters
     * @param _ticketPrice Price of each ticket in wei
     * @param _jackpotPercentage Percentage of ticket price that goes to jackpot (1-99)
     * @param _maxTicketsPerPurchase Maximum tickets that can be purchased in a single transaction
     * @param _raffleDuration Duration of the raffle in seconds
     * @param _claimPeriod Time window for winner to claim the prize in seconds
     */
    constructor(
        uint256 _ticketPrice,
        uint8 _jackpotPercentage,
        uint256 _maxTicketsPerPurchase,
        uint256 _raffleDuration,
        uint256 _claimPeriod
    ) {
        require(_ticketPrice > 0, "Ticket price must be greater than zero");
        require(_jackpotPercentage > 0 && _jackpotPercentage < 100, "Jackpot percentage must be between 1 and 99");
        require(_maxTicketsPerPurchase > 0, "Max tickets per purchase must be greater than zero");
        require(_raffleDuration > 0, "Raffle duration must be greater than zero");
        require(_claimPeriod > 0, "Claim period must be greater than zero");

        owner = msg.sender;
        ticketPrice = _ticketPrice;
        jackpotPercentage = _jackpotPercentage;
        maxTicketsPerPurchase = _maxTicketsPerPurchase;
        endTime = block.timestamp + _raffleDuration;
        claimPeriod = _claimPeriod;
        raffleEnded = false;
        jackpotClaimed = false;
    }

    /**
     * @dev Function to purchase raffle tickets
     * @param numTickets Number of tickets to purchase
     */
    function purchaseTickets(uint256 numTickets) external payable raffleActive {
        require(numTickets > 0, "Must purchase at least one ticket");
        require(numTickets <= maxTicketsPerPurchase, "Cannot purchase more than maximum tickets per transaction");
        require(msg.value == ticketPrice * numTickets, "Incorrect ETH amount sent");

        // Calculate jackpot contribution and platform fee
        uint256 jackpotContribution = (msg.value * jackpotPercentage) / 100;
        uint256 platformFee = msg.value - jackpotContribution;

        // Update state
        jackpotAmount += jackpotContribution;
        platformFees += platformFee;

        // Assign tickets to the buyer
        uint256 startTicketId = totalTickets;
        for (uint256 i = 0; i < numTickets; i++) {
            uint256 ticketId = totalTickets + i;
            ticketsByOwner[msg.sender].push(ticketId);
            ticketOwner[ticketId] = msg.sender;
            allTickets.push(ticketId);
        }

        totalTickets += numTickets;

        emit TicketsPurchased(msg.sender, startTicketId, numTickets);
    }

    /**
     * @dev Function to end the raffle and select a winner
     * Uses block hash as a source of randomness combined with other parameters
     */
    function endRaffle() external raffleOver {
        require(!raffleEnded, "Raffle has already ended");
        require(totalTickets > 0, "No tickets were sold");

        raffleEnded = true;

        // Get a random ticket using a hash of future block data as seed
        uint256 randomSeed = uint256(
            keccak256(
                abi.encodePacked(
                    blockhash(block.number - 1),
                    block.timestamp,
                    totalTickets,
                    jackpotAmount
                )
            )
        );

        winningTicketId = allTickets[randomSeed % totalTickets];
        winner = ticketOwner[winningTicketId];

        emit RaffleEnded(winningTicketId, winner);
    }

    /**
     * @dev Function for the winner to claim the jackpot
     */
    function claimJackpot() external {
        require(raffleEnded, "Raffle has not ended yet");
        require(msg.sender == winner, "Only the winner can claim the jackpot");
        require(!jackpotClaimed, "Jackpot has already been claimed");

        jackpotClaimed = true;
        uint256 amount = jackpotAmount;
        jackpotAmount = 0;

        // Transfer the jackpot to the winner
        (bool success, ) = payable(winner).call{value: amount}("");
        require(success, "Failed to send jackpot to winner");

        emit JackpotClaimed(winner, amount);
    }

    /**
     * @dev Function for the owner to handle unclaimed jackpot after claim period
     */
    function handleUnclaimedJackpot() external onlyOwner {
        require(raffleEnded, "Raffle has not ended yet");
        require(!jackpotClaimed, "Jackpot has already been claimed");
        require(block.timestamp > endTime + claimPeriod, "Claim period not yet expired");

        uint256 amount = jackpotAmount;
        jackpotAmount = 0;
        jackpotClaimed = true;

        // Transfer unclaimed jackpot to owner
        (bool success, ) = payable(owner).call{value: amount}("");
        require(success, "Failed to send unclaimed jackpot to owner");

        emit JackpotUnclaimed(amount);
    }

    /**
     * @dev Function for the owner to withdraw platform fees
     */
    function withdrawPlatformFees() external onlyOwner {
        uint256 amount = platformFees;
        platformFees = 0;

        // Transfer platform fees to owner
        (bool success, ) = payable(owner).call{value: amount}("");
        require(success, "Failed to send platform fees to owner");
    }

    /**
     * @dev Function to get tickets owned by an address
     * @param player Address of the player
     * @return uint256[] Array of ticket IDs owned by the player
     */
    function getTicketsByOwner(address player) external view returns (uint256[] memory) {
        return ticketsByOwner[player];
    }

    /**
     * @dev Function to get the current raffle state
     * @return uint256 Total tickets sold
     * @return uint256 Current jackpot amount
     * @return uint256 Time remaining until raffle ends
     * @return bool Whether raffle has ended
     */
    function getRaffleState() external view returns (
        uint256,
        uint256,
        uint256,
        bool
    ) {
        uint256 timeRemaining = 0;
        if (!raffleEnded && block.timestamp < endTime) {
            timeRemaining = endTime - block.timestamp;
        }
        
        return (
            totalTickets,
            jackpotAmount,
            timeRemaining,
            raffleEnded
        );
    }
}