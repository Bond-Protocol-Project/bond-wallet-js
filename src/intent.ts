import { encodeFunctionData, erc20Abi, Hex, parseEther, parseUnits, PublicClient, WalletClient } from "viem";
import { IntentDstData, SupportedChains, SupportedTokens, UserOperationStruct } from "./types/global.types";
import { encodeIntentData, getChainIdFromChainName, getChainNameFromChainId, getDummySignatureByTotalSignersLength, getPaymasterData, getPoolIdFromTokenName, getProviderFromChainId, getTokenFromChainNameAndTokenName } from "./utils/helpers";
import { computeAddress, createPubClient } from "./bond";
import { ENTRYPOINT_ADDRESS, PROTOCOL_ADDRESS } from "./utils/constants";

import { abi as ENTRYPOINT_ABI } from "./artifacts/EntryPoint.json";
import { abi as PROTOCOL_ABI } from "./artifacts/Protocol.json";
import { abi as ACCOUNT_ABI } from "./artifacts/Account.json";

export class Intent {

    private walletClient: WalletClient;
    private salt: Hex;
    private entrypoint: Hex;

    constructor(_walletClient: WalletClient, _salt: Hex, _entrypoint: Hex) {
        this.walletClient = _walletClient;
        this.salt = _salt;
        this.entrypoint = _entrypoint;
    }

    async raw(data:
        {
            token: SupportedTokens,
            source: {
                chain: SupportedChains,
                amount: bigint
            }[],
            destChain: SupportedChains,
            destDatas: {
                target: Hex,
                value: bigint,
                data: Hex
            }[]
        }
    ) {
        // const tokenAddress = getTokenFromChainNameAndTokenName(data.destChain, data.token);
        const publicClient = await createPubClient(this.walletClient);

        const owner = this.walletClient.account!.address;

        // First get the counterfactual address and initCode
        const { address: sender, initCode } = await computeAddress(owner, publicClient, this.salt, this.entrypoint);

        const _poolId = getPoolIdFromTokenName(data.token);
        const _nonce: any = await publicClient.readContract({
            address: PROTOCOL_ADDRESS,
            abi: PROTOCOL_ABI,
            functionName: "getNonce",
            args: [sender],
            account: sender
        });

        console.log("nonce:", _nonce);

        const intentData = encodeIntentData({
            sender,
            initChainSenderNonce: _nonce,
            initChainId: BigInt(this.walletClient.chain!.id),
            poolId: BigInt(_poolId),
            srcChainIds: data.source.map((e) => BigInt(getChainIdFromChainName(e.chain))),
            srcAmounts: data.source.map((e) => e.amount),
            dstChainId: BigInt(getChainIdFromChainName(data.destChain)),
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
        }

    }

    async direct(data:
        {
            token: SupportedTokens,
            source: {
                chain: SupportedChains,
                amount: string
            }[],
            destChain: SupportedChains,
            recipient: Hex,
            amount: string
        }
    ) {
        // const tokenAddress = getTokenFromChainNameAndTokenName(data.destChain, data.token);
        const publicClient = await createPubClient(this.walletClient);

        const owner = this.walletClient.account!.address;

        // First get the counterfactual address and initCode
        const { address: sender, initCode } = await computeAddress(owner, publicClient, this.salt, this.entrypoint);

        const _poolId = getPoolIdFromTokenName(data.token);
        const _nonce: any = await publicClient.readContract({
            address: PROTOCOL_ADDRESS,
            abi: PROTOCOL_ABI,
            functionName: "getNonce",
            args: [sender],
            account: sender
        });

        console.log("nonce:", _nonce);

        const getTokenAddress = getTokenFromChainNameAndTokenName(
            getChainNameFromChainId(this.walletClient.chain!.id),
            data.token
        );

        const getDestTokenAddress = getTokenFromChainNameAndTokenName(
            data.destChain,
            data.token
        );

        console.log("getTokenAddress:", getTokenAddress)

        const decimals = await publicClient.readContract({
            address: getTokenAddress,
            abi: erc20Abi,
            functionName: "decimals",
            args: []
        });

        const destDatas: IntentDstData[] = [
            {
                target: getDestTokenAddress,
                value: 0n,
                data: encodeFunctionData({
                    abi: erc20Abi,
                    functionName: "transfer",
                    args: [data.recipient, parseUnits(data.amount, decimals)]
                })
            }
        ]

        const intentData = encodeIntentData({
            sender,
            initChainSenderNonce: _nonce,
            initChainId: BigInt(this.walletClient.chain!.id),
            poolId: BigInt(_poolId),
            srcChainIds: data.source.map((e) => BigInt(getChainIdFromChainName(e.chain))),
            srcAmounts: data.source.map((e) => parseUnits(e.amount, decimals)),
            dstChainId: BigInt(getChainIdFromChainName(data.destChain)),
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
        }

    }

    private async getIntentFees(
        intentData: Hex,
        publicClient: PublicClient,
        accountInfo: {
            address: `0x${string}`;
            initCode: Hex;
        }
    ): Promise<bigint> {

        const { address: sender } = accountInfo;

        const fees: any = await publicClient.readContract({
            address: PROTOCOL_ADDRESS,
            abi: PROTOCOL_ABI,
            functionName: "getFees",
            args: [intentData],
            account: sender
        });

        return fees;
    }

    private async sendIntentUserOperation(
        intentData: Hex,
        publicClient: PublicClient,
        accountInfo: {
            address: `0x${string}`;
            initCode: Hex;
        }
    ): Promise<string> {

        const { address: sender, initCode } = accountInfo;

        const nonce = "0x" + (await publicClient.readContract({
            address: this.entrypoint,
            abi: ENTRYPOINT_ABI,
            functionName: "getNonce",
            args: [sender, 0],
        }) as any).toString(16);

        console.log("initCode:", initCode);

        const _chainId = await this.walletClient.getChainId();

        const pimlicoPublicClient = getProviderFromChainId(_chainId);

        const encodedSubmitIntentFn = encodeFunctionData({
            abi: PROTOCOL_ABI,
            functionName: "submitIntent",
            args: [intentData],
        });

        // Build UserOperation
        const userOp: Partial<UserOperationStruct> = {
            sender,
            nonce: nonce as any,
            initCode: initCode,
            callData: encodeFunctionData({
                abi: ACCOUNT_ABI,
                functionName: "execute",
                args: [PROTOCOL_ADDRESS, 0n, encodedSubmitIntentFn],
            }),
            paymasterAndData: '0x',
            signature: getDummySignatureByTotalSignersLength(1),
        };

        const feeData = await pimlicoPublicClient.send(
            "pimlico_getUserOperationGasPrice",
            []
        );

        console.log(feeData);

        userOp.maxFeePerGas = feeData.fast.maxFeePerGas;
        userOp.maxPriorityFeePerGas = feeData.fast.maxPriorityFeePerGas;

        const paymasterData = await getPaymasterData(_chainId, userOp)

        console.log("paymasterData:", paymasterData);

        userOp.paymasterAndData = paymasterData.paymasterAndData;
        userOp.preVerificationGas = paymasterData.preVerificationGas;
        userOp.verificationGasLimit = paymasterData.verificationGasLimit;
        userOp.callGasLimit = paymasterData.callGasLimit;

        // Get UserOperation hash from this.entrypoint contract
        const userOpHash = await publicClient.readContract({
            address: this.entrypoint,
            abi: ENTRYPOINT_ABI,
            functionName: "getUserOpHash",
            args: [userOp as UserOperationStruct],
        });

        userOp.signature = await this.walletClient.signMessage({
            account: this.walletClient.account!,
            message: { raw: userOpHash as Hex },
        });

        // Send UserOperation
        const opTxHash = await pimlicoPublicClient.send("eth_sendUserOperation", [
            userOp,
            ENTRYPOINT_ADDRESS,
        ]);

        return opTxHash;
    }

}