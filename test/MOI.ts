import { ethers } from "hardhat";
import { BigNumber, constants } from "ethers";
import chai from "chai";
import { solidity } from "ethereum-waffle";
import { MOI } from "../types/contracts/MOI.sol/MOI";
import { ERRORS } from "./constants";
import { expectEvent, expectRevert, timeTravel } from "./helpers";
const { expect } = chai;

chai.use(solidity);

const TOKEN_NAME: string = "MyOwnItem";
const TOKEN_SYMBOL: string = "MOI";
const TOTAL_SUPPLY: string = "5000000000000000000000000000";

describe(TOKEN_SYMBOL + " Token Test", function () {
    let contract: MOI;
    let supervisorContract: MOI;
    let ordinaryContract: MOI;
    let freezedContract: MOI;
    let burnerContract: MOI;
    let lockerContract: MOI;
    let timeLocked1Contract: MOI;
    let timeLocked2Contract: MOI;
    let timeLocked3Contract: MOI;
    let vestingLocked1Contract: MOI;
    let vestingLocked2Contract: MOI;
    let owner: string;
    let supervisor: string;
    let ordinary: string;
    let freezed: string;
    let burner: string;
    let locker: string;
    let timeLocked1: string;
    let timeLocked2: string;
    let timeLocked3: string;
    let vestingLocked1: string;
    let vestingLocked2: string;

    beforeEach(async function () {
        const accounts = await ethers.getSigners();
        const ownerSigner = accounts[0];
        owner = await ownerSigner.getAddress();
        supervisor = await accounts[1].getAddress();
        ordinary = await accounts[2].getAddress();
        freezed = await accounts[3].getAddress();
        burner = await accounts[4].getAddress();
        locker = await accounts[5].getAddress();
        timeLocked1 = await accounts[6].getAddress();
        timeLocked2 = await accounts[7].getAddress();
        timeLocked3 = await accounts[8].getAddress();
        vestingLocked1 = await accounts[9].getAddress();
        vestingLocked2 = await accounts[10].getAddress();

        const Contract = await ethers.getContractFactory(TOKEN_SYMBOL, ownerSigner);
        contract = (await Contract.deploy()) as MOI;
        await contract.deployed();
        supervisorContract = contract.connect(accounts[1]);
        ordinaryContract = contract.connect(accounts[2]);
        freezedContract = contract.connect(accounts[3]);
        burnerContract = contract.connect(accounts[4]);
        lockerContract = contract.connect(accounts[5]);
        timeLocked1Contract = contract.connect(accounts[6]);
        timeLocked2Contract = contract.connect(accounts[7]);
        timeLocked3Contract = contract.connect(accounts[8]);
        vestingLocked1Contract = contract.connect(accounts[9]);
        vestingLocked2Contract = contract.connect(accounts[10]);

        await contract.transferSupervisorOwnership(supervisor);
    });

    describe("1. basic info test", async function () {
        it("1-1 should basic info right", async function () {
            expect(await contract.symbol()).to.equal(TOKEN_SYMBOL);
            expect(await contract.name()).to.equal(TOKEN_NAME);
            expect(await contract.balanceOf(owner)).to.equal(BigNumber.from(TOTAL_SUPPLY));
        });
    });

    describe("2. transfer test", async function () {
        it("2-1 should transfer some token to ordinary", async function () {
            let amount = BigNumber.from(10000);
            await expectEvent(contract.transfer(ordinary, amount), "Transfer", { from: owner, to: ordinary, value: amount });
            expect(await contract.balanceOf(ordinary)).to.equal(amount);
        });
    });

    describe("3. freeze test", () => {
        it("3-1 should freeze and unfreeze transfer", async () => {
            let freezedAmount = 10000;

            await contract.transfer(freezed, freezedAmount);
            expect(await contract.balanceOf(freezed)).to.equal(freezedAmount);

            await contract.freeze(freezed);
            await expectRevert(freezedContract.transfer(owner, freezedAmount), ERRORS.FREEZABLE_TRANSFER_FROM_FREEZED_ACCOUNT);

            await supervisorContract.unfreeze(freezed);
            await freezedContract.transfer(owner, freezedAmount);
            expect(await contract.balanceOf(freezed)).to.equal(0);
        });
    });

    describe("4. burner test", () => {
        it("4-1 should set burner properly by owner", async () => {
            expect(await contract.isBurner(burner)).to.equal(false);
            await expectRevert(ordinaryContract.addBurner(burner), ERRORS.OWNABLE_CALLER_NOT_OWNER);
            expect(await contract.isBurner(burner)).to.equal(false);

            await contract.addBurner(burner, { from: owner });
            expect(await contract.isBurner(burner)).to.equal(true);

            await expectRevert(ordinaryContract.removeBurner(burner), ERRORS.OWNABLE_CALLER_NOT_OWNER);
            expect(await contract.isBurner(burner)).to.equal(true);

            await contract.removeBurner(burner, { from: owner });
            expect(await contract.isBurner(burner)).to.equal(false);
        });
        it("4-2 should burn", async () => {
            let transferredAmount = 20000;
            let burnedAmount = 10000;
            await contract.addBurner(burner);
            expect(await contract.isBurner(burner)).to.equal(true);
            await contract.transfer(burner, transferredAmount);
            expect(await contract.balanceOf(burner)).to.equal(transferredAmount);
            await burnerContract.burn(burnedAmount);
            expect(await burnerContract.balanceOf(burner)).to.equal(transferredAmount - burnedAmount);
            await contract.removeBurner(burner);
            expect(await contract.isBurner(burner)).to.equal(false);
        });
    });

    describe("5. locker test", () => {
        it("5-1 should lock and unlock properly by owner", async () => {
            expect(await contract.isLocker(locker)).to.equal(false);

            await expectRevert(ordinaryContract.addLocker(locker), ERRORS.OWNABLE_CALLER_NOT_OWNER);

            await contract.addLocker(locker);
            expect(await contract.isLocker(locker)).to.equal(true);

            await expectRevert(ordinaryContract.removeLocker(locker), ERRORS.OWNABLE_CALLER_NOT_OWNER);
            expect(await contract.isLocker(locker)).to.equal(true);

            await contract.removeLocker(locker);
            expect(await contract.isLocker(locker)).to.equal(false);
        });

        it("5-2 should time lock add and remove work right", async () => {
            const transferredAmount: number = 50000;
            const lockedAmount: number = 10000;
            let now: number = Date.now();
            let timeLockInfo = [];

            await contract.addLocker(locker);
            expect(await contract.isLocker(locker)).to.equal(true);

            await contract.transfer(timeLocked1, transferredAmount);
            expect(await contract.balanceOf(timeLocked1)).to.equal(transferredAmount);

            await lockerContract.addTimeLock(timeLocked1, lockedAmount, now + 300);
            expect(await contract.getTimeLockLength(timeLocked1)).to.equal(1);
            expect(await contract.getTimeLockedAmount(timeLocked1)).to.equal(lockedAmount);

            await lockerContract.addTimeLock(timeLocked1, lockedAmount + 100, now + 400);
            expect(await contract.getTimeLockLength(timeLocked1)).to.equal(2);
            expect(await contract.getTimeLockedAmount(timeLocked1)).to.equal(lockedAmount * 2 + 100);

            await lockerContract.addTimeLock(timeLocked1, lockedAmount + 200, now + 500);
            expect(await contract.getTimeLockLength(timeLocked1)).to.equal(3);
            expect(await contract.getTimeLockedAmount(timeLocked1)).to.equal(lockedAmount * 3 + 300);

            await lockerContract.addTimeLock(timeLocked1, lockedAmount + 300, now + 600);
            expect(await contract.getTimeLockLength(timeLocked1)).to.equal(4);
            expect(await contract.getTimeLockedAmount(timeLocked1)).to.equal(lockedAmount * 4 + 600);

            timeLockInfo = await contract.getTimeLock(timeLocked1, 0);
            expect(timeLockInfo[0]).to.equal(lockedAmount);
            expect(timeLockInfo[1]).to.equal(now + 300);

            timeLockInfo = await contract.getTimeLock(timeLocked1, 1);
            expect(timeLockInfo[0]).to.equal(lockedAmount + 100);
            expect(timeLockInfo[1]).to.equal(now + 400);

            timeLockInfo = await contract.getTimeLock(timeLocked1, 2);
            expect(timeLockInfo[0]).to.equal(lockedAmount + 200);
            expect(timeLockInfo[1]).to.equal(now + 500);

            timeLockInfo = await contract.getTimeLock(timeLocked1, 3);
            expect(timeLockInfo[0]).to.equal(lockedAmount + 300);
            expect(timeLockInfo[1]).to.equal(now + 600);

            await expectRevert(lockerContract.removeTimeLock(timeLocked1, 2), ERRORS.SUPERVISOR_CALLER_NOT_SUPERVISOR);
            expect(await contract.getTimeLockLength(timeLocked1)).to.equal(4);

            await supervisorContract.removeTimeLock(timeLocked1, 1);
            expect(await contract.getTimeLockLength(timeLocked1)).to.equal(3);

            timeLockInfo = await contract.getTimeLock(timeLocked1, 0);
            expect(timeLockInfo[0]).to.equal(lockedAmount);
            expect(timeLockInfo[1]).to.equal(now + 300);

            timeLockInfo = await contract.getTimeLock(timeLocked1, 1);
            expect(timeLockInfo[0]).to.equal(lockedAmount + 300);
            expect(timeLockInfo[1]).to.equal(now + 600);

            timeLockInfo = await contract.getTimeLock(timeLocked1, 2);
            expect(timeLockInfo[0]).to.equal(lockedAmount + 200);
            expect(timeLockInfo[1]).to.equal(now + 500);

            expect(await contract.getTimeLockedAmount(timeLocked1)).to.equal(lockedAmount * 3 + 500);

            await supervisorContract.removeTimeLock(timeLocked1, 2);
            expect(await contract.getTimeLockLength(timeLocked1)).to.equal(2);

            timeLockInfo = await contract.getTimeLock(timeLocked1, 0);
            expect(timeLockInfo[0]).to.equal(lockedAmount);
            expect(timeLockInfo[1]).to.equal(now + 300);

            timeLockInfo = await contract.getTimeLock(timeLocked1, 1);
            expect(timeLockInfo[0]).to.equal(lockedAmount + 300);
            expect(timeLockInfo[1]).to.equal(now + 600);

            expect(await contract.getTimeLockedAmount(timeLocked1)).to.equal(lockedAmount * 2 + 300);

            await supervisorContract.removeTimeLock(timeLocked1, 0);
            expect(await contract.getTimeLockLength(timeLocked1)).to.equal(1);

            timeLockInfo = await contract.getTimeLock(timeLocked1, 0);
            expect(timeLockInfo[0]).to.equal(lockedAmount + 300);
            expect(timeLockInfo[1]).to.equal(now + 600);

            expect(await contract.getTimeLockedAmount(timeLocked1)).to.equal(lockedAmount + 300);

            await lockerContract.addTimeLock(timeLocked1, lockedAmount + 100, now + 400);
            expect(await contract.getTimeLockLength(timeLocked1)).to.equal(2);
            expect(await contract.getTimeLockedAmount(timeLocked1)).to.equal(lockedAmount * 2 + 400);

            timeLockInfo = await contract.getTimeLock(timeLocked1, 0);
            expect(timeLockInfo[0]).to.equal(lockedAmount + 300);
            expect(timeLockInfo[1]).to.equal(now + 600);

            timeLockInfo = await contract.getTimeLock(timeLocked1, 1);
            expect(timeLockInfo[0]).to.equal(lockedAmount + 100);
            expect(timeLockInfo[1]).to.equal(now + 400);
        });

        it("5-3 should time lock and transfer", async () => {
            const transferredAmount = 50000;
            const lockedAmount = 10000;
            let now = Date.now();

            await contract.addLocker(locker);
            expect(await contract.isLocker(locker)).to.equal(true);

            await contract.transfer(timeLocked2, transferredAmount);
            expect(await contract.balanceOf(timeLocked2)).to.equal(transferredAmount);

            await lockerContract.addTimeLock(timeLocked2, lockedAmount * 4 + 100, now + 300);
            expect(await contract.getTimeLockLength(timeLocked2)).to.equal(1);
            expect(await contract.getTimeLockedAmount(timeLocked2)).to.equal(lockedAmount * 4 + 100);

            await expectRevert(timeLocked2Contract.transfer(owner, lockedAmount), ERRORS.LOCKABLE_INSUFFICIENT_AMOUNT);
            expect(await contract.balanceOf(timeLocked2)).to.equal(transferredAmount);

            await timeLocked2Contract.transfer(owner, lockedAmount - 100);
            expect(await contract.balanceOf(timeLocked2)).to.equal(transferredAmount - lockedAmount + 100);
        });

        it("5-4 should time lock expires", async () => {
            let transferredAmount = 50000;
            let lockedAmount = 10000;
            let now = Math.round(new Date().getTime() / 1000);
            let timeLockInfo = [];

            await contract.addLocker(locker);
            expect(await contract.isLocker(locker)).to.equal(true);

            await contract.transfer(timeLocked3, transferredAmount);
            expect(await contract.balanceOf(timeLocked3)).to.equal(transferredAmount);

            await lockerContract.addTimeLock(timeLocked3, lockedAmount * 4 + 100, now + 2000);
            expect(await contract.getTimeLockLength(timeLocked3)).to.equal(1);
            expect(await contract.getTimeLockedAmount(timeLocked3)).to.equal(lockedAmount * 4 + 100);

            await expectRevert(timeLocked3Contract.transfer(owner, lockedAmount), ERRORS.LOCKABLE_INSUFFICIENT_AMOUNT);
            expect(await contract.balanceOf(timeLocked3)).to.equal(transferredAmount);

            timeLockInfo = await contract.getTimeLock(timeLocked3, 0);
            expect(timeLockInfo[0]).to.equal(lockedAmount * 4 + 100);
            expect(timeLockInfo[1]).to.equal(now + 2000);

            await timeTravel(3000);

            expect(await contract.getTimeLockedAmount(timeLocked3)).to.equal(0);

            await timeLocked3Contract.transfer(owner, lockedAmount);
            expect(await contract.balanceOf(timeLocked3)).to.equal(transferredAmount - lockedAmount);
        });

        it("5-5 should vesting lock add and remove work right", async () => {
            let transferredAmount = 50000;
            let period = 60 * 60 * 24 * 31;
            let startsAt = new Date().getTime() + period;
            let count = 5;
            let vestingLockInfo = [];

            await contract.addLocker(locker);
            expect(await contract.isLocker(locker)).to.equal(true);

            await contract.transfer(vestingLocked1, transferredAmount);
            expect(await contract.balanceOf(vestingLocked1)).to.equal(transferredAmount);

            await lockerContract.addVestingLock(vestingLocked1, startsAt, period, count);
            expect(await contract.getVestingLockedAmount(vestingLocked1)).to.equal(transferredAmount);
            vestingLockInfo = await contract.getVestingLock(vestingLocked1);
            expect(vestingLockInfo[0]).to.equal(transferredAmount);
            expect(vestingLockInfo[1]).to.equal(startsAt);
            expect(vestingLockInfo[2]).to.equal(period);
            expect(vestingLockInfo[3]).to.equal(count);

            await expectRevert(lockerContract.removeVestingLock(vestingLocked1), ERRORS.SUPERVISOR_CALLER_NOT_SUPERVISOR);
            expect(await contract.getVestingLockedAmount(vestingLocked1)).to.equal(transferredAmount);
            vestingLockInfo = await contract.getVestingLock(vestingLocked1);
            expect(vestingLockInfo[0]).to.equal(transferredAmount);
            expect(vestingLockInfo[1]).to.equal(startsAt);
            expect(vestingLockInfo[2]).to.equal(period);
            expect(vestingLockInfo[3]).to.equal(count);

            await supervisorContract.removeVestingLock(vestingLocked1);
            expect(await contract.getVestingLockedAmount(vestingLocked1)).to.equal(0);
            vestingLockInfo = await contract.getVestingLock(vestingLocked1);
            expect(vestingLockInfo[0]).to.equal(0);
        });

        it("5-6 should vesting lock and transfer", async () => {
            let transferredAmount = 50000;
            let lockedAmount = 50000;
            let period = 60 * 60 * 24 * 31;
            let startsAt = new Date().getTime() + period;
            let count = 5;

            await contract.addLocker(locker);
            expect(await contract.isLocker(locker)).to.equal(true);

            await contract.transfer(vestingLocked1, transferredAmount);
            expect(await contract.balanceOf(vestingLocked1)).to.equal(transferredAmount);

            await lockerContract.addVestingLock(vestingLocked1, startsAt, period, count);
            expect(await contract.getVestingLockedAmount(vestingLocked1)).to.equal(transferredAmount);

            await expectRevert(vestingLocked1Contract.transfer(owner, lockedAmount), ERRORS.LOCKABLE_INSUFFICIENT_AMOUNT);
            expect(await contract.balanceOf(vestingLocked1)).to.equal(transferredAmount);
        });

        it("5-7 should vesting lock expires", async () => {
            let transferredAmount = 50000;
            let period = 60 * 60 * 24 * 31;
            let startsAt = Math.floor(new Date().getTime() / 1000) + period;
            let count = 5;
            let oneMonthToSec = 60 * 60 * 24 * 31;
            let releasedAmountPerMonth = 10000;

            await contract.addLocker(locker);
            expect(await contract.isLocker(locker)).to.equal(true);

            await contract.transfer(vestingLocked2, transferredAmount);
            expect(await contract.balanceOf(vestingLocked2)).to.equal(transferredAmount);

            await lockerContract.addVestingLock(vestingLocked2, startsAt, period, count);
            expect(await contract.getVestingLockedAmount(vestingLocked2)).to.equal(transferredAmount);

            await expectRevert(vestingLocked2Contract.transfer(owner, transferredAmount), ERRORS.LOCKABLE_INSUFFICIENT_AMOUNT);
            expect(await contract.balanceOf(vestingLocked2)).to.equal(transferredAmount);

            await timeTravel(oneMonthToSec + 1);
            expect(await contract.getVestingLockedAmount(vestingLocked2)).to.equal(transferredAmount - releasedAmountPerMonth);

            await vestingLocked2Contract.transfer(owner, releasedAmountPerMonth);
            expect(await contract.balanceOf(vestingLocked2)).to.equal(transferredAmount - releasedAmountPerMonth);
        });
    });
});
