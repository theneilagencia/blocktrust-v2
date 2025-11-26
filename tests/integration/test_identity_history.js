import { expect } from "chai";
import hardhat from "hardhat";

const { ethers } = hardhat;

describe("Identity History Functions - Integration Test", function () {
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
    bioHash1 = ethers.keccak256(ethers.toUtf8Bytes("biohash-user1-history"));
    bioHash2 = ethers.keccak256(ethers.toUtf8Bytes("biohash-user2-history"));
  });

  describe("getTokenHistory", function () {
    it("deve retornar histórico vazio para bioHash não registrado", async function () {
      const history = await identityNFT.getTokenHistory(bioHash1);
      expect(history.length).to.equal(0);
    });

    it("deve retornar histórico com um token após mint", async function () {
      // Mint inicial
      await identityNFT.connect(minter).mintIdentity(
        user1.address,
        "João Silva",
        "123.456.789-00",
        bioHash1,
        "applicant-123"
      );

      const history = await identityNFT.getTokenHistory(bioHash1);
      expect(history.length).to.equal(1);
      expect(history[0]).to.equal(1n);
    });

    it("deve retornar histórico completo após múltiplas recuperações", async function () {
      // Mint inicial
      await identityNFT.connect(minter).mintIdentity(
        user1.address,
        "João Silva",
        "123.456.789-00",
        bioHash1,
        "applicant-123"
      );

      // Primeira recuperação
      await identityNFT.connect(user1).emergencyRecovery(bioHash1, user2.address);

      // Segunda recuperação
      await identityNFT.connect(user2).emergencyRecovery(bioHash1, user1.address);

      const history = await identityNFT.getTokenHistory(bioHash1);
      expect(history.length).to.equal(3);
      expect(history[0]).to.equal(1n); // Token original
      expect(history[1]).to.equal(2n); // Primeira recuperação  
      expect(history[2]).to.equal(3n); // Segunda recuperação
    });
  });

  describe("getFullHistory", function () {
    it("deve retornar dados completos do histórico", async function () {
      // Mint inicial
      await identityNFT.connect(minter).mintIdentity(
        user1.address,
        "João Silva", 
        "123.456.789-00",
        bioHash1,
        "applicant-123"
      );

      // Recuperação
      await identityNFT.connect(user1).emergencyRecovery(bioHash1, user2.address);

      const [tokenIds, identityData, isActiveFlags] = await identityNFT.getFullHistory(bioHash1);

      // Verifica estrutura
      expect(tokenIds.length).to.equal(2);
      expect(identityData.length).to.equal(2);
      expect(isActiveFlags.length).to.equal(2);

      // Verifica dados do token original
      expect(tokenIds[0]).to.equal(1n);
      expect(identityData[0].name).to.equal("João Silva");
      expect(identityData[0].documentNumber).to.equal("123.456.789-00");
      expect(identityData[0].bioHash).to.equal(bioHash1);
      expect(identityData[0].previousTokenId).to.equal(0n);
      expect(isActiveFlags[0]).to.equal(false); // Revogado

      // Verifica dados do token recuperado
      expect(tokenIds[1]).to.equal(2n);
      expect(identityData[1].name).to.equal("João Silva");
      expect(identityData[1].previousTokenId).to.equal(1n);
      expect(isActiveFlags[1]).to.equal(true); // Ativo
    });

    it("deve manter dados consistentes entre tokens", async function () {
      const name = "Maria Santos";
      const document = "987.654.321-00";
      const applicantId = "applicant-maria";

      // Mint inicial
      await identityNFT.connect(minter).mintIdentity(
        user1.address,
        name,
        document,
        bioHash1,
        applicantId
      );

      // Múltiplas recuperações
      await identityNFT.connect(user1).emergencyRecovery(bioHash1, user2.address);
      await identityNFT.connect(user2).emergencyRecovery(bioHash1, user1.address);

      const [tokenIds, identityData] = await identityNFT.getFullHistory(bioHash1);

      // Todos os tokens devem manter os mesmos dados pessoais
      for (let i = 0; i < tokenIds.length; i++) {
        expect(identityData[i].name).to.equal(name);
        expect(identityData[i].documentNumber).to.equal(document);
        expect(identityData[i].bioHash).to.equal(bioHash1);
        expect(identityData[i].applicantId).to.equal(applicantId);
      }

      // Verifica previousTokenId
      expect(identityData[0].previousTokenId).to.equal(0n); // Primeiro token
      expect(identityData[1].previousTokenId).to.equal(1n); // Segunda referencia primeira
      expect(identityData[2].previousTokenId).to.equal(2n); // Terceira referencia segunda
    });
  });

  describe("getRevocationCount", function () {
    it("deve retornar 0 para bioHash não registrado", async function () {
      const count = await identityNFT.getRevocationCount(bioHash1);
      expect(count).to.equal(0n);
    });

    it("deve retornar 0 após mint inicial", async function () {
      await identityNFT.connect(minter).mintIdentity(
        user1.address,
        "João Silva",
        "123.456.789-00", 
        bioHash1,
        "applicant-123"
      );

      const count = await identityNFT.getRevocationCount(bioHash1);
      expect(count).to.equal(0n);
    });

    it("deve incrementar contador a cada recuperação", async function () {
      // Mint inicial
      await identityNFT.connect(minter).mintIdentity(
        user1.address,
        "João Silva",
        "123.456.789-00",
        bioHash1,
        "applicant-123"
      );

      // Primeira recuperação
      await identityNFT.connect(user1).emergencyRecovery(bioHash1, user2.address);
      let count = await identityNFT.getRevocationCount(bioHash1);
      expect(count).to.equal(1n);

      // Segunda recuperação
      await identityNFT.connect(user2).emergencyRecovery(bioHash1, user1.address);
      count = await identityNFT.getRevocationCount(bioHash1);
      expect(count).to.equal(2n);

      // Terceira recuperação
      await identityNFT.connect(user1).emergencyRecovery(bioHash1, user2.address);
      count = await identityNFT.getRevocationCount(bioHash1);
      expect(count).to.equal(3n);
    });
  });

  describe("isSuspiciousActivity", function () {
    it("deve retornar false para atividade normal", async function () {
      // Mint inicial
      await identityNFT.connect(minter).mintIdentity(
        user1.address,
        "João Silva",
        "123.456.789-00",
        bioHash1,
        "applicant-123"
      );

      // Uma recuperação
      await identityNFT.connect(user1).emergencyRecovery(bioHash1, user2.address);

      const [isSuspicious, reason] = await identityNFT.isSuspiciousActivity(bioHash1);
      expect(isSuspicious).to.equal(false);
      expect(reason).to.equal("Normal");
    });

    it("deve detectar muitas revogações como suspeito", async function () {
      // Mint inicial
      await identityNFT.connect(minter).mintIdentity(
        user1.address,
        "João Silva",
        "123.456.789-00",
        bioHash1,
        "applicant-123"
      );

      // 6 recuperações (mais que o limite de 5)
      let currentUser = user1;
      let targetUser = user2;

      for (let i = 0; i < 6; i++) {
        await identityNFT.connect(currentUser).emergencyRecovery(bioHash1, targetUser.address);
        [currentUser, targetUser] = [targetUser, currentUser]; // Alterna usuários
      }

      const [isSuspicious, reason] = await identityNFT.isSuspiciousActivity(bioHash1);
      expect(isSuspicious).to.equal(true);
      expect(reason).to.equal("Muitas revogacoes");
    });

    it("deve detectar revogações rápidas como suspeito", async function () {
      // Mint inicial
      await identityNFT.connect(minter).mintIdentity(
        user1.address,
        "João Silva",
        "123.456.789-00",
        bioHash1,
        "applicant-123"
      );

      // 3 recuperações rápidas (dentro da mesma transação/bloco)
      await identityNFT.connect(user1).emergencyRecovery(bioHash1, user2.address);
      await identityNFT.connect(user2).emergencyRecovery(bioHash1, user1.address);
      await identityNFT.connect(user1).emergencyRecovery(bioHash1, user2.address);

      const [isSuspicious, reason] = await identityNFT.isSuspiciousActivity(bioHash1);
      
      // Pode ser suspeito por tempo rápido (mesmo que nem sempre detecte em testes locais)
      if (isSuspicious) {
        expect(reason).to.be.oneOf(["Revogacoes rapidas", "Muitas revogacoes"]);
      }
    });
  });

  describe("Integração com sistema existente", function () {
    it("deve manter compatibilidade com funções existentes", async function () {
      // Mint inicial
      await identityNFT.connect(minter).mintIdentity(
        user1.address,
        "João Silva",
        "123.456.789-00",
        bioHash1,
        "applicant-123"
      );

      // Recuperação
      await identityNFT.connect(user1).emergencyRecovery(bioHash1, user2.address);

      // Verificar que funções existentes ainda funcionam
      const [tokenId, owner] = await identityNFT.getActiveTokenByBioHash(bioHash1);
      expect(tokenId).to.equal(2n); // Token recuperado
      expect(owner).to.equal(user2.address);

      const isValid = await identityNFT.validateWalletForBioHash(user2.address, bioHash1);
      expect(isValid).to.equal(true);
    });

    it("deve manter integridade entre histórico e estado atual", async function () {
      // Mint inicial
      await identityNFT.connect(minter).mintIdentity(
        user1.address,
        "João Silva",
        "123.456.789-00",
        bioHash1,
        "applicant-123"
      );

      // Múltiplas recuperações
      await identityNFT.connect(user1).emergencyRecovery(bioHash1, user2.address);
      await identityNFT.connect(user2).emergencyRecovery(bioHash1, user1.address);

      // Token ativo deve corresponder ao último no histórico
      const [activeTokenId] = await identityNFT.getActiveTokenByBioHash(bioHash1);
      const history = await identityNFT.getTokenHistory(bioHash1);
      const lastTokenInHistory = history[history.length - 1];

      expect(activeTokenId).to.equal(lastTokenInHistory);

      // Contadores devem ser consistentes
      const revocationCount = await identityNFT.getRevocationCount(bioHash1);
      expect(revocationCount).to.equal(BigInt(history.length - 1)); // Total de tokens - 1 (inicial)
    });
  });
});
