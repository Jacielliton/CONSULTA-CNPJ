"use client";
import { useState, useEffect, FormEvent } from 'react';
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

interface Cidade {
  codigo: string;
  descricao: string;
}

export default function PesquisaAvancada() {
  const [filtros, setFiltros] = useState({
    termo: '',
    uf: '',
    municipio: '', 
    situacao: '02',
    dataInicio: '',
    dataFim: ''
  });

  const [cidades, setCidades] = useState<Cidade[]>([]);
  const [loadingCidades, setLoadingCidades] = useState(false);

  const [resultados, setResultados] = useState<Empresa[]>([]);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [loading, setLoading] = useState(false);
  const [buscou, setBuscou] = useState(false);
  const [exportando, setExportando] = useState(false);

  // --- EFEITO: Carregar Cidades quando UF muda ---
  useEffect(() => {
    async function carregarCidades() {
      if (!filtros.uf) {
        setCidades([]);
        return;
      }
      setLoadingCidades(true);
      try {
        const res = await fetch(`${API_BASE}/auxiliar/cidades/${filtros.uf}`);
        const data = await res.json();
        setCidades(data);
      } catch (e) {
        console.error("Erro ao carregar cidades", e);
      } finally {
        setLoadingCidades(false);
      }
    }
    carregarCidades();
  }, [filtros.uf]);

  const situacoes = [
    { cod: "", label: "Todas" },
    { cod: "02", label: "Ativa" },
    { cod: "08", label: "Baixada" },
    { cod: "04", label: "Inapta" },
    { cod: "03", label: "Suspensa" },
    { cod: "01", label: "Nula" }
  ];

  const formatarData = (d: string) => {
    if(!d || d.length !== 8) return d;
    return `${d.substr(6,2)}/${d.substr(4,2)}/${d.substr(0,4)}`;
  }

  const construirParams = (p = 1) => {
    const params = new URLSearchParams();
    if(filtros.termo) params.append('q', filtros.termo);
    if(filtros.uf) params.append('uf', filtros.uf);
    if(filtros.municipio) params.append('municipio', filtros.municipio);
    if(filtros.situacao) params.append('situacao', filtros.situacao);
    if(filtros.dataInicio) params.append('data_inicio', filtros.dataInicio);
    if(filtros.dataFim) params.append('data_fim', filtros.dataFim);
    return params;
  }

  const buscar = async (p = 1) => {
    setLoading(true);
    setBuscou(true);
    setPagina(p);
    
    try {
      const params = construirParams(p);
      params.append('page', p.toString());
      params.append('limit', '20');

      const res = await fetch(`${API_BASE}/buscar?${params.toString()}`);
      const data = await res.json();
      
      setResultados(data.items || []);
      setTotal(data.total || 0);

    } catch (error) {
      alert("Erro ao buscar dados. Verifique se a API está rodando.");
    } finally {
      setLoading(false);
    }
  };

  const handleExportar = async () => {
    setExportando(true);
    try {
        const params = construirParams();
        // Redireciona o navegador para baixar o arquivo
        window.location.href = `${API_BASE}/exportar?${params.toString()}`;
    } catch (e) {
        alert("Erro ao iniciar download.");
    } finally {
        // Pequeno delay para liberar o botão
        setTimeout(() => setExportando(false), 2000);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    buscar(1);
  };

  const limparFiltros = () => {
    setFiltros({ termo: '', uf: '', municipio: '', situacao: '', dataInicio: '', dataFim: '' });
    setCidades([]);
    setResultados([]);
    setBuscou(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b py-4 px-8 flex justify-between items-center sticky top-0 z-10">
        <h1 className="text-xl font-bold text-blue-800 flex items-center gap-2">
          🔬 Pesquisa Avançada
        </h1>
        <Link href="/" className="text-sm text-gray-500 hover:text-blue-600">
          ← Voltar para Home
        </Link>
      </header>

      <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-4 gap-6">
        <aside className="lg:col-span-1">
          <form onSubmit={handleSubmit} className="bg-white p-5 rounded-lg shadow-sm border border-gray-200 sticky top-24">
            <h2 className="font-semibold text-gray-700 mb-4 border-b pb-2">Filtros</h2>
            
            <div className="mb-4">
              <label className="block text-xs font-bold text-gray-500 mb-1">Palavra-chave</label>
              <input 
                type="text" 
                placeholder="Nome, Razão ou CNPJ"
                className="w-full p-2 border rounded text-sm text-black"
                value={filtros.termo}
                onChange={e => setFiltros({...filtros, termo: e.target.value})}
              />
            </div>

            <div className="mb-4">
              <label className="block text-xs font-bold text-gray-500 mb-1">Situação Cadastral</label>
              <select 
                className="w-full p-2 border rounded text-sm text-black bg-white"
                value={filtros.situacao}
                onChange={e => setFiltros({...filtros, situacao: e.target.value})}
              >
                {situacoes.map(s => <option key={s.cod} value={s.cod}>{s.label}</option>)}
              </select>
            </div>

            <div className="mb-4">
              <label className="block text-xs font-bold text-gray-500 mb-1">Estado (UF)</label>
              <select 
                className="w-full p-2 border rounded text-sm text-black bg-white"
                value={filtros.uf}
                onChange={e => {
                  setFiltros({...filtros, uf: e.target.value, municipio: ''});
                }}
              >
                <option value="">Selecione...</option>
                {['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'].map(uf => (
                  <option key={uf} value={uf}>{uf}</option>
                ))}
              </select>
            </div>

            <div className="mb-4">
              <label className="block text-xs font-bold text-gray-500 mb-1">
                Município 
                {loadingCidades && <span className="text-blue-500 ml-1 animate-pulse">(Carregando...)</span>}
              </label>
              <select 
                className="w-full p-2 border rounded text-sm text-black bg-white disabled:bg-gray-100"
                value={filtros.municipio}
                onChange={e => setFiltros({...filtros, municipio: e.target.value})}
                disabled={!filtros.uf || loadingCidades}
              >
                <option value="">Todas as cidades</option>
                {cidades.map(c => (
                  <option key={c.codigo} value={c.codigo}>
                    {c.descricao}
                  </option>
                ))}
              </select>
            </div>

            <div className="mb-6">
              <label className="block text-xs font-bold text-gray-500 mb-1">Data de Abertura</label>
              <div className="flex gap-2 items-center">
                <input 
                  type="date" 
                  className="w-full p-1 border rounded text-xs text-black"
                  value={filtros.dataInicio}
                  onChange={e => setFiltros({...filtros, dataInicio: e.target.value})}
                />
                <span className="text-gray-400">-</span>
                <input 
                  type="date" 
                  className="w-full p-1 border rounded text-xs text-black"
                  value={filtros.dataFim}
                  onChange={e => setFiltros({...filtros, dataFim: e.target.value})}
                />
              </div>
            </div>

            <div className="space-y-2">
                <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-blue-600 text-white font-bold py-2 rounded hover:bg-blue-700 transition"
                >
                {loading ? "Filtrando..." : "Aplicar Filtros"}
                </button>
                
                <button 
                type="button" 
                onClick={handleExportar}
                disabled={exportando}
                className="w-full bg-green-600 text-white font-bold py-2 rounded hover:bg-green-700 transition flex items-center justify-center gap-2"
                >
                {exportando ? "Baixando..." : "📥 Exportar CSV"}
                </button>

                <button 
                type="button" 
                onClick={limparFiltros}
                className="w-full bg-gray-100 text-gray-600 py-2 rounded hover:bg-gray-200 transition text-sm"
                >
                Limpar
                </button>
            </div>
          </form>
        </aside>

        <section className="lg:col-span-3">
          <div className="mb-4 flex justify-between items-end">
            <div>
              <h2 className="text-xl font-bold text-gray-800">Resultados</h2>
              {buscou && (
                <p className="text-sm text-gray-500">
                  Encontrados <span className="font-bold text-black">{total}</span> registros
                </p>
              )}
            </div>
          </div>

          <div className="space-y-3">
            {resultados.map((empresa, i) => (
              <div key={i} className="bg-white p-4 rounded border hover:shadow-md transition flex justify-between items-center group">
                <div>
                  <Link href={`/empresa/${empresa.cnpj_basico}${empresa.cnpj_ordem}${empresa.cnpj_dv}`}>
                    <h3 className="text-lg font-bold text-blue-700 hover:underline cursor-pointer">
                      {empresa.razao_social || empresa.nome_fantasia}
                    </h3>
                  </Link>
                  <div className="text-sm text-gray-500 mt-1 flex gap-3">
                    <span className="font-mono bg-gray-100 px-1 rounded">
                      {empresa.cnpj_basico}.{empresa.cnpj_ordem}/{empresa.cnpj_dv}
                    </span>
                    <span>📍 {empresa.uf}</span>
                    <span>📅 {formatarData(empresa.data_inicio_atividade)}</span>
                  </div>
                </div>

                <div className="text-right">
                  <span className={`text-xs font-bold px-2 py-1 rounded ${
                    empresa.situacao_cadastral === '02' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {empresa.situacao_cadastral === '02' ? 'ATIVA' : 'INATIVA'}
                  </span>
                  <div className="mt-2 opacity-0 group-hover:opacity-100 transition">
                    <Link 
                       href={`/empresa/${empresa.cnpj_basico}${empresa.cnpj_ordem}${empresa.cnpj_dv}`}
                       className="text-sm text-blue-600 font-medium hover:text-blue-800"
                    >
                      Ver Detalhes →
                    </Link>
                  </div>
                </div>
              </div>
            ))}

            {buscou && !loading && resultados.length === 0 && (
              <div className="text-center py-12 bg-white rounded border border-dashed">
                <p className="text-gray-500">Nenhum resultado para os filtros selecionados.</p>
              </div>
            )}
             
            {loading && resultados.length === 0 && (
               [1,2,3].map(n => <div key={n} className="h-24 bg-gray-200 rounded animate-pulse"></div>)
            )}
          </div>

          {total > 20 && (
            <div className="mt-8 flex justify-center gap-4">
              <button 
                disabled={pagina === 1 || loading}
                onClick={() => buscar(pagina - 1)}
                className="px-4 py-2 border bg-white rounded hover:bg-gray-50 disabled:opacity-50 text-black"
              >
                Anterior
              </button>
              <span className="py-2 px-4 bg-gray-100 rounded text-black font-bold">{pagina}</span>
              <button 
                disabled={resultados.length < 20 || loading}
                onClick={() => buscar(pagina + 1)}
                className="px-4 py-2 border bg-white rounded hover:bg-gray-50 disabled:opacity-50 text-black"
              >
                Próxima
              </button>
            </div>
          )}

        </section>
      </main>
    </div>
  );
}