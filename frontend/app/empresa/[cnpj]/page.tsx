"use client";
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

export default function DetalhesEmpresa() {
  const params = useParams();
  const cnpjRaw = params?.cnpj; 
  const cnpj = Array.isArray(cnpjRaw) ? cnpjRaw[0] : cnpjRaw;

  const [dados, setDados] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (cnpj) carregarDados();
  }, [cnpj]);

  const carregarDados = async () => {
    try {
      const res = await fetch(`http://127.0.0.1:8000/empresa/${cnpj}`);
      if (!res.ok) throw new Error("Empresa não encontrada.");
      const data = await res.json();
      setDados(data);
    } catch (e: any) {
      setErro(e.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="flex justify-center items-center h-screen text-blue-600 animate-pulse text-xl font-semibold">Buscando dados...</div>;
  if (erro) return <div className="flex justify-center items-center h-screen text-red-600 text-xl font-bold">❌ {erro}</div>;
  if (!dados) return null;

  // --- FORMATAÇÕES ---
  const formatarData = (d: string) => {
    if (!d || d.length !== 8) return "Não informada";
    return `${d.substr(6,2)}/${d.substr(4,2)}/${d.substr(0,4)}`;
  };

  const formatarMoeda = (v: string) => {
    const valor = parseFloat(v?.replace(',', '.') || '0');
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const formatarTelefone = (ddd: string, num: string) => {
    if (!num) return null;
    if (num.length === 8) return `(${ddd}) ${num.substr(0,4)}-${num.substr(4,4)}`;
    if (num.length === 9) return `(${ddd}) ${num.substr(0,5)}-${num.substr(5,4)}`;
    return `(${ddd}) ${num}`;
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        
        <Link href="/" className="inline-flex items-center text-blue-600 hover:text-blue-800 font-medium mb-6 transition">
          <span className="mr-2">←</span> Voltar para a busca
        </Link>

        {/* --- CABEÇALHO --- */}
        <div className="bg-white rounded-t-lg shadow-sm border border-gray-200 p-8 mb-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-2 bg-blue-600"></div>
          
          <div className="flex flex-col md:flex-row justify-between items-start">
            <div>
              <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 tracking-tight">
                {dados.razao_social}
              </h1>
              {dados.nome_fantasia && (
                <p className="text-xl text-gray-500 mt-2 font-medium uppercase tracking-wide">
                  {dados.nome_fantasia}
                </p>
              )}
              
              <div className="flex flex-wrap items-center gap-3 mt-6">
                <span className="bg-gray-100 text-gray-800 px-4 py-2 rounded-md font-mono text-lg font-bold border border-gray-300">
                  {dados.cnpj_formatado}
                </span>
                
                <span className={`px-4 py-2 rounded-md text-sm font-bold uppercase tracking-wider ${
                  dados.situacao_cadastral === '02' 
                    ? 'bg-green-100 text-green-800 border border-green-200' 
                    : 'bg-red-100 text-red-800 border border-red-200'
                }`}>
                  {dados.situacao_cadastral === '02' ? 'ATIVA' : 'INATIVA / BAIXADA'}
                </span>

                <span className="bg-blue-50 text-blue-800 px-4 py-2 rounded-md text-sm font-semibold border border-blue-100">
                  📅 Abertura: {formatarData(dados.data_inicio_atividade)}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* --- COLUNA ESQUERDA (DADOS PRINCIPAIS) --- */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* ATIVIDADE ECONÔMICA */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-bold text-gray-900 border-b pb-3 mb-4 flex items-center">
                <span className="bg-blue-100 text-blue-600 p-1.5 rounded mr-3 text-sm">💼</span>
                Atividade Econômica
              </h3>
              <div>
                <p className="text-sm text-gray-500 font-bold mb-1">CNAE Principal</p>
                <p className="text-lg text-gray-800 font-medium">
                  {dados.cnae_principal_texto || `Cód: ${dados.cnae_fiscal_principal} (Descrição não disponível)`}
                </p>
                
                {/* Aqui você poderia adicionar CNAEs secundários se tivesse importado */}
              </div>
            </div>

            {/* DADOS CADASTRAIS */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-bold text-gray-900 border-b pb-3 mb-4 flex items-center">
                <span className="bg-purple-100 text-purple-600 p-1.5 rounded mr-3 text-sm">📝</span>
                Ficha Cadastral
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <p className="text-xs text-gray-500 font-bold uppercase mb-1">Natureza Jurídica</p>
                  <p className="text-gray-800">{dados.natureza_juridica_texto || dados.natureza_juridica}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-bold uppercase mb-1">Capital Social</p>
                  <p className="text-green-700 font-bold text-lg">{formatarMoeda(dados.capital_social)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-bold uppercase mb-1">Porte da Empresa</p>
                  <p className="text-gray-800 font-medium">
                    {dados.porte_empresa === '01' ? 'MICROEMPRESA (ME)' : 
                     dados.porte_empresa === '03' ? 'EMPRESA DE PEQUENO PORTE (EPP)' : 
                     dados.porte_empresa === '05' ? 'DEMAIS' : 'NÃO INFORMADO'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-bold uppercase mb-1">Tipo</p>
                  <p className="text-gray-800">
                    {dados.identificador_matriz_filial === '1' ? 'MATRIZ' : 'FILIAL'}
                  </p>
                </div>
              </div>
            </div>

            {/* CONTATO E ENDEREÇO */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-bold text-gray-900 border-b pb-3 mb-4 flex items-center">
                <span className="bg-orange-100 text-orange-600 p-1.5 rounded mr-3 text-sm">📍</span>
                Localização e Contato
              </h3>
              
              <div className="space-y-4">
                <div>
                  <p className="text-xs text-gray-500 font-bold uppercase mb-1">Endereço Completo</p>
                  <p className="text-gray-800 text-lg">
                    {dados.tipo_de_logradouro} {dados.logradouro}, {dados.numero} {dados.complemento}
                  </p>
                  <p className="text-gray-600">
                    Bairro: {dados.bairro} • CEP: {dados.cep}
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-8 pt-4 border-t">
                  <div>
                    <p className="text-xs text-gray-500 font-bold uppercase mb-1">Município / UF</p>
                    <p className="text-gray-900 font-bold text-lg">
                      {dados.municipio_texto || dados.municipio} <span className="text-gray-400">/</span> {dados.uf}
                    </p>
                  </div>
                  
                  <div>
                    <p className="text-xs text-gray-500 font-bold uppercase mb-1">Contatos</p>
                    <div className="text-gray-800">
                      {dados.correio_eletronico && (
                        <p className="mb-1">📧 {dados.correio_eletronico.toLowerCase()}</p>
                      )}
                      {(dados.telefone_1 || dados.telefone_2) && (
                        <p>📞 {formatarTelefone(dados.ddd_1, dados.telefone_1)} {dados.telefone_2 && ` / ${formatarTelefone(dados.ddd_2, dados.telefone_2)}`}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* --- COLUNA DIREITA (SÓCIOS) --- */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 sticky top-6">
              <div className="flex items-center justify-between mb-4 border-b pb-3">
                <h3 className="text-lg font-bold text-gray-900">Quadro Societário</h3>
                <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs font-bold">
                  {dados.socios.length}
                </span>
              </div>
              
              {dados.socios.length === 0 ? (
                <div className="text-center py-10">
                    <p className="text-gray-400 text-4xl mb-2">👤</p>
                    <p className="text-gray-500 text-sm">Informação não disponível ou Empresário Individual.</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1 custom-scrollbar">
                  {dados.socios.map((socio: any, index: number) => (
                    <div key={index} className="bg-gray-50 p-4 rounded-lg border border-gray-100 hover:border-blue-200 transition">
                      <div className="flex items-start gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                            socio.identificador_socio === '2' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
                        }`}>
                            {socio.identificador_socio === '2' ? 'PF' : 'PJ'}
                        </div>
                        <div>
                            <p className="font-bold text-gray-800 text-sm leading-tight">{socio.nome_socio_razao_social}</p>
                            <p className="text-xs text-gray-500 mt-1 font-medium">
                                Sócio / Administrador
                            </p>
                            <p className="text-[10px] text-gray-400 mt-1">
                                Entrada: {formatarData(socio.data_entrada_sociedade)}
                            </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}