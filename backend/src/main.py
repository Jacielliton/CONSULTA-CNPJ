import os
import subprocess
from fastapi import FastAPI, HTTPException, BackgroundTasks, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlalchemy import create_engine, text
from elasticsearch import Elasticsearch
from typing import Optional, List
from functools import lru_cache
import io
from datetime import datetime

app = FastAPI(title="API Casa dos Dados Clone")

# --- 1. CONFIGURAÇÃO ELASTICSEARCH ---
try:
    es_client = Elasticsearch("http://localhost:9200", request_timeout=5)
except:
    es_client = None
    print("[AVISO] Elasticsearch não parece estar rodando ou configurado.")

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

# --- 3. BANCO DE DADOS (POSTGRESQL) ---
DB_USER = "user_cnpj"
DB_PASS = "password_cnpj"
DB_HOST = "127.0.0.1"
DB_PORT = "5433"
DB_NAME = "cnpj_dados"
DATABASE_URL = f"postgresql+pg8000://{DB_USER}:{DB_PASS}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

# Pool Size: Mantém 20 conexões abertas para performance
engine = create_engine(DATABASE_URL, pool_size=20, max_overflow=0)

# --- 4. FUNÇÕES DE FORMATAÇÃO (HELPERS PARA EXPORTAÇÃO) ---
def fmt_cnpj(b, o, d):
    """Formata 12345678000199 para 12.345.678/0001-99"""
    if not b or not o or not d: return f"{b}{o}{d}"
    return f"{b}.{o}/{d}"

def fmt_data(d):
    """Formata YYYYMMDD para DD/MM/AAAA"""
    if not d or len(str(d)) != 8: return d
    return f"{d[6:8]}/{d[4:6]}/{d[0:4]}"

def fmt_fone(ddd, num):
    """Formata (11) 99999999"""
    if not num: return ""
    return f"({ddd}) {num}" if ddd else num

def fmt_situacao(cod):
    mapa = {'01': 'NULA', '02': 'ATIVA', '03': 'SUSPENSA', '04': 'INAPTA', '08': 'BAIXADA'}
    return mapa.get(cod, cod)

def fmt_porte(cod):
    mapa = {'00': 'NÃO INFORMADO', '01': 'MICRO EMPRESA', '03': 'EPP', '05': 'DEMAIS'}
    return mapa.get(cod, cod)

def fmt_dinheiro(val):
    """Formata valor decimal para R$"""
    if not val: return ""
    try:
        # Troca vírgula por ponto para converter float, depois formata BR
        val_float = float(val.replace(',', '.'))
        return f"R$ {val_float:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    except:
        return val

# --- 5. CACHE DE CIDADES ---
@lru_cache(maxsize=32)
def buscar_cidades_por_uf_cached(uf: str):
    sql = text("""
        SELECT DISTINCT e.municipio as codigo, m.descricao 
        FROM estabelecimentos e 
        JOIN municipios m ON e.municipio = m.codigo 
        WHERE e.uf = :uf
        ORDER BY m.descricao
    """)
    with engine.connect() as conn:
        return conn.execute(sql, {"uf": uf}).mappings().all()

# --- 6. FUNÇÕES UTILITÁRIAS (ADMIN) ---
def executar_script(nome_script):
    print(f"--- [ADMIN] Iniciando script: {nome_script} ---")
    try:
        pasta_raiz = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        caminho_script = os.path.join(pasta_raiz, nome_script)
        if not os.path.exists(caminho_script): return
        subprocess.run(["python", caminho_script], check=True, cwd=pasta_raiz)
        print(f"--- [ADMIN] {nome_script} finalizado ---")
    except Exception as e:
        print(f"--- [ERRO] {e}")

def realizar_backup():
    pasta_raiz = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    pasta_backup = os.path.join(pasta_raiz, "backups")
    if not os.path.exists(pasta_backup): os.makedirs(pasta_backup)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    tabelas = ["empresas", "estabelecimentos", "socios"]
    
    with engine.connect() as conn:
        for tabela in tabelas:
            arquivo = os.path.join(pasta_backup, f"{tabela}_{timestamp}.csv")
            try:
                with open(arquivo, 'w', encoding='utf-8') as f:
                    cursor = conn.connection.cursor()
                    cursor.execute(f"COPY (SELECT * FROM {tabela}) TO STDOUT WITH CSV HEADER", stream=f)
            except Exception as e: print(e)

# --- 7. ROTAS PÚBLICAS ---

@app.get("/")
def home():
    status_es = "Online 🟢" if es_client and es_client.ping() else "Offline 🔴"
    return {"message": "API Casa dos Dados Clone", "elasticsearch": status_es}

@app.get("/auxiliar/cidades/{uf}")
def listar_cidades(uf: str):
    if len(uf) != 2: raise HTTPException(400, "UF inválida")
    try:
        cidades = buscar_cidades_por_uf_cached(uf.upper())
        return [{"codigo": c.codigo, "descricao": c.descricao} for c in cidades]
    except: return []

@app.get("/empresa/{cnpj}")
def detalhes_empresa(cnpj: str):
    cnpj_limpo = cnpj.replace(".", "").replace("/", "").replace("-", "")
    if len(cnpj_limpo) != 14: raise HTTPException(400, "CNPJ inválido.")
    basico, ordem, dv = cnpj_limpo[:8], cnpj_limpo[8:12], cnpj_limpo[12:]

    sql_empresa = text("""
        SELECT est.*, emp.razao_social, emp.natureza_juridica, emp.capital_social, emp.porte_empresa, emp.ente_federativo_responsavel,
            nat.descricao as natureza_juridica_texto, cnae.descricao as cnae_principal_texto, mun.descricao as municipio_texto
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
        if not res: raise HTTPException(404, "Não encontrada.")
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
    municipio: Optional[str] = Query(None),
    situacao: Optional[str] = Query(None),
    data_inicio: Optional[str] = Query(None),
    data_fim: Optional[str] = Query(None)
):
    offset = (page - 1) * limit
    if not es_client or not es_client.ping(): raise HTTPException(503, "Busca offline.")

    must, filtros = [], []

    if q:
        termo = q.replace(".", "").replace("/", "").replace("-", "")
        if termo.isdigit() and len(termo) == 14:
            must.append({"term": {"cnpj_completo": termo}})
        else:
            must.append({"multi_match": {"query": q, "fields": ["razao_social", "nome_fantasia"], "type": "best_fields", "operator": "and"}})

    if uf: filtros.append({"term": {"uf": uf.upper()}})
    if situacao: filtros.append({"term": {"situacao_cadastral": situacao}})
    if municipio: filtros.append({"term": {"municipio": municipio}})

    if data_inicio or data_fim:
        r = {}
        if data_inicio: r["gte"] = data_inicio.replace("-", "")
        if data_fim: r["lte"] = data_fim.replace("-", "")
        filtros.append({"range": {"data_inicio_atividade": r}})

    body = {
        "from": offset, "size": limit,
        "query": {"bool": {"must": must if must else [{"match_all": {}}], "filter": filtros}}
    }

    try:
        resp = es_client.search(index="empresas-index", body=body)
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
        } for h in resp['hits']['hits']]
        
        import math
        return {"status": "ok", "items": items, "total": resp['hits']['total']['value'], "page": page, "pages": math.ceil(resp['hits']['total']['value']/limit) if resp['hits']['total']['value'] > 0 else 1}
    except Exception as e:
        return {"items": [], "total": 0, "page": 1, "erro": str(e)}

# --- 8. ROTA DE EXPORTAÇÃO AVANÇADA ---
@app.get("/exportar")
def exportar_dados(
    q: Optional[str] = Query(None),
    uf: Optional[str] = Query(None),
    municipio: Optional[str] = Query(None),
    situacao: Optional[str] = Query(None),
    data_inicio: Optional[str] = Query(None),
    data_fim: Optional[str] = Query(None)
):
    """
    Exporta CSV COMPLETO (Ficha, Sócios, Endereço) com filtros.
    """
    condicoes = ["1=1"]
    params = {}

    if uf:
        condicoes.append("est.uf = :uf")
        params["uf"] = uf.upper()
    if municipio:
        condicoes.append("est.municipio = :municipio")
        params["municipio"] = municipio
    if situacao:
        condicoes.append("est.situacao_cadastral = :situacao")
        params["situacao"] = situacao
    if data_inicio:
        condicoes.append("est.data_inicio_atividade >= :data_inicio")
        params["data_inicio"] = data_inicio.replace("-", "")
    if data_fim:
        condicoes.append("est.data_inicio_atividade <= :data_fim")
        params["data_fim"] = data_fim.replace("-", "")
    if q:
        termo = q.replace(".", "").replace("/", "").replace("-", "")
        if termo.isdigit() and len(termo) == 14:
            condicoes.append("est.cnpj_basico = :b AND est.cnpj_ordem = :o AND est.cnpj_dv = :d")
            params["b"], params["o"], params["d"] = termo[:8], termo[8:12], termo[12:]
        else:
            condicoes.append("(est.nome_fantasia ILIKE :q OR emp.razao_social ILIKE :q)")
            params["q"] = f"%{q}%"

    # SQL Otimizado com Subquery para Sócios
    sql = f"""
        SELECT 
            -- Identificação
            est.cnpj_basico, est.cnpj_ordem, est.cnpj_dv,
            emp.razao_social,
            est.nome_fantasia,
            est.situacao_cadastral,
            est.data_situacao_cadastral,
            est.data_inicio_atividade,
            nat.descricao as natureza_juridica,
            emp.capital_social,
            emp.porte_empresa,
            
            -- Localização
            est.tipo_de_logradouro, est.logradouro, est.numero, est.complemento, est.bairro,
            est.cep, est.uf, mun.descricao as municipio,
            
            -- Contato
            est.ddd_1, est.telefone_1, est.correio_eletronico,

            -- Sócios (Agrupados em uma linha)
            (
                SELECT string_agg(nome_socio_razao_social || ' (' || COALESCE(qual.descricao, '') || ')', '; ')
                FROM socios s
                LEFT JOIN qualificacoes qual ON s.qualificacao_socio = qual.codigo
                WHERE s.cnpj_basico = est.cnpj_basico
            ) as quadro_societario

        FROM estabelecimentos est
        LEFT JOIN empresas emp ON est.cnpj_basico = emp.cnpj_basico
        LEFT JOIN naturezas nat ON emp.natureza_juridica = nat.codigo
        LEFT JOIN municipios mun ON est.municipio = mun.codigo
        WHERE {" AND ".join(condicoes)} 
        LIMIT 50000 
    """
    
    def iterar():
        yield "CNPJ;RAZAO SOCIAL;NOME FANTASIA;SITUACAO;DATA SITUACAO;DATA ABERTURA;NATUREZA JURIDICA;CAPITAL SOCIAL;PORTE;ENDERECO;BAIRRO;CEP;CIDADE/UF;TELEFONE;EMAIL;SOCIOS\n"
        
        with engine.connect() as conn:
            # yield_per evita estouro de memória
            for row in conn.execution_options(yield_per=2000).execute(text(sql), params):
                
                r = dict(row._mapping)
                # Remove Nones
                for k, v in r.items(): 
                    if v is None: r[k] = ""

                # Formatações
                cnpj = fmt_cnpj(r['cnpj_basico'], r['cnpj_ordem'], r['cnpj_dv'])
                situacao = fmt_situacao(r['situacao_cadastral'])
                data_sit = fmt_data(r['data_situacao_cadastral'])
                data_abert = fmt_data(r['data_inicio_atividade'])
                capital = fmt_dinheiro(r['capital_social'])
                porte = fmt_porte(r['porte_empresa'])
                
                # Endereço
                end_parts = [r['tipo_de_logradouro'], r['logradouro'], r['numero'], r['complemento']]
                endereco = " ".join([p for p in end_parts if p]).strip()
                cidade_uf = f"{r['municipio']}/{r['uf']}"
                fone = fmt_fone(r['ddd_1'], r['telefone_1'])
                
                # Monta Colunas
                cols = [
                    cnpj, r['razao_social'], r['nome_fantasia'], situacao, data_sit, data_abert,
                    r['natureza_juridica'], capital, porte,
                    endereco, r['bairro'], r['cep'], cidade_uf,
                    fone, r['correio_eletronico'], r['quadro_societario']
                ]
                
                # Limpa CSV
                cols_limpas = [str(c).replace(";", ",").replace("\n", " ").strip() for c in cols]
                
                yield ";".join(cols_limpas) + "\n"

    filename = f"Relatorio_CNPJ_{datetime.now().strftime('%d%m%Y_%H%M')}.csv"
    return StreamingResponse(
        iterar(), 
        media_type="text/csv", 
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

# --- 9. ROTAS ADMIN ---

@app.get("/admin/stats")
def stats():
    try:
        with engine.connect() as conn:
            pg_count = conn.execute(text("SELECT count(*) FROM estabelecimentos")).scalar()
            pg_size = conn.execute(text("SELECT pg_size_pretty(pg_database_size('cnpj_dados'));")).scalar()
        
        es_count = 0
        if es_client:
            try: es_count = es_client.count(index="empresas-index")['count']
            except: pass

        return {
            "postgres_empresas": pg_count, 
            "postgres_tamanho": pg_size,
            "elastic_empresas": es_count,
            "elastic_status": "Online" if es_client and es_client.ping() else "Offline"
        }
    except Exception as e: return {"erro": str(e)}

@app.post("/admin/atualizar")
def acao_atualizar(bg: BackgroundTasks):
    bg.add_task(lambda: (
        executar_script("etl_download.py"), 
        executar_script("etl_import.py"),
        executar_script("etl_sync_es.py")
    ))
    return {"status": "Atualização iniciada."}

@app.post("/admin/sincronizar_elastic")
def acao_sincronizar_elastic(bg: BackgroundTasks):
    bg.add_task(executar_script, "etl_sync_es.py")
    return {"status": "Sync Elastic iniciado."}

@app.post("/admin/otimizar")
def acao_otimizar(bg: BackgroundTasks):
    bg.add_task(executar_script, "etl_optimize_db.py")
    return {"status": "Otimização iniciada."}

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
            if es_client: es_client.indices.delete(index="empresas-index", ignore=[400, 404])
        return {"status": "Limpeza concluída."}
    except Exception as e: raise HTTPException(500, str(e))