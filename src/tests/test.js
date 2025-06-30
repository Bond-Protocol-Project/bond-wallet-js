"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("../index");
const viem_1 = require("viem");
const accounts_1 = require("viem/accounts");
const chains_1 = require("viem/chains"); // Or your desired chain
const ERC20_json_1 = require("../artifacts/ERC20.json");
const bond_1 = require("../bond");
const constants_1 = require("../utils/constants");
const helpers_1 = require("../utils/helpers");
async function main() {
    // Your private key (KEEP THIS SECRET!)
    const privateKey = '0x2bb758569718e4ac67a8164d98cadd08068e5839a6cb7c8bd4e769893818ddbf';
    // Create an account from the private key
    const pk = (0, accounts_1.privateKeyToAccount)(privateKey);
    // Create the Wallet Client
    const walletClient = (0, viem_1.createWalletClient)({
        account: pk, // Use the account created from the private key
        chain: chains_1.arbitrumSepolia, // Choose your chain
        transport: (0, viem_1.http)(),
    });
    const pubClient = await (0, bond_1.createPubClient)(walletClient);
    const tokenAddress = (0, helpers_1.getUsdcAddressByChainName)((0, helpers_1.getChainNameFromChainId)(walletClient.chain.id));
    const decimals = await pubClient.readContract({
        address: tokenAddress,
        abi: ERC20_json_1.abi,
        functionName: "decimals"
    });
    console.log(decimals);
    const account = new index_1.BondWallet(walletClient);
    const address = await account.getAddress();
    console.log("address:", address);
    const balanceOf = await pubClient.readContract({
        address: tokenAddress,
        abi: ERC20_json_1.abi,
        functionName: "balanceOf",
        args: [address]
    });
    console.log("balance:", balanceOf);
    const allowance = await pubClient.readContract({
        address: tokenAddress,
        abi: ERC20_json_1.abi,
        functionName: "allowance",
        args: [address, constants_1.PROTOCOL_ADDRESS]
    });
    console.log("allowance:", allowance);
    try {
        const resp = await account.sendUserOperation({
            to: tokenAddress,
            data: await index_1.BondWallet.buildContract({
                abi: ERC20_json_1.abi,
                args: [constants_1.PROTOCOL_ADDRESS, (0, viem_1.parseUnits)('10', decimals)],
                functionName: "approve"
            })
        });
        console.log(resp);
    }
    catch (error) {
        console.log("Error:", error);
    }
    // const balance = await bond.getBalance();
    // console.log("balance:", balance);
    // const intent = await account.intent.raw({
    //     token: "USDC",
    //     source: [
    //         {
    //             amount: 2n,
    //             chain: "avalanche_fuji"
    //         },
    //         {
    //             amount: 2n,
    //             chain: "arbitrum_sepolia"
    //         }
    //     ],
    //     destChain: "polygon_amoy",
    //     destDatas: [{
    //         target: "0x",
    //         value: 0n,
    //         data: "0x"
    //     }]
    // });
    // const intent = await account.intent.direct({
    //     token: "USDC",
    //     source: [
    //         {
    //             amount: "1",
    //             chain: "polygon_amoy"
    //         },
    //         {
    //             amount: "1",
    //             chain: "avalanche_fuji"
    //         }
    //     ],
    //     destChain: "avalanche_fuji",
    //     recipient: "0x325522253A66c475c5c5302D5a2538115969c09c",
    //     amount: "2"
    // });
    // const dataResp = intent.data;
    // console.log("data:", dataResp);
    // const fees = await intent.getFees();
    // console.log(fees);
    // const resp = await intent.send();
    // console.log(resp);
    const bal = await account.unifiedBalance("USDC");
    console.log("Unified Balance:", bal);
    // const txData = await BondWallet.buildContract({
    //     abi: ERC20_ABI,
    //     functionName: "transfer",
    //     args: ["0x85db92aD7a03727063D58846617C977B3Aaa3036", balanceOf]
    // });
    // console.log("txData:", txData);
    // const resp = await account.sendUserOperation({
    //     to: tokenAddress,
    //     value: 0,
    //     data: txData
    // });
    // console.log("response hash:", resp);
    // const activateFuji = await account.activate("avalanche_fuji");
    // console.log("activateFuji:", activateFuji);
    // const activateArb = await account.activate("arbitrum_sepolia");
    // console.log("activateArb:", activateArb);
    // const activateSepolia = await account.activate("sepolia");
    // console.log("activateSepolia:", activateSepolia);
    // const activateAmoy = await account.activate("polygon_amoy");
    // console.log("activateAmoy:", activateAmoy);
    // const publicClient = createPublicClient({
    //     chain: sepolia,
    //     transport: http("https://eth-sepolia.g.alchemy.com/v2/SE-MFXtLZCCVRBDG93CdAL8G0CRwhkhZ")
    // });
    // const code = await publicClient.getCode({
    //     address: address
    // });
    // console.log(code);
}
main().catch((e) => {
    console.log("Errr:", e);
});
