import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:10000';

interface PGPKeyInfo {
  fingerprint: string;
  public_key: string;
  imported_at: string;
}

const DualSignature: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'import' | 'sign' | 'verify'>('import');
  const [pgpKey, setPgpKey] = useState<PGPKeyInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Import PGP Key
  const [armoredPubkey, setArmoredPubkey] = useState('');

  // Sign Dual
  const [fileToSign, setFileToSign] = useState<File | null>(null);
  const [docHash, setDocHash] = useState('');
  const [pgpSignature, setPgpSignature] = useState('');
  const [nftId, setNftId] = useState('');

  // Verify Dual
  const [fileToVerify, setFileToVerify] = useState<File | null>(null);
  const [verifyDocHash, setVerifyDocHash] = useState('');
  const [verifyPgpSignature, setVerifyPgpSignature] = useState('');
  const [verifyFingerprint, setVerifyFingerprint] = useState('');
  const [verifyResult, setVerifyResult] = useState<any>(null);

  useEffect(() => {
    loadPGPKey();
  }, []);

  const loadPGPKey = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_BASE}/api/pgp/key`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPgpKey(response.data);
    } catch (error: any) {
      if (error.response?.status !== 404) {
        console.error('Erro ao carregar chave PGP:', error);
      }
    }
  };

  const handleImportKey = async () => {
    if (!armoredPubkey.trim()) {
      setMessage({ type: 'error', text: 'Cole sua chave pública PGP' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API_BASE}/api/pgp/import`,
        { armored_pubkey: armoredPubkey },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setMessage({ type: 'success', text: `Chave importada com sucesso! Fingerprint: ${response.data.fingerprint}` });
      setArmoredPubkey('');
      await loadPGPKey();
    } catch (error: any) {
      setMessage({ type: 'error', text: error.response?.data?.error || 'Erro ao importar chave' });
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = async (file: File, setHash: (hash: string) => void) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const content = e.target?.result as ArrayBuffer;
      const hashBuffer = await crypto.subtle.digest('SHA-256', content);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = '0x' + hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      setHash(hashHex);
    };
    reader.readAsArrayBuffer(file);
  };

  const handleSignDual = async () => {
    if (!docHash || !pgpSignature || !nftId) {
      setMessage({ type: 'error', text: 'Preencha todos os campos' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API_BASE}/api/dual/sign`,
        {
          doc_hash: docHash,
          pgp_signature: pgpSignature,
          pgp_fingerprint: pgpKey?.fingerprint,
          nft_id: parseInt(nftId)
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setMessage({
        type: 'success',
        text: `Assinatura dupla criada! TX: ${response.data.tx_hash.substring(0, 16)}...`
      });
      setDocHash('');
      setPgpSignature('');
      setNftId('');
      setFileToSign(null);
    } catch (error: any) {
      setMessage({ type: 'error', text: error.response?.data?.error || 'Erro ao criar assinatura dupla' });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyDual = async () => {
    if (!verifyDocHash || !verifyPgpSignature || !verifyFingerprint) {
      setMessage({ type: 'error', text: 'Preencha todos os campos' });
      return;
    }

    setLoading(true);
    setMessage(null);
    setVerifyResult(null);

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API_BASE}/api/dual/verify`,
        {
          doc_hash: verifyDocHash,
          pgp_signature: verifyPgpSignature,
          pgp_fingerprint: verifyFingerprint
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setVerifyResult(response.data);
      setMessage({
        type: response.data.valid ? 'success' : 'error',
        text: response.data.valid ? 'Assinatura válida!' : 'Assinatura inválida'
      });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.response?.data?.error || 'Erro ao verificar assinatura' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">🔐 Assinatura Dupla (PGP + Blockchain)</h1>

      {/* Tabs */}
      <div className="flex space-x-4 mb-6 border-b">
        <button
          className={`px-4 py-2 ${activeTab === 'import' ? 'border-b-2 border-blue-500 font-semibold' : ''}`}
          onClick={() => setActiveTab('import')}
        >
          Importar Chave PGP
        </button>
        <button
          className={`px-4 py-2 ${activeTab === 'sign' ? 'border-b-2 border-blue-500 font-semibold' : ''}`}
          onClick={() => setActiveTab('sign')}
        >
          Assinar Documento
        </button>
        <button
          className={`px-4 py-2 ${activeTab === 'verify' ? 'border-b-2 border-blue-500 font-semibold' : ''}`}
          onClick={() => setActiveTab('verify')}
        >
          Verificar Assinatura
        </button>
      </div>

      {/* Message */}
      {message && (
        <div className={`p-4 mb-6 rounded ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {message.text}
        </div>
      )}

      {/* Import Tab */}
      {activeTab === 'import' && (
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Importar Chave Pública PGP</h2>

          {pgpKey ? (
            <div className="mb-6 p-4 bg-green-50 rounded">
              <p className="font-semibold">✅ Chave PGP importada</p>
              <p className="text-sm text-gray-600 mt-2">
                <strong>Fingerprint:</strong> {pgpKey.fingerprint}
              </p>
              <p className="text-sm text-gray-600">
                <strong>Importada em:</strong> {new Date(pgpKey.imported_at).toLocaleString()}
              </p>
              <button
                className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                onClick={() => {
                  const blob = new Blob([pgpKey.public_key], { type: 'text/plain' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `pgp_public_key_${pgpKey.fingerprint.substring(0, 8)}.asc`;
                  a.click();
                }}
              >
                📥 Download Chave Pública
              </button>
            </div>
          ) : (
            <>
              <p className="text-gray-600 mb-4">
                Cole sua chave pública PGP (formato armored) abaixo:
              </p>
              <textarea
                className="w-full h-64 p-3 border rounded font-mono text-sm"
                placeholder="-----BEGIN PGP PUBLIC KEY BLOCK-----&#10;...&#10;-----END PGP PUBLIC KEY BLOCK-----"
                value={armoredPubkey}
                onChange={(e) => setArmoredPubkey(e.target.value)}
              />
              <button
                className="mt-4 px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400"
                onClick={handleImportKey}
                disabled={loading}
              >
                {loading ? 'Importando...' : 'Importar Chave'}
              </button>
            </>
          )}
        </div>
      )}

      {/* Sign Tab */}
      {activeTab === 'sign' && (
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Assinar Documento (Dual)</h2>

          {!pgpKey ? (
            <div className="p-4 bg-yellow-50 text-yellow-800 rounded">
              ⚠️ Você precisa importar sua chave PGP primeiro
            </div>
          ) : (
            <>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">1. Selecione o arquivo</label>
                <input
                  type="file"
                  className="w-full p-2 border rounded"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setFileToSign(file);
                      handleFileSelect(file, setDocHash);
                    }
                  }}
                />
                {docHash && (
                  <p className="text-sm text-gray-600 mt-2">
                    <strong>Hash:</strong> <code className="bg-gray-100 px-2 py-1 rounded">{docHash}</code>
                  </p>
                )}
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">2. Cole a assinatura PGP</label>
                <textarea
                  className="w-full h-32 p-3 border rounded font-mono text-sm"
                  placeholder="-----BEGIN PGP SIGNATURE-----&#10;...&#10;-----END PGP SIGNATURE-----"
                  value={pgpSignature}
                  onChange={(e) => setPgpSignature(e.target.value)}
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">3. ID do NFT</label>
                <input
                  type="number"
                  className="w-full p-2 border rounded"
                  placeholder="123"
                  value={nftId}
                  onChange={(e) => setNftId(e.target.value)}
                />
              </div>

              <button
                className="px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400"
                onClick={handleSignDual}
                disabled={loading}
              >
                {loading ? 'Assinando...' : '✍️ Criar Assinatura Dupla'}
              </button>
            </>
          )}
        </div>
      )}

      {/* Verify Tab */}
      {activeTab === 'verify' && (
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Verificar Assinatura Dupla</h2>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">1. Selecione o arquivo (opcional)</label>
            <input
              type="file"
              className="w-full p-2 border rounded"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  setFileToVerify(file);
                  handleFileSelect(file, setVerifyDocHash);
                }
              }}
            />
            {verifyDocHash && (
              <p className="text-sm text-gray-600 mt-2">
                <strong>Hash:</strong> <code className="bg-gray-100 px-2 py-1 rounded">{verifyDocHash}</code>
              </p>
            )}
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">2. Hash do documento (0x...)</label>
            <input
              type="text"
              className="w-full p-2 border rounded font-mono text-sm"
              placeholder="0x..."
              value={verifyDocHash}
              onChange={(e) => setVerifyDocHash(e.target.value)}
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">3. Assinatura PGP</label>
            <textarea
              className="w-full h-32 p-3 border rounded font-mono text-sm"
              placeholder="-----BEGIN PGP SIGNATURE-----&#10;...&#10;-----END PGP SIGNATURE-----"
              value={verifyPgpSignature}
              onChange={(e) => setVerifyPgpSignature(e.target.value)}
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">4. Fingerprint PGP</label>
            <input
              type="text"
              className="w-full p-2 border rounded font-mono text-sm"
              placeholder="ABCD1234ABCD1234ABCD1234ABCD1234ABCD1234"
              value={verifyFingerprint}
              onChange={(e) => setVerifyFingerprint(e.target.value)}
            />
          </div>

          <button
            className="px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400"
            onClick={handleVerifyDual}
            disabled={loading}
          >
            {loading ? 'Verificando...' : '🔍 Verificar Assinatura'}
          </button>

          {verifyResult && (
            <div className={`mt-6 p-4 rounded ${verifyResult.valid ? 'bg-green-50' : 'bg-red-50'}`}>
              <h3 className="font-semibold text-lg mb-2">
                {verifyResult.valid ? '✅ Assinatura Válida' : '❌ Assinatura Inválida'}
              </h3>
              <div className="text-sm space-y-1">
                <p><strong>PGP Válido:</strong> {verifyResult.pgp_valid ? '✅' : '❌'}</p>
                <p><strong>Blockchain Válido:</strong> {verifyResult.blockchain_valid ? '✅' : '❌'}</p>
                <p><strong>NFT Ativo:</strong> {verifyResult.nft_active ? '✅' : '❌'}</p>
                {verifyResult.tx_hash && <p><strong>TX Hash:</strong> <code>{verifyResult.tx_hash}</code></p>}
                {verifyResult.timestamp && <p><strong>Timestamp:</strong> {new Date(verifyResult.timestamp).toLocaleString()}</p>}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DualSignature;

