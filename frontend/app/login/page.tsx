"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Cookies from "js-cookie";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export default function Login() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", senha: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Erro ao entrar");

      // Salva token e flag de admin
      Cookies.set("auth_token", data.access_token, { expires: 1 });
      Cookies.set("user_name", data.user_name, { expires: 1 });
      Cookies.set("is_admin", data.is_admin ? "true" : "false", { expires: 1 }); // NOVO

      router.push("/dashboard");
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
          <h1 className="text-2xl font-bold text-gray-800">Acesse sua Conta</h1>
          <p className="text-gray-500 text-sm">Bem-vindo de volta à Plataforma</p>
        </div>

        {error && <div className="bg-red-50 text-red-600 p-3 rounded text-sm mb-4">{error}</div>}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
            <input
              type="email"
              required
              className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
            <input
              type="password"
              required
              className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
              value={form.senha}
              onChange={(e) => setForm({ ...form, senha: e.target.value })}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white font-bold py-2.5 rounded hover:bg-blue-700 transition disabled:opacity-50"
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>

        <p className="text-center text-sm text-gray-600 mt-6">
          Não tem conta?{" "}
          <Link href="/cadastro" className="text-blue-600 hover:underline font-semibold">
            Cadastre-se grátis
          </Link>
        </p>
      </div>
    </div>
  );
}