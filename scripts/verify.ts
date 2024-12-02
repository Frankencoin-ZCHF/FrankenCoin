import { run } from "hardhat";

export const verify = async (contractAddress: string, args: any[] | undefined) => {
    console.log("Verifying contract...");
    try {
        const verificationParams: any = {
            address: contractAddress,
        };

        if (args && args.length > 0) {
            verificationParams.constructorArguments = args;
        }

        await run("verify:verify", verificationParams);
    } catch (e: any) {
        if (e.message.toLowerCase().includes("already verified")) {
            console.log("Already Verified!");
        }
    }
};