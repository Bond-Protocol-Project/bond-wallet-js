import { WalletClient, PublicClient, createPublicClient, http, encodeFunctionData, Hex, erc20Abi, parseUnits } from "viem";
import { getChainIdFromChainName, getDummySignatureByTotalSignersLength, getPaymasterData, getProviderFromChainId, getUsdcAddressByChainName, toBytes32Salt } from "./utils/helpers";
import { ENTRYPOINT_ADDRESS, FACTORY_ADDRESS, PROTOCOL_ADDRESS } from "./utils/constants";
import { getRpcUrl } from "./utils/rpc";

import { abi as ENTRYPOINT_ABI } from "./artifacts/EntryPoint.json";
import { abi as ACCOUNT_FACTORY_ABI } from "./artifacts/AcountFactory.json";
import { abi as ACCOUNT_ABI } from "./artifacts/Account.json";
import { abi as PROTOCOL_ABI } from "./artifacts/Protocol.json";
import { SupportedChains, SupportedTokens, UserOperationStruct } from "./types/global.types";
import { Intent } from "./intent";

export class Bond {
    private walletClient: WalletClient;
    private entrypoint: `0x${string}`;
    private salt: Hex;
    public intent: Intent;

    constructor(walletClient: WalletClient, _salt: number = 1) {
        if (!walletClient.account) {
            throw new Error("Walle tClient must be connected with an account.");
        }
        this.walletClient = walletClient;
        this.entrypoint = ENTRYPOINT_ADDRESS;
        this.salt = toBytes32Salt(_salt);
        this.intent = new Intent(this.walletClient, this.salt, this.entrypoint);
    }

    async sendUserOperation({
        to, value, data
    }: {
        to: Hex,
        value?: number,
        data: Hex
    }): Promise<string> {

        const publicClient = await createPubClient(this.walletClient);

        const owner = this.walletClient.account!.address;

        // First get the counterfactual address and initCode
        const { address: sender, initCode } = await computeAddress(owner, publicClient, this.salt, this.entrypoint);

        const nonce = "0x" + (await publicClient.readContract({
            address: this.entrypoint,
            abi: ENTRYPOINT_ABI,
            functionName: "getNonce",
            args: [sender, 0],
        }) as any).toString(16);

        console.log("initCode:", initCode);

        const _chainId = await this.walletClient.getChainId();

        const pimlicoPublicClient = getProviderFromChainId(_chainId);

        // Build UserOperation
        const userOp: Partial<UserOperationStruct> = {
            sender,
            nonce: nonce as any,
            initCode: initCode,
            callData: encodeFunctionData({
                abi: ACCOUNT_ABI,
                functionName: "execute",
                args: [to, value ? value : 0, data],
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

    static async buildContract({
        abi,
        functionName,
        args
    }: {
        abi: any,
        functionName: string,
        args: any[]
    }) {
        const data = encodeFunctionData({
            abi: abi,
            functionName: functionName,
            args: args,
        })

        return data;
    }

    async getBalance(): Promise<bigint> {
        const publicClient = await createPubClient(this.walletClient);
        const { address } = await computeAddress(this.walletClient.account!.address, publicClient, this.salt, this.entrypoint);
        return publicClient!.getBalance({ address });
    }

    async getAddress(): Promise<Hex> {
        const owner = this.walletClient.account!.address;
        const publicClient = await createPubClient(this.walletClient);
        const resp = await computeAddress(owner, publicClient, this.salt, this.entrypoint);
        return resp.address as Hex;
    }

    async activate(chain: SupportedChains): Promise<{
        message: string
    }> {

        const _chainId = getChainIdFromChainName(chain);
        const rpcUrl = getRpcUrl(_chainId);
        const publicClient = createPublicClient({
            transport: http(rpcUrl),
        });

        const owner = this.walletClient.account!.address;

        // First get the counterfactual address and initCode
        const { address: sender, initCode } = await computeAddress(owner, publicClient, this.salt, this.entrypoint);

        const nonce = "0x" + (await publicClient.readContract({
            address: this.entrypoint,
            abi: ENTRYPOINT_ABI,
            functionName: "getNonce",
            args: [sender, 0],
        }) as any).toString(16);

        console.log("initCode:", initCode);

        const pimlicoPublicClient = getProviderFromChainId(_chainId);

        // Build UserOperation
        const userOp: Partial<UserOperationStruct> = {
            sender,
            nonce: nonce as any,
            initCode: initCode,
            callData: encodeFunctionData({
                abi: ACCOUNT_ABI,
                functionName: "execute",
                args: [getUsdcAddressByChainName(chain), 0, encodeFunctionData({
                    abi: erc20Abi,
                    functionName: "approve",
                    args: [PROTOCOL_ADDRESS, parseUnits('100', 6)]
                })],
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
        await pimlicoPublicClient.send("eth_sendUserOperation", [
            userOp,
            ENTRYPOINT_ADDRESS,
        ]);

        return {
            message: "Activated"
        };
    }

    async unifiedBalance(token: SupportedTokens): Promise<{
        balance: number,
        fragmented: {
            chain: SupportedChains,
            balance: number
        }[],
        chainBalance: number
    }> {

        const chains: SupportedChains[] = ["sepolia", "avalanche_fuji", "arbitrum_sepolia", "polygon_amoy"];
        const f_balances: {
            chain: SupportedChains,
            balance: number
        }[] = [];

        const owner = this.walletClient.account!.address;
        let uBal = 0;
        let cBal = 0

        for (const chain of chains) {
            const _chainId = getChainIdFromChainName(chain);
            const rpcUrl = getRpcUrl(_chainId);
            const publicClient = createPublicClient({
                transport: http(rpcUrl),
            });

            const tokenAddress = getUsdcAddressByChainName(chain);

            // First get the counterfactual address and initCode
            const { address: sender, initCode } = await computeAddress(owner, publicClient, this.salt, this.entrypoint);

            const balance = await publicClient.readContract({
                address: tokenAddress,
                abi: erc20Abi,
                functionName: "balanceOf",
                args: [sender],
            })

            const _balance = parseFloat(balance.toString()) / 1000000;

            f_balances.push({
                chain: chain,
                balance: _balance
            })

            console.log("balance:", balance);

            uBal += _balance;

            if (_chainId == this.walletClient.chain!.id) {
                cBal = _balance
            }
        }

        return {
            balance: uBal,
            fragmented: f_balances,
            chainBalance: cBal
        };
    }
}

export async function computeAddress(owner: string, publicClient: PublicClient, _salt: Hex, _entrypoint: Hex): Promise<{ address: `0x${string}`; initCode: Hex }> {

    // Create initCode
    const factoryCreateAccountData = encodeFunctionData({
        abi: ACCOUNT_FACTORY_ABI,
        functionName: "createAccount",
        args: [owner, _salt],
    });

    let initCode =
        FACTORY_ADDRESS +
        factoryCreateAccountData.slice(2) as Hex;

    try {
        // Try to get the sender address first (getSenderAddress must revert)
        await publicClient.readContract({
            address: _entrypoint,
            abi: ENTRYPOINT_ABI,
            functionName: "getSenderAddress",
            args: [initCode],
        });
        throw new Error("Expected getSenderAddress to revert");
    } catch (error: any) {
        const address: `0x${string}` = `0x${error.cause.raw.slice(-40)}`;

        try {
            // Check if the contract is already deployed
            const contractCode = await publicClient.getCode({
                address: address
            });

            // Return initCode if contract is not deployed (contractCode is undefined)
            // Return "0x" if contract is already deployed (contractCode exists)
            const finalInitCode = contractCode !== undefined && contractCode !== "0x" ? "0x" : initCode;

            return {
                address: address as `0x${string}`,
                initCode: finalInitCode
            };
        } catch (error) {
            // If getCode fails, assume contract is not deployed
            return {
                address: address as `0x${string}`,
                initCode
            };
        }
    }
}

export async function createPubClient(walletClient: WalletClient): Promise<PublicClient> {
    if (!walletClient.account) {
        throw new Error("Wallet is not connected");
    }
    const _chainId = await walletClient.getChainId();
    const rpcUrl = getRpcUrl(_chainId);
    const publicClient = createPublicClient({
        transport: http(rpcUrl),
    });

    return publicClient;
}