"use client";
import { useState, FormEvent } from 'react';
import Link from 'next/link';

// Configuração de API
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

interface Empresa {
  razao_social: string;
  nome_fantasia: string;
  cnpj_basico: string;
  cnpj_ordem: string;
  cnpj_dv: string;
  situacao_cadastral: string;
  municipio: string;
  uf: string;
  data_inicio_atividade: string;
}

export default function ConsultaSimples() {
  // --- FILTROS ---
  const [termo, setTermo] = useState('');
  const [filtroUF, setFiltroUF] = useState('');
  const [filtroData, setFiltroData] = useState('');
  const [filtroSituacao, setFiltroSituacao] = useState('02'); // Padrão 02 (Ativa)

  // --- ESTADOS ---
  const [resultados, setResultados] = useState<Empresa[]>([]);
  const [totalResultados, setTotalResultados] = useState(0);
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [loading, setLoading] = useState(false);
  const [buscou, setBuscou] = useState(false);
  const [erro, setErro] = useState('');
  const [exportando, setExportando] = useState(false);

  // --- OPÇÕES DE SITUAÇÃO ---
  const situacoes = [
    { cod: "", label: "Todas as Situações" },
    { cod: "02", label: "✅ Ativa" },
    { cod: "08", label: "🛑 Baixada" },
    { cod: "04", label: "⚠️ Inapta" },
    { cod: "03", label: "⏸️ Suspensa" },
    { cod: "01", label: "❌ Nula" }
  ];

  // --- FUNÇÕES AUXILIARES ---
  const formatarData = (d: string) => {
    if (!d || d.length !== 8) return d;
    return `${d.substr(6, 2)}/${d.substr(4, 2)}/${d.substr(0, 4)}`;
  };

  const construirParams = (pagina: number) => {
    const params = new URLSearchParams();
    if (termo) params.append('q', termo);
    if (filtroUF) params.append('uf', filtroUF);
    if (filtroSituacao) params.append('situacao', filtroSituacao);
    
    // Se preencher data, usamos como filtro de inicio (>= data)
    if (filtroData) params.append('data_inicio', filtroData);
    
    params.append('page', pagina.toString());
    params.append('limit', '10');
    return params;
  };

  const realizarBusca = async (pagina: number) => {
    setLoading(true);
    setBuscou(true);
    setErro('');
    setResultados([]);

    try {
      const params = construirParams(pagina);
      const res = await fetch(`${API_BASE}/buscar?${params.toString()}`);
      
      if (!res.ok) throw new Error('Erro ao conectar com o servidor.');

      const data = await res.json();
      setResultados(data.items || []);
      setTotalResultados(data.total || 0);
      setPaginaAtual(data.page || 1);

    } catch (error) {
      setErro("Falha ao buscar dados. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const handleExportar = () => {
    setExportando(true);
    try {
      // Remove paginação para o CSV e usa a rota de exportação
      const params = construirParams(1); 
      params.delete('page');
      params.delete('limit');
      
      window.location.href = `${API_BASE}/exportar?${params.toString()}`;
    } catch (e) {
      alert("Erro ao iniciar download.");
    } finally {
      setTimeout(() => setExportando(false), 2000);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setPaginaAtual(1);
    realizarBusca(1);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      

      <main className="flex-1 max-w-5xl mx-auto w-full p-6">
        
        {/* Painel de Filtros */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-8">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Parâmetros da Busca</h2>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Linha 1: Barra de Pesquisa Principal */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Empresa</label>
              <input
                type="text"
                placeholder="Nome da Empresa, Razão Social ou CNPJ..."
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none text-gray-900"
                value={termo}
                onChange={(e) => setTermo(e.target.value)}
              />
            </div>

            {/* Linha 2: Filtros Secundários (Grid) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              
              {/* Filtro UF */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Estado (UF)</label>
                <select 
                  className="w-full px-3 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 bg-white text-gray-700"
                  value={filtroUF}
                  onChange={(e) => setFiltroUF(e.target.value)}
                >
                  <option value="">Todos os Estados</option>
                  {['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'].map(uf => (
                    <option key={uf} value={uf}>{uf}</option>
                  ))}
                </select>
              </div>

              {/* Filtro Data */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Abertura (A partir de)</label>
                <input 
                  type="date"
                  className="w-full px-3 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 text-gray-700"
                  value={filtroData}
                  onChange={(e) => setFiltroData(e.target.value)}
                />
              </div>

              {/* Filtro Situação */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Situação Cadastral</label>
                <select 
                  className="w-full px-3 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 bg-white text-gray-700"
                  value={filtroSituacao}
                  onChange={(e) => setFiltroSituacao(e.target.value)}
                >
                  {situacoes.map(s => <option key={s.cod} value={s.cod}>{s.label}</option>)}
                </select>
              </div>

            </div>

            {/* Linha 3: Botões de Ação */}
            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition disabled:opacity-70 flex items-center justify-center gap-2"
              >
                {loading ? <span className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full"/> : "🔍 Pesquisar Empresas"}
              </button>

              <button
                type="button"
                onClick={handleExportar}
                disabled={exportando || loading}
                className="px-6 bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-lg transition disabled:opacity-70 flex items-center gap-2"
              >
                {exportando ? "Baixando..." : "📥 Exportar CSV"}
              </button>
            </div>

          </form>
          
          {erro && <p className="text-red-600 bg-red-50 p-3 rounded-lg text-sm mt-4">{erro}</p>}
        </div>

        {/* Lista de Resultados */}
        <div className="space-y-4">
          
          {/* Contador */}
          {buscou && !loading && !erro && (
            <div className="flex justify-between items-end pb-2 border-b border-gray-200">
              <span className="text-gray-600 font-medium">Resultados encontrados</span>
              <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-bold">
                {totalResultados} registros
              </span>
            </div>
          )}

          {/* Cards */}
          {resultados.map((empresa, index) => (
            <Link 
              href={`/empresa/${empresa.cnpj_basico}${empresa.cnpj_ordem}${empresa.cnpj_dv}`} 
              key={index}
              className="block group"
            >
              <div className="bg-white p-5 rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-md transition duration-200 flex flex-col sm:flex-row justify-between gap-4">
                
                {/* Dados Principais */}
                <div>
                  <h3 className="text-lg font-bold text-gray-800 group-hover:text-blue-700 transition">
                    {empresa.razao_social || empresa.nome_fantasia}
                  </h3>
                  <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-gray-500">
                    <span className="font-mono bg-gray-100 px-2 py-0.5 rounded text-gray-700 border border-gray-200">
                      {empresa.cnpj_basico}.{empresa.cnpj_ordem}/{empresa.cnpj_dv}
                    </span>
                    <span className="flex items-center gap-1">
                      📍 {empresa.municipio}/{empresa.uf}
                    </span>
                  </div>
                </div>

                {/* Status e Data */}
                <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 text-right min-w-[120px]">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
                    empresa.situacao_cadastral === '02' 
                      ? 'bg-green-50 text-green-700 border-green-200' 
                      : 'bg-red-50 text-red-700 border-red-200'
                  }`}>
                    {empresa.situacao_cadastral === '02' ? 'ATIVA' : 'INATIVA'}
                  </span>
                  <span className="text-xs text-gray-400">
                    Desde {formatarData(empresa.data_inicio_atividade)}
                  </span>
                </div>

              </div>
            </Link>
          ))}

          {/* Empty State */}
          {buscou && !loading && resultados.length === 0 && !erro && (
            <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-300">
              <div className="text-4xl mb-2">🤷‍♂️</div>
              <h3 className="text-gray-800 font-bold">Nenhum resultado</h3>
              <p className="text-gray-500 text-sm">Tente ajustar os filtros ou verificar a grafia.</p>
            </div>
          )}

          {/* Skeleton Loading */}
          {loading && (
            [1,2,3].map(i => (
              <div key={i} className="bg-white p-5 rounded-xl border border-gray-100 animate-pulse flex justify-between">
                <div className="space-y-3 w-2/3">
                  <div className="h-5 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                </div>
                <div className="space-y-3 w-24 flex flex-col items-end">
                  <div className="h-6 bg-gray-200 rounded w-full"></div>
                  <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                </div>
              </div>
            ))
          )}

        </div>

        {/* Paginação */}
        {totalResultados > 10 && (
          <div className="mt-8 flex justify-center gap-4">
            <button
              onClick={() => realizarBusca(paginaAtual - 1)}
              disabled={paginaAtual === 1 || loading}
              className="px-4 py-2 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 text-sm font-medium text-gray-700"
            >
              Anterior
            </button>
            <span className="px-4 py-2 bg-gray-100 rounded text-sm font-bold text-gray-700">
              {paginaAtual}
            </span>
            <button
              onClick={() => realizarBusca(paginaAtual + 1)}
              disabled={loading || resultados.length < 10}
              className="px-4 py-2 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 text-sm font-medium text-gray-700"
            >
              Próxima
            </button>
          </div>
        )}

      </main>
    </div>
  );
}