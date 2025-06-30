"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Bond = void 0;
exports.computeAddress = computeAddress;
exports.createPubClient = createPubClient;
const viem_1 = require("viem");
const helpers_1 = require("./utils/helpers");
const constants_1 = require("./utils/constants");
const rpc_1 = require("./utils/rpc");
const EntryPoint_json_1 = require("./artifacts/EntryPoint.json");
const AcountFactory_json_1 = require("./artifacts/AcountFactory.json");
const Account_json_1 = require("./artifacts/Account.json");
const intent_1 = require("./intent");
class Bond {
    constructor(walletClient, _salt = 1) {
        if (!walletClient.account) {
            throw new Error("Walle tClient must be connected with an account.");
        }
        this.walletClient = walletClient;
        this.entrypoint = constants_1.ENTRYPOINT_ADDRESS;
        this.salt = (0, helpers_1.toBytes32Salt)(_salt);
        this.intent = new intent_1.Intent(this.walletClient, this.salt, this.entrypoint);
    }
    async sendUserOperation({ to, value, data }) {
        const publicClient = await createPubClient(this.walletClient);
        const owner = this.walletClient.account.address;
        // First get the counterfactual address and initCode
        const { address: sender, initCode } = await computeAddress(owner, publicClient, this.salt, this.entrypoint);
        const nonce = "0x" + (await publicClient.readContract({
            address: this.entrypoint,
            abi: EntryPoint_json_1.abi,
            functionName: "getNonce",
            args: [sender, 0],
        })).toString(16);
        console.log("initCode:", initCode);
        const _chainId = await this.walletClient.getChainId();
        const pimlicoPublicClient = (0, helpers_1.getProviderFromChainId)(_chainId);
        // Build UserOperation
        const userOp = {
            sender,
            nonce: nonce,
            initCode: initCode,
            callData: (0, viem_1.encodeFunctionData)({
                abi: Account_json_1.abi,
                functionName: "execute",
                args: [to, value ? value : 0, data],
            }),
            paymasterAndData: '0x',
            signature: (0, helpers_1.getDummySignatureByTotalSignersLength)(1),
        };
        const feeData = await pimlicoPublicClient.send("pimlico_getUserOperationGasPrice", []);
        console.log(feeData);
        userOp.maxFeePerGas = feeData.fast.maxFeePerGas;
        userOp.maxPriorityFeePerGas = feeData.fast.maxPriorityFeePerGas;
        const paymasterData = await (0, helpers_1.getPaymasterData)(_chainId, userOp);
        console.log("paymasterData:", paymasterData);
        userOp.paymasterAndData = paymasterData.paymasterAndData;
        userOp.preVerificationGas = paymasterData.preVerificationGas;
        userOp.verificationGasLimit = paymasterData.verificationGasLimit;
        userOp.callGasLimit = paymasterData.callGasLimit;
        // Get UserOperation hash from this.entrypoint contract
        const userOpHash = await publicClient.readContract({
            address: this.entrypoint,
            abi: EntryPoint_json_1.abi,
            functionName: "getUserOpHash",
            args: [userOp],
        });
        userOp.signature = await this.walletClient.signMessage({
            account: this.walletClient.account,
            message: { raw: userOpHash },
        });
        // Send UserOperation
        const opTxHash = await pimlicoPublicClient.send("eth_sendUserOperation", [
            userOp,
            constants_1.ENTRYPOINT_ADDRESS,
        ]);
        return opTxHash;
    }
    static async buildContract({ abi, functionName, args }) {
        const data = (0, viem_1.encodeFunctionData)({
            abi: abi,
            functionName: functionName,
            args: args,
        });
        return data;
    }
    async getBalance() {
        const publicClient = await createPubClient(this.walletClient);
        const { address } = await computeAddress(this.walletClient.account.address, publicClient, this.salt, this.entrypoint);
        return publicClient.getBalance({ address });
    }
    async getAddress() {
        const owner = this.walletClient.account.address;
        const publicClient = await createPubClient(this.walletClient);
        const resp = await computeAddress(owner, publicClient, this.salt, this.entrypoint);
        return resp.address;
    }
    async activate(chain) {
        const _chainId = (0, helpers_1.getChainIdFromChainName)(chain);
        const rpcUrl = (0, rpc_1.getRpcUrl)(_chainId);
        const publicClient = (0, viem_1.createPublicClient)({
            transport: (0, viem_1.http)(rpcUrl),
        });
        const owner = this.walletClient.account.address;
        // First get the counterfactual address and initCode
        const { address: sender, initCode } = await computeAddress(owner, publicClient, this.salt, this.entrypoint);
        const nonce = "0x" + (await publicClient.readContract({
            address: this.entrypoint,
            abi: EntryPoint_json_1.abi,
            functionName: "getNonce",
            args: [sender, 0],
        })).toString(16);
        console.log("initCode:", initCode);
        const pimlicoPublicClient = (0, helpers_1.getProviderFromChainId)(_chainId);
        // Build UserOperation
        const userOp = {
            sender,
            nonce: nonce,
            initCode: initCode,
            callData: (0, viem_1.encodeFunctionData)({
                abi: Account_json_1.abi,
                functionName: "execute",
                args: [(0, helpers_1.getUsdcAddressByChainName)(chain), 0, (0, viem_1.encodeFunctionData)({
                        abi: viem_1.erc20Abi,
                        functionName: "approve",
                        args: [constants_1.PROTOCOL_ADDRESS, (0, viem_1.parseUnits)('100', 6)]
                    })],
            }),
            paymasterAndData: '0x',
            signature: (0, helpers_1.getDummySignatureByTotalSignersLength)(1),
        };
        const feeData = await pimlicoPublicClient.send("pimlico_getUserOperationGasPrice", []);
        console.log(feeData);
        userOp.maxFeePerGas = feeData.fast.maxFeePerGas;
        userOp.maxPriorityFeePerGas = feeData.fast.maxPriorityFeePerGas;
        const paymasterData = await (0, helpers_1.getPaymasterData)(_chainId, userOp);
        console.log("paymasterData:", paymasterData);
        userOp.paymasterAndData = paymasterData.paymasterAndData;
        userOp.preVerificationGas = paymasterData.preVerificationGas;
        userOp.verificationGasLimit = paymasterData.verificationGasLimit;
        userOp.callGasLimit = paymasterData.callGasLimit;
        // Get UserOperation hash from this.entrypoint contract
        const userOpHash = await publicClient.readContract({
            address: this.entrypoint,
            abi: EntryPoint_json_1.abi,
            functionName: "getUserOpHash",
            args: [userOp],
        });
        userOp.signature = await this.walletClient.signMessage({
            account: this.walletClient.account,
            message: { raw: userOpHash },
        });
        // Send UserOperation
        await pimlicoPublicClient.send("eth_sendUserOperation", [
            userOp,
            constants_1.ENTRYPOINT_ADDRESS,
        ]);
        return {
            message: "Activated"
        };
    }
    async unifiedBalance(token) {
        const chains = ["sepolia", "avalanche_fuji", "arbitrum_sepolia", "polygon_amoy"];
        const f_balances = [];
        const owner = this.walletClient.account.address;
        let uBal = 0;
        let cBal = 0;
        for (const chain of chains) {
            const _chainId = (0, helpers_1.getChainIdFromChainName)(chain);
            const rpcUrl = (0, rpc_1.getRpcUrl)(_chainId);
            const publicClient = (0, viem_1.createPublicClient)({
                transport: (0, viem_1.http)(rpcUrl),
            });
            const tokenAddress = (0, helpers_1.getUsdcAddressByChainName)(chain);
            // First get the counterfactual address and initCode
            const { address: sender, initCode } = await computeAddress(owner, publicClient, this.salt, this.entrypoint);
            const balance = await publicClient.readContract({
                address: tokenAddress,
                abi: viem_1.erc20Abi,
                functionName: "balanceOf",
                args: [sender],
            });
            const _balance = parseFloat(balance.toString()) / 1000000;
            f_balances.push({
                chain: chain,
                balance: _balance
            });
            console.log("balance:", balance);
            uBal += _balance;
            if (_chainId == this.walletClient.chain.id) {
                cBal = _balance;
            }
        }
        return {
            balance: uBal,
            fragmented: f_balances,
            chainBalance: cBal
        };
    }
}
exports.Bond = Bond;
async function computeAddress(owner, publicClient, _salt, _entrypoint) {
    // Create initCode
    const factoryCreateAccountData = (0, viem_1.encodeFunctionData)({
        abi: AcountFactory_json_1.abi,
        functionName: "createAccount",
        args: [owner, _salt],
    });
    let initCode = constants_1.FACTORY_ADDRESS +
        factoryCreateAccountData.slice(2);
    try {
        // Try to get the sender address first (getSenderAddress must revert)
        await publicClient.readContract({
            address: _entrypoint,
            abi: EntryPoint_json_1.abi,
            functionName: "getSenderAddress",
            args: [initCode],
        });
        throw new Error("Expected getSenderAddress to revert");
    }
    catch (error) {
        const address = `0x${error.cause.raw.slice(-40)}`;
        try {
            // Check if the contract is already deployed
            const contractCode = await publicClient.getCode({
                address: address
            });
            // Return initCode if contract is not deployed (contractCode is undefined)
            // Return "0x" if contract is already deployed (contractCode exists)
            const finalInitCode = contractCode !== undefined && contractCode !== "0x" ? "0x" : initCode;
            return {
                address: address,
                initCode: finalInitCode
            };
        }
        catch (error) {
            // If getCode fails, assume contract is not deployed
            return {
                address: address,
                initCode
            };
        }
    }
}
async function createPubClient(walletClient) {
    if (!walletClient.account) {
        throw new Error("Wallet is not connected");
    }
    const _chainId = await walletClient.getChainId();
    const rpcUrl = (0, rpc_1.getRpcUrl)(_chainId);
    const publicClient = (0, viem_1.createPublicClient)({
        transport: (0, viem_1.http)(rpcUrl),
    });
    return publicClient;
}
