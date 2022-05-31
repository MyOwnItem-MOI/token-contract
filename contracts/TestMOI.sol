// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract TestMOI is ERC20, Ownable {
    uint256 private constant _initialSupply = 100_000_000e18;

    constructor() ERC20("MOI", "MOI") {
        _mint(_msgSender(), _initialSupply);
    }
}
