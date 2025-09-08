// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract BloodPulseToken is ERC20 {
    constructor() ERC20("BloodPulseToken", "BPT") {
        _mint(msg.sender, 25000000000 * 10 ** decimals());
    }
}

