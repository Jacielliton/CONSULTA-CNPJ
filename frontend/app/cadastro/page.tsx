"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export default function Cadastro() {
  const router = useRouter();
  const [form, setForm] = useState({ nome: "", email: "", senha: "", contato: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Erro ao cadastrar");

      alert("Cadastro realizado! Faça login.");
      router.push("/login");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-800">Crie sua Conta</h1>
          <p className="text-gray-500 text-sm">Acesso completo à inteligência de dados</p>
        </div>

        {error && <div className="bg-red-50 text-red-600 p-3 rounded text-sm mb-4">{error}</div>}

        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome Completo</label>
            <input
              type="text"
              required
              className="w-full p-2 border rounded"
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp / Contato</label>
            <input
              type="text"
              required
              placeholder="(00) 00000-0000"
              className="w-full p-2 border rounded"
              value={form.contato}
              onChange={(e) => setForm({ ...form, contato: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
            <input
              type="email"
              required
              className="w-full p-2 border rounded"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
            <input
              type="password"
              required
              className="w-full p-2 border rounded"
              value={form.senha}
              onChange={(e) => setForm({ ...form, senha: e.target.value })}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-600 text-white font-bold py-2.5 rounded hover:bg-green-700 transition disabled:opacity-50"
          >
            {loading ? "Cadastrando..." : "Criar Conta"}
          </button>
        </form>

        <p className="text-center text-sm text-gray-600 mt-6">
          Já tem conta?{" "}
          <Link href="/login" className="text-blue-600 hover:underline font-semibold">
            Fazer Login
          </Link>
        </p>
      </div>
    </div>
  );
}