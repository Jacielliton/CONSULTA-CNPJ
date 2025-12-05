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
  capital_social?: string;
  porte_empresa?: string;
}

interface Cidade {
  codigo: string;
  descricao: string;
}

export default function PesquisaAvancada() {
  // --- ESTADOS ---
  const [filtros, setFiltros] = useState({
    termo: '', uf: '', municipio: '', situacao: '02', porte: '',
    natureza: '', dataInicio: '', dataFim: '', capitalMin: '', capitalMax: ''
  });

  const [cidades, setCidades] = useState<Cidade[]>([]);
  const [loadingCidades, setLoadingCidades] = useState(false);
  const [resultados, setResultados] = useState<Empresa[]>([]);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [loading, setLoading] = useState(false);
  const [buscou, setBuscou] = useState(false);
  const [exportando, setExportando] = useState(false);

  // --- EFEITO: Cidades ---
  useEffect(() => {
    async function carregarCidades() {
      if (!filtros.uf) { setCidades([]); return; }
      setLoadingCidades(true);
      try {
        const res = await fetch(`${API_BASE}/auxiliar/cidades/${filtros.uf}`);
        const data = await res.json();
        setCidades(data);
      } catch (e) { console.error(e); } 
      finally { setLoadingCidades(false); }
    }
    carregarCidades();
  }, [filtros.uf]);

  // --- OPÇÕES ---
  const situacoes = [
    { cod: "", label: "Todas" }, { cod: "02", label: "Ativa" }, { cod: "08", label: "Baixada" },
    { cod: "04", label: "Inapta" }, { cod: "03", label: "Suspensa" }, { cod: "01", label: "Nula" }
  ];
  
  const portes = [
    { cod: "", label: "Todos" }, { cod: "01", label: "ME - Micro Empresa" }, 
    { cod: "03", label: "EPP - Pequeno Porte" }, { cod: "05", label: "Demais" }
  ];

  // --- HELPERS ---
  const formatarData = (d: string) => {
    if(!d || d.length !== 8) return d;
    return `${d.substr(6,2)}/${d.substr(4,2)}/${d.substr(0,4)}`;
  }

  const formatarDinheiro = (v: any) => {
    if (!v) return "-";
    const n = parseFloat(String(v).replace(',', '.'));
    return isNaN(n) ? v : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);
  }

  const formatarCNPJ = (b: string, o: string, d: string) => `${b}.${o}/${d}`;

  // --- BUSCA ---
  const construirParams = (p = 1) => {
    const params = new URLSearchParams();
    if(filtros.termo) params.append('q', filtros.termo);
    if(filtros.uf) params.append('uf', filtros.uf);
    if(filtros.municipio) params.append('municipio', filtros.municipio);
    if(filtros.situacao) params.append('situacao', filtros.situacao);
    if(filtros.dataInicio) params.append('data_inicio', filtros.dataInicio);
    if(filtros.dataFim) params.append('data_fim', filtros.dataFim);
    if(filtros.capitalMin) params.append('capital_min', filtros.capitalMin);
    if(filtros.capitalMax) params.append('capital_max', filtros.capitalMax);
    if(filtros.porte) params.append('porte', filtros.porte);
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
    } catch (error) { alert("Erro ao buscar dados."); } 
    finally { setLoading(false); }
  };

  const handleExportar = async () => {
    setExportando(true);
    try {
        const params = construirParams();
        window.location.href = `${API_BASE}/exportar?${params.toString()}`;
    } catch (e) { alert("Erro exportação"); } 
    finally { setTimeout(() => setExportando(false), 2000); }
  };

  const limparFiltros = () => {
    setFiltros({ termo: '', uf: '', municipio: '', situacao: '', porte: '', natureza: '', dataInicio: '', dataFim: '', capitalMin: '', capitalMax: '' });
    setResultados([]);
    setBuscou(false);
  };

  // ESTILO PADRÃO DOS CAMPOS (Borda Escura Forçada)
  const inputStyle = "w-full p-2.5 bg-white border border-gray-400 rounded-md text-sm text-gray-900 focus:ring-2 focus:ring-blue-600 focus:border-blue-600 outline-none transition placeholder-gray-500 shadow-sm";
  const labelStyle = "block text-xs font-bold text-gray-600 uppercase mb-1";

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-gray-900">
      <main className="flex-1 p-6 max-w-[1600px] mx-auto w-full grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* --- SIDEBAR DE FILTROS --- */}
        <aside className="lg:col-span-1">
          <form onSubmit={(e) => { e.preventDefault(); buscar(1); }} className="bg-white p-6 rounded-lg shadow-md border border-gray-300 sticky top-24">
            <h2 className="font-bold text-gray-800 mb-5 border-b border-gray-200 pb-2 text-lg">Filtros</h2>
            
            <div className="space-y-5">
              
              {/* Palavra Chave */}
              <div>
                <label className={labelStyle}>Palavra-chave</label>
                <input type="text" className={inputStyle} placeholder="Nome, Razão ou CNPJ" value={filtros.termo} onChange={e => setFiltros({...filtros, termo: e.target.value})} />
              </div>

              {/* Situação */}
              <div>
                <label className={labelStyle}>Situação Cadastral</label>
                <select className={inputStyle} value={filtros.situacao} onChange={e => setFiltros({...filtros, situacao: e.target.value})}>
                  {situacoes.map(s => <option key={s.cod} value={s.cod}>{s.label}</option>)}
                </select>
              </div>

              {/* Porte */}
              <div>
                <label className={labelStyle}>Porte da Empresa</label>
                <select className={inputStyle} value={filtros.porte} onChange={e => setFiltros({...filtros, porte: e.target.value})}>
                  {portes.map(p => <option key={p.cod} value={p.cod}>{p.label}</option>)}
                </select>
              </div>

              {/* Estado */}
              <div>
                <label className={labelStyle}>Estado (UF)</label>
                <select className={inputStyle} value={filtros.uf} onChange={e => setFiltros({...filtros, uf: e.target.value, municipio: ''})}>
                  <option value="">-- Todos --</option>
                  {['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'].map(uf => <option key={uf} value={uf}>{uf}</option>)}
                </select>
              </div>

              {/* Município */}
              <div>
                <label className={labelStyle}>Município {loadingCidades && '...'}</label>
                <select className={inputStyle} value={filtros.municipio} onChange={e => setFiltros({...filtros, municipio: e.target.value})} disabled={!filtros.uf}>
                  <option value="">Todas as cidades</option>
                  {cidades.map(c => <option key={c.codigo} value={c.codigo}>{c.descricao}</option>)}
                </select>
              </div>

              {/* Datas */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={labelStyle}>Início (Abertura)</label>
                  <input type="date" className={inputStyle} value={filtros.dataInicio} onChange={e => setFiltros({...filtros, dataInicio: e.target.value})} />
                </div>
                <div>
                  <label className={labelStyle}>Fim (Abertura)</label>
                  <input type="date" className={inputStyle} value={filtros.dataFim} onChange={e => setFiltros({...filtros, dataFim: e.target.value})} />
                </div>
              </div>

              {/* Capital Social */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={labelStyle}>Capital Min (R$)</label>
                  <input type="number" className={inputStyle} placeholder="0" value={filtros.capitalMin} onChange={e => setFiltros({...filtros, capitalMin: e.target.value})} />
                </div>
                <div>
                  <label className={labelStyle}>Capital Max (R$)</label>
                  <input type="number" className={inputStyle} placeholder="Max" value={filtros.capitalMax} onChange={e => setFiltros({...filtros, capitalMax: e.target.value})} />
                </div>
              </div>

              {/* BOTÕES */}
              <div className="pt-4 space-y-3 border-t border-gray-200 mt-2">
                
                {/* BOTÃO APLICAR (AZUL) */}
                <button type="submit" disabled={loading} className="w-full bg-blue-700 hover:bg-blue-800 text-white font-bold py-3 rounded-md shadow transition flex justify-center items-center gap-2">
                  {loading ? "Pesquisando..." : "🔍 Aplicar Filtros"}
                </button>
                
                <div className="grid grid-cols-2 gap-3">
                  {/* BOTÃO EXPORTAR (VERDE) */}
                  <button type="button" onClick={handleExportar} disabled={exportando} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 rounded-md text-xs transition shadow">
                    {exportando ? "..." : "📥 Exportar"}
                  </button>
                  
                  {/* BOTÃO LIMPAR (VERMELHO) */}
                  <button type="button" onClick={limparFiltros} className="bg-white border border-red-500 text-red-600 hover:bg-red-50 font-bold py-2 rounded-md text-xs transition shadow">
                    Limpar
                  </button>
                </div>
              </div>

            </div>
          </form>
        </aside>

        {/* --- TABELA DE RESULTADOS --- */}
        <section className="lg:col-span-3">
          
          {buscou && (
            <div className="flex justify-between items-center mb-4 px-1">
              <h2 className="text-lg font-bold text-gray-800">
                Resultados: <span className="text-blue-700">{total}</span>
              </h2>
            </div>
          )}

          {loading ? (
            <div className="space-y-3">
              {[1,2,3,4,5].map(i => <div key={i} className="h-16 bg-white border border-gray-300 rounded animate-pulse"/>)}
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-sm border border-gray-300 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-gray-700">
                  <thead className="bg-gray-100 border-b border-gray-300 uppercase text-xs font-bold text-gray-600">
                    <tr>
                      <th className="px-4 py-3">Empresa</th>
                      <th className="px-4 py-3">CNPJ</th>
                      <th className="px-4 py-3">Cidade/UF</th>
                      <th className="px-4 py-3">Abertura</th>
                      <th className="px-4 py-3 text-right">Capital</th>
                      <th className="px-4 py-3 text-center">Status</th>
                      <th className="px-4 py-3 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {resultados.length === 0 && buscou && (
                      <tr><td colSpan={7} className="px-6 py-12 text-center text-gray-500">Nenhum resultado encontrado.</td></tr>
                    )}
                    {resultados.map((empresa, i) => (
                      <tr key={i} className="hover:bg-blue-50 transition">
                        <td className="px-4 py-3 max-w-[220px] truncate" title={empresa.razao_social}>
                          <div className="font-bold text-gray-900">{empresa.nome_fantasia || empresa.razao_social}</div>
                          <div className="text-xs text-gray-500">{empresa.razao_social}</div>
                        </td>
                        <td className="px-4 py-3 font-mono text-gray-800 text-xs">
                          {formatarCNPJ(empresa.cnpj_basico, empresa.cnpj_ordem, empresa.cnpj_dv)}
                        </td>
                        <td className="px-4 py-3 text-xs">{empresa.municipio}/{empresa.uf}</td>
                        <td className="px-4 py-3 text-xs">{formatarData(empresa.data_inicio_atividade)}</td>
                        <td className="px-4 py-3 text-right font-bold text-emerald-700 text-xs">{formatarDinheiro(empresa.capital_social)}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${empresa.situacao_cadastral === '02' ? 'bg-green-100 text-green-800 border-green-300' : 'bg-red-100 text-red-800 border-red-300'}`}>
                            {empresa.situacao_cadastral === '02' ? 'ATIVA' : 'INATIVA'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link
                            href={`/empresa/${empresa.cnpj_basico}${empresa.cnpj_ordem}${empresa.cnpj_dv}`}
                            className="text-blue-700 hover:underline font-bold text-xs"
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            VER DETALHES
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {total > 20 && (
                <div className="px-4 py-3 border-t border-gray-300 bg-gray-50 flex justify-between items-center">
                  <button onClick={() => buscar(pagina - 1)} disabled={pagina === 1} className="bg-white border border-gray-400 text-gray-700 px-3 py-1 rounded text-xs font-bold hover:bg-gray-100">Anterior</button>
                  <span className="text-xs font-bold text-gray-600">Página {pagina}</span>
                  <button onClick={() => buscar(pagina + 1)} disabled={resultados.length < 20} className="bg-white border border-gray-400 text-gray-700 px-3 py-1 rounded text-xs font-bold hover:bg-gray-100">Próxima</button>
                </div>
              )}
            </div>
          )}
        </section>

      </main>
    </div>
  );
}