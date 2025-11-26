import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { DocumentUpload } from './DocumentUpload';
import { DocumentSignature } from './DocumentSignature';
import { GaslessTransaction } from './GaslessTransaction';
import { useGaslessTransactions } from '../hooks/useGasless';
import { useDocumentSignature } from '../hooks/useDocumentSignature';

interface BlocktrustExampleProps {
  signer?: ethers.Signer;
}

export function BlocktrustGaslessExample({ signer }: BlocktrustExampleProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'upload' | 'sign' | 'gasless'>('overview');
  const [selectedDocument, setSelectedDocument] = useState<number | null>(null);
  
  const documentSignature = useDocumentSignature();
  const gasless = useGaslessTransactions(signer);

  const [gasStats, setGasStats] = useState({
    totalSaved: '0',
    transactionsSponsored: 0,
    currentBalance: '0'
  });

  useEffect(() => {
    // Fetch gas analytics
    if (gasless.isAvailable) {
      gasless.getAnalytics('week').then(analytics => {
        setGasStats({
          totalSaved: analytics.totalGasSaved,
          transactionsSponsored: analytics.totalTransactions,
          currentBalance: '0' // Would be fetched from smart account
        });
      });
    }
  }, [gasless]);

  const handleGaslessDocumentCreation = async (
    file: File,
    title: string,
    description: string
  ) => {
    if (!signer || !gasless.canExecuteTransactions) {
      throw new Error('Gasless transactions not available');
    }

    try {
      // 1. Upload document to IPFS first
      const metadata = {
        title,
        description,
        creator: await signer.getAddress(),
        timestamp: Date.now(),
        mimeType: file.type,
        size: file.size
      };

      // This would typically use the IPFS service
      const ipfsHash = 'QmSampleHash' + Date.now();

      // 2. Prepare contract call data
      const contractInterface = new ethers.Interface([
        'function createDocument(string ipfsHash, string title, string description) returns (uint256)'
      ]);

      const callData = contractInterface.encodeFunctionData('createDocument', [
        ipfsHash,
        title,
        description
      ]);

      // 3. Execute gasless transaction
      const result = await gasless.executeGaslessTransaction(
        documentSignature.contractAddress || '',
        callData
      );

      if (result.success) {
        // Refresh documents
        await documentSignature.fetchUserDocuments();
        return result;
      } else {
        throw new Error(result.error || 'Transaction failed');
      }
    } catch (error) {
      console.error('Gasless document creation failed:', error);
      throw error;
    }
  };

  const handleGaslessSignature = async (
    documentId: number,
    identityTokenId: number
  ) => {
    if (!signer || !gasless.canExecuteTransactions) {
      throw new Error('Gasless transactions not available');
    }

    try {
      // 1. Prepare signature metadata
      const signatureMetadata = {
        documentId: documentId.toString(),
        signer: await signer.getAddress(),
        timestamp: Date.now(),
        signatureType: 'EIP712'
      };

      const metadataHash = 'QmSignatureMetadata' + Date.now();

      // 2. Create EIP-712 signature
      const domain = {
        name: 'DocumentSignature',
        version: '1',
        chainId: await signer.provider?.getNetwork().then(n => n.chainId),
        verifyingContract: documentSignature.contractAddress
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
        documentId,
        signer: await signer.getAddress(),
        timestamp: Date.now(),
        ipfsMetadata: metadataHash
      };

      const signature = await signer.signTypedData(domain, types, message);

      // 3. Prepare contract call
      const contractInterface = new ethers.Interface([
        'function signDocument(uint256 documentId, uint256 identityTokenId, string ipfsMetadata, bytes signature) returns (uint256)'
      ]);

      const callData = contractInterface.encodeFunctionData('signDocument', [
        documentId,
        identityTokenId,
        metadataHash,
        signature
      ]);

      // 4. Execute gasless transaction
      const result = await gasless.executeGaslessTransaction(
        documentSignature.contractAddress || '',
        callData
      );

      if (result.success) {
        return result;
      } else {
        throw new Error(result.error || 'Signature transaction failed');
      }
    } catch (error) {
      console.error('Gasless signature failed:', error);
      throw error;
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Blocktrust</h1>
            <p className="text-gray-600 mt-1">
              Decentralized Document Signature Platform with Gasless Transactions
            </p>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-500">Network</div>
            <div className="font-semibold text-blue-600">
              {gasless.configuration?.chainId === 137 ? 'Polygon Mainnet' : 'Amoy Testnet'}
            </div>
          </div>
        </div>
      </div>

      {/* Gas Savings Overview */}
      {gasless.isAvailable && (
        <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-lg border border-green-200 p-6">
          <h2 className="text-xl font-semibold text-green-800 mb-4">⚡ Gas Savings Enabled</h2>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{gasStats.totalSaved} MATIC</div>
              <div className="text-sm text-gray-600">Total Saved</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{gasStats.transactionsSponsored}</div>
              <div className="text-sm text-gray-600">Sponsored Transactions</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{gasStats.currentBalance} MATIC</div>
              <div className="text-sm text-gray-600">Smart Account Balance</div>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            {[
              { id: 'overview', label: 'Overview', icon: '📊' },
              { id: 'upload', label: 'Upload Document', icon: '📤' },
              { id: 'sign', label: 'Sign Document', icon: '✍️' },
              { id: 'gasless', label: 'Gasless Settings', icon: '⚡' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-4 px-2 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">
                    {documentSignature.stats?.[0] || 0}
                  </div>
                  <div className="text-sm text-gray-600">Total Documents</div>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">
                    {documentSignature.stats?.[1] || 0}
                  </div>
                  <div className="text-sm text-gray-600">Total Signatures</div>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-purple-600">
                    {documentSignature.documents.length}
                  </div>
                  <div className="text-sm text-gray-600">My Documents</div>
                </div>
                <div className="bg-orange-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-orange-600">
                    {documentSignature.stats?.[2] || 0}
                  </div>
                  <div className="text-sm text-gray-600">Active Documents</div>
                </div>
              </div>

              {/* Recent Documents */}
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-3">Recent Documents</h3>
                {documentSignature.documents.length > 0 ? (
                  <div className="space-y-3">
                    {documentSignature.documents.slice(0, 5).map(doc => (
                      <div key={doc.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                        <div>
                          <h4 className="font-medium text-gray-900">{doc.title}</h4>
                          <p className="text-sm text-gray-600">{doc.description}</p>
                          <div className="text-xs text-gray-500 mt-1">
                            Created: {new Date(doc.createdAt * 1000).toLocaleDateString()}
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
                            {doc.totalSignatures} signatures
                          </span>
                          <button
                            onClick={() => setSelectedDocument(doc.id)}
                            className="text-blue-600 hover:text-blue-800 text-sm"
                          >
                            View
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <div className="text-4xl mb-4">📄</div>
                    <div>No documents yet. Upload your first document to get started!</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Upload Document Tab */}
          {activeTab === 'upload' && (
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Upload New Document</h3>
              {gasless.isAvailable && (
                <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center">
                    <span className="text-green-600 mr-2">⚡</span>
                    <span className="text-green-800 text-sm">
                      Gasless transactions enabled - you won't pay gas fees!
                    </span>
                  </div>
                </div>
              )}
              <DocumentUpload
                onUpload={gasless.isAvailable ? handleGaslessDocumentCreation : undefined}
                isLoading={documentSignature.loading}
                error={documentSignature.error}
              />
            </div>
          )}

          {/* Sign Document Tab */}
          {activeTab === 'sign' && (
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Sign Document</h3>
              {gasless.isAvailable && (
                <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center">
                    <span className="text-green-600 mr-2">⚡</span>
                    <span className="text-green-800 text-sm">
                      Gasless signatures enabled - sign documents for free!
                    </span>
                  </div>
                </div>
              )}
              <DocumentSignature
                selectedDocumentId={selectedDocument}
                onSign={gasless.isAvailable ? handleGaslessSignature : undefined}
                isLoading={documentSignature.loading}
                error={documentSignature.error}
              />
            </div>
          )}

          {/* Gasless Settings Tab */}
          {activeTab === 'gasless' && (
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Gasless Transaction Settings</h3>
              <GaslessTransaction
                signer={signer}
                onTransactionComplete={(result) => {
                  if (result.success) {
                    // Refresh documents after gasless transaction
                    documentSignature.fetchUserDocuments();
                  }
                }}
                showAnalytics={true}
              />
            </div>
          )}
        </div>
      </div>

      {/* Error Display */}
      {(documentSignature.error || gasless.error) && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <svg className="w-5 h-5 text-red-600 mt-1" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <div>
              <h4 className="font-medium text-red-800">Error</h4>
              <p className="text-red-700 mt-1">
                {documentSignature.error || gasless.error}
              </p>
              <div className="mt-2 space-x-3">
                {documentSignature.error && (
                  <button
                    onClick={documentSignature.clearError}
                    className="text-sm text-red-600 hover:text-red-800 underline"
                  >
                    Clear Document Error
                  </button>
                )}
                {gasless.error && (
                  <button
                    onClick={gasless.clearError}
                    className="text-sm text-red-600 hover:text-red-800 underline"
                  >
                    Clear Gasless Error
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Loading State */}
      {(documentSignature.loading || gasless.isLoading) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 flex items-center space-x-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="text-gray-700">
              {gasless.isLoading ? 'Processing gasless transaction...' : 'Loading...'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
