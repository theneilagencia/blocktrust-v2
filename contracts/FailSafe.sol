// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import "@openzeppelin/contracts/access/AccessControl.sol";
interface IIdentityNFTWritable{function activeNFT(address user) external view returns(uint256);function cancelNFT(uint256 tokenId) external;}
contract FailSafe is AccessControl{
    bytes32 public constant SECURITY_ROLE=keccak256("SECURITY_ROLE");
    IIdentityNFTWritable public identity;
    event FailsafeEvent(address indexed user,uint256 indexed tokenId,uint256 timestamp);
    constructor(address admin,address identityContract){
        _grantRole(DEFAULT_ADMIN_ROLE,admin);
        _grantRole(SECURITY_ROLE,admin);
        identity=IIdentityNFTWritable(identityContract);
    }
    function panicSign(address user) external onlyRole(SECURITY_ROLE){
        uint256 tokenId=identity.activeNFT(user);
        emit FailsafeEvent(user,tokenId,block.timestamp);
        if(tokenId!=0){identity.cancelNFT(tokenId);}
    }
}
