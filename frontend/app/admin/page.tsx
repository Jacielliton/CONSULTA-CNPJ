"use client";
import { useState, useEffect } from "react";

export default function AdminPanel() {
  const [stats, setStats] = useState({ total_empresas: 0, tamanho_db: "Carregando..." });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  // Carrega estatísticas ao abrir
  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const res = await fetch("http://127.0.0.1:8000/admin/stats");
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
      const res = await fetch(`http://127.0.0.1:8000/admin/${acao}`, { method: metodo });
      const data = await res.json();
      setMsg(data.status || "Comando enviado!");
      
      // Se limpou, atualiza stats
      if (acao === "limpar") fetchStats();
      
    } catch (error) {
      setMsg("Erro ao comunicar com servidor.");
    } finally {
      setLoading(false);
      // Limpa mensagem após 5s
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow border-l-4 border-blue-500">
            <h3 className="text-gray-500 text-sm font-bold uppercase">Empresas Indexadas</h3>
            <p className="text-3xl font-bold text-gray-800">{stats.total_empresas.toLocaleString()}</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow border-l-4 border-purple-500">
            <h3 className="text-gray-500 text-sm font-bold uppercase">Tamanho do Banco</h3>
            <p className="text-3xl font-bold text-gray-800">{stats.tamanho_db}</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow border-l-4 border-green-500">
            <h3 className="text-gray-500 text-sm font-bold uppercase">Status da API</h3>
            <p className="text-3xl font-bold text-green-600">ONLINE</p>
          </div>
        </div>

        {/* Feedback Message */}
        {msg && (
          <div className="bg-blue-100 border border-blue-400 text-blue-700 px-4 py-3 rounded mb-6">
            {msg}
          </div>
        )}

        {/* Actions Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* Manutenção de Dados */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold mb-4 border-b pb-2">🛠️ Manutenção de Dados</h2>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="font-semibold">Atualizar Base Completa</h3>
                  <p className="text-sm text-gray-500">Baixa dados da Receita e importa.</p>
                </div>
                <button 
                  onClick={() => executarAcao("atualizar")} 
                  disabled={loading}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded disabled:opacity-50"
                >
                  {loading ? "..." : "Iniciar"}
                </button>
              </div>

              <div className="flex justify-between items-center">
                <div>
                  <h3 className="font-semibold">Otimizar Banco</h3>
                  <p className="text-sm text-gray-500">Cria índices para busca rápida.</p>
                </div>
                <button 
                  onClick={() => executarAcao("otimizar")}
                  disabled={loading} 
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded disabled:opacity-50"
                >
                  Otimizar
                </button>
              </div>

              <div className="flex justify-between items-center">
                <div>
                  <h3 className="font-semibold">Fazer Backup</h3>
                  <p className="text-sm text-gray-500">Exporta dados para CSV.</p>
                </div>
                <button 
                   onClick={() => executarAcao("backup")}
                   disabled={loading}
                   className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded disabled:opacity-50"
                >
                  Backup
                </button>
              </div>
            </div>
          </div>

          {/* Zona de Perigo */}
          <div className="bg-white rounded-lg shadow p-6 border-t-4 border-red-500">
            <h2 className="text-xl font-bold mb-4 border-b pb-2 text-red-600">⛔ Zona de Perigo</h2>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="font-semibold text-red-700">Limpar Banco de Dados</h3>
                  <p className="text-sm text-gray-500">Apaga todas as empresas e sócios.</p>
                </div>
                <button 
                   onClick={() => executarAcao("limpar", "DELETE")}
                   disabled={loading}
                   className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded disabled:opacity-50"
                >
                  Apagar Tudo
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Tutoriais / Logs */}
        <div className="mt-8 bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold mb-4">📚 Tutoriais & Documentação</h2>
          <ul className="list-disc pl-5 space-y-2 text-gray-700">
            <li><strong>Como Atualizar:</strong> O botão "Atualizar Base" verifica automaticamente a data mais recente no site da Receita Federal. O processo roda em segundo plano e pode levar horas.</li>
            <li><strong>Backup:</strong> Os arquivos .csv são salvos na pasta <code>backend/backups</code>.</li>
            <li><strong>Monitoramento:</strong> Para ver o progresso real das importações, olhe o terminal onde o Backend está rodando (lá aparecem as barras de progresso).</li>
          </ul>
        </div>

      </div>
    </div>
  );
}