import { expect } from "chai";
import { ethers } from "hardhat";
import { DocumentSignature, IdentityNFT } from "../typechain-types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

describe("DocumentSignature - Integration Tests", function () {
  let documentSignature: DocumentSignature;
  let identityNFT: IdentityNFT;
  let owner: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let user3: SignerWithAddress;

  // Test data
  const testDocument = {
    ipfsHash: "QmTestHash123456789abcdef",
    title: "Contrato de Teste",
    description: "Documento de teste para validação"
  };

  beforeEach(async function () {
    // Deploy contracts
    [owner, user1, user2, user3] = await ethers.getSigners();

    // Deploy IdentityNFT
    const IdentityNFTFactory = await ethers.getContractFactory("IdentityNFT");
    identityNFT = await IdentityNFTFactory.deploy();
    await identityNFT.deployed();

    // Deploy DocumentSignature
    const DocumentSignatureFactory = await ethers.getContractFactory("DocumentSignature");
    documentSignature = await DocumentSignatureFactory.deploy(identityNFT.address);
    await documentSignature.deployed();

    // Mint identity tokens for users
    await identityNFT.connect(owner).mint(user1.address);
    await identityNFT.connect(owner).mint(user2.address);
    await identityNFT.connect(owner).mint(user3.address);
  });

  describe("Contract Deployment", function () {
    it("Should deploy correctly with valid IdentityNFT address", async function () {
      expect(await documentSignature.identityNFT()).to.equal(identityNFT.address);
    });

    it("Should have correct initial stats", async function () {
      const [totalDocs, totalSigs, activeDocs] = await documentSignature.getStats();
      expect(totalDocs).to.equal(0);
      expect(totalSigs).to.equal(0);
      expect(activeDocs).to.equal(0);
    });

    it("Should set correct owner", async function () {
      expect(await documentSignature.owner()).to.equal(owner.address);
    });
  });

  describe("Document Creation", function () {
    it("Should create document with valid identity", async function () {
      const tx = await documentSignature
        .connect(user1)
        .createDocument(testDocument.ipfsHash, testDocument.title, testDocument.description);
      
      await expect(tx)
        .to.emit(documentSignature, "DocumentCreated")
        .withArgs(1, testDocument.ipfsHash, user1.address, testDocument.title);

      const document = await documentSignature.getDocument(1);
      expect(document.ipfsHash).to.equal(testDocument.ipfsHash);
      expect(document.title).to.equal(testDocument.title);
      expect(document.description).to.equal(testDocument.description);
      expect(document.creator).to.equal(user1.address);
      expect(document.isActive).to.be.true;
      expect(document.version).to.equal(1);
      expect(document.totalSignatures).to.equal(0);
    });

    it("Should fail to create document without identity NFT", async function () {
      const userWithoutNFT = await ethers.getSigner();
      
      await expect(
        documentSignature
          .connect(userWithoutNFT)
          .createDocument(testDocument.ipfsHash, testDocument.title, testDocument.description)
      ).to.be.revertedWith("Usuario deve ter NFT de identidade na Polygon");
    });

    it("Should fail with empty IPFS hash", async function () {
      await expect(
        documentSignature
          .connect(user1)
          .createDocument("", testDocument.title, testDocument.description)
      ).to.be.revertedWith("IPFS hash nao pode estar vazio");
    });

    it("Should fail with empty title", async function () {
      await expect(
        documentSignature
          .connect(user1)
          .createDocument(testDocument.ipfsHash, "", testDocument.description)
      ).to.be.revertedWith("Titulo nao pode estar vazio");
    });
  });

  describe("Document Signing", function () {
    let documentId: number;
    let domain: any;
    let types: any;

    beforeEach(async function () {
      // Create a document first
      await documentSignature
        .connect(user1)
        .createDocument(testDocument.ipfsHash, testDocument.title, testDocument.description);
      documentId = 1;

      // Setup EIP-712 signing domain and types
      const chainId = (await ethers.provider.getNetwork()).chainId;
      domain = {
        name: 'DocumentSignature',
        version: '1',
        chainId: chainId,
        verifyingContract: documentSignature.address
      };

      types = {
        DocumentSignature: [
          { name: 'documentId', type: 'uint256' },
          { name: 'signer', type: 'address' },
          { name: 'timestamp', type: 'uint256' },
          { name: 'ipfsMetadata', type: 'string' }
        ]
      };
    });

    it("Should sign document with valid signature", async function () {
      const timestamp = Math.floor(Date.now() / 1000);
      const ipfsMetadata = "QmMetadataHash123";
      
      const message = {
        documentId: documentId,
        signer: user2.address,
        timestamp: timestamp,
        ipfsMetadata: ipfsMetadata
      };

      const signature = await user2._signTypedData(domain, types, message);
      const tokenId = 2; // user2's token ID

      const tx = await documentSignature
        .connect(user2)
        .signDocument(documentId, tokenId, ipfsMetadata, signature);

      await expect(tx)
        .to.emit(documentSignature, "DocumentSigned")
        .withArgs(documentId, 1, user2.address, tokenId);

      // Verify signature
      const [isValid, signer, sigTimestamp] = await documentSignature.verifySignature(documentId, 1);
      expect(isValid).to.be.true;
      expect(signer).to.equal(user2.address);
    });

    it("Should prevent double signing", async function () {
      const timestamp = Math.floor(Date.now() / 1000);
      const ipfsMetadata = "QmMetadataHash123";
      
      const message = {
        documentId: documentId,
        signer: user2.address,
        timestamp: timestamp,
        ipfsMetadata: ipfsMetadata
      };

      const signature = await user2._signTypedData(domain, types, message);
      const tokenId = 2;

      // First signature
      await documentSignature
        .connect(user2)
        .signDocument(documentId, tokenId, ipfsMetadata, signature);

      // Second signature should fail
      await expect(
        documentSignature
          .connect(user2)
          .signDocument(documentId, tokenId, ipfsMetadata, signature)
      ).to.be.revertedWith("Usuario ja assinou este documento");
    });

    it("Should fail with invalid identity token", async function () {
      const timestamp = Math.floor(Date.now() / 1000);
      const ipfsMetadata = "QmMetadataHash123";
      
      const message = {
        documentId: documentId,
        signer: user2.address,
        timestamp: timestamp,
        ipfsMetadata: ipfsMetadata
      };

      const signature = await user2._signTypedData(domain, types, message);
      const wrongTokenId = 1; // user1's token ID

      await expect(
        documentSignature
          .connect(user2)
          .signDocument(documentId, wrongTokenId, ipfsMetadata, signature)
      ).to.be.revertedWith("Usuario nao possui este token de identidade");
    });

    it("Should fail with invalid signature", async function () {
      const timestamp = Math.floor(Date.now() / 1000);
      const ipfsMetadata = "QmMetadataHash123";
      
      // Create signature with user1 but submit as user2
      const message = {
        documentId: documentId,
        signer: user1.address,
        timestamp: timestamp,
        ipfsMetadata: ipfsMetadata
      };

      const signature = await user1._signTypedData(domain, types, message);
      const tokenId = 2;

      await expect(
        documentSignature
          .connect(user2)
          .signDocument(documentId, tokenId, ipfsMetadata, signature)
      ).to.be.revertedWith("Assinatura invalida");
    });
  });

  describe("Document Signatures Retrieval", function () {
    let documentId: number;

    beforeEach(async function () {
      // Create document
      await documentSignature
        .connect(user1)
        .createDocument(testDocument.ipfsHash, testDocument.title, testDocument.description);
      documentId = 1;

      // Add signatures
      const domain = {
        name: 'DocumentSignature',
        version: '1',
        chainId: (await ethers.provider.getNetwork()).chainId,
        verifyingContract: documentSignature.address
      };

      const types = {
        DocumentSignature: [
          { name: 'documentId', type: 'uint256' },
          { name: 'signer', type: 'address' },
          { name: 'timestamp', type: 'uint256' },
          { name: 'ipfsMetadata', type: 'string' }
        ]
      };

      // User2 signs
      const timestamp1 = Math.floor(Date.now() / 1000);
      const message1 = {
        documentId: documentId,
        signer: user2.address,
        timestamp: timestamp1,
        ipfsMetadata: "QmMeta1"
      };
      const sig1 = await user2._signTypedData(domain, types, message1);
      await documentSignature.connect(user2).signDocument(documentId, 2, "QmMeta1", sig1);

      // User3 signs
      const timestamp2 = Math.floor(Date.now() / 1000) + 1;
      const message2 = {
        documentId: documentId,
        signer: user3.address,
        timestamp: timestamp2,
        ipfsMetadata: "QmMeta2"
      };
      const sig2 = await user3._signTypedData(domain, types, message2);
      await documentSignature.connect(user3).signDocument(documentId, 3, "QmMeta2", sig2);
    });

    it("Should return all document signatures", async function () {
      const [signatureIds, signers, timestamps, validFlags] = 
        await documentSignature.getDocumentSignatures(documentId);

      expect(signatureIds.length).to.equal(2);
      expect(signers.length).to.equal(2);
      expect(timestamps.length).to.equal(2);
      expect(validFlags.length).to.equal(2);

      expect(signers[0]).to.equal(user2.address);
      expect(signers[1]).to.equal(user3.address);
      expect(validFlags[0]).to.be.true;
      expect(validFlags[1]).to.be.true;
    });

    it("Should update document statistics", async function () {
      const document = await documentSignature.getDocument(documentId);
      expect(document.totalSignatures).to.equal(2);

      const [totalDocs, totalSigs, activeDocs] = await documentSignature.getStats();
      expect(totalDocs).to.equal(1);
      expect(totalSigs).to.equal(2);
      expect(activeDocs).to.equal(1);
    });
  });

  describe("User Documents and Signatures", function () {
    beforeEach(async function () {
      // User1 creates 2 documents
      await documentSignature
        .connect(user1)
        .createDocument("QmHash1", "Doc1", "Description1");
      
      await documentSignature
        .connect(user1)
        .createDocument("QmHash2", "Doc2", "Description2");

      // User2 creates 1 document
      await documentSignature
        .connect(user2)
        .createDocument("QmHash3", "Doc3", "Description3");
    });

    it("Should return user documents", async function () {
      const user1Docs = await documentSignature.getUserDocuments(user1.address);
      const user2Docs = await documentSignature.getUserDocuments(user2.address);

      expect(user1Docs.length).to.equal(2);
      expect(user1Docs[0]).to.equal(1);
      expect(user1Docs[1]).to.equal(2);

      expect(user2Docs.length).to.equal(1);
      expect(user2Docs[0]).to.equal(3);
    });

    it("Should check if user can sign", async function () {
      const [canSign1, reason1] = await documentSignature.canUserSign(user2.address, 1);
      expect(canSign1).to.be.true;
      expect(reason1).to.equal("");

      // User without NFT
      const userWithoutNFT = await ethers.getSigner();
      const [canSign2, reason2] = await documentSignature.canUserSign(userWithoutNFT.address, 1);
      expect(canSign2).to.be.false;
      expect(reason2).to.equal("Usuario nao possui NFT de identidade");
    });
  });

  describe("Document Management", function () {
    let documentId: number;

    beforeEach(async function () {
      await documentSignature
        .connect(user1)
        .createDocument(testDocument.ipfsHash, testDocument.title, testDocument.description);
      documentId = 1;
    });

    it("Should update document", async function () {
      const newIpfsHash = "QmNewHash123";
      const newDescription = "Updated description";

      const tx = await documentSignature
        .connect(user1)
        .updateDocument(documentId, newIpfsHash, newDescription);

      await expect(tx)
        .to.emit(documentSignature, "DocumentUpdated")
        .withArgs(documentId, newIpfsHash, 2);

      const document = await documentSignature.getDocument(documentId);
      expect(document.ipfsHash).to.equal(newIpfsHash);
      expect(document.description).to.equal(newDescription);
      expect(document.version).to.equal(2);
    });

    it("Should deactivate document", async function () {
      const reason = "Documento obsoleto";

      const tx = await documentSignature
        .connect(user1)
        .deactivateDocument(documentId, reason);

      await expect(tx)
        .to.emit(documentSignature, "DocumentDeactivated")
        .withArgs(documentId, user1.address, reason);

      const document = await documentSignature.getDocument(documentId);
      expect(document.isActive).to.be.false;
    });

    it("Should fail to update non-owned document", async function () {
      await expect(
        documentSignature
          .connect(user2)
          .updateDocument(documentId, "QmNewHash", "New desc")
      ).to.be.revertedWith("Apenas criador pode executar esta acao");
    });

    it("Should fail to deactivate non-owned document", async function () {
      await expect(
        documentSignature
          .connect(user2)
          .deactivateDocument(documentId, "reason")
      ).to.be.revertedWith("Apenas criador pode executar esta acao");
    });
  });

  describe("Gas Optimization Tests", function () {
    it("Should have reasonable gas costs for document creation", async function () {
      const tx = await documentSignature
        .connect(user1)
        .createDocument(testDocument.ipfsHash, testDocument.title, testDocument.description);
      
      const receipt = await tx.wait();
      console.log(`Document creation gas: ${receipt.gasUsed.toString()}`);
      
      // Should be under 200k gas
      expect(receipt.gasUsed.toNumber()).to.be.lessThan(200000);
    });

    it("Should have reasonable gas costs for signing", async function () {
      // Create document first
      await documentSignature
        .connect(user1)
        .createDocument(testDocument.ipfsHash, testDocument.title, testDocument.description);

      const domain = {
        name: 'DocumentSignature',
        version: '1',
        chainId: (await ethers.provider.getNetwork()).chainId,
        verifyingContract: documentSignature.address
      };

      const types = {
        DocumentSignature: [
          { name: 'documentId', type: 'uint256' },
          { name: 'signer', type: 'address' },
          { name: 'timestamp', type: 'uint256' },
          { name: 'ipfsMetadata', type: 'string' }
        ]
      };

      const message = {
        documentId: 1,
        signer: user2.address,
        timestamp: Math.floor(Date.now() / 1000),
        ipfsMetadata: "QmMeta"
      };

      const signature = await user2._signTypedData(domain, types, message);
      
      const tx = await documentSignature
        .connect(user2)
        .signDocument(1, 2, "QmMeta", signature);
      
      const receipt = await tx.wait();
      console.log(`Document signing gas: ${receipt.gasUsed.toString()}`);
      
      // Should be under 300k gas
      expect(receipt.gasUsed.toNumber()).to.be.lessThan(300000);
    });
  });
});
