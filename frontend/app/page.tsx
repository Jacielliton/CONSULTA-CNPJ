"use client";
import { useState, FormEvent } from 'react';

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
  // --- ESTADOS DO FILTRO ---
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

  // Formata data de YYYYMMDD (Banco) para DD/MM/YYYY (Visual)
  const formatarData = (dataString: string) => {
    if (!dataString || dataString.length !== 8) return dataString;
    const ano = dataString.substring(0, 4);
    const mes = dataString.substring(4, 6);
    const dia = dataString.substring(6, 8);
    return `${dia}/${mes}/${ano}`;
  };

  const realizarBusca = async (pagina: number) => {
    // VALIDAÇÃO: Pelo menos um campo deve estar preenchido para não sobrecarregar
    if (!termo && !filtroUF && !filtroData) {
      alert("Por favor, preencha pelo menos um filtro (Nome, Estado ou Data) para pesquisar.");
      return;
    }

    setLoading(true);
    setBuscou(true);
    setAvisoMuitosResultados({ show: false, msg: '', detail: '' }); // Limpa alertas anteriores
    setResultados([]); // Limpa lista visualmente enquanto carrega

    try {
      // Monta a URL com os parâmetros preenchidos
      const params = new URLSearchParams();
      if (termo) params.append('q', termo);
      if (filtroUF) params.append('uf', filtroUF);
      if (filtroData) params.append('data_abertura', filtroData);
      
      params.append('page', pagina.toString());
      params.append('limit', '10');

      // Faz a requisição ao Backend
      const res = await fetch(`http://127.0.0.1:8000/buscar?${params.toString()}`);
      
      // Tratamento de erros HTTP (400, 500, etc)
      if (!res.ok) {
        const erroMsg = await res.json();
        throw new Error(erroMsg.detail || 'Erro desconhecido na API');
      }

      const data = await res.json();
      
      // --- LÓGICA DO FREIO DE SEGURANÇA ---
      if (data.status === 'too_broad') {
        setAvisoMuitosResultados({
          show: true,
          msg: data.message,   // Ex: "Muitos resultados encontrados (+1000)"
          detail: data.detail  // Ex: "Adicione um filtro de Estado..."
        });
        setTotalResultados(data.total); 
        setResultados([]); // Não exibe itens para não travar o navegador
      } else {
        // Busca normal com sucesso
        setResultados(data.items);
        setTotalResultados(data.total);
        setPaginaAtual(data.page);
        setTotalPaginas(data.pages);
      }

    } catch (error: any) {
      console.error(error);
      // Se o erro for nossa mensagem tratada, mostra alerta, senão erro genérico
      alert(error.message || "Erro ao conectar com o servidor. Verifique se o backend está rodando.");
    } finally {
      setLoading(false);
    }
  };

  // Handler do botão "Pesquisar"
  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    setPaginaAtual(1);
    realizarBusca(1);
  };

  // Handler da Paginação
  const mudarPagina = (novaPagina: number) => {
    if (novaPagina >= 1 && novaPagina <= totalPaginas) {
      setPaginaAtual(novaPagina);
      realizarBusca(novaPagina);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center py-10 px-4">
      
      {/* --- CABEÇALHO --- */}
      <div className="w-full max-w-4xl text-center mb-8">
        <h1 className="text-4xl font-bold text-blue-800">Consulta CNPJ Otimizada</h1>
        <p className="text-gray-600">Filtre por data e estado para buscas ultrarrápidas em milhões de empresas.</p>
      </div>

      {/* --- FORMULÁRIO --- */}
      <form onSubmit={handleSearch} className="w-full max-w-4xl bg-white p-6 rounded-xl shadow-lg border border-gray-200">
        <div className="flex flex-col md:flex-row gap-4 mb-4">
          
          {/* Input Texto */}
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
          
          {/* Select UF */}
          <div className="w-full md:w-32">
            <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
            <select 
              className="w-full p-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 text-black bg-white"
              value={filtroUF}
              onChange={(e) => setFiltroUF(e.target.value)}
            >
              <option value="">Todos</option>
              <option value="AC">AC</option><option value="AL">AL</option><option value="AP">AP</option>
              <option value="AM">AM</option><option value="BA">BA</option><option value="CE">CE</option>
              <option value="DF">DF</option><option value="ES">ES</option><option value="GO">GO</option>
              <option value="MA">MA</option><option value="MT">MT</option><option value="MS">MS</option>
              <option value="MG">MG</option><option value="PA">PA</option><option value="PB">PB</option>
              <option value="PR">PR</option><option value="PE">PE</option><option value="PI">PI</option>
              <option value="RJ">RJ</option><option value="RN">RN</option><option value="RS">RS</option>
              <option value="RO">RO</option><option value="RR">RR</option><option value="SC">SC</option>
              <option value="SP">SP</option><option value="SE">SE</option><option value="TO">TO</option>
            </select>
          </div>

          {/* Input Data */}
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
        
        {/* ALERTA DE MUITOS RESULTADOS (FREIO) */}
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

        {/* CONTADOR DE RESULTADOS (NORMAL) */}
        {buscou && !loading && !avisoMuitosResultados.show && (
          <div className="mb-4 text-gray-600 font-medium">
            Encontrados <strong>{totalResultados}</strong> resultados 
            {totalResultados > 0 && ` (Página ${paginaAtual} de ${totalPaginas})`}
          </div>
        )}

        {/* LISTA DE CARDS */}
        <div className="space-y-4">
          {resultados.map((empresa, index) => (
            <div key={index} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:border-blue-400 transition group">
              <div className="flex justify-between items-start">
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
                
                <div className="text-right flex flex-col items-end">
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
          ))}

          {/* MENSAGEM DE "NADA ENCONTRADO" */}
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