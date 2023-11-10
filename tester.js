const { expect, assert } = require("chai");
const { ethers } = require("hardhat");
const fetch = require('node-fetch');
const {impersonateFundErc20} = require("../utils/utilities");

const { abi } = require("../artifacts/contracts/interfaces/IERC20.sol/IERC20.json")

const provider = waffle.provider;

describe("Token Contract", () => {
  let FLASHSWAP, 
    BORROW_AMOUNT, 
    FUND_AMOUNT, 
    initialFundingHuman, 
    txArbitrage, 
    totalGasUSD
  
  const DECIMALS = 18;
  const DAI_WHALE = "0xF977814e90dA44bFA03b6295A0616a897441aceC";
  const WBNB = "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c";
  const USDT = "0x55d398326f99059fF775485246999027B3197955";
  const TWT = "0x4B0F1812e5Df2A09796481Ff14017e6005508003";
  const CROX = "0x2c094F5A7D1146BB93850f629501eB749f6Ed491";
  const CAKE = "0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82";
  const USDC = "0x8965349fb649A33a30cbFDa057D8eC2C48AbE2A2";
  const DAI = "0x1AF3F329e8BE154074D8769D1FFa4eE058B1DBc3";
  const BTCB = "0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c";

  const BASE_TOKEN_ADDRESS = (DAI);

  const tokenBase = new ethers.Contract(BASE_TOKEN_ADDRESS, abi, provider);

  beforeEach(async () =>{
    // Get owner as signer

    const initialOwnerAddress = "0x7684610D8Fc600F11924906bb1a987e9491a26a1";
    const PANCAKE_FACTORY = "0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73";
    const PANCAKE_ROUTER = "0x10ED43C718714eb63d5aA57B78B54704E256024E";
    const SUSHI_FACTORY = "0xc35DADB65012eC5796536bD9864eD8773aBc74C4";
    const SUSHI_ROUTER = "0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506";

    [owner] = await ethers.getSigners();

    // Ensure that the WHALE has a balance
    const whale_balance = await provider.getBalance(DAI_WHALE);
    expect(whale_balance).not.equal("0");
    
    //Deploy smart contract
    const FlashSwap = await ethers.getContractFactory("PancakeSushi")
    FLASHSWAP = await FlashSwap.deploy(initialOwnerAddress, PANCAKE_FACTORY, PANCAKE_ROUTER, SUSHI_ROUTER, SUSHI_FACTORY);
    await FLASHSWAP.deployed();

    // Configure our borrowing
    const borrowAmountHuman ="1";
    BORROW_AMOUNT = ethers.utils.parseUnits(borrowAmountHuman, DECIMALS);
    // Configure funding - FOR TESTING ONLY
    initialFundingHuman ="100";
    FUND_AMOUNT = ethers.utils.parseUnits(initialFundingHuman, DECIMALS);

    // Fund our contract - FOR TESTING ONLY
    await impersonateFundErc20(
      tokenBase,
      DAI_WHALE,
      FLASHSWAP.address,
      initialFundingHuman,
    );
  });
  
  describe("Arbitrage Execution", () => {
    it("ensures the contract is funded", async () =>{
      const flashSwapBalance = await FLASHSWAP.getBalanceOfToken(
        BASE_TOKEN_ADDRESS
      );

      const flashSwapBalanceHuman = ethers.utils.formatUnits(
        flashSwapBalance,
        DECIMALS
      );
      console.log(flashSwapBalanceHuman)

      expect(Number(flashSwapBalanceHuman)).equal(Number(initialFundingHuman));

    });

    it("executes the arbitrage", async () =>{
      txArbitrage = await FLASHSWAP.startArbitrage(
        BASE_TOKEN_ADDRESS, 
        BORROW_AMOUNT
      );

      assert(txArbitrage);

      // Print balances
      const contractBalanceUSDT = await FLASHSWAP.getBalanceOfToken(USDT);
      const formattedBalUSDT = Number(
        ethers.utils.formatUnits(contractBalanceUSDT, DECIMALS)
      );
      console.log("Balance of USDT: " + formattedBalUSDT);

      const contractBalanceTWT = await FLASHSWAP.getBalanceOfToken(TWT);
      const formattedBalTWT = Number (ethers.utils.formatUnits(contractBalanceTWT, DECIMALS)
      );
      console.log("Balance of TWT: " + formattedBalTWT);

      const contractBalanceDAI = await FLASHSWAP.getBalanceOfToken(DAI);
      const formattedBalDAI = Number (ethers.utils.formatUnits(contractBalanceDAI, DECIMALS)
      );
      console.log("Balance of DAI: " + formattedBalDAI);

      const contractBalanceBTCB = await FLASHSWAP.getBalanceOfToken(BTCB);
      const formattedBalBTCB = Number (ethers.utils.formatUnits(contractBalanceBTCB, DECIMALS)
      );
      console.log("Balance of BTCB: " + formattedBalBTCB);
      
      const contractBalanceCAKE = await FLASHSWAP.getBalanceOfToken(CAKE);
      const formattedBalCAKE = Number (ethers.utils.formatUnits(contractBalanceCAKE, DECIMALS)
      );
      console.log("Balance of CAKE: " + formattedBalCAKE);
      async function getBNBPrice() {
        try {
          const response = await fetch('https://api.binance.com/api/v1/ticker/price?symbol=BNBUSDT');
          const data = await response.json();
          return data.price;
        } catch (error) {
          console.error('Error fetching BNB price:', error);
          return null;
        }
      }
      
      describe('Transaction Tests', () => {
        it("provides GAS output", async () => {
          const txReceipt = await provider.getTransactionReceipt(txArbitrage.hash);
          const effGasPrice = ethers.BigNumber.from(txReceipt.effectiveGasPrice);
          const txGasUsed = ethers.BigNumber.from(txReceipt.gasUsed);
      
          // Calculate the total gas used in BNB
          const gasUsedBNB = effGasPrice.mul(txGasUsed);
      
          // Fetch the live BNB price in USD
          const bnbPriceUSD = await getBNBPrice();
      
          // Handle the case where the BNB price couldn't be fetched
          if (!bnbPriceUSD) {
            console.log('Could not fetch the BNB price.');
            return;
          }
      
          // Convert the gas used in BNB to a human-readable format and then to USD
          const totalGasUSD = ethers.utils.formatEther(gasUsedBNB) * bnbPriceUSD;
          console.log(`Total Gas USD: ${totalGasUSD.toFixed(2)}`);
      
          // Use Chai's 'expect' to make the assertion more readable
          expect(gasUsedBNB.gt(0), 'Gas used should be greater than 0').to.be.true;
        });
      });
      });
    });
  });
