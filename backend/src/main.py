import os
import subprocess
from fastapi import FastAPI, HTTPException, BackgroundTasks, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, text
from typing import Optional
from datetime import datetime

app = FastAPI(title="API Casa dos Dados Clone")

# --- CONFIGURAÇÃO CORS ---
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- BANCO DE DADOS (DOCKER / WINDOWS) ---
DB_USER = "user_cnpj"
DB_PASS = "password_cnpj"
DB_HOST = "127.0.0.1"
DB_PORT = "5433"
DB_NAME = "cnpj_dados"

# Usando driver pg8000 para compatibilidade total
DATABASE_URL = f"postgresql+pg8000://{DB_USER}:{DB_PASS}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
engine = create_engine(DATABASE_URL)

# --- FUNÇÕES AUXILIARES (ADMIN) ---
def executar_script(nome_script):
    try:
        pasta_raiz = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        caminho_script = os.path.join(pasta_raiz, nome_script)
        # cwd define onde o script vai rodar (na raiz do backend)
        subprocess.run(["python", caminho_script], check=True, cwd=pasta_raiz)
        print(f"[ADMIN] {nome_script} executado com sucesso.")
    except Exception as e:
        print(f"[ERRO] Falha ao rodar {nome_script}: {e}")

def realizar_backup():
    pasta_raiz = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    pasta_backup = os.path.join(pasta_raiz, "backups")
    
    if not os.path.exists(pasta_backup):
        os.makedirs(pasta_backup)
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    tabelas = ["empresas", "estabelecimentos", "socios"]
    
    print(f"[BACKUP] Iniciando em: {pasta_backup}")
    with engine.connect() as conn:
        for tabela in tabelas:
            arquivo = os.path.join(pasta_backup, f"{tabela}_{timestamp}.csv")
            try:
                with open(arquivo, 'w', encoding='utf-8') as f:
                    cursor = conn.connection.cursor()
                    # Exportação rápida usando COPY
                    sql = f"COPY (SELECT * FROM {tabela}) TO STDOUT WITH CSV HEADER"
                    cursor.execute(sql, stream=f)
                print(f"   -> {tabela} salvo.")
            except Exception as e:
                print(f"   -> Erro ao salvar {tabela}: {e}")

# --- ROTAS PÚBLICAS ---

@app.get("/")
def home():
    return {"message": "API Online 🚀", "docs": "/docs"}

@app.get("/buscar")
def buscar_empresa(
    q: Optional[str] = Query(None, description="Termo de busca (CNPJ ou Nome)"),
    page: int = Query(1, ge=1, description="Número da página"),
    limit: int = Query(10, ge=1, le=100, description="Itens por página"),
    uf: Optional[str] = Query(None, min_length=2, max_length=2, description="Filtro de Estado (UF)"),
    data_abertura: Optional[str] = Query(None, description="Data de abertura (YYYY-MM-DD)")
):
    # Limpeza e Preparação
    offset = (page - 1) * limit
    termo_limpo = q.replace(".", "").replace("/", "").replace("-", "") if q else ""
    tem_filtros = (uf is not None) or (data_abertura is not None)

    # 1. Validação de Segurança
    if not q and not tem_filtros:
        raise HTTPException(status_code=400, detail="Forneça pelo menos um filtro (Nome/CNPJ, UF ou Data).")
    
    if q and len(q) < 3 and not tem_filtros and not termo_limpo.isdigit():
         raise HTTPException(status_code=400, detail="Para buscas por nome sem filtros, digite pelo menos 3 letras.")

    # 2. BUSCA EXATA (CNPJ) - Prioridade Máxima
    if q and termo_limpo.isdigit() and len(termo_limpo) == 14:
        sql = """
            SELECT est.cnpj_basico, est.cnpj_ordem, est.cnpj_dv, est.nome_fantasia, 
                   est.situacao_cadastral, est.uf, est.municipio, est.data_inicio_atividade, 
                   emp.razao_social
            FROM estabelecimentos est
            LEFT JOIN empresas emp ON est.cnpj_basico = emp.cnpj_basico
            WHERE est.cnpj_basico = :basico AND est.cnpj_ordem = :ordem AND est.cnpj_dv = :dv
        """
        params = {"basico": termo_limpo[:8], "ordem": termo_limpo[8:12], "dv": termo_limpo[12:]}
        
        # Aplica filtros opcionais mesmo na busca por CNPJ (ex: confirmar se é de SP)
        if uf: 
            sql += " AND est.uf = :uf"
            params["uf"] = uf.upper()
        if data_abertura:
            sql += " AND est.data_inicio_atividade = :data_inicio"
            params["data_inicio"] = data_abertura.replace("-", "")

        with engine.connect() as conn:
            result = conn.execute(text(sql), params).mappings().fetchone()
            items = [dict(result)] if result else []
            return {"status": "ok", "items": items, "total": len(items), "page": 1, "pages": 1}

    # 3. BUSCA GERAL (Texto / Filtros)
    else:
        condicoes = []
        params = {"limit": limit, "offset": offset}

        # Ordem dos filtros importa! (Data e UF primeiro para usar índices)
        if data_abertura:
            condicoes.append("est.data_inicio_atividade = :data_inicio")
            params["data_inicio"] = data_abertura.replace("-", "")
        
        if uf:
            condicoes.append("est.uf = :uf")
            params["uf"] = uf.upper()

        if q:
            condicoes.append("(emp.razao_social ILIKE :termo OR est.nome_fantasia ILIKE :termo)")
            params["termo"] = f"%{q.upper()}%"

        where_clause = " AND ".join(condicoes)

        # === FREIO DE SEGURANÇA OTIMIZADO ===
        # Se o usuário NÃO usou filtros restritivos (Data ou UF), contamos apenas até 1001.
        # Isso evita que o banco conte 1 milhão de linhas (Full Scan) para dizer que tem muitos resultados.
        LIMITE_SEGURANCA = 1000
        
        if not tem_filtros:
            sql_check = f"""
                SELECT count(*) FROM (
                    SELECT 1 
                    FROM estabelecimentos est
                    LEFT JOIN empresas emp ON est.cnpj_basico = emp.cnpj_basico
                    WHERE {where_clause}
                    LIMIT :limite_check
                ) as sub
            """
            params["limite_check"] = LIMITE_SEGURANCA + 1
            
            with engine.connect() as conn:
                total_check = conn.execute(text(sql_check), params).scalar()
            
            if total_check > LIMITE_SEGURANCA:
                return {
                    "status": "too_broad",
                    "message": f"Muitos resultados encontrados (+{LIMITE_SEGURANCA}).",
                    "detail": "Busca muito ampla. Por favor, adicione um ESTADO ou DATA para filtrar.",
                    "total": total_check,
                    "items": []
                }
            total_real = total_check # Se é pouco, já temos o total
        
        else:
            # Se tem filtros, usamos count normal pois os índices de Data/UF garantem velocidade
            sql_count_full = f"""
                SELECT count(*)
                FROM estabelecimentos est
                LEFT JOIN empresas emp ON est.cnpj_basico = emp.cnpj_basico
                WHERE {where_clause}
            """
            with engine.connect() as conn:
                total_real = conn.execute(text(sql_count_full), params).scalar()

        # === BUSCA DE DADOS (PAGINADA) ===
        sql_data = f"""
            SELECT est.cnpj_basico, est.cnpj_ordem, est.cnpj_dv, est.nome_fantasia, 
                   est.situacao_cadastral, est.uf, est.municipio, est.data_inicio_atividade,
                   emp.razao_social
            FROM estabelecimentos est
            LEFT JOIN empresas emp ON est.cnpj_basico = emp.cnpj_basico
            WHERE {where_clause}
            ORDER BY est.data_inicio_atividade DESC
            LIMIT :limit OFFSET :offset
        """

        with engine.connect() as conn:
            results = conn.execute(text(sql_data), params).mappings().all()

        import math
        total_pages = math.ceil(total_real / limit) if total_real > 0 else 1

        return {
            "status": "ok",
            "items": [dict(r) for r in results],
            "total": total_real,
            "page": page,
            "pages": total_pages
        }

# --- ROTAS DE ADMINISTRAÇÃO (PAINEL) ---

@app.get("/admin/stats")
def stats():
    try:
        with engine.connect() as conn:
            qtd = conn.execute(text("SELECT count(*) FROM estabelecimentos")).scalar()
            size = conn.execute(text("SELECT pg_size_pretty(pg_database_size('cnpj_dados'));")).scalar()
        return {"total_empresas": qtd, "tamanho_db": size}
    except:
        return {"total_empresas": 0, "tamanho_db": "Erro"}

@app.post("/admin/atualizar")
def acao_atualizar(bg: BackgroundTasks):
    bg.add_task(lambda: (executar_script("etl_download.py"), executar_script("etl_import.py")))
    return {"status": "Atualização iniciada em background."}

@app.post("/admin/otimizar")
def acao_otimizar(bg: BackgroundTasks):
    bg.add_task(executar_script, "etl_optimize_db.py")
    return {"status": "Otimização iniciada."}

@app.post("/admin/backup")
def acao_backup(bg: BackgroundTasks):
    bg.add_task(realizar_backup)
    return {"status": "Backup iniciado."}

@app.delete("/admin/limpar")
def acao_limpar():
    try:
        with engine.connect() as conn:
            conn.execute(text("TRUNCATE TABLE socios, estabelecimentos, empresas;"))
            conn.commit()
        return {"status": "Banco limpo."}
    except Exception as e:
        raise HTTPException(500, str(e))