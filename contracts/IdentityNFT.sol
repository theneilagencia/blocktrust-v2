// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title IdentityNFT - Self-Custodial Identity System
 * @dev NFT de identidade com vinculação biométrica para sistema self-custodial
 * @author Blocktrust Team
 * @notice Sistema que elimina custódia centralizada de chaves privadas
 */
contract IdentityNFT is ERC721, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant KYC_PROVIDER_ROLE = keccak256("KYC_PROVIDER_ROLE");
    
    // Mapeamento de bioHash para histórico de tokens
    mapping(bytes32 => uint256[]) public bioHashHistory;
    
    // Contador de revogações por bioHash
    mapping(bytes32 => uint256) public revocationCount;
    
    // Mapeamento de bioHash para token ativo
    mapping(bytes32 => uint256) public bioHashToActiveToken;
    
    // Mapeamento de token para bioHash (para validações)
    mapping(uint256 => bytes32) public tokenToBioHash;
    
    // Estrutura de dados do NFT
    struct IdentityData {
        string name;
        string documentNumber;
        bytes32 bioHash;
        uint256 kycTimestamp;
        bool isActive;
        uint256 previousTokenId; // Para rastreamento de histórico
        string applicantId; // ID do Sumsub para referência
    }
    
    mapping(uint256 => IdentityData) public identities;
    uint256 public totalSupply;
    
    // Eventos
    event IdentityMinted(uint256 indexed tokenId, address indexed owner, bytes32 indexed bioHash, string applicantId);
    event IdentityRevoked(uint256 indexed oldTokenId, uint256 indexed newTokenId, bytes32 indexed bioHash);
    event BioHashLinked(bytes32 indexed bioHash, uint256 indexed tokenId);
    event IdentityRecovered(bytes32 indexed bioHash, uint256 indexed tokenId, address indexed owner);

    constructor() ERC721("BlocktrustID", "BTID") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
    }

    /**
     * @dev Mint de novo NFT de identidade com bioHash
     * @param to Endereço que receberá o NFT (gerado deterministicamente)
     * @param name Nome completo do usuário
     * @param documentNumber Número do documento
     * @param bioHash Hash biométrico único do Sumsub
     * @param applicantId ID do aplicante no Sumsub
     */
    function mintIdentity(
        address to,
        string memory name,
        string memory documentNumber,
        bytes32 bioHash,
        string memory applicantId
    ) public onlyRole(MINTER_ROLE) returns (uint256) {
        require(to != address(0), "Endereco invalido");
        require(bioHash != bytes32(0), "BioHash invalido");
        require(bytes(name).length > 0, "Nome obrigatorio");
        require(bytes(documentNumber).length > 0, "Documento obrigatorio");
        
        // Verifica se já existe token ativo para este bioHash
        uint256 existingToken = bioHashToActiveToken[bioHash];
        require(existingToken == 0, "Identidade ja existe para este bioHash");
        
        totalSupply++;
        uint256 newTokenId = totalSupply;
        
        // Cria a identidade
        identities[newTokenId] = IdentityData({
            name: name,
            documentNumber: documentNumber,
            bioHash: bioHash,
            kycTimestamp: block.timestamp,
            isActive: true,
            previousTokenId: 0,
            applicantId: applicantId
        });
        
        // Estabelece vínculos
        bioHashToActiveToken[bioHash] = newTokenId;
        tokenToBioHash[newTokenId] = bioHash;
        
        // Adiciona ao histórico
        bioHashHistory[bioHash].push(newTokenId);
        
        // Mint do NFT
        _safeMint(to, newTokenId);
        
        emit IdentityMinted(newTokenId, to, bioHash, applicantId);
        emit BioHashLinked(bioHash, newTokenId);
        
        return newTokenId;
    }

    /**
     * @dev Recupera token ativo por bioHash
     * @param bioHash Hash biométrico para busca
     * @return tokenId ID do token ativo
     * @return owner Proprietário atual do token
     */
    function getActiveTokenByBioHash(bytes32 bioHash) 
        public 
        view 
        returns (uint256 tokenId, address owner) 
    {
        tokenId = bioHashToActiveToken[bioHash];
        require(tokenId != 0, "Nenhuma identidade encontrada");
        owner = ownerOf(tokenId);
        
        return (tokenId, owner);
    }
    
    /**
     * @dev Verifica se um endereço corresponde ao bioHash
     * @param walletAddress Endereço da wallet a ser verificado
     * @param bioHash Hash biométrico
     * @return isValid True se o endereço corresponde ao bioHash
     */
    function validateWalletForBioHash(address walletAddress, bytes32 bioHash) 
        public 
        view 
        returns (bool isValid) 
    {
        uint256 tokenId = bioHashToActiveToken[bioHash];
        if (tokenId == 0) return false;
        
        address owner = ownerOf(tokenId);
        return owner == walletAddress;
    }
    
    /**
     * @dev Recuperação de emergência - permite criar novo token para mesmo bioHash
     * @param bioHash Hash biométrico do usuário
     * @param newWalletAddress Novo endereço da wallet regenerada
     */
    function emergencyRecovery(bytes32 bioHash, address newWalletAddress) 
        public 
        returns (uint256 newTokenId) 
    {
        uint256 oldTokenId = bioHashToActiveToken[bioHash];
        require(oldTokenId != 0, "Identidade nao encontrada");
        require(ownerOf(oldTokenId) == msg.sender, "Nao e o proprietario");
        
        // Desativa token antigo
        identities[oldTokenId].isActive = false;
        
        // Cria novo token
        totalSupply++;
        newTokenId = totalSupply;
        
        IdentityData memory oldData = identities[oldTokenId];
        identities[newTokenId] = IdentityData({
            name: oldData.name,
            documentNumber: oldData.documentNumber,
            bioHash: bioHash,
            kycTimestamp: block.timestamp,
            isActive: true,
            previousTokenId: oldTokenId,
            applicantId: oldData.applicantId
        });
        
        // Atualiza vínculos
        bioHashToActiveToken[bioHash] = newTokenId;
        tokenToBioHash[newTokenId] = bioHash;
        
        // Adiciona ao histórico e incrementa contador de revogações
        bioHashHistory[bioHash].push(newTokenId);
        revocationCount[bioHash]++;
        
        // Mint novo NFT
        _safeMint(newWalletAddress, newTokenId);
        
        // Burn do token antigo
        _burn(oldTokenId);
        
        emit IdentityRevoked(oldTokenId, newTokenId, bioHash);
        
        return newTokenId;
    }
    
    /**
     * @dev Retorna histórico completo de tokens para um bioHash
     * @param bioHash Hash biométrico para consulta
     * @return tokenIds Array de todos os tokens já criados para este bioHash
     */
    function getTokenHistory(bytes32 bioHash) 
        public 
        view 
        returns (uint256[] memory tokenIds) 
    {
        return bioHashHistory[bioHash];
    }
    
    /**
     * @dev Retorna informações completas do histórico de identidade
     * @param bioHash Hash biométrico para consulta
     * @return tokenIds Array de tokens
     * @return identityData Array com dados de cada token
     * @return isActiveFlags Array indicando quais tokens estão ativos
     */
    function getFullHistory(bytes32 bioHash) 
        public 
        view 
        returns (
            uint256[] memory tokenIds, 
            IdentityData[] memory identityData,
            bool[] memory isActiveFlags
        ) 
    {
        tokenIds = bioHashHistory[bioHash];
        identityData = new IdentityData[](tokenIds.length);
        isActiveFlags = new bool[](tokenIds.length);
        
        for (uint256 i = 0; i < tokenIds.length; i++) {
            identityData[i] = identities[tokenIds[i]];
            isActiveFlags[i] = identities[tokenIds[i]].isActive;
        }
        
        return (tokenIds, identityData, isActiveFlags);
    }
    
    /**
     * @dev Retorna o número de revogações para um bioHash
     * @param bioHash Hash biométrico para consulta
     * @return count Número de vezes que identidade foi revogada/recuperada
     */
    function getRevocationCount(bytes32 bioHash) 
        public 
        view 
        returns (uint256 count) 
    {
        return revocationCount[bioHash];
    }
    
    /**
     * @dev Detecta atividade suspeita baseada no histórico
     * @param bioHash Hash biométrico para análise
     * @return isSuspicious True se atividade for considerada suspeita
     * @return reason Motivo da suspeita
     */
    function isSuspiciousActivity(bytes32 bioHash) 
        public 
        view 
        returns (bool isSuspicious, string memory reason) 
    {
        uint256 revocations = revocationCount[bioHash];
        uint256[] memory tokens = bioHashHistory[bioHash];
        
        // Mais de 5 revogações é suspeito
        if (revocations > 5) {
            return (true, "Muitas revogacoes");
        }
        
        // Mais de 3 revogações em menos de 24 horas é suspeito
        if (revocations >= 3 && tokens.length >= 3) {
            uint256 firstToken = tokens[0];
            uint256 lastToken = tokens[tokens.length - 1];
            uint256 timeSpan = identities[lastToken].kycTimestamp - identities[firstToken].kycTimestamp;
            
            if (timeSpan < 24 hours) {
                return (true, "Revogacoes rapidas");
            }
        }
        
        return (false, "Normal");
    }
    
    /**
     * @dev Override para tornar NFTs não transferíveis (soulbound)
     */
    function _update(address to, uint256 tokenId, address auth) 
        internal 
        override 
        returns (address) 
    {
        address from = _ownerOf(tokenId);
        
        // Permite mint (from == address(0)) e burn (to == address(0))
        // Bloqueia transferências (from != address(0) && to != address(0))
        if (from != address(0) && to != address(0)) {
            revert("SBT: transfer proibido");
        }
        
        return super._update(to, tokenId, auth);
    }
    
    /**
     * @dev Override do tokenURI para retornar metadados on-chain
     */
    function tokenURI(uint256 tokenId) 
        public 
        view 
        override 
        returns (string memory) 
    {
        require(_ownerOf(tokenId) != address(0), "Token inexistente");
        
        IdentityData memory identity = identities[tokenId];
        
        // Metadados básicos em formato JSON
        return string(abi.encodePacked(
            '{"name": "Blocktrust Identity #',
            _toString(tokenId),
            '", "description": "Identidade digital verificada", "attributes": [',
            '{"trait_type": "Status", "value": "', 
            identity.isActive ? 'Ativo' : 'Inativo', 
            '"}, {"trait_type": "KYC Timestamp", "value": "',
            _toString(identity.kycTimestamp),
            '"}]}'
        ));
    }
    
    /**
     * @dev Função auxiliar para converter uint256 para string
     */
    function _toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        
        uint256 temp = value;
        uint256 digits;
        
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        
        bytes memory buffer = new bytes(digits);
        
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        
        return string(buffer);
    }
    
    /**
     * @dev Verifica suporte a interfaces
     */
    function supportsInterface(bytes4 interfaceId) 
        public 
        view 
        override(ERC721, AccessControl) 
        returns (bool) 
    {
        return super.supportsInterface(interfaceId);
    }

    // ============================================================
    // FUNÇÕES LEGACY PARA COMPATIBILIDADE
    // ============================================================
    
    /**
     * @dev Função legacy mantida para compatibilidade
     * @notice Deprecated: Use mintIdentity() instead
     */
    function mintIdentityNFT(
        address user,
        string memory tokenURIData,
        uint256 previousId
    ) external onlyRole(MINTER_ROLE) returns (uint256) {
        // Para compatibilidade, cria um bioHash baseado nos dados
        bytes32 legacyBioHash = keccak256(abi.encodePacked(user, tokenURIData, block.timestamp));
        
        return mintIdentity(
            user,
            "Legacy User",
            "LEGACY",
            legacyBioHash,
            "legacy-migration"
        );
    }
    
    /**
     * @dev Função legacy para verificar se token está ativo
     * @notice Deprecated: Use identities[tokenId].isActive instead
     */
    function isActive(uint256 tokenId) external view returns (bool) {
        return _ownerOf(tokenId) != address(0) && identities[tokenId].isActive;
    }
}
