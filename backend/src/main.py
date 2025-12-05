import os
import subprocess
from fastapi import FastAPI, HTTPException, BackgroundTasks, Query, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlalchemy import create_engine, text
from elasticsearch import Elasticsearch
from typing import Optional, List
from functools import lru_cache
from datetime import datetime, timedelta
from dotenv import load_dotenv

# --- SEGURANÇA & AUTH ---
from pydantic import BaseModel
from passlib.context import CryptContext
from jose import jwt, JWTError
from fastapi.security import OAuth2PasswordBearer

# --- CARREGAR ENV ---
load_dotenv()

# --- MÓDULOS DE LICITAÇÃO ---
try:
    from .busca_licitacoes import BuscadorLicitacoesTCEMA
    from .busca_famem import BuscadorFamem
except ImportError:
    from busca_licitacoes import BuscadorLicitacoesTCEMA
    from busca_famem import BuscadorFamem

app = FastAPI(title="Plataforma de Inteligência - CNPJ & Licitações")

# ==============================================================================
#  CONFIGURAÇÕES GERAIS
# ==============================================================================

# 1. ELASTICSEARCH
ELASTIC_HOST = os.getenv("ELASTIC_HOST", "http://localhost:9200")
try:
    es_client = Elasticsearch(ELASTIC_HOST, request_timeout=5)
except:
    es_client = None
    print("[AVISO] Elasticsearch não configurado.")

# 2. CORS
origins = ["http://localhost:3000", "http://127.0.0.1:3000"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 3. BANCO DE DADOS
DB_USER = os.getenv("DB_USER", "user_cnpj")
DB_PASS = os.getenv("DB_PASS", "password_cnpj")
DB_HOST = os.getenv("DB_HOST", "127.0.0.1")
DB_PORT = os.getenv("DB_PORT", "5433")
DB_NAME = os.getenv("DB_NAME", "cnpj_dados")

DATABASE_URL = f"postgresql+pg8000://{DB_USER}:{DB_PASS}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
engine = create_engine(DATABASE_URL, pool_size=20, max_overflow=0)

# 4. SEGURANÇA (JWT)
SECRET_KEY = os.getenv("SECRET_KEY", "chave_secreta_padrao_insegura")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 # 24 horas

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")

# ==============================================================================
#  AUTENTICAÇÃO & DEPENDÊNCIAS
# ==============================================================================

class UserCreate(BaseModel):
    nome: str
    email: str
    senha: str
    contato: str

class UserLogin(BaseModel):
    email: str
    senha: str

def get_password_hash(password):
    return pwd_context.hash(password)

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Não autorizado",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None: raise credentials_exception
    except JWTError:
        raise credentials_exception
        
    with engine.connect() as conn:
        user = conn.execute(text("SELECT id, nome, email, contato, is_admin FROM users WHERE email = :e"), {"e": email}).mappings().fetchone()
        
    if user is None: raise credentials_exception
    return dict(user)

def get_current_admin(current_user: dict = Depends(get_current_user)):
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Acesso negado. Requer Admin.")
    return current_user

# --- ROTAS DE AUTH ---

@app.post("/auth/register")
def register(user: UserCreate):
    with engine.connect() as conn:
        exists = conn.execute(text("SELECT email FROM users WHERE email = :e"), {"e": user.email}).fetchone()
        if exists: raise HTTPException(status_code=400, detail="Email já cadastrado.")
        
        hashed = get_password_hash(user.senha)
        conn.execute(text("""
            INSERT INTO users (nome, email, senha_hash, contato, is_admin) 
            VALUES (:n, :e, :s, :c, FALSE)
        """), {"n": user.nome, "e": user.email, "s": hashed, "c": user.contato})
        conn.commit()
    return {"msg": "Usuário criado!"}

@app.post("/auth/login")
def login(user: UserLogin):
    with engine.connect() as conn:
        db_user = conn.execute(text("SELECT * FROM users WHERE email = :e"), {"e": user.email}).mappings().fetchone()
    
    if not db_user or not verify_password(user.senha, db_user['senha_hash']):
        raise HTTPException(status_code=401, detail="Credenciais inválidas")
    
    access_token = create_access_token(data={
        "sub": db_user['email'], 
        "name": db_user['nome'],
        "admin": db_user['is_admin']
    })
    
    return {
        "access_token": access_token, 
        "token_type": "bearer", 
        "user_name": db_user['nome'],
        "is_admin": db_user['is_admin']
    }

@app.get("/users/me")
def read_users_me(current_user: dict = Depends(get_current_user)):
    return current_user

# ==============================================================================
#  HELPERS & UTILITÁRIOS
# ==============================================================================

def fmt_cnpj(b, o, d): return f"{b}.{o}/{d}" if b else ""
def fmt_data(d): return f"{d[6:8]}/{d[4:6]}/{d[0:4]}" if d and len(str(d)) == 8 else d
def fmt_fone(ddd, num): return f"({ddd}) {num}" if num else ""
def fmt_situacao(cod): return {'01':'NULA','02':'ATIVA','03':'SUSPENSA','04':'INAPTA','08':'BAIXADA'}.get(cod, cod)
def fmt_porte(cod): return {'00':'NÃO INFORMADO','01':'MICRO','03':'EPP','05':'DEMAIS'}.get(cod, cod)
def fmt_dinheiro(val):
    if not val: return ""
    try: return f"R$ {float(val.replace(',', '.')):,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    except: return val

@lru_cache(maxsize=32)
def buscar_cidades_por_uf_cached(uf: str):
    sql = text("SELECT DISTINCT e.municipio as codigo, m.descricao FROM estabelecimentos e JOIN municipios m ON e.municipio = m.codigo WHERE e.uf = :uf ORDER BY m.descricao")
    with engine.connect() as conn: return conn.execute(sql, {"uf": uf}).mappings().all()

def executar_script(nome_script):
    try:
        pasta = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        subprocess.run(["python", os.path.join(pasta, nome_script)], check=True, cwd=pasta)
    except Exception as e: print(f"Erro script: {e}")

def realizar_backup():
    pasta = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "backups")
    if not os.path.exists(pasta): os.makedirs(pasta)
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    with engine.connect() as conn:
        for t in ["empresas", "estabelecimentos", "socios"]:
            try:
                with open(os.path.join(pasta, f"{t}_{ts}.csv"), 'w', encoding='utf-8') as f:
                    conn.connection.cursor().execute(f"COPY (SELECT * FROM {t}) TO STDOUT WITH CSV HEADER", stream=f)
            except: pass

# ==============================================================================
#  ROTAS CNPJ
# ==============================================================================

@app.get("/")
def home():
    status = "Online 🟢" if es_client and es_client.ping() else "Offline 🔴"
    return {"msg": "Plataforma CNPJ & Licitações", "elastic": status}

@app.get("/auxiliar/cidades/{uf}")
def listar_cidades(uf: str):
    try: return [{"codigo": c.codigo, "descricao": c.descricao} for c in buscar_cidades_por_uf_cached(uf.upper())]
    except: return []

@app.get("/buscar")
def buscar_empresa(
    q: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    uf: Optional[str] = Query(None, min_length=2, max_length=2),
    municipio: Optional[str] = Query(None),
    situacao: Optional[str] = Query(None),
    data_inicio: Optional[str] = Query(None),
    data_fim: Optional[str] = Query(None),
    capital_min: Optional[float] = Query(None),
    capital_max: Optional[float] = Query(None)
):
    offset = (page - 1) * limit
    if not es_client: raise HTTPException(503, "Busca offline")
    must, filtros = [], []
    
    if q:
        t = q.replace(".", "").replace("/", "").replace("-", "")
        if t.isdigit() and len(t) == 14: must.append({"term": {"cnpj_completo": t}})
        else: must.append({"multi_match": {"query": q, "fields": ["razao_social", "nome_fantasia"], "type": "best_fields", "operator": "and"}})
    
    if uf: filtros.append({"term": {"uf": uf.upper()}})
    if municipio: filtros.append({"term": {"municipio": municipio}})
    if situacao: filtros.append({"term": {"situacao_cadastral": situacao}})
    
    if data_inicio or data_fim:
        r = {}
        if data_inicio: r["gte"] = data_inicio.replace("-", "")
        if data_fim: r["lte"] = data_fim.replace("-", "")
        filtros.append({"range": {"data_inicio_atividade": r}})

    # Filtro Capital Social (Supondo mapeamento padrão onde números podem ser string ou float)
    if capital_min is not None or capital_max is not None:
        cr = {}
        if capital_min is not None: cr["gte"] = capital_min
        if capital_max is not None: cr["lte"] = capital_max
        filtros.append({"range": {"capital_social": cr}})

    try:
        resp = es_client.search(index="empresas-index", body={"from": offset, "size": limit, "query": {"bool": {"must": must if must else [{"match_all": {}}], "filter": filtros}}})
        items = [{
            "cnpj_basico": h['_source']['cnpj_completo'][:8],
            "cnpj_ordem": h['_source']['cnpj_completo'][8:12],
            "cnpj_dv": h['_source']['cnpj_completo'][12:],
            "razao_social": h['_source']['razao_social'],
            "nome_fantasia": h['_source']['nome_fantasia'],
            "situacao_cadastral": h['_source']['situacao_cadastral'],
            "uf": h['_source']['uf'],
            "municipio": h['_source']['municipio'],
            "data_inicio_atividade": h['_source']['data_inicio_atividade'],
            "capital_social": h['_source'].get('capital_social', 0)
        } for h in resp['hits']['hits']]
        import math
        return {"items": items, "total": resp['hits']['total']['value'], "page": page, "pages": math.ceil(resp['hits']['total']['value']/limit)}
    except Exception as e: return {"items": [], "total": 0, "error": str(e)}

@app.get("/empresa/{cnpj}")
def detalhes_empresa(cnpj: str):
    c = cnpj.replace(".", "").replace("/", "").replace("-", "")
    b, o, d = c[:8], c[8:12], c[12:]
    with engine.connect() as conn:
        res = conn.execute(text("""
            SELECT est.*, emp.razao_social, emp.natureza_juridica, emp.capital_social, emp.porte_empresa,
            nat.descricao as natureza_juridica_texto, mun.descricao as municipio_texto
            FROM estabelecimentos est
            LEFT JOIN empresas emp ON est.cnpj_basico = emp.cnpj_basico
            LEFT JOIN naturezas nat ON emp.natureza_juridica = nat.codigo
            LEFT JOIN municipios mun ON est.municipio = mun.codigo
            WHERE est.cnpj_basico = :b AND est.cnpj_ordem = :o AND est.cnpj_dv = :d LIMIT 1
        """), {"b": b, "o": o, "d": d}).mappings().fetchone()
        if not res: raise HTTPException(404, "Não encontrada")
        socios = conn.execute(text("SELECT * FROM socios WHERE cnpj_basico = :b"), {"b": b}).mappings().all()
    ret = dict(res)
    ret["socios"] = [dict(s) for s in socios]
    return ret

@app.get("/exportar")
def exportar_dados(
    q: Optional[str]=None, uf: Optional[str]=None, municipio: Optional[str]=None, 
    situacao: Optional[str]=None, data_inicio: Optional[str]=None, data_fim: Optional[str]=None,
    capital_min: Optional[float]=None, capital_max: Optional[float]=None
):
    cond = ["1=1"]
    p = {}
    if uf: cond.append("est.uf = :uf"); p["uf"] = uf
    if municipio: cond.append("est.municipio = :municipio"); p["municipio"] = municipio
    if situacao: cond.append("est.situacao_cadastral = :situacao"); p["situacao"] = situacao
    if data_inicio: cond.append("est.data_inicio_atividade >= :di"); p["di"] = data_inicio.replace("-", "")
    if data_fim: cond.append("est.data_inicio_atividade <= :df"); p["df"] = data_fim.replace("-", "")
    
    # Filtro SQL Capital Social (Casting necessário pois importação bruta é texto)
    if capital_min is not None:
        cond.append("CAST(REPLACE(emp.capital_social, ',', '.') AS NUMERIC) >= :cmin"); p["cmin"] = capital_min
    if capital_max is not None:
        cond.append("CAST(REPLACE(emp.capital_social, ',', '.') AS NUMERIC) <= :cmax"); p["cmax"] = capital_max

    if q:
        t = q.replace(".", "").replace("/", "").replace("-", "")
        if t.isdigit() and len(t) == 14:
            cond.append("est.cnpj_basico = :b AND est.cnpj_ordem = :o AND est.cnpj_dv = :d")
            p["b"], p["o"], p["d"] = t[:8], t[8:12], t[12:]
        else:
            cond.append("(est.nome_fantasia ILIKE :q OR emp.razao_social ILIKE :q)"); p["q"] = f"%{q}%"

    sql = f"""
        SELECT est.cnpj_basico, est.cnpj_ordem, est.cnpj_dv, emp.razao_social, est.nome_fantasia,
        est.situacao_cadastral, est.data_situacao_cadastral, est.data_inicio_atividade,
        nat.descricao as natureza, emp.capital_social, emp.porte_empresa,
        est.tipo_de_logradouro, est.logradouro, est.numero, est.complemento, est.bairro, est.cep, est.uf, mun.descricao as munic,
        est.ddd_1, est.telefone_1, est.correio_eletronico,
        (SELECT string_agg(nome_socio_razao_social || ' (' || COALESCE(qual.descricao, '') || ')', '; ') 
         FROM socios s LEFT JOIN qualificacoes qual ON s.qualificacao_socio = qual.codigo WHERE s.cnpj_basico = est.cnpj_basico) as socios
        FROM estabelecimentos est
        LEFT JOIN empresas emp ON est.cnpj_basico = emp.cnpj_basico
        LEFT JOIN naturezas nat ON emp.natureza_juridica = nat.codigo
        LEFT JOIN municipios mun ON est.municipio = mun.codigo
        WHERE {" AND ".join(cond)} LIMIT 50000
    """
    def iterar():
        yield "CNPJ;RAZAO SOCIAL;NOME FANTASIA;SITUACAO;DATA SITUACAO;DATA ABERTURA;NATUREZA;CAPITAL;PORTE;ENDERECO;BAIRRO;CEP;CIDADE;TELEFONE;EMAIL;SOCIOS\n"
        with engine.connect() as conn:
            for row in conn.execution_options(yield_per=2000).execute(text(sql), p):
                r = dict(row._mapping)
                for k,v in r.items(): 
                    if v is None: r[k] = ""
                l = [
                    fmt_cnpj(r['cnpj_basico'], r['cnpj_ordem'], r['cnpj_dv']), r['razao_social'], r['nome_fantasia'],
                    fmt_situacao(r['situacao_cadastral']), fmt_data(r['data_situacao_cadastral']), fmt_data(r['data_inicio_atividade']),
                    r['natureza'], fmt_dinheiro(r['capital_social']), fmt_porte(r['porte_empresa']),
                    f"{r['tipo_de_logradouro']} {r['logradouro']} {r['numero']} {r['complemento']}".strip(),
                    r['bairro'], r['cep'], f"{r['munic']}/{r['uf']}",
                    fmt_fone(r['ddd_1'], r['telefone_1']), r['correio_eletronico'], r['socios']
                ]
                yield ";".join([str(x).replace(";", ",").replace("\n", " ").strip() for x in l]) + "\n"
    return StreamingResponse(iterar(), media_type="text/csv", headers={"Content-Disposition": f"attachment; filename=relatorio_cnpj.csv"})

# ==============================================================================
#  ROTAS LICITAÇÕES
# ==============================================================================

@app.get("/api/licitacoes/tce")
def get_licitacoes_tce(data_inicio: str=None, data_fim: str=None, tipo_procedimento: str='PP', finalidade: str=None):
    try:
        if not data_inicio: data_inicio = datetime.now().strftime('%Y-%m-%d')
        if not data_fim: data_fim = (datetime.now() + timedelta(days=7)).strftime('%Y-%m-%d')
        res = BuscadorLicitacoesTCEMA().buscar_pregoes_abertos(data_inicio, data_fim, tipo_procedimento, finalidade)
        res.sort(key=lambda x: x['data_sessao'])
        return {"status": "success", "data": res}
    except Exception as e: return {"status": "error", "message": str(e)}

@app.get("/api/licitacoes/famem")
def get_licitacoes_famem(data_inicio: str=None, data_fim: str=None, termo: str="Pregão Presencial", titulo: str=None, categoria: str=None):
    try:
        if not data_inicio: data_inicio = datetime.now().strftime('%Y-%m-%d')
        if not data_fim: data_fim = (datetime.now() + timedelta(days=7)).strftime('%Y-%m-%d')
        res = BuscadorFamem().buscar_publicacoes(data_inicio, data_fim, termo, titulo, categoria)
        res.sort(key=lambda x: x['data_sessao'], reverse=True)
        return {"status": "success", "data": res}
    except Exception as e: return {"status": "error", "message": str(e)}

# ==============================================================================
#  ROTAS ADMIN (PROTEGIDAS)
# ==============================================================================

@app.get("/admin/stats", dependencies=[Depends(get_current_admin)])
def stats():
    with engine.connect() as conn:
        c = conn.execute(text("SELECT count(*) FROM estabelecimentos")).scalar()
        s = conn.execute(text("SELECT pg_size_pretty(pg_database_size('cnpj_dados'))")).scalar()
    return {"postgres_empresas": c, "postgres_tamanho": s}

@app.post("/admin/atualizar", dependencies=[Depends(get_current_admin)])
def atualizar(bg: BackgroundTasks):
    bg.add_task(lambda: (executar_script("etl_download.py"), executar_script("etl_import.py"), executar_script("etl_sync_es.py")))
    return {"status": "ok"}

@app.post("/admin/sincronizar_elastic", dependencies=[Depends(get_current_admin)])
def sync(bg: BackgroundTasks):
    bg.add_task(executar_script, "etl_sync_es.py")
    return {"status": "ok"}

@app.post("/admin/otimizar", dependencies=[Depends(get_current_admin)])
def otimizar(bg: BackgroundTasks):
    bg.add_task(executar_script, "etl_optimize_db.py")
    return {"status": "ok"}

@app.post("/admin/backup", dependencies=[Depends(get_current_admin)])
def backup(bg: BackgroundTasks):
    bg.add_task(realizar_backup)
    return {"status": "ok"}

@app.delete("/admin/limpar", dependencies=[Depends(get_current_admin)])
def limpar():
    with engine.connect() as conn:
        conn.execute(text("TRUNCATE TABLE socios, estabelecimentos, empresas, cnaes, naturezas, municipios"))
        conn.commit()
        if es_client: es_client.indices.delete(index="empresas-index", ignore=[400, 404])
    return {"status": "ok"}