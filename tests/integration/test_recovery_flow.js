import { expect } from "chai";
import hardhat from "hardhat";

const { ethers } = hardhat;

describe("Identity Recovery Flow - Integration Test", function () {
  let identityNFT;
  let owner, minter, user1, user2;
  let bioHash1, bioHash2;

  beforeEach(async function () {
    // Obtém signers
    [owner, minter, user1, user2] = await ethers.getSigners();

    // Deploy do contrato
    const IdentityNFT = await ethers.getContractFactory("IdentityNFT");
    identityNFT = await IdentityNFT.deploy();
    await identityNFT.waitForDeployment();

    console.log("Contrato deployado em:", await identityNFT.getAddress());

    // Concede MINTER_ROLE
    const MINTER_ROLE = ethers.keccak256(
      ethers.toUtf8Bytes("MINTER_ROLE")
    );
    await identityNFT.grantRole(MINTER_ROLE, minter.address);

    // BioHashes de teste
    bioHash1 = ethers.keccak256(ethers.toUtf8Bytes("biohash-user1"));
    bioHash2 = ethers.keccak256(ethers.toUtf8Bytes("biohash-user2"));
  });

  describe("Fluxo completo de recuperação", function () {
    it("Deve permitir mint, recuperação e validação", async function () {
      // 1. Mint do NFT
      const tx = await identityNFT.connect(minter).mintIdentity(
        user1.address,
        "João Silva",
        "123.456.789-00",
        bioHash1,
        "applicant-123"
      );

      const receipt = await tx.wait();
      const events = await identityNFT.queryFilter("IdentityMinted");
      const event = events[events.length - 1];
      const tokenId = event.args.tokenId;

      console.log("NFT mintado com tokenId:", tokenId.toString());
      expect(tokenId).to.equal(1n);

      // 2. Recuperação: Consulta por bioHash
      const [recoveredTokenId, recoveredOwner] = await identityNFT.getActiveTokenByBioHash(bioHash1);

      expect(recoveredTokenId).to.equal(tokenId);
      expect(recoveredOwner).to.equal(user1.address);

      // 3. Validação: Verifica se endereço corresponde ao bioHash
      const isValid = await identityNFT.validateWalletForBioHash(
        user1.address,
        bioHash1
      );

      expect(isValid).to.be.true;

      // 4. Validação negativa: Endereço errado
      const isInvalid = await identityNFT.validateWalletForBioHash(
        owner.address,
        bioHash1
      );

      expect(isInvalid).to.be.false;

      // 5. Recupera dados da identidade
      const identity = await identityNFT.identities(tokenId);

      expect(identity.name).to.equal("João Silva");
      expect(identity.documentNumber).to.equal("123.456.789-00");
      expect(identity.bioHash).to.equal(bioHash1);
      expect(identity.isActive).to.be.true;
      expect(identity.applicantId).to.equal("applicant-123");
    });

    it("Deve impedir mint duplicado para mesmo bioHash", async function () {
      // Primeiro mint
      await identityNFT.connect(minter).mintIdentity(
        user1.address,
        "João Silva",
        "123.456.789-00",
        bioHash1,
        "applicant-123"
      );

      // Segundo mint com mesmo bioHash deve falhar
      await expect(
        identityNFT.connect(minter).mintIdentity(
          user1.address,
          "João Silva",
          "123.456.789-00",
          bioHash1,
          "applicant-123"
        )
      ).to.be.revertedWith("Identidade ja existe para este bioHash");
    });

    it("Deve permitir múltiplos usuários com bioHashes diferentes", async function () {
      // Mint para user1
      await identityNFT.connect(minter).mintIdentity(
        user1.address,
        "João Silva",
        "123.456.789-00",
        bioHash1,
        "applicant-123"
      );

      // Mint para user2 com bioHash diferente
      await identityNFT.connect(minter).mintIdentity(
        user2.address,
        "Maria Santos",
        "987.654.321-00",
        bioHash2,
        "applicant-456"
      );

      // Verifica que ambos podem ser recuperados
      const [tokenId1] = await identityNFT.getActiveTokenByBioHash(bioHash1);
      const [tokenId2] = await identityNFT.getActiveTokenByBioHash(bioHash2);

      expect(tokenId1).to.equal(1n);
      expect(tokenId2).to.equal(2n);

      // Verifica que validações são independentes
      const isValid1 = await identityNFT.validateWalletForBioHash(
        user1.address,
        bioHash1
      );
      const isValid2 = await identityNFT.validateWalletForBioHash(
        user2.address,
        bioHash2
      );

      expect(isValid1).to.be.true;
      expect(isValid2).to.be.true;

      // Cross-validation deve falhar
      const isCrossValid = await identityNFT.validateWalletForBioHash(
        user1.address,
        bioHash2
      );

      expect(isCrossValid).to.be.false;
    });
  });

  describe("Controle de acesso", function () {
    it("Apenas minter pode mintar NFTs", async function () {
      await expect(
        identityNFT.connect(user1).mintIdentity(
          user1.address,
          "João Silva",
          "123.456.789-00",
          bioHash1,
          "applicant-123"
        )
      ).to.be.reverted;
    });
  });
});
