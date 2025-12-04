import os
import subprocess
from fastapi import FastAPI, HTTPException, BackgroundTasks, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlalchemy import create_engine, text
from elasticsearch import Elasticsearch
from typing import Optional
from datetime import datetime
import io

app = FastAPI(title="API Casa dos Dados Clone")

# --- 1. CONFIGURAÇÃO ELASTICSEARCH (BUSCA RÁPIDA) ---
# Tenta conectar. Se falhar, o sistema continua funcionando (apenas busca cai)
try:
    es_client = Elasticsearch("http://localhost:9200", request_timeout=5)
except:
    es_client = None
    print("[AVISO] Elasticsearch não parece estar rodando.")

# --- 2. CONFIGURAÇÃO CORS ---
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

# --- 3. BANCO DE DADOS POSTGRES (FONTE DA VERDADE) ---
DB_USER = "user_cnpj"
DB_PASS = "password_cnpj"
DB_HOST = "127.0.0.1"
DB_PORT = "5433"
DB_NAME = "cnpj_dados"

# Configuração otimizada para leitura
DATABASE_URL = f"postgresql+pg8000://{DB_USER}:{DB_PASS}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
engine = create_engine(DATABASE_URL, pool_size=20, max_overflow=0)

# --- FUNÇÕES AUXILIARES (ADMIN) ---
def executar_script(nome_script):
    """Executa scripts Python na pasta raiz do backend"""
    print(f"--- [ADMIN] Iniciando script: {nome_script} ---")
    try:
        # Pega o diretório raiz do backend (onde estão os etl_*.py)
        pasta_raiz = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        caminho_script = os.path.join(pasta_raiz, nome_script)
        
        if not os.path.exists(caminho_script):
            print(f"--- [ERRO] Script não encontrado: {caminho_script}")
            return

        # Executa o script
        subprocess.run(["python", caminho_script], check=True, cwd=pasta_raiz)
        print(f"--- [ADMIN] {nome_script} finalizado com sucesso ---")
    except Exception as e:
        print(f"--- [ERRO] Falha ao rodar {nome_script}: {e}")

def realizar_backup():
    """Exporta as tabelas principais para CSV na pasta backups"""
    pasta_raiz = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    pasta_backup = os.path.join(pasta_raiz, "backups")
    
    if not os.path.exists(pasta_backup):
        os.makedirs(pasta_backup)
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    tabelas = ["empresas", "estabelecimentos", "socios"]
    
    print(f"--- [BACKUP] Iniciando backup em: {pasta_backup} ---")
    with engine.connect() as conn:
        for tabela in tabelas:
            arquivo = os.path.join(pasta_backup, f"{tabela}_{timestamp}.csv")
            try:
                with open(arquivo, 'w', encoding='utf-8') as f:
                    # Uso de cursor cru para performance no COPY
                    cursor = conn.connection.cursor()
                    sql = f"COPY (SELECT * FROM {tabela}) TO STDOUT WITH CSV HEADER"
                    cursor.execute(sql, stream=f)
                print(f"   -> {tabela} salvo com sucesso.")
            except Exception as e:
                print(f"   -> Erro ao salvar {tabela}: {e}")

# --- ROTAS PÚBLICAS ---

@app.get("/")
def home():
    status_es = "Offline 🔴"
    try:
        if es_client and es_client.ping():
            status_es = "Online 🟢"
    except:
        pass
    return {"message": "API Casa dos Dados Clone", "elasticsearch": status_es}

@app.get("/empresa/{cnpj}")
def detalhes_empresa(cnpj: str):
    """
    Busca DETALHADA no PostgreSQL (com Sócios, CNAEs, etc).
    """
    cnpj_limpo = cnpj.replace(".", "").replace("/", "").replace("-", "")
    if len(cnpj_limpo) != 14:
        raise HTTPException(status_code=400, detail="CNPJ inválido.")

    basico, ordem, dv = cnpj_limpo[:8], cnpj_limpo[8:12], cnpj_limpo[12:]

    sql_empresa = text("""
        SELECT 
            est.*, 
            emp.razao_social, emp.natureza_juridica, emp.capital_social, emp.porte_empresa, emp.ente_federativo_responsavel,
            nat.descricao as natureza_juridica_texto,
            cnae.descricao as cnae_principal_texto,
            mun.descricao as municipio_texto
        FROM estabelecimentos est
        LEFT JOIN empresas emp ON est.cnpj_basico = emp.cnpj_basico
        LEFT JOIN naturezas nat ON emp.natureza_juridica = nat.codigo
        LEFT JOIN cnaes cnae ON est.cnae_fiscal_principal = cnae.codigo
        LEFT JOIN municipios mun ON est.municipio = mun.codigo
        WHERE est.cnpj_basico = :b AND est.cnpj_ordem = :o AND est.cnpj_dv = :d LIMIT 1
    """)
    
    sql_socios = text("SELECT * FROM socios WHERE cnpj_basico = :b")

    with engine.connect() as conn:
        res = conn.execute(sql_empresa, {"b": basico, "o": ordem, "d": dv}).mappings().fetchone()
        if not res: raise HTTPException(404, "Empresa não encontrada.")
        socios = conn.execute(sql_socios, {"b": basico}).mappings().all()

    dados = dict(res)
    dados["socios"] = [dict(s) for s in socios]
    dados["cnpj_formatado"] = f"{basico}.{ordem}/{dv}"
    return dados

@app.get("/buscar")
def buscar_empresa(
    q: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    uf: Optional[str] = Query(None, min_length=2, max_length=2),
    data_abertura: Optional[str] = Query(None)
):
    """
    Busca RÁPIDA no Elasticsearch.
    """
    offset = (page - 1) * limit
    
    # Se o Elastic estiver fora, avisamos o usuário
    if not es_client or not es_client.ping():
        raise HTTPException(status_code=503, detail="Motor de busca em manutenção. Tente buscar pelo CNPJ direto na URL.")

    must, filtros = [], []

    if uf: filtros.append({"term": {"uf": uf.upper()}})
    if data_abertura: filtros.append({"term": {"data_inicio_atividade": data_abertura.replace("-", "")}})

    if q:
        termo = q.replace(".", "").replace("/", "").replace("-", "")
        if termo.isdigit() and len(termo) == 14:
            must.append({"term": {"cnpj_completo": termo}})
        else:
            must.append({
                "multi_match": {
                    "query": q,
                    "fields": ["razao_social", "nome_fantasia"],
                    "type": "best_fields",
                    "operator": "and"
                }
            })

    body = {
        "from": offset, "size": limit,
        "query": {"bool": {"must": must if must else [{"match_all": {}}], "filter": filtros}}
    }

    try:
        resp = es_client.search(index="empresas-index", body=body)
        hits = resp['hits']['hits']
        items = [{
            "cnpj_basico": h['_source']['cnpj_completo'][:8],
            "cnpj_ordem": h['_source']['cnpj_completo'][8:12],
            "cnpj_dv": h['_source']['cnpj_completo'][12:],
            "razao_social": h['_source']['razao_social'],
            "nome_fantasia": h['_source']['nome_fantasia'],
            "situacao_cadastral": h['_source']['situacao_cadastral'],
            "uf": h['_source']['uf'],
            "municipio": h['_source']['municipio'],
            "data_inicio_atividade": h['_source']['data_inicio_atividade']
        } for h in hits]
        
        import math
        total = resp['hits']['total']['value']
        return {"status": "ok", "items": items, "total": total, "page": page, "pages": math.ceil(total/limit)}

    except Exception as e:
        print(f"Erro Elastic: {e}")
        return {"items": [], "total": 0, "page": 1, "erro": "Erro na consulta"}

@app.get("/exportar")
def exportar_dados(tipo: str, valor: str = None, uf: str = None, data_fim: str = None):
    """Exportação CSV direto do PostgreSQL"""
    # ... (Lógica idêntica ao seu arquivo original, mantida para brevidade)
    # Reutilizando a lógica do arquivo original para exportação
    condicoes = ["1=1"]
    params = {}

    if uf:
        condicoes.append("est.uf = :uf")
        params["uf"] = uf.upper()

    if tipo == "dia":
        condicoes.append("est.data_inicio_atividade = :valor")
        params["valor"] = valor.replace("-", "")
    elif tipo == "mes":
        condicoes.append("est.data_inicio_atividade LIKE :valor")
        params["valor"] = f"{valor.replace('-', '')}%"
    elif tipo == "ano":
        condicoes.append("est.data_inicio_atividade LIKE :valor")
        params["valor"] = f"{valor}%"
    elif tipo == "intervalo":
        condicoes.append("est.data_inicio_atividade BETWEEN :inicio AND :fim")
        params["inicio"] = valor.replace("-", "")
        params["fim"] = data_fim.replace("-", "") if data_fim else "99991231"

    sql = f"""
        SELECT est.cnpj_basico||est.cnpj_ordem||est.cnpj_dv, est.nome_fantasia, est.situacao_cadastral, est.uf, est.municipio 
        FROM estabelecimentos est 
        WHERE {" AND ".join(condicoes)} LIMIT 50000
    """
    
    def iterar():
        yield "CNPJ;NOME;SITUACAO;UF;MUNICIPIO\n"
        with engine.connect() as conn:
            for row in conn.execute(text(sql), params):
                yield ";".join([str(x) for x in row]) + "\n"

    return StreamingResponse(iterar(), media_type="text/csv", headers={"Content-Disposition": "attachment; filename=export.csv"})


# --- ROTAS DE ADMINISTRAÇÃO (PAINEL) ---

@app.get("/admin/stats")
def stats():
    try:
        with engine.connect() as conn:
            pg_count = conn.execute(text("SELECT count(*) FROM estabelecimentos")).scalar()
            pg_size = conn.execute(text("SELECT pg_size_pretty(pg_database_size('cnpj_dados'));")).scalar()
        
        es_count = 0
        if es_client:
            try:
                es_count = es_client.count(index="empresas-index")['count']
            except: pass

        return {
            "postgres_empresas": pg_count, 
            "postgres_tamanho": pg_size,
            "elastic_empresas": es_count,
            "elastic_status": "Online" if es_client and es_client.ping() else "Offline"
        }
    except Exception as e:
        return {"erro": str(e)}

@app.post("/admin/atualizar")
def acao_atualizar(bg: BackgroundTasks):
    """
    Fluxo Completo: Download -> Importar SQL -> Sincronizar Elastic
    """
    bg.add_task(lambda: (
        executar_script("etl_download.py"), 
        executar_script("etl_import.py"),
        executar_script("etl_sync_es.py") # NOVO: Mantém o Elastic atualizado
    ))
    return {"status": "Atualização completa (Download + DB + Elastic) iniciada em background."}

@app.post("/admin/sincronizar_elastic")
def acao_sincronizar_elastic(bg: BackgroundTasks):
    """
    Rota específica para rodar apenas a sincronização PostgreSQL -> Elasticsearch
    """
    bg.add_task(executar_script, "etl_sync_es.py")
    return {"status": "Sincronização com Elasticsearch iniciada."}

@app.post("/admin/otimizar")
def acao_otimizar(bg: BackgroundTasks):
    bg.add_task(executar_script, "etl_optimize_db.py")
    return {"status": "Otimização de índices iniciada."}

@app.post("/admin/backup")
def acao_backup(bg: BackgroundTasks):
    bg.add_task(realizar_backup)
    return {"status": "Backup CSV iniciado."}

@app.delete("/admin/limpar")
def acao_limpar():
    try:
        with engine.connect() as conn:
            conn.execute(text("TRUNCATE TABLE socios, estabelecimentos, empresas, cnaes, naturezas, municipios;"))
            conn.commit()
            # Se limpou o banco, deveria limpar o Elastic também
            if es_client:
                es_client.indices.delete(index="empresas-index", ignore=[400, 404])
        return {"status": "Banco de dados e Índice de busca limpos."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))