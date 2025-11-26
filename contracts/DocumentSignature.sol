// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "./IdentityNFT.sol";

/**
 * @title DocumentSignature
 * @dev Gerenciamento de assinaturas de documentos na Polygon
 * @notice Este contrato será deployado na Polygon Amoy (testnet) e depois na Polygon Mainnet
 * @author Blocktrust Team
 */
contract DocumentSignature is AccessControl, EIP712 {
    using ECDSA for bytes32;

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant DOCUMENT_CREATOR_ROLE = keccak256("DOCUMENT_CREATOR_ROLE");

    // Integração com NFT de identidade existente
    IdentityNFT public immutable identityNFT;

    struct Document {
        string ipfsHash;          // Hash IPFS do documento
        string title;             // Título do documento
        string description;       // Descrição
        address creator;          // Endereço Polygon do criador
        uint256 createdAt;        // Timestamp
        bool isActive;            // Status
        uint256 totalSignatures; // Contador de assinaturas
        uint256 version;          // Versão do documento
    }

    struct Signature {
        uint256 identityTokenId;  // ID do NFT de identidade
        address signer;           // Endereço Polygon do assinante
        uint256 timestamp;        // Quando foi assinado
        string ipfsMetadata;      // Metadados adicionais no IPFS
        bytes signature;          // Assinatura EIP-712
        bool isValid;             // Se ainda é válida
        uint256 documentVersion;  // Versão do documento quando foi assinado
        string reason;            // Motivo da assinatura/revogação
    }

    struct MultiSignRequest {
        uint256 documentId;
        address[] requiredSigners;  // Endereços Polygon
        uint256 deadline;
        uint256 signedCount;
        bool isComplete;
        string description;
        mapping(address => bool) hasSigned;
        mapping(address => uint256) signatureTimestamp;
    }

    // Mappings
    mapping(uint256 => Document) public documents;
    mapping(uint256 => mapping(address => Signature)) public documentSignatures;
    mapping(uint256 => address[]) public documentSigners;
    mapping(uint256 => MultiSignRequest) public multiSignRequests;
    mapping(address => uint256[]) public userSignedDocuments;

    // Counters
    uint256 public nextDocumentId = 1;
    uint256 public nextMultiSignId = 1;

    // EIP-712 Type Hashes
    bytes32 private constant DOCUMENT_SIGNATURE_TYPEHASH = keccak256(
        "DocumentSignature(uint256 documentId,address signer,uint256 timestamp,string ipfsMetadata)"
    );

    // Events
    event DocumentCreated(
        uint256 indexed documentId, 
        string ipfsHash, 
        address indexed creator,
        string title
    );
    
    event DocumentSigned(
        uint256 indexed documentId, 
        address indexed signer, 
        uint256 indexed tokenId,
        string ipfsMetadata
    );
    
    event SignatureRevoked(
        uint256 indexed documentId, 
        address indexed signer, 
        string reason
    );
    
    event MultiSignRequestCreated(
        uint256 indexed requestId,
        uint256 indexed documentId,
        address[] requiredSigners,
        uint256 deadline
    );
    
    event MultiSignCompleted(
        uint256 indexed requestId,
        uint256 indexed documentId
    );

    event DocumentUpdated(
        uint256 indexed documentId,
        string newIpfsHash,
        uint256 newVersion
    );

    modifier onlyValidIdentity(address user) {
        require(
            identityNFT.balanceOf(user) > 0,
            "Usuario deve ter NFT de identidade na Polygon"
        );
        _;
    }

    modifier onlyActiveDocument(uint256 documentId) {
        require(documents[documentId].isActive, "Documento nao esta ativo");
        _;
    }

    modifier onlyDocumentCreator(uint256 documentId) {
        require(
            documents[documentId].creator == msg.sender,
            "Apenas criador pode modificar documento"
        );
        _;
    }

    constructor(address _identityNFT) EIP712("BlocktrustDocumentSignature", "1") {
        identityNFT = IdentityNFT(_identityNFT);
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(DOCUMENT_CREATOR_ROLE, msg.sender);
    }

    /**
     * @dev Criar novo documento com hash IPFS
     */
    function createDocument(
        string memory ipfsHash,
        string memory title,
        string memory description
    ) external onlyValidIdentity(msg.sender) returns (uint256 documentId) {
        require(bytes(ipfsHash).length > 0, "IPFS hash obrigatorio");
        require(bytes(title).length > 0, "Titulo obrigatorio");

        documentId = nextDocumentId++;

        documents[documentId] = Document({
            ipfsHash: ipfsHash,
            title: title,
            description: description,
            creator: msg.sender,
            createdAt: block.timestamp,
            isActive: true,
            totalSignatures: 0,
            version: 1
        });

        emit DocumentCreated(documentId, ipfsHash, msg.sender, title);
    }

    /**
     * @dev Assinar documento com EIP-712
     */
    function signDocument(
        uint256 documentId,
        string memory ipfsMetadata,
        bytes memory signature
    ) external onlyValidIdentity(msg.sender) onlyActiveDocument(documentId) {
        require(
            documentSignatures[documentId][msg.sender].timestamp == 0,
            "Usuario ja assinou este documento"
        );

        // Verificar se usuário tem NFT de identidade válido
        uint256 tokenId = getUserActiveTokenId(msg.sender);
        require(tokenId > 0, "NFT de identidade nao encontrado");

        // Verificar assinatura EIP-712
        bytes32 structHash = keccak256(
            abi.encode(
                DOCUMENT_SIGNATURE_TYPEHASH,
                documentId,
                msg.sender,
                block.timestamp,
                keccak256(bytes(ipfsMetadata))
            )
        );
        bytes32 hash = _hashTypedDataV4(structHash);
        address recoveredSigner = hash.recover(signature);
        require(recoveredSigner == msg.sender, "Assinatura invalida");

        // Criar assinatura
        documentSignatures[documentId][msg.sender] = Signature({
            identityTokenId: tokenId,
            signer: msg.sender,
            timestamp: block.timestamp,
            ipfsMetadata: ipfsMetadata,
            signature: signature,
            isValid: true,
            documentVersion: documents[documentId].version,
            reason: "Signed"
        });

        documentSigners[documentId].push(msg.sender);
        userSignedDocuments[msg.sender].push(documentId);
        documents[documentId].totalSignatures++;

        emit DocumentSigned(documentId, msg.sender, tokenId, ipfsMetadata);
    }

    /**
     * @dev Verificar validade de assinatura
     */
    function verifySignature(
        uint256 documentId,
        address signer
    ) external view returns (bool isValid, Signature memory signatureData) {
        signatureData = documentSignatures[documentId][signer];
        
        if (signatureData.timestamp == 0) {
            return (false, signatureData);
        }

        // Verificar se NFT ainda é válido
        bool hasValidNFT = identityNFT.balanceOf(signer) > 0;
        
        isValid = signatureData.isValid && 
                 hasValidNFT && 
                 documents[documentId].isActive;
    }

    /**
     * @dev Listar todas assinaturas de um documento
     */
    function getDocumentSignatures(
        uint256 documentId
    ) external view returns (address[] memory signers, Signature[] memory signatures) {
        address[] memory documentSignersList = documentSigners[documentId];
        signers = documentSignersList;
        signatures = new Signature[](documentSignersList.length);

        for (uint256 i = 0; i < documentSignersList.length; i++) {
            signatures[i] = documentSignatures[documentId][documentSignersList[i]];
        }
    }

    /**
     * @dev Criar requisição multi-assinatura
     */
    function createMultiSignRequest(
        uint256 documentId,
        address[] memory requiredSigners,
        uint256 deadline,
        string memory description
    ) external onlyDocumentCreator(documentId) returns (uint256 requestId) {
        require(deadline > block.timestamp, "Deadline deve ser no futuro");
        require(requiredSigners.length > 0, "Deve ter pelo menos um assinante");

        requestId = nextMultiSignId++;

        MultiSignRequest storage request = multiSignRequests[requestId];
        request.documentId = documentId;
        request.requiredSigners = requiredSigners;
        request.deadline = deadline;
        request.signedCount = 0;
        request.isComplete = false;
        request.description = description;

        emit MultiSignRequestCreated(requestId, documentId, requiredSigners, deadline);
    }

    /**
     * @dev Assinar requisição multi-assinatura
     */
    function signMultiSignRequest(
        uint256 requestId,
        string memory ipfsMetadata,
        bytes memory signature
    ) external onlyValidIdentity(msg.sender) {
        MultiSignRequest storage request = multiSignRequests[requestId];
        require(!request.isComplete, "Requisicao ja completa");
        require(block.timestamp <= request.deadline, "Deadline expirado");
        require(!request.hasSigned[msg.sender], "Usuario ja assinou");

        // Verificar se usuário está na lista de assinantes requeridos
        bool isRequired = false;
        for (uint256 i = 0; i < request.requiredSigners.length; i++) {
            if (request.requiredSigners[i] == msg.sender) {
                isRequired = true;
                break;
            }
        }
        require(isRequired, "Usuario nao esta na lista de assinantes");

        // Assinar documento principal
        signDocument(request.documentId, ipfsMetadata, signature);

        // Marcar como assinado na requisição
        request.hasSigned[msg.sender] = true;
        request.signatureTimestamp[msg.sender] = block.timestamp;
        request.signedCount++;

        // Verificar se completou todas as assinaturas
        if (request.signedCount == request.requiredSigners.length) {
            request.isComplete = true;
            emit MultiSignCompleted(requestId, request.documentId);
        }
    }

    /**
     * @dev Invalidar assinaturas de um usuário (para revogação de NFT)
     */
    function invalidateUserSignatures(
        address user,
        string memory reason
    ) external onlyRole(ADMIN_ROLE) {
        uint256[] memory userDocs = userSignedDocuments[user];
        
        for (uint256 i = 0; i < userDocs.length; i++) {
            uint256 docId = userDocs[i];
            if (documentSignatures[docId][user].isValid) {
                documentSignatures[docId][user].isValid = false;
                documentSignatures[docId][user].reason = reason;
                documents[docId].totalSignatures--;
                
                emit SignatureRevoked(docId, user, reason);
            }
        }
    }

    /**
     * @dev Atualizar documento com nova versão
     */
    function updateDocument(
        uint256 documentId,
        string memory newIpfsHash
    ) external onlyDocumentCreator(documentId) onlyActiveDocument(documentId) {
        require(bytes(newIpfsHash).length > 0, "IPFS hash obrigatorio");
        
        documents[documentId].ipfsHash = newIpfsHash;
        documents[documentId].version++;

        emit DocumentUpdated(documentId, newIpfsHash, documents[documentId].version);
    }

    /**
     * @dev Desativar documento
     */
    function deactivateDocument(
        uint256 documentId
    ) external onlyDocumentCreator(documentId) {
        documents[documentId].isActive = false;
    }

    /**
     * @dev Obter token ID ativo do usuário
     */
    function getUserActiveTokenId(address user) public view returns (uint256) {
        if (identityNFT.balanceOf(user) == 0) {
            return 0;
        }
        // Assumindo que o usuário tem apenas um token ativo
        // Em implementação mais complexa, seria necessário iterar pelos tokens
        return 1; // Simplificação - implementar lógica real baseada no IdentityNFT
    }

    /**
     * @dev Obter documentos criados por um usuário
     */
    function getUserCreatedDocuments(
        address user
    ) external view returns (uint256[] memory documentIds) {
        uint256 count = 0;
        
        // Contar documentos
        for (uint256 i = 1; i < nextDocumentId; i++) {
            if (documents[i].creator == user) {
                count++;
            }
        }

        // Preencher array
        documentIds = new uint256[](count);
        uint256 index = 0;
        for (uint256 i = 1; i < nextDocumentId; i++) {
            if (documents[i].creator == user) {
                documentIds[index] = i;
                index++;
            }
        }
    }

    /**
     * @dev Obter status da requisição multi-assinatura
     */
    function getMultiSignStatus(
        uint256 requestId
    ) external view returns (
        uint256 documentId,
        address[] memory requiredSigners,
        uint256 deadline,
        uint256 signedCount,
        bool isComplete,
        string memory description
    ) {
        MultiSignRequest storage request = multiSignRequests[requestId];
        return (
            request.documentId,
            request.requiredSigners,
            request.deadline,
            request.signedCount,
            request.isComplete,
            request.description
        );
    }

    /**
     * @dev Verificar se usuário assinou requisição multi-sig
     */
    function hasSignedMultiSig(
        uint256 requestId,
        address user
    ) external view returns (bool, uint256 timestamp) {
        MultiSignRequest storage request = multiSignRequests[requestId];
        return (
            request.hasSigned[user],
            request.signatureTimestamp[user]
        );
    }
}
