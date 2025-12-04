"use client";
import { useState, useEffect } from "react";

export default function AdminPanel() {
  const [stats, setStats] = useState({ 
    postgres_empresas: 0, 
    postgres_tamanho: "Carregando...",
    elastic_empresas: 0,
    elastic_status: "Verificando..."
  });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [osTab, setOsTab] = useState<'windows' | 'linux'>('linux'); // Padrão Linux já que estamos na VPS

  // Carrega estatísticas ao abrir e a cada 10s
  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchStats = async () => {
    try {
      // Tenta pegar a URL da API do env ou usa localhost
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
      const res = await fetch(`${apiUrl}/admin/stats`);
      const data = await res.json();
      setStats(data);
    } catch (e) {
      console.error(e);
    }
  };

  const executarAcao = async (acao: string, metodo = "POST") => {
    if (acao === "limpar" && !confirm("TEM CERTEZA? Isso apagará TUDO!")) return;
    
    setLoading(true);
    setMsg("Processando comando...");
    
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
      const res = await fetch(`${apiUrl}/admin/${acao}`, { method: metodo });
      const data = await res.json();
      setMsg(data.status || "Comando enviado!");
      
      if (acao === "limpar") setTimeout(fetchStats, 1000);
      
    } catch (error) {
      setMsg("Erro ao comunicar com servidor API.");
    } finally {
      setLoading(false);
      setTimeout(() => setMsg(""), 5000);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-6xl mx-auto">
        
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Painel de Controle</h1>
            <p className="text-gray-500">Gestão do Sistema CNPJ</p>
          </div>
          <a href="/" className="text-blue-600 hover:underline">← Voltar para Busca</a>
        </div>

        {/* Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          
          <div className="bg-white p-6 rounded-lg shadow border-l-4 border-blue-500">
            <h3 className="text-gray-500 text-xs font-bold uppercase">PostgreSQL (Base)</h3>
            <p className="text-2xl font-bold text-gray-800">
              {stats.postgres_empresas ? stats.postgres_empresas.toLocaleString() : 0}
            </p>
            <span className="text-xs text-gray-400">Registros Brutos</span>
          </div>

          <div className="bg-white p-6 rounded-lg shadow border-l-4 border-green-500">
            <h3 className="text-gray-500 text-xs font-bold uppercase">Elasticsearch (Busca)</h3>
            <p className="text-2xl font-bold text-gray-800">
              {stats.elastic_empresas ? stats.elastic_empresas.toLocaleString() : 0}
            </p>
             <span className="text-xs text-gray-400">Disponíveis na Pesquisa</span>
          </div>

          <div className="bg-white p-6 rounded-lg shadow border-l-4 border-purple-500">
            <h3 className="text-gray-500 text-xs font-bold uppercase">Tamanho em Disco</h3>
            <p className="text-2xl font-bold text-gray-800">{stats.postgres_tamanho}</p>
            <span className="text-xs text-gray-400">Apenas Postgres</span>
          </div>

          <div className="bg-white p-6 rounded-lg shadow border-l-4 border-orange-500">
            <h3 className="text-gray-500 text-xs font-bold uppercase">Status Elastic</h3>
            <p className={`text-2xl font-bold ${stats.elastic_status?.includes("Online") ? "text-green-600" : "text-red-600"}`}>
              {stats.elastic_status}
            </p>
          </div>

        </div>

        {/* Feedback Message */}
        {msg && (
          <div className="bg-blue-100 border border-blue-400 text-blue-700 px-4 py-3 rounded mb-6 animate-pulse">
            {msg}
          </div>
        )}

        {/* Actions Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          
          {/* Manutenção de Dados */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold mb-4 border-b pb-2 flex items-center gap-2">
              🛠️ Manutenção Automática
            </h2>
            <div className="space-y-6">
              
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="font-semibold text-gray-800">Atualizar Tudo</h3>
                  <p className="text-xs text-gray-500 max-w-xs">Download + Importação + Elastic. (Demora Horas)</p>
                </div>
                <button 
                  onClick={() => executarAcao("atualizar")} 
                  disabled={loading}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm disabled:opacity-50"
                >
                  Iniciar Auto
                </button>
              </div>

              <div className="flex justify-between items-center">
                <div>
                  <h3 className="font-semibold text-gray-800">Sincronizar Elastic</h3>
                  <p className="text-xs text-gray-500 max-w-xs">Copia dados do Postgres para o Elastic.</p>
                </div>
                <button 
                  onClick={() => executarAcao("sincronizar_elastic")} 
                  disabled={loading}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded text-sm disabled:opacity-50"
                >
                  Sincronizar
                </button>
              </div>

              <div className="flex justify-between items-center">
                <div>
                  <h3 className="font-semibold text-gray-800">Otimizar Banco</h3>
                  <p className="text-xs text-gray-500 max-w-xs">Cria índices no Postgres (B-Tree).</p>
                </div>
                <button 
                  onClick={() => executarAcao("otimizar")}
                  disabled={loading} 
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded text-sm disabled:opacity-50"
                >
                  Otimizar
                </button>
              </div>

            </div>
          </div>

          {/* Zona de Perigo e Backup */}
          <div className="space-y-6">
            
            <div className="bg-white rounded-lg shadow p-6">
               <h2 className="text-xl font-bold mb-4 border-b pb-2">💾 Backup</h2>
               <div className="flex justify-between items-center">
                  <div>
                    <h3 className="font-semibold text-gray-800">Exportar CSV</h3>
                    <p className="text-xs text-gray-500">Salva tabelas na pasta de backups.</p>
                  </div>
                  <button 
                     onClick={() => executarAcao("backup")}
                     disabled={loading}
                     className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded text-sm disabled:opacity-50"
                  >
                    Gerar Backup
                  </button>
                </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6 border-t-4 border-red-500">
              <h2 className="text-xl font-bold mb-4 border-b pb-2 text-red-600">⛔ Zona de Perigo</h2>
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="font-semibold text-red-700">Limpar Tudo</h3>
                  <p className="text-xs text-gray-500">Apaga Postgres E Elastic.</p>
                </div>
                <button 
                   onClick={() => executarAcao("limpar", "DELETE")}
                   disabled={loading}
                   className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded text-sm disabled:opacity-50"
                >
                  APAGAR TUDO
                </button>
              </div>
            </div>

          </div>
        </div>

        {/* --- TUTORIAL MANUAL VIA TERMINAL --- */}
        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold flex items-center gap-2">
              💻 Comandos Manuais (Terminal)
            </h2>
            <div className="bg-gray-200 p-1 rounded flex gap-1">
              <button 
                onClick={() => setOsTab('windows')}
                className={`px-3 py-1 text-xs font-bold rounded ${osTab === 'windows' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Windows (Local)
              </button>
              <button 
                onClick={() => setOsTab('linux')}
                className={`px-3 py-1 text-xs font-bold rounded ${osTab === 'linux' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Linux (VPS)
              </button>
            </div>
          </div>
          
          <p className="text-gray-600 mb-4 text-sm">
            Execute na pasta <code>backend</code>. {osTab === 'linux' ? 'Use SCREEN para processos longos!' : ''}
          </p>

          <div className="bg-gray-900 text-gray-200 p-4 rounded-lg font-mono text-sm overflow-x-auto border border-gray-700 shadow-inner">
            
            <div className="mb-4">
              <p className="text-gray-500 mb-1"># 1. Ativar Ambiente Virtual</p>
              {osTab === 'windows' ? (
                <p className="text-green-400 select-all">.\venv\Scripts\Activate.ps1</p>
              ) : (
                <p className="text-green-400 select-all">source venv/bin/activate</p>
              )}
            </div>

            <div className="mb-4">
              <p className="text-gray-500 mb-1"># 2. Verificar Containers</p>
              <p className="text-green-400 select-all">docker compose ps</p>
            </div>

            <div className="mb-4 border-t border-gray-700 pt-4">
              <p className="text-yellow-500 font-bold mb-2">--- SEQUÊNCIA DE ATUALIZAÇÃO ---</p>
              
              {osTab === 'linux' && (
                <div className="mb-3">
                  <p className="text-purple-400 font-bold mb-1">⚠️ DICA VPS: Use o 'screen' para não cair a conexão</p>
                  <p className="text-gray-400 select-all">screen -S importacao</p>
                  <p className="text-gray-500 text-xs italic">Para sair sem fechar: Ctrl+A depois D</p>
                </div>
              )}

              <p className="text-gray-500 mb-1"># A: Baixar dados</p>
              <p className="text-green-400 select-all mb-3">python etl_download.py</p>

              <p className="text-gray-500 mb-1"># B: Importar (Demorado)</p>
              <p className="text-green-400 select-all mb-3">python etl_import.py</p>

              <p className="text-gray-500 mb-1"># C: Criar Índices</p>
              <p className="text-green-400 select-all mb-3">python etl_optimize_db.py</p>

              <p className="text-gray-500 mb-1"># D: Sincronizar Elastic</p>
              <p className="text-green-400 select-all">python etl_sync_es.py</p>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}