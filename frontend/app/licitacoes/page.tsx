"use client";
import { useState, useEffect } from 'react';
import Link from 'next/link';

// Configuração de API
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

// --- ÍCONES (SVG Components) ---
const Icons = {
    Globe: () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>,
    Book: () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>,
    Loading: () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>,
    Megaphone: () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3"><path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/></svg>,
    Tag: () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3"><path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94 .94-2.48 0-3.42L12 2Z"/><path d="M7 7h.01"/></svg>,
    Search: () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-12 h-12"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>,
    Filter: () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
};

export default function LicitacoesPage() {
    const [source, setSource] = useState('TCE'); 
    const [licitacoes, setLicitacoes] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    // Datas
    const today = new Date().toISOString().split('T')[0];
    const nextWeekDate = new Date();
    nextWeekDate.setDate(new Date().getDate() + 7);
    const nextWeek = nextWeekDate.toISOString().split('T')[0];
    
    const [dataInicio, setDataInicio] = useState(today);
    const [dataFim, setDataFim] = useState(nextWeek);
    
    // Filtros
    const [tipoProcedimento, setTipoProcedimento] = useState("PP");
    const [finalidade, setFinalidade] = useState("");
    const [termoPesquisa, setTermoPesquisa] = useState("Pregão Presencial");
    const [filtroTitulo, setFiltroTitulo] = useState("");
    const [filtroCategoria, setFiltroCategoria] = useState("Aviso de Licitação");

    const fetchLicitacoes = async () => {
        setLoading(true);
        setError(null);
        setLicitacoes([]);
        
        try {
            const params = new URLSearchParams({ data_inicio: dataInicio, data_fim: dataFim });
            
            if (source === 'FAMEM') {
                params.append('termo', termoPesquisa);
                if(filtroTitulo) params.append('titulo', filtroTitulo);
                if(filtroCategoria) params.append('categoria', filtroCategoria);
            } else {
                params.append('tipo_procedimento', tipoProcedimento);
                if(finalidade) params.append('finalidade', finalidade);
            }
            
            const endpoint = source === 'TCE' ? '/api/licitacoes/tce' : '/api/licitacoes/famem';
            const res = await fetch(`${API_BASE}${endpoint}?${params}`);
            
            if (!res.ok) throw new Error('Erro ao buscar dados.');
            const result = await res.json();
            
            if (result.status === 'success') {
                setLicitacoes(result.data);
            } else {
                throw new Error(result.message);
            }
        } catch (err: any) {
            setError(err.message || "Erro de conexão");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { setLicitacoes([]); setError(null); }, [source]); 

    // --- CONSTANTES DE OPÇÕES ---
    const TIPOS_PROCEDIMENTO = [
        { code: 'PP', label: 'Pregão Presencial' }, { code: 'PE', label: 'Pregão Eletrônico' },
        { code: 'TP', label: 'Tomada de Preços' }, { code: 'CP', label: 'Concorrência' },
        { code: 'DI', label: 'Dispensa' }, { code: 'IN', label: 'Inexigibilidade' }
    ];
    const FAMEM_OPCOES_TITULO = [
        { value: '', label: 'Todos os Títulos' }, { value: 'Pregão Presencial', label: 'Pregão Presencial' },
        { value: 'Pregão Eletrônico', label: 'Pregão Eletrônico' }, { value: 'Tomada de Preços', label: 'Tomada de Preços' }
    ];
    const FAMEM_OPCOES_CATEGORIA = [
        { value: '', label: 'Todas' }, { value: 'Aviso de Licitação', label: 'Aviso de Licitação' },
        { value: 'Aviso de Homologação', label: 'Aviso de Homologação' }, { value: 'Extrato de Contrato', label: 'Extrato de Contrato' }
    ];

    const formatMoney = (val: any) => {
        if(!val || val === 0) return "Não informado";
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
    };
    const formatDate = (d: string) => { if(!d) return '--/--'; const [y,m,day] = d.split('-'); return `${day}/${m}`; };

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col">
            
            {/* Header */}
            <header className="bg-white border-b px-6 py-4 flex justify-between items-center sticky top-0 z-20">
                <div>
                    <h1 className="text-xl font-bold text-blue-800 flex items-center gap-2">
                        📜 Monitor de Licitações (MA)
                    </h1>
                    <p className="text-xs text-gray-500">Acompanhe editais do TCE e Diário Oficial</p>
                </div>                
            </header>

            <div className="flex flex-1">
                {/* Sidebar */}
                <aside className="w-64 bg-white border-r border-gray-200 hidden md:block p-4">
                    <div className="space-y-1">
                        <p className="text-xs font-bold text-gray-400 uppercase mb-2 px-2">Fontes de Dados</p>
                        <button onClick={() => setSource('TCE')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition ${source === 'TCE' ? 'bg-blue-50 text-blue-700 border border-blue-100' : 'text-gray-600 hover:bg-gray-50'}`}>
                            <Icons.Globe /> TCE-MA (Mural)
                        </button>
                        <button onClick={() => setSource('FAMEM')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition ${source === 'FAMEM' ? 'bg-blue-50 text-blue-700 border border-blue-100' : 'text-gray-600 hover:bg-gray-50'}`}>
                            <Icons.Book /> FAMEM (Diário)
                        </button>
                    </div>
                </aside>

                {/* Main */}
                <main className="flex-1 p-6">
                    
                    {/* Filtros */}
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm mb-6 flex flex-wrap gap-4 items-end">
                        {source === 'TCE' ? (
                            <div className="flex flex-col">
                                <label className="text-xs font-bold text-gray-500 mb-1">Tipo</label>
                                <select value={tipoProcedimento} onChange={e => setTipoProcedimento(e.target.value)} className="p-2 border rounded text-sm text-black bg-white">
                                    {TIPOS_PROCEDIMENTO.map(t => <option key={t.code} value={t.code}>{t.label}</option>)}
                                </select>
                            </div>
                        ) : (
                            <>
                                <div className="flex flex-col">
                                    <label className="text-xs font-bold text-gray-500 mb-1">Título</label>
                                    <select value={filtroTitulo} onChange={e => setFiltroTitulo(e.target.value)} className="p-2 border rounded text-sm text-black bg-white w-40">
                                        {FAMEM_OPCOES_TITULO.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                    </select>
                                </div>
                                <div className="flex flex-col">
                                    <label className="text-xs font-bold text-gray-500 mb-1">Categoria</label>
                                    <select value={filtroCategoria} onChange={e => setFiltroCategoria(e.target.value)} className="p-2 border rounded text-sm text-black bg-white w-40">
                                        {FAMEM_OPCOES_CATEGORIA.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                    </select>
                                </div>
                            </>
                        )}

                        <div className="flex flex-col">
                            <label className="text-xs font-bold text-gray-500 mb-1">Período</label>
                            <div className="flex items-center gap-2">
                                <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} className="p-2 border rounded text-sm text-black" />
                                <span className="text-gray-400">-</span>
                                <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} className="p-2 border rounded text-sm text-black" />
                            </div>
                        </div>

                        <button onClick={fetchLicitacoes} disabled={loading} className="bg-blue-600 text-white px-6 py-2 rounded font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 text-sm h-[38px]">
                            {loading ? <Icons.Loading /> : <Icons.Filter />} Buscar
                        </button>
                    </div>

                    {/* Resultados */}
                    {error && <div className="bg-red-50 text-red-600 p-4 rounded mb-4 text-sm">{error}</div>}

                    <div className="grid grid-cols-1 gap-4">
                        {licitacoes.map((lic, i) => (
                            <div key={i} className="bg-white p-5 rounded-lg border border-gray-100 hover:shadow-md transition flex flex-col md:flex-row gap-6">
                                <div className="flex-shrink-0 flex flex-col items-center justify-center bg-blue-50 text-blue-700 rounded w-16 h-16 border border-blue-100">
                                    <span className="text-lg font-bold">{formatDate(lic.data_sessao).split('/')[0]}</span>
                                    <span className="text-xs uppercase">{formatDate(lic.data_sessao).split('/')[1]}</span>
                                </div>
                                <div className="flex-grow">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="bg-gray-100 text-gray-600 text-[10px] font-bold px-2 py-0.5 rounded">{lic.municipio}</span>
                                        <span className="text-xs text-gray-400 flex items-center gap-1"><Icons.Megaphone /> {lic.id}</span>
                                    </div>
                                    <h3 className="text-base font-bold text-gray-900 mb-2 leading-snug">{lic.objeto}</h3>
                                    <div className="flex gap-3 text-xs text-gray-500">
                                        <span className="flex items-center gap-1 bg-gray-50 px-2 py-1 rounded"><Icons.Tag /> {lic.criterio}</span>
                                    </div>
                                </div>
                                <div className="text-right flex flex-col justify-between">
                                    <div>
                                        <div className="text-xs text-gray-400">Valor Estimado</div>
                                        <div className="text-sm font-bold text-emerald-600">{formatMoney(lic.valor_estimado)}</div>
                                    </div>
                                    <a href={lic.link_edital} target="_blank" className="text-xs font-bold text-blue-600 hover:underline mt-2">
                                        Ver Edital →
                                    </a>
                                </div>
                            </div>
                        ))}
                    </div>

                    {!loading && licitacoes.length === 0 && !error && (
                        <div className="text-center py-20 opacity-40">
                            <div className="flex justify-center mb-2"><Icons.Search /></div>
                            <p>Nenhuma licitação encontrada.</p>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
}