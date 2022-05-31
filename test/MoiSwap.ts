import { ethers } from "hardhat";
import { BigNumber, constants } from "ethers";
import chai from "chai";
import { solidity } from "ethereum-waffle";
import { MOI } from "../types/contracts/MOI.sol/MOI";
import { TestMOI } from "../types/contracts/TestMOI";
import { MoiSwap } from "../types/contracts/MoiSwap.sol/MoiSwap";

import { ERRORS } from "./constants";
import { expectEvent, expectRevert, timeTravel } from "./helpers";
import { Test } from "mocha";
const { expect } = chai;

const SWAP_RATE: number = 50;

chai.use(solidity);

describe("Moi Swap Test", function () {
    let moiContract: MOI;
    let testMoiContract: TestMOI;
    let moiSwapContract: MoiSwap;

    let user1SwapContract: MoiSwap;
    let newOwnerSwapContract: MoiSwap;
    let user1TestMoiContract: TestMOI;
    let owner: string;
    let user1: string;
    let newOwner: string;

    beforeEach(async function () {
        const accounts = await ethers.getSigners();
        const ownerSigner = accounts[0];
        owner = await ownerSigner.getAddress();
        user1 = await accounts[1].getAddress();
        newOwner = await accounts[2].getAddress();

        const MoiContract = await ethers.getContractFactory("MOI", ownerSigner);
        moiContract = (await MoiContract.deploy()) as MOI;
        await moiContract.deployed();

        const TestMoiContract = await ethers.getContractFactory("TestMOI", ownerSigner);
        testMoiContract = (await TestMoiContract.deploy()) as TestMOI;
        await testMoiContract.deployed();
        user1TestMoiContract = testMoiContract.connect(accounts[1]);

        const MoiSwapContract = await ethers.getContractFactory("MoiSwap", ownerSigner);
        moiSwapContract = (await MoiSwapContract.deploy(testMoiContract.address, moiContract.address)) as MoiSwap;
        await moiSwapContract.deployed();

        user1SwapContract = moiSwapContract.connect(accounts[1]);
        newOwnerSwapContract = moiSwapContract.connect(accounts[2]);
    });

    describe("1. Swap Test", async function () {
        it("1-1 should token address info right", async function () {
            expect(await moiSwapContract.legacyMOI()).to.equal(testMoiContract.address);
            expect(await moiSwapContract.newMOI()).to.equal(moiContract.address);
        });

        it("1-2 should swap right", async function () {
            await expectRevert(user1SwapContract.swap(), ERRORS.INSUFFICIENT_LEGACY_MOI);

            const swapAmount = 1000000;
            const moiSwapAmount = swapAmount * SWAP_RATE;
            await testMoiContract.transfer(user1, swapAmount);
            expect(await testMoiContract.balanceOf(user1)).to.equal(swapAmount);

            await expectRevert(user1SwapContract.swap(), ERRORS.ALLOWANCE_TOO_LOW);

            await user1TestMoiContract.approve(moiSwapContract.address, ethers.constants.MaxUint256);

            await expectRevert(user1SwapContract.swap(), ERRORS.INSUFFICIENT_NEW_MOI);

            await moiContract.transfer(moiSwapContract.address, moiSwapAmount);
            expect(await moiContract.balanceOf(moiSwapContract.address)).to.equal(moiSwapAmount);

            await user1SwapContract.swap();
            expect(await testMoiContract.balanceOf(user1)).to.equal(0);
            expect(await testMoiContract.balanceOf(moiSwapContract.address)).to.equal(swapAmount);
            expect(await moiContract.balanceOf(user1)).to.equal(moiSwapAmount);
            expect(await moiContract.balanceOf(moiSwapContract.address)).to.equal(0);
        });
    });

    describe("2. Withdraw Test", async function () {
        it("2-1 should withdraw right", async function () {
            const depositAmount = 1000000;
            await moiContract.transfer(moiSwapContract.address, depositAmount);
            expect(await moiContract.balanceOf(moiSwapContract.address)).to.equal(depositAmount);

            await expectEvent(moiSwapContract.transferOwnership(newOwner), "OwnershipTransferred", { previousOwner: owner, newOwner: newOwner });

            await expectRevert(moiSwapContract.withdraw(), ERRORS.OWNABLE_CALLER_IS_NOT_THE_OWNER);
            await newOwnerSwapContract.withdraw();
            expect(await moiContract.balanceOf(newOwner)).to.equal(depositAmount);
        });
        it("2-2 should withdraw legacy right", async function () {
            const swapAmount = 1000000;
            const moiSwapAmount = swapAmount * SWAP_RATE;
            await testMoiContract.transfer(user1, swapAmount);
            await user1TestMoiContract.approve(moiSwapContract.address, ethers.constants.MaxUint256);
            await moiContract.transfer(moiSwapContract.address, moiSwapAmount);
            await user1SwapContract.swap();

            await expectEvent(moiSwapContract.transferOwnership(newOwner), "OwnershipTransferred", { previousOwner: owner, newOwner: newOwner });
            await newOwnerSwapContract.withdrawLegacy();
            expect(await testMoiContract.balanceOf(newOwner)).to.equal(swapAmount);
        });
    });
});
