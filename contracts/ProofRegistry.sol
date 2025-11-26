// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
interface IIdentityNFT{function isActive(uint256 tokenId) external view returns(bool);function activeNFT(address user) external view returns(uint256);}
contract ProofRegistry{
    struct Proof{string docHash;address signer;string proofUrl;uint256 timestamp;bool revoked;}
    struct DualProof{bytes32 docHash;address signer;bytes20 pgpFingerprint;bytes32 pgpSigHash;uint256 nftId;uint256 timestamp;bool revoked;}
    mapping(string=>Proof) public proofs;
    mapping(bytes32=>DualProof) public dualProofs;
    IIdentityNFT public identity;
    event ProofRegistered(string indexed docHash,address indexed signer,uint256 timestamp);
    event ProofRevoked(string indexed docHash,address indexed by,uint256 timestamp);
    event ProofStoredDual(bytes32 indexed docHash,address indexed signer,bytes20 pgpFingerprint,bytes32 pgpSigHash,uint256 nftId,uint256 timestamp);
    constructor(address identityContract){identity=IIdentityNFT(identityContract);}
    function registerProof(string calldata docHash,string calldata proofUrl) external{
        uint256 tokenId=identity.activeNFT(msg.sender);
        require(tokenId!=0&&identity.isActive(tokenId),"Identidade inativa");
        proofs[docHash]=Proof(docHash,msg.sender,proofUrl,block.timestamp,false);
        emit ProofRegistered(docHash,msg.sender,block.timestamp);
    }
    function verifyProof(string calldata docHash) external view returns(Proof memory){return proofs[docHash];}
    function revokeProof(string calldata docHash) external{
        Proof storage p=proofs[docHash];
        require(p.signer==msg.sender,"Somente o signatario pode revogar");
        p.revoked=true;
        emit ProofRevoked(docHash,msg.sender,block.timestamp);
    }
    function storeDual(bytes32 docHash,bytes20 pgpFingerprint,bytes32 pgpSigHash,uint256 nftId) external{
        require(identity.isActive(nftId),"NFT inativo");
        require(identity.activeNFT(msg.sender)==nftId,"NFT nao pertence ao usuario");
        dualProofs[docHash]=DualProof(docHash,msg.sender,pgpFingerprint,pgpSigHash,nftId,block.timestamp,false);
        emit ProofStoredDual(docHash,msg.sender,pgpFingerprint,pgpSigHash,nftId,block.timestamp);
    }
    function verifyDual(bytes32 docHash) external view returns(DualProof memory){return dualProofs[docHash];}
    function revokeDual(bytes32 docHash) external{
        DualProof storage p=dualProofs[docHash];
        require(p.signer==msg.sender,"Somente o signatario pode revogar");
        p.revoked=true;
    }
}
