"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Intent = void 0;
const viem_1 = require("viem");
const helpers_1 = require("./utils/helpers");
const bond_1 = require("./bond");
const constants_1 = require("./utils/constants");
const EntryPoint_json_1 = require("./artifacts/EntryPoint.json");
const Protocol_json_1 = require("./artifacts/Protocol.json");
const Account_json_1 = require("./artifacts/Account.json");
class Intent {
    constructor(_walletClient, _salt, _entrypoint) {
        this.walletClient = _walletClient;
        this.salt = _salt;
        this.entrypoint = _entrypoint;
    }
    async raw(data) {
        // const tokenAddress = getTokenFromChainNameAndTokenName(data.destChain, data.token);
        const publicClient = await (0, bond_1.createPubClient)(this.walletClient);
        const owner = this.walletClient.account.address;
        // First get the counterfactual address and initCode
        const { address: sender, initCode } = await (0, bond_1.computeAddress)(owner, publicClient, this.salt, this.entrypoint);
        const _poolId = (0, helpers_1.getPoolIdFromTokenName)(data.token);
        const _nonce = await publicClient.readContract({
            address: constants_1.PROTOCOL_ADDRESS,
            abi: Protocol_json_1.abi,
            functionName: "getNonce",
            args: [sender],
            account: sender
        });
        console.log("nonce:", _nonce);
        const intentData = (0, helpers_1.encodeIntentData)({
            sender,
            initChainSenderNonce: _nonce,
            initChainId: BigInt(this.walletClient.chain.id),
            poolId: BigInt(_poolId),
            srcChainIds: data.source.map((e) => BigInt((0, helpers_1.getChainIdFromChainName)(e.chain))),
            srcAmounts: data.source.map((e) => e.amount),
            dstChainId: BigInt((0, helpers_1.getChainIdFromChainName)(data.destChain)),
            dstDatas: data.destDatas,
            expires: BigInt(Math.floor(Date.now() / 1000) + (3600 * 2)) // 2 hour from now
        });
        return {
            data: intentData,
            getFees: async () => {
                await this.getIntentFees(intentData, publicClient, { address: sender, initCode });
            },
            send: async () => {
                await this.sendIntentUserOperation(intentData, publicClient, { address: sender, initCode });
            }
        };
    }
    async direct(data) {
        // const tokenAddress = getTokenFromChainNameAndTokenName(data.destChain, data.token);
        const publicClient = await (0, bond_1.createPubClient)(this.walletClient);
        const owner = this.walletClient.account.address;
        // First get the counterfactual address and initCode
        const { address: sender, initCode } = await (0, bond_1.computeAddress)(owner, publicClient, this.salt, this.entrypoint);
        const _poolId = (0, helpers_1.getPoolIdFromTokenName)(data.token);
        const _nonce = await publicClient.readContract({
            address: constants_1.PROTOCOL_ADDRESS,
            abi: Protocol_json_1.abi,
            functionName: "getNonce",
            args: [sender],
            account: sender
        });
        console.log("nonce:", _nonce);
        const getTokenAddress = (0, helpers_1.getTokenFromChainNameAndTokenName)((0, helpers_1.getChainNameFromChainId)(this.walletClient.chain.id), data.token);
        const getDestTokenAddress = (0, helpers_1.getTokenFromChainNameAndTokenName)(data.destChain, data.token);
        console.log("getTokenAddress:", getTokenAddress);
        const decimals = await publicClient.readContract({
            address: getTokenAddress,
            abi: viem_1.erc20Abi,
            functionName: "decimals",
            args: []
        });
        const destDatas = [
            {
                target: getDestTokenAddress,
                value: 0n,
                data: (0, viem_1.encodeFunctionData)({
                    abi: viem_1.erc20Abi,
                    functionName: "transfer",
                    args: [data.recipient, (0, viem_1.parseUnits)(data.amount, decimals)]
                })
            }
        ];
        const intentData = (0, helpers_1.encodeIntentData)({
            sender,
            initChainSenderNonce: _nonce,
            initChainId: BigInt(this.walletClient.chain.id),
            poolId: BigInt(_poolId),
            srcChainIds: data.source.map((e) => BigInt((0, helpers_1.getChainIdFromChainName)(e.chain))),
            srcAmounts: data.source.map((e) => (0, viem_1.parseUnits)(e.amount, decimals)),
            dstChainId: BigInt((0, helpers_1.getChainIdFromChainName)(data.destChain)),
            dstDatas: destDatas,
            expires: BigInt(Math.floor(Date.now() / 1000) + (3600 * 2)) // 2 hour from now
        });
        return {
            data: intentData,
            getFees: async () => {
                return await this.getIntentFees(intentData, publicClient, { address: sender, initCode });
            },
            send: async () => {
                return await this.sendIntentUserOperation(intentData, publicClient, { address: sender, initCode });
            }
        };
    }
    async getIntentFees(intentData, publicClient, accountInfo) {
        const { address: sender } = accountInfo;
        const fees = await publicClient.readContract({
            address: constants_1.PROTOCOL_ADDRESS,
            abi: Protocol_json_1.abi,
            functionName: "getFees",
            args: [intentData],
            account: sender
        });
        return fees;
    }
    async sendIntentUserOperation(intentData, publicClient, accountInfo) {
        const { address: sender, initCode } = accountInfo;
        const nonce = "0x" + (await publicClient.readContract({
            address: this.entrypoint,
            abi: EntryPoint_json_1.abi,
            functionName: "getNonce",
            args: [sender, 0],
        })).toString(16);
        console.log("initCode:", initCode);
        const _chainId = await this.walletClient.getChainId();
        const pimlicoPublicClient = (0, helpers_1.getProviderFromChainId)(_chainId);
        const encodedSubmitIntentFn = (0, viem_1.encodeFunctionData)({
            abi: Protocol_json_1.abi,
            functionName: "submitIntent",
            args: [intentData],
        });
        // Build UserOperation
        const userOp = {
            sender,
            nonce: nonce,
            initCode: initCode,
            callData: (0, viem_1.encodeFunctionData)({
                abi: Account_json_1.abi,
                functionName: "execute",
                args: [constants_1.PROTOCOL_ADDRESS, 0n, encodedSubmitIntentFn],
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
}
exports.Intent = Intent;
