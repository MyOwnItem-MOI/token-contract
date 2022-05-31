import { ethers } from "hardhat";
import chai from "chai";
import { ContractTransaction } from "ethers";
const { assert, expect } = chai;

const expectRevert = async (transaction: Promise<ContractTransaction>, message: string) => {
    await expect(transaction).to.be.revertedWith(message);
};

const expectEvent = async (transaction: Promise<ContractTransaction>, eventName: string, params: any) => {
    const tx = await transaction;
    const receipt = await tx.wait();
    const event = receipt.events?.find((event) => event.event === eventName);
    assert.isNotNull(event);
    for (let key in params) {
        expect(event?.args![key]).to.equal(params[key]);
    }
};

async function timeTravel(seconds: number) {
    await ethers.provider.send("evm_increaseTime", [seconds]);
    await ethers.provider.send("evm_mine", []);
}

export { expectRevert, expectEvent, timeTravel };
