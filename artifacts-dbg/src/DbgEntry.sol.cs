//6a327fa227406ea68b70d68cd1c36435195f07c423b7678bd3079a56ab72ed00
// NOTICE: Do not change this file. This file is auto-generated and any changes will be reset.
// Generated date: 2023-05-13T13:53:17 (UTC)
#pragma warning disable SA1000 // The keyword 'new' should be followed by a space

#pragma warning disable SA1003 // Symbols should be spaced correctly

#pragma warning disable SA1008 // Opening parenthesis should be preceded by a space

#pragma warning disable SA1009 // Closing parenthesis should be spaced correctly

#pragma warning disable SA1011 // Closing square brackets should be spaced correctly

#pragma warning disable SA1012 // Opening brace should be preceded by a space

#pragma warning disable SA1013 // Closing brace should be preceded by a space

#pragma warning disable SA1024 // Colons Should Be Spaced Correctly

#pragma warning disable SA1128 // Put constructor initializers on their own line

#pragma warning disable SA1300 // Element should begin with upper-case letter

#pragma warning disable SA1307 // Field names should begin with upper-case letter

#pragma warning disable SA1313 // Parameter names should begin with lower-case letter

#pragma warning disable IDE1006 // Naming Styles

using Meadow.Contract;
using Meadow.Core.AbiEncoding;
using Meadow.Core.EthTypes;
using Meadow.Core.Utils;
using Meadow.JsonRpc.Types;
using SolcNet.DataDescription.Output;
using System;
using System.Runtime.InteropServices;
using System.Threading.Tasks;

namespace Meadow.DebugSol.Generated
{
    /// <summary>From file FrankencoinTest.t.sol<para/></summary>
    [Meadow.Contract.SolidityContractAttribute(typeof(DbgEntry), CONTRACT_SOL_FILE, CONTRACT_NAME)]
    public class DbgEntry : Meadow.Contract.BaseContract
    {
        public static Lazy<byte[]> BYTECODE_BYTES = new Lazy<byte[]>(() => Meadow.Core.Utils.HexUtil.HexToBytes(GeneratedSolcData<DbgEntry>.Default.GetSolcBytecodeInfo(CONTRACT_SOL_FILE, CONTRACT_NAME).Bytecode));
        public const string CONTRACT_SOL_FILE = "FrankencoinTest.t.sol";
        public const string CONTRACT_NAME = "DbgEntry";
        protected override string ContractSolFilePath => CONTRACT_SOL_FILE;
        protected override string ContractName => CONTRACT_NAME;
        private DbgEntry(Meadow.JsonRpc.Client.IJsonRpcClient rpcClient, Meadow.Core.EthTypes.Address address, Meadow.Core.EthTypes.Address defaultFromAccount): base(rpcClient, address, defaultFromAccount)
        {
            Meadow.Contract.EventLogUtil.RegisterDeployedContractEventTypes(address.GetHexString(hexPrefix: true), typeof(Meadow.DebugSol.Generated.DbgEntry.EvmPrint));
        }

        public static async Task<DbgEntry> At(Meadow.JsonRpc.Client.IJsonRpcClient rpcClient, Meadow.Core.EthTypes.Address address, Meadow.Core.EthTypes.Address? defaultFromAccount = null)
        {
            defaultFromAccount = defaultFromAccount ?? (await rpcClient.Accounts())[0];
            return new DbgEntry(rpcClient, address, defaultFromAccount.Value);
        }

        public DbgEntry()
        {
        }

        /// <summary>
        /// Deploys the contract.  <para/>
        /// </summary>
         
        /// <param name = "rpcClient">The RPC client to be used for this contract instance.</param>
        /// <param name = "defaultFromAccount">If null then the first account returned by eth_accounts will be used.</param>
        /// <returns>An contract instance pointed at the deployed contract address.</returns>
        public static async Task<DbgEntry> Deploy(Meadow.JsonRpc.Client.IJsonRpcClient rpcClient, Meadow.JsonRpc.Types.TransactionParams transactionParams = null, Meadow.Core.EthTypes.Address? defaultFromAccount = null)
        {
            transactionParams = transactionParams ?? new Meadow.JsonRpc.Types.TransactionParams();
            defaultFromAccount = defaultFromAccount ?? transactionParams.From ?? (await rpcClient.Accounts())[0];
            transactionParams.From = transactionParams.From ?? defaultFromAccount;
            var encodedParams = Array.Empty<byte>();
            var contractAddr = await ContractFactory.Deploy(rpcClient, BYTECODE_BYTES.Value, transactionParams, encodedParams);
            return new DbgEntry(rpcClient, contractAddr, defaultFromAccount.Value);
        }

        /// <summary>
        /// Deploys the contract.  <para/>
        /// </summary>
         
        /// <param name = "rpcClient">The RPC client to be used for this contract instance.</param>
        /// <param name = "defaultFromAccount">If null then the first account returned by eth_accounts will be used.</param>
        /// <returns>An contract instance pointed at the deployed contract address.</returns>
        public static ContractDeployer<DbgEntry> New(Meadow.JsonRpc.Client.IJsonRpcClient rpcClient, Meadow.JsonRpc.Types.TransactionParams transactionParams = null, Meadow.Core.EthTypes.Address? defaultFromAccount = null)
        {
            var encodedParams = Array.Empty<byte>();
            return new ContractDeployer<DbgEntry>(rpcClient, BYTECODE_BYTES.Value, transactionParams, defaultFromAccount, encodedParams);
        }

        [Meadow.Contract.EventSignatureAttribute(SIGNATURE)]
        public class EvmPrint : Meadow.Contract.EventLog
        {
            public override string EventName => "EvmPrint";
            public override string EventSignature => SIGNATURE;
            public const string SIGNATURE = "ac7ca0a94e285198d436d769bcb8fb1eeaf90caf667da852590812bf0459424a";
            // Event log parameters.
            public readonly System.String unamed0;
            public EvmPrint(Meadow.JsonRpc.Types.FilterLogObject log): base(log)
            {
                // Decode the log topic args.
                Span<byte> topicBytes = MemoryMarshal.AsBytes(new Span<Meadow.Core.EthTypes.Data>(log.Topics).Slice(1));
                AbiTypeInfo[] topicTypes = Array.Empty<AbiTypeInfo>();
                var topicBuff = new AbiDecodeBuffer(topicBytes, topicTypes);
                // Decode the log data args.
                Span<byte> dataBytes = log.Data;
                AbiTypeInfo[] dataTypes = new AbiTypeInfo[]{"string"};
                var dataBuff = new AbiDecodeBuffer(dataBytes, dataTypes);
                DecoderFactory.Decode(dataTypes[0], ref dataBuff, out unamed0);
                // Add all the log args and their metadata to a collection that can be checked at runtime.
                LogArgs = new(string Name, string Type, bool Indexed, object Value)[]{("", "string", false, unamed0)};
            }
        }

        /// <summary> <para/>Returns <c>uint256</c></summary>
        public EthFunc<Meadow.Core.EthTypes.UInt256> testTest()
        {
            var callData = Meadow.Core.AbiEncoding.EncoderUtil.GetFunctionCallBytes("testTest()");
            return EthFunc.Create<Meadow.Core.EthTypes.UInt256>(this, callData, "uint256", DecoderFactory.Decode);
        }

        /// <summary>The contract fallback function. <para/></summary>
        public EthFunc FallbackFunction => EthFunc.Create(this, Array.Empty<byte>());
    }
}
