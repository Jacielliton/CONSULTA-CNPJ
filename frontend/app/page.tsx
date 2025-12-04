"use client";
import { useState, FormEvent } from 'react';
import Link from 'next/link';

// --- CONFIGURAÇÃO DE AMBIENTE ---
// Se houver variável de ambiente configurada, usa ela. 
// Caso contrário, usa localhost (fallback para desenvolvimento local)
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

export default function Home() {
  // --- ESTADOS DA BUSCA ---
  const [termo, setTermo] = useState('');
  const [filtroUF, setFiltroUF] = useState('');
  const [filtroData, setFiltroData] = useState('');
  
  // --- ESTADOS DOS DADOS ---
  const [resultados, setResultados] = useState<Empresa[]>([]);
  const [totalResultados, setTotalResultados] = useState(0);
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [totalPaginas, setTotalPaginas] = useState(1);
  
  // --- ESTADOS DE CONTROLE ---
  const [loading, setLoading] = useState(false);
  const [buscou, setBuscou] = useState(false);
  const [avisoMuitosResultados, setAvisoMuitosResultados] = useState<{show: boolean, msg: string, detail: string}>({ show: false, msg: '', detail: '' });

  // --- ESTADOS DE EXPORTAÇÃO (MODAL) ---
  const [modalAberto, setModalAberto] = useState(false);
  const [tipoExport, setTipoExport] = useState('dia');
  const [ufExport, setUfExport] = useState('');
  const [valorExport, setValorExport] = useState('');
  const [dataFimExport, setDataFimExport] = useState('');
  const [loadingExport, setLoadingExport] = useState(false);

  // --- FUNÇÕES UTILITÁRIAS ---
  const formatarData = (dataString: string) => {
    if (!dataString || dataString.length !== 8) return dataString;
    const ano = dataString.substring(0, 4);
    const mes = dataString.substring(4, 6);
    const dia = dataString.substring(6, 8);
    return `${dia}/${mes}/${ano}`;
  };

  // --- LÓGICA DE BUSCA ---
  const realizarBusca = async (pagina: number) => {
    if (!termo && !filtroUF && !filtroData) {
      alert("Por favor, preencha pelo menos um filtro (Nome, Estado ou Data) para pesquisar.");
      return;
    }

    setLoading(true);
    setBuscou(true);
    setAvisoMuitosResultados({ show: false, msg: '', detail: '' });
    setResultados([]);

    try {
      const params = new URLSearchParams();
      if (termo) params.append('q', termo);
      if (filtroUF) params.append('uf', filtroUF);
      if (filtroData) params.append('data_abertura', filtroData);
      
      params.append('page', pagina.toString());
      params.append('limit', '10');

      // USO DA VARIÁVEL DE AMBIENTE AQUI
      const res = await fetch(`${API_BASE}/buscar?${params.toString()}`);
      
      if (!res.ok) {
        const erroMsg = await res.json();
        throw new Error(erroMsg.detail || 'Erro desconhecido na API');
      }

      const data = await res.json();
      
      if (data.status === 'too_broad') {
        setAvisoMuitosResultados({
          show: true,
          msg: data.message,
          detail: data.detail
        });
        setTotalResultados(data.total); 
        setResultados([]); 
      } else {
        setResultados(data.items);
        setTotalResultados(data.total);
        setPaginaAtual(data.page);
        setTotalPaginas(data.pages);
      }

    } catch (error: any) {
      console.error(error);
      alert(error.message || "Erro ao conectar com o servidor.");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    setPaginaAtual(1);
    realizarBusca(1);
  };

  const mudarPagina = (novaPagina: number) => {
    if (novaPagina >= 1 && novaPagina <= totalPaginas) {
      setPaginaAtual(novaPagina);
      realizarBusca(novaPagina);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // --- LÓGICA DE EXPORTAÇÃO ---
  const handleExportar = async () => {
    if (!valorExport && tipoExport !== 'intervalo') {
      alert("Preencha o valor da data/ano.");
      return;
    }
    if (tipoExport === 'intervalo' && (!valorExport || !dataFimExport)) {
      alert("Preencha as duas datas.");
      return;
    }

    setLoadingExport(true);
    
    try {
      const params = new URLSearchParams();
      params.append('tipo', tipoExport);
      if (ufExport) params.append('uf', ufExport);
      params.append('valor', valorExport);
      if (dataFimExport) params.append('data_fim', dataFimExport);

      // USO DA VARIÁVEL DE AMBIENTE AQUI TAMBÉM
      window.location.href = `${API_BASE}/exportar?${params.toString()}`;
      
    } catch (e) {
      alert("Erro ao iniciar download.");
    } finally {
      setLoadingExport(false);
      setModalAberto(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center py-10 px-4 relative">
      
      {/* --- CABEÇALHO --- */}
      <div className="w-full max-w-4xl text-center mb-8">
        <h1 className="text-4xl font-bold text-blue-800">Consulta CNPJ Otimizada</h1>
        <div className="flex flex-col sm:flex-row justify-center items-center gap-4 mt-4">
            <p className="text-gray-600">Base de dados oficial da Receita Federal.</p>
            <button 
                onClick={() => setModalAberto(true)}
                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 shadow-sm flex items-center gap-2 text-sm font-medium transition"
            >
                📂 Exportar Dados (CSV)
            </button>
        </div>
      </div>

      {/* --- MODAL DE EXPORTAÇÃO --- */}
      {modalAberto && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md animate-fade-in-up">
            <div className="flex justify-between items-center mb-4 border-b pb-2">
              <h2 className="text-xl font-bold text-gray-800">Exportar Relatório</h2>
              <button onClick={() => setModalAberto(false)} className="text-gray-500 hover:text-red-500 text-2xl">&times;</button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Filtro</label>
                <select 
                  className="w-full p-2 border rounded text-black bg-white"
                  value={tipoExport}
                  onChange={(e) => { setTipoExport(e.target.value); setValorExport(''); setDataFimExport(''); }}
                >
                  <option value="dia">Data Específica (Dia)</option>
                  <option value="mes">Mês e Ano</option>
                  <option value="ano">Ano Completo</option>
                  <option value="intervalo">Intervalo de Datas</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Estado (Opcional)</label>
                <select 
                  className="w-full p-2 border rounded text-black bg-white"
                  value={ufExport}
                  onChange={(e) => setUfExport(e.target.value)}
                >
                  <option value="">Todo o Brasil</option>
                  <option value="SP">SP</option><option value="RJ">RJ</option><option value="MG">MG</option>
                  <option value="RS">RS</option><option value="PR">PR</option><option value="SC">SC</option>
                  <option value="BA">BA</option><option value="MA">MA</option>
                  <option value="DF">DF</option>
                  <option value="GO">GO</option><option value="PE">PE</option>
                  <option value="CE">CE</option><option value="PA">PA</option>
                </select>
              </div>

              {tipoExport === 'dia' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Data</label>
                  <input type="date" className="w-full p-2 border rounded text-black" value={valorExport} onChange={e => setValorExport(e.target.value)} />
                </div>
              )}

              {tipoExport === 'mes' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Mês/Ano</label>
                  <input type="month" className="w-full p-2 border rounded text-black" value={valorExport} onChange={e => setValorExport(e.target.value)} />
                </div>
              )}

              {tipoExport === 'ano' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Ano (ex: 2023)</label>
                  <input type="number" min="1900" max="2030" className="w-full p-2 border rounded text-black" value={valorExport} onChange={e => setValorExport(e.target.value)} placeholder="2023" />
                </div>
              )}

              {tipoExport === 'intervalo' && (
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700">Início</label>
                    <input type="date" className="w-full p-2 border rounded text-black" value={valorExport} onChange={e => setValorExport(e.target.value)} />
                  </div>
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700">Fim</label>
                    <input type="date" className="w-full p-2 border rounded text-black" value={dataFimExport} onChange={e => setDataFimExport(e.target.value)} />
                  </div>
                </div>
              )}

              <button 
                onClick={handleExportar}
                disabled={loadingExport}
                className="w-full bg-green-600 text-white font-bold py-3 rounded hover:bg-green-700 transition mt-4 shadow-sm"
              >
                {loadingExport ? "Gerando Arquivo..." : "📥 Baixar CSV"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- FORMULÁRIO DE BUSCA --- */}
      <form onSubmit={handleSearch} className="w-full max-w-4xl bg-white p-6 rounded-xl shadow-lg border border-gray-200">
        <div className="flex flex-col md:flex-row gap-4 mb-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Empresa ou CNPJ</label>
            <input
              type="text"
              placeholder="Ex: Padaria, 12.345.678..."
              className="w-full p-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 text-black placeholder-gray-400"
              value={termo}
              onChange={(e) => setTermo(e.target.value)}
            />
          </div>
          <div className="w-full md:w-32">
            <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
            <select 
              className="w-full p-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 text-black bg-white"
              value={filtroUF}
              onChange={(e) => setFiltroUF(e.target.value)}
            >
              <option value="">Todos</option>
              <option value="SP">SP</option><option value="RJ">RJ</option><option value="MG">MG</option>
              <option value="RS">RS</option><option value="PR">PR</option><option value="SC">SC</option>
              <option value="BA">BA</option><option value="GO">GO</option><option value="PE">PE</option>
              <option value="CE">CE</option><option value="PA">PA</option>
              <option value="MA">MA</option>
              <option value="DF">DF</option>
              <option value="ES">ES</option>
              <option value="MT">MT</option>
            </select>
          </div>
          <div className="w-full md:w-48">
            <label className="block text-sm font-medium text-gray-700 mb-1">Data de Abertura</label>
            <input
              type="date"
              className="w-full p-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 text-black"
              value={filtroData}
              onChange={(e) => setFiltroData(e.target.value)}
            />
          </div>
        </div>

        <button 
          type="submit" 
          disabled={loading}
          className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 transition disabled:bg-gray-400 flex justify-center items-center gap-2"
        >
          {loading ? (
            <>
              <span className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></span>
              Buscando...
            </>
          ) : (
            "🔍 Pesquisar"
          )}
        </button>
      </form>

      {/* --- ÁREA DE RESULTADOS --- */}
      <div className="w-full max-w-4xl mt-8 mb-20">
        
        {/* ALERTA DE MUITOS RESULTADOS */}
        {avisoMuitosResultados.show && (
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-6 rounded shadow-md mb-6 animate-fade-in">
            <div className="flex items-start">
              <div className="flex-shrink-0 text-3xl">⚠️</div>
              <div className="ml-4">
                <p className="font-bold text-yellow-800 text-lg">{avisoMuitosResultados.msg}</p>
                <p className="text-yellow-700 mt-1">{avisoMuitosResultados.detail}</p>
              </div>
            </div>
          </div>
        )}

        {/* CONTADOR */}
        {buscou && !loading && !avisoMuitosResultados.show && (
          <div className="mb-4 text-gray-600 font-medium">
            Encontrados <strong>{totalResultados}</strong> resultados 
            {totalResultados > 0 && ` (Página ${paginaAtual} de ${totalPaginas})`}
          </div>
        )}

        {/* LISTA DE CARDS COM LINK */}
        <div className="space-y-4">
          {resultados.map((empresa, index) => (
            <Link 
              href={`/empresa/${empresa.cnpj_basico}${empresa.cnpj_ordem}${empresa.cnpj_dv}`} 
              key={index}
              className="block group"
            >
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:border-blue-400 hover:shadow-md transition cursor-pointer relative">
                
                {/* Seta indicativa de clique (aparece no hover) */}
                <div className="absolute right-4 top-4 opacity-0 group-hover:opacity-100 transition text-blue-500">
                  ↗
                </div>

                <div className="flex flex-col sm:flex-row justify-between items-start">
                  <div>
                    <h2 className="text-xl font-bold text-gray-800 group-hover:text-blue-700 transition">
                      {empresa.razao_social || empresa.nome_fantasia}
                    </h2>
                    <p className="text-sm text-gray-500 font-mono mt-1">
                      CNPJ: {empresa.cnpj_basico}.{empresa.cnpj_ordem}/{empresa.cnpj_dv}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs font-semibold bg-gray-100 text-gray-600 px-2 py-1 rounded border border-gray-300">
                        📅 Abertura: {formatarData(empresa.data_inicio_atividade)}
                      </span>
                    </div>
                  </div>
                  
                  <div className="text-left sm:text-right mt-4 sm:mt-0 flex flex-col items-start sm:items-end w-full sm:w-auto">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold mb-2 ${
                      empresa.situacao_cadastral === '02' ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-red-100 text-red-700 border border-red-200'
                    }`}>
                      {empresa.situacao_cadastral === '02' ? 'ATIVA' : 'INATIVA'}
                    </span>
                    <p className="text-xs text-gray-500 font-medium flex items-center gap-1">
                      📍 {empresa.municipio} / {empresa.uf}
                    </p>
                  </div>
                </div>
              </div>
            </Link>
          ))}

          {/* MENSAGEM VAZIA */}
          {buscou && !loading && resultados.length === 0 && !avisoMuitosResultados.show && (
            <div className="text-center py-16 bg-white rounded-xl border-2 border-dashed border-gray-300">
              <div className="text-4xl mb-4">📂</div>
              <p className="text-gray-500 text-lg font-medium">Nenhum resultado encontrado.</p>
              <p className="text-sm text-gray-400 mt-2">Tente remover alguns filtros ou mudar a data.</p>
            </div>
          )}
        </div>

        {/* PAGINAÇÃO */}
        {totalPaginas > 1 && !avisoMuitosResultados.show && (
          <div className="flex justify-center items-center gap-4 mt-10">
            <button
              onClick={() => mudarPagina(paginaAtual - 1)}
              disabled={paginaAtual === 1 || loading}
              className="px-4 py-2 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 text-gray-700 transition font-medium"
            >
              ← Anterior
            </button>
            
            <span className="text-gray-700 font-semibold">
              {paginaAtual} / {totalPaginas}
            </span>

            <button
              onClick={() => mudarPagina(paginaAtual + 1)}
              disabled={paginaAtual === totalPaginas || loading}
              className="px-4 py-2 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 text-gray-700 transition font-medium"
            >
              Próxima →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}