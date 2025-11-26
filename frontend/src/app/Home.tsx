import { Link } from 'react-router-dom'
import { Shield, FileCheck, Lock, Globe, Wallet, Key, AlertTriangle, FileSignature, CheckCircle, ArrowRight, UserCheck, SearchCheck, ShieldAlert } from 'lucide-react'
import { motion, useScroll, useTransform } from 'framer-motion'
import Button from '../components/Button'

// Animation variants
const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 }
}

const fadeIn = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 }
}

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
}

const scaleIn = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { 
    opacity: 1, 
    scale: 1,
    transition: {
      type: "spring",
      stiffness: 100,
      damping: 15
    }
  }
}

export default function Home() {
  const { scrollYProgress } = useScroll()
  const heroY = useTransform(scrollYProgress, [0, 0.3], [0, 50])
  const heroOpacity = useTransform(scrollYProgress, [0, 0.3], [1, 0.8])

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-navy to-brand-neutral">
      {/* Navigation */}
      <motion.nav 
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ type: "spring", stiffness: 100, damping: 20 }}
        className="fixed top-0 left-0 right-0 bg-brand-navy/80 backdrop-blur-md border-b border-gray-700 z-50"
      >
        <div className="container-custom py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <img src="/logo.png" alt="BTS Blocktrust" className="h-8" />
              <span className="text-xs bg-brand-blue text-white px-2 py-1 rounded-full font-medium">v1.4</span>
            </div>
            <div className="flex items-center space-x-3">
              <Link to="/login">
                <Button variant="secondary" className="text-sm hover:scale-105 transition-transform">Entrar</Button>
              </Link>
              <Link to="/register">
                <Button className="text-sm hover:scale-105 transition-transform">Criar Conta</Button>
              </Link>
            </div>
          </div>
        </div>
      </motion.nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 overflow-hidden">
        <div className="container-custom">
          <motion.div 
            style={{ y: heroY, opacity: heroOpacity }}
            className="max-w-4xl mx-auto text-center"
          >
            <motion.h1 
              initial="hidden"
              animate="visible"
              variants={fadeInUp}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="font-display text-4xl md:text-6xl lg:text-7xl font-bold text-white mb-6 leading-tight"
            >
              Identidade Digital Soberana e Assinatura Blockchain
            </motion.h1>
            <motion.p 
              initial="hidden"
              animate="visible"
              variants={fadeInUp}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="text-lg md:text-xl text-gray-300 mb-10 max-w-3xl mx-auto leading-relaxed"
            >
              Sistema completo de identidade verificada (KYC), carteira autocustodiada, 
              NFT SoulBound e assinatura dupla (PGP + Blockchain) com protocolo de emergência
            </motion.p>
            <motion.div
              initial="hidden"
              animate="visible"
              variants={fadeInUp}
              transition={{ duration: 0.6, delay: 0.6 }}
            >
              <Link to="/register" className="inline-block no-underline">
                <Button 
                  size="lg" 
                  className="bg-brand-blue hover:bg-blue-700 text-white text-sm md:text-base px-6 md:px-8 py-3 shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300 whitespace-nowrap"
                >
                  Começar Agora
                </Button>
              </Link>
            </motion.div>
          </motion.div>

          {/* Video Section */}
          <motion.div 
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.8 }}
            className="mt-16 max-w-5xl mx-auto"
          >
            <div className="relative aspect-video rounded-2xl overflow-hidden shadow-2xl border border-gray-200 hover:shadow-3xl transition-shadow duration-300">
              <iframe
                className="w-full h-full"
                src="https://www.youtube.com/embed/HAz8u9dWt28"
                title="Conheça o BTS Blocktrust"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                loading="lazy"
              ></iframe>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20">
        <div className="container-custom">
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeInUp}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2 className="font-display text-3xl md:text-4xl font-bold text-white mb-4">
              Módulos e Funcionalidades
            </h2>
            <p className="text-lg text-gray-300 max-w-2xl mx-auto">
              Tecnologia de ponta para garantir segurança, privacidade e controle total da sua identidade digital
            </p>
          </motion.div>

          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={staggerContainer}
            className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12"
          >
            {/* Card 1 */}
            <motion.div 
              variants={scaleIn}
              whileHover={{ y: -8, transition: { duration: 0.2 } }}
              className="group bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-8 hover:shadow-xl hover:border-brand-blue transition-all duration-300"
            >
              <motion.div 
                whileHover={{ scale: 1.1, rotate: 5 }}
                transition={{ type: "spring", stiffness: 300 }}
                className="w-14 h-14 bg-blue-50 rounded-xl flex items-center justify-center mb-6 group-hover:bg-brand-blue transition-colors"
              >
                <Wallet className="w-7 h-7 text-brand-blue group-hover:text-white transition-colors" />
              </motion.div>
              <h3 className="font-display text-lg font-bold text-white mb-3">Carteira Proprietária</h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                Geração e gerenciamento de chaves privadas secp256k1 com criptografia local
              </p>
            </motion.div>

            {/* Card 2 */}
            <motion.div 
              variants={scaleIn}
              whileHover={{ y: -8, transition: { duration: 0.2 } }}
              className="group bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-8 hover:shadow-xl hover:border-brand-blue transition-all duration-300"
            >
              <motion.div 
                whileHover={{ scale: 1.1, rotate: 5 }}
                transition={{ type: "spring", stiffness: 300 }}
                className="w-14 h-14 bg-blue-50 rounded-xl flex items-center justify-center mb-6 group-hover:bg-brand-blue transition-colors"
              >
                <Shield className="w-7 h-7 text-brand-blue group-hover:text-white transition-colors" />
              </motion.div>
              <h3 className="font-display text-lg font-bold text-white mb-3">NFT SoulBound</h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                Identidade única não-transferível vinculada ao KYC com cancelamento automático
              </p>
            </motion.div>

            {/* Card 3 */}
            <motion.div 
              variants={scaleIn}
              whileHover={{ y: -8, transition: { duration: 0.2 } }}
              className="group bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-8 hover:shadow-xl hover:border-brand-blue transition-all duration-300"
            >
              <motion.div 
                whileHover={{ scale: 1.1, rotate: 5 }}
                transition={{ type: "spring", stiffness: 300 }}
                className="w-14 h-14 bg-blue-50 rounded-xl flex items-center justify-center mb-6 group-hover:bg-brand-blue transition-colors"
              >
                <FileSignature className="w-7 h-7 text-brand-blue group-hover:text-white transition-colors" />
              </motion.div>
              <h3 className="font-display text-lg font-bold text-white mb-3">Assinatura Dupla</h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                PGP + Blockchain para máxima segurança e não-repúdio de documentos
              </p>
            </motion.div>

            {/* Card 4 */}
            <motion.div 
              variants={scaleIn}
              whileHover={{ y: -8, transition: { duration: 0.2 } }}
              className="group bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-8 hover:shadow-xl hover:border-red-500 transition-all duration-300"
            >
              <motion.div 
                whileHover={{ scale: 1.1, rotate: 5 }}
                transition={{ type: "spring", stiffness: 300 }}
                className="w-14 h-14 bg-red-50 rounded-xl flex items-center justify-center mb-6 group-hover:bg-red-500 transition-colors"
              >
                <AlertTriangle className="w-7 h-7 text-red-500 group-hover:text-white transition-colors" />
              </motion.div>
              <h3 className="font-display text-lg font-bold text-white mb-3">Protocolo Failsafe</h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                Senha de emergência para situações de coação com cancelamento automático de NFT
              </p>
            </motion.div>
          </motion.div>

          {/* Additional Features */}
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={staggerContainer}
            className="grid md:grid-cols-3 gap-8 mt-16"
          >
            <motion.div variants={scaleIn} className="text-center group">
              <motion.div 
                whileHover={{ scale: 1.1, rotate: 5 }}
                transition={{ type: "spring", stiffness: 300 }}
                className="w-16 h-16 bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:shadow-lg transition-shadow"
              >
                <FileCheck className="w-8 h-8 text-brand-blue" />
              </motion.div>
              <h3 className="font-display text-xl font-bold text-white mb-3">KYC Integrado</h3>
              <p className="text-gray-300 leading-relaxed">
                Verificação de identidade via KYC com liveness e mint automático de NFT
              </p>
            </motion.div>

            <motion.div variants={scaleIn} className="text-center group">
              <motion.div 
                whileHover={{ scale: 1.1, rotate: 5 }}
                transition={{ type: "spring", stiffness: 300 }}
                className="w-16 h-16 bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:shadow-lg transition-shadow"
              >
                <Lock className="w-8 h-8 text-brand-blue" />
              </motion.div>
              <h3 className="font-display text-xl font-bold text-white mb-3">Privacidade Total</h3>
              <p className="text-gray-300 leading-relaxed">
                Chaves privadas nunca saem do dispositivo. Criptografia AES-256 + PBKDF2
              </p>
            </motion.div>

            <motion.div variants={scaleIn} className="text-center group">
              <motion.div 
                whileHover={{ scale: 1.1, rotate: 5 }}
                transition={{ type: "spring", stiffness: 300 }}
                className="w-16 h-16 bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:shadow-lg transition-shadow"
              >
                <Globe className="w-8 h-8 text-brand-blue" />
              </motion.div>
              <h3 className="font-display text-xl font-bold text-white mb-3">Blockchain Polygon</h3>
              <p className="text-gray-300 leading-relaxed">
                Registro imutável e verificável em blockchain pública de baixo custo
              </p>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* How It Works Section - CARDS HORIZONTAIS */}
      <section className="py-24 bg-[#0B1727]">
        <div className="container-custom">
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeInUp}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold text-[#F5F7FA] mb-4">
              Como Funciona o Blocktrust
            </h2>
            <p className="text-lg md:text-xl text-[#D1D5DB] max-w-2xl mx-auto leading-relaxed">
              Processo simples e seguro em três etapas principais
            </p>
          </motion.div>

          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={staggerContainer}
            className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto"
          >
            {/* Card 1 - Cadastro e Verificação */}
            <motion.div 
              variants={scaleIn}
              whileHover={{ y: -8, scale: 1.02 }}
              transition={{ type: "spring", stiffness: 300 }}
              className="group bg-white/10 backdrop-blur-sm rounded-2xl p-8 shadow-lg hover:shadow-2xl border border-white/20 hover:border-brand-blue transition-all duration-300"
            >
              <motion.div 
                whileHover={{ scale: 1.1, rotate: 5 }}
                transition={{ type: "spring", stiffness: 300 }}
                className="w-16 h-16 bg-brand-blue text-white rounded-2xl flex items-center justify-center mb-6 group-hover:shadow-xl transition-shadow"
              >
                <UserCheck className="w-8 h-8" />
              </motion.div>
              <div className="flex items-center gap-3 mb-4">
                <span className="text-4xl font-bold text-brand-blue">1</span>
                <h3 className="font-display text-xl font-bold text-[#F5F7FA]">Cadastro e Verificação</h3>
              </div>
              <div className="space-y-3 text-sm text-[#D1D5DB] leading-relaxed">
                <p>
                  Crie uma conta com <strong>duas senhas</strong>: a senha principal e uma senha de emergência (failsafe), 
                  usada apenas em situações de risco.
                </p>
                <p>
                  Realize a <strong>verificação de identidade (KYC)</strong> com prova de vida diretamente pelo aplicativo.
                </p>
                <p>
                  O sistema gera automaticamente uma <strong>carteira digital autocustodiada</strong>, onde suas chaves privadas 
                  são armazenadas localmente e criptografadas.
                </p>
                <p>
                  Um <strong>NFT SoulBound</strong> — único, intransferível e auditável — é emitido na blockchain Polygon e 
                  vinculado permanentemente à sua identidade digital.
                </p>
              </div>
            </motion.div>

            {/* Card 2 - Assinatura de Documentos */}
            <motion.div 
              variants={scaleIn}
              whileHover={{ y: -8, scale: 1.02 }}
              transition={{ type: "spring", stiffness: 300 }}
              className="group bg-white/10 backdrop-blur-sm rounded-2xl p-8 shadow-lg hover:shadow-2xl border border-white/20 hover:border-brand-blue transition-all duration-300"
            >
              <motion.div 
                whileHover={{ scale: 1.1, rotate: 5 }}
                transition={{ type: "spring", stiffness: 300 }}
                className="w-16 h-16 bg-brand-blue text-white rounded-2xl flex items-center justify-center mb-6 group-hover:shadow-xl transition-shadow"
              >
                <FileSignature className="w-8 h-8" />
              </motion.div>
              <div className="flex items-center gap-3 mb-4">
                <span className="text-4xl font-bold text-brand-blue">2</span>
                <h3 className="font-display text-xl font-bold text-[#F5F7FA]">Assinatura de Documentos</h3>
              </div>
              <div className="space-y-3 text-sm text-[#D1D5DB] leading-relaxed">
                <p>
                  (Opcional) Importe sua <strong>chave pública PGP</strong> para ampliar a compatibilidade com sistemas externos.
                </p>
                <p>
                  Faça o <strong>upload do documento</strong> a ser assinado.
                </p>
                <p>
                  O sistema valida seu <strong>NFT ativo</strong> na blockchain, garantindo que sua identidade digital está íntegra.
                </p>
                <p>
                  O documento é assinado com <strong>dupla camada de segurança</strong>:
                </p>
                <ul className="space-y-2 ml-4">
                  <li className="flex items-start">
                    <CheckCircle className="w-4 h-4 text-brand-blue mr-2 mt-0.5 flex-shrink-0" />
                    <span><strong>ECDSA</strong>, com sua chave privada local Blocktrust.</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="w-4 h-4 text-brand-blue mr-2 mt-0.5 flex-shrink-0" />
                    <span><strong>PGP</strong>, para compatibilidade adicional com outras plataformas.</span>
                  </li>
                </ul>
                <p>
                  Apenas o <strong>hash criptográfico</strong> e os metadados de auditoria são registrados na blockchain — 
                  o conteúdo do documento <strong>nunca sai do seu dispositivo</strong>.
                </p>
              </div>
            </motion.div>

            {/* Card 3 - Verificação e Auditoria */}
            <motion.div 
              variants={scaleIn}
              whileHover={{ y: -8, scale: 1.02 }}
              transition={{ type: "spring", stiffness: 300 }}
              className="group bg-white/10 backdrop-blur-sm rounded-2xl p-8 shadow-lg hover:shadow-2xl border border-white/20 hover:border-brand-blue transition-all duration-300"
            >
              <motion.div 
                whileHover={{ scale: 1.1, rotate: 5 }}
                transition={{ type: "spring", stiffness: 300 }}
                className="w-16 h-16 bg-brand-blue text-white rounded-2xl flex items-center justify-center mb-6 group-hover:shadow-xl transition-shadow"
              >
                <SearchCheck className="w-8 h-8" />
              </motion.div>
              <div className="flex items-center gap-3 mb-4">
                <span className="text-4xl font-bold text-brand-blue">3</span>
                <h3 className="font-display text-xl font-bold text-[#F5F7FA]">Verificação e Auditoria</h3>
              </div>
              <div className="space-y-3 text-sm text-[#D1D5DB] leading-relaxed">
                <p>
                  Qualquer pessoa pode verificar a autenticidade de um documento por meio do <strong>QR code do certificado</strong> 
                  ou do <strong>Explorer Blocktrust</strong>.
                </p>
                <p>
                  A consulta pública exibe o <strong>status do NFT</strong>, o hash do documento e o histórico completo de eventos 
                  diretamente na blockchain Polygon.
                </p>
                <p>
                  O <strong>painel de auditoria</strong> oferece:
                </p>
                <ul className="space-y-2 ml-4">
                  <li className="flex items-start">
                    <CheckCircle className="w-4 h-4 text-brand-blue mr-2 mt-0.5 flex-shrink-0" />
                    <span>Histórico de assinaturas e cancelamentos</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="w-4 h-4 text-brand-blue mr-2 mt-0.5 flex-shrink-0" />
                    <span>Registro de eventos on-chain (Minting, Proof, Failsafe, etc.)</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="w-4 h-4 text-brand-blue mr-2 mt-0.5 flex-shrink-0" />
                    <span>Logs em tempo real, com atualização automática</span>
                  </li>
                </ul>
                <p className="font-medium text-[#F5F7FA]">
                  Cada ação é registrada de forma pública, imutável e auditável — transformando confiança em código.
                </p>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Failsafe Protocol Section - COM PULSAÇÃO */}
      <section className="py-24 bg-black">
        <div className="container-custom">
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeInUp}
            transition={{ duration: 0.6 }}
            className="max-w-4xl mx-auto"
          >
            <div className="flex items-start gap-6 mb-8">
              <motion.div 
                animate={{ 
                  scale: [1, 1.1, 1],
                  boxShadow: [
                    "0 0 0 0 rgba(239, 68, 68, 0.4)",
                    "0 0 0 10px rgba(239, 68, 68, 0)",
                    "0 0 0 0 rgba(239, 68, 68, 0)"
                  ]
                }}
                transition={{ 
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
                className="flex-shrink-0"
              >
                <div className="w-16 h-16 bg-[#EF4444] text-white rounded-2xl flex items-center justify-center">
                  <ShieldAlert className="w-8 h-8" />
                </div>
              </motion.div>
              <div>
                <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4">
                  Protocolo de Emergência (Failsafe)
                </h2>
                <p className="text-lg md:text-xl text-[#F5F5F5] leading-relaxed">
                  Proteção avançada para situações de coerção ou ameaça
                </p>
              </div>
            </div>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="bg-white/5 backdrop-blur-sm rounded-2xl p-8 md:p-10 shadow-xl border border-[#1F2937] hover:shadow-2xl transition-all duration-300"
            >
              <div className="space-y-6 text-[#F5F5F5] leading-relaxed text-base">
                <p>
                  Em caso de <strong>coerção, fraude ou ameaça</strong>, o usuário pode acionar o modo de emergência com sua <strong>senha failsafe</strong>.
                </p>
                <p>
                  O sistema gera uma <strong>"assinatura fake"</strong> — visualmente idêntica à real — que engana o invasor, 
                  protegendo você e seus documentos legítimos.
                </p>
                <p>
                  Simultaneamente, o <strong>NFT ativo é automaticamente marcado como inválido</strong> na blockchain, impedindo futuras 
                  assinaturas e acionando o protocolo de segurança.
                </p>
                <p>
                  O usuário pode, depois, <strong>refazer o KYC e emitir um novo NFT (v+1)</strong> para recuperar sua identidade digital.
                </p>
                <div className="bg-[#EF4444]/10 border-l-4 border-[#EF4444] p-4 rounded-r-lg">
                  <p className="font-medium text-[#F5F7FA]">
                    ⚠️ <strong>Importante:</strong> O NFT não é apagado nem removido — ele é <strong>marcado como inválido</strong>, 
                    permanecendo visível na blockchain para garantir rastreabilidade e auditoria.
                  </p>
                </div>
                <p className="font-medium text-[#F5F7FA]">
                  Isso preserva a <strong>cadeia de auditoria simbiótica</strong>, garantindo rastreabilidade e transparência total ao longo do tempo.
                </p>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-brand-navy text-white">
        <div className="container-custom text-center">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeInUp}
            transition={{ duration: 0.6 }}
          >
            <h2 className="font-display text-3xl md:text-5xl font-bold mb-6">
              Pronto para começar?
            </h2>
            <p className="text-xl text-gray-300 mb-10 max-w-2xl mx-auto">
              Crie sua identidade digital soberana agora e tenha controle total sobre suas assinaturas e documentos
            </p>
            <Link to="/register" className="inline-block no-underline">
              <Button 
                size="lg" 
                className="bg-[#007AFF] text-white hover:bg-[#005BBB] text-sm md:text-base px-6 md:px-8 py-3 rounded-xl font-semibold shadow-lg hover:scale-105 transition-all duration-300 focus:ring-2 focus:ring-offset-2 focus:ring-[#007AFF] !bg-[#007AFF] whitespace-nowrap"
              >
                Criar Conta Gratuita
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-12">
        <div className="container-custom">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <img src="/logo.png" alt="BTS Blocktrust" className="h-8" />
              <span className="text-sm">Sistema descentralizado de registro blockchain</span>
            </div>
            <p className="text-sm">
              2025 BTS Global Corp © Todos os direitos reservados
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}

