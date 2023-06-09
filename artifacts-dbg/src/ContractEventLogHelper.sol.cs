//1e7ab895182d29ced9e878d1cd59a974372b2ff1b9c3bfa90758c2c0a7d09452
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

using System;
using System.Collections.Generic;
using System.Globalization;
using System.Threading.Tasks;
using Meadow.JsonRpc.Types;

namespace Meadow.DebugSol.Generated
{
    public static class ContractEventLogHelper
    {
        public static Meadow.Contract.EventLog Parse(string eventSignatureHash, Meadow.JsonRpc.Types.FilterLogObject log)
        {
            var eventLog = Meadow.Contract.EventLogUtil.Parse(eventSignatureHash, log);
            if (eventLog != null)
            {
                return eventLog;
            }

            // Switch on the event signature hash and the number of indexed event arguments.
            switch (eventSignatureHash + "_" + (log.Topics.Length - 1).ToString("00", CultureInfo.InvariantCulture))
            {
                case "ac7ca0a94e285198d436d769bcb8fb1eeaf90caf667da852590812bf0459424a_00":
                    return new Meadow.DebugSol.Generated.DbgEntry.EvmPrint(log);
                default:
                    return null;
            }
        }
    }
}
