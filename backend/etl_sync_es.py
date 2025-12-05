import time
import sys
import gc
from sqlalchemy import create_engine, text
from elasticsearch import Elasticsearch, helpers

# --- CONFIGURAÇÕES ---
DB_URL = "postgresql+pg8000://user_cnpj:password_cnpj@127.0.0.1:5433/cnpj_dados"
ES_HOST = "http://localhost:9200"
INDEX_NAME = "empresas-index"
BATCH_SIZE = 1000 

def get_postgres_engine():
    return create_engine(DB_URL, execution_options={"stream_results": True})

def limpar_capital(valor_str):
    """Converte '10000,00' para 10000.00 (float)"""
    if not valor_str: return 0.0
    try:
        # Remove caracteres estranhos e troca vírgula por ponto
        limpo = str(valor_str).replace('.', '').replace(',', '.')
        return float(limpo)
    except:
        return 0.0

def criar_indice(es):
    if es.indices.exists(index=INDEX_NAME):
        print(f"[*] Índice '{INDEX_NAME}' já existe. (Recomendado apagar para re-mapear se tiver erro de tipo)")
        return

    mapping = {
        "settings": {
            "number_of_shards": 1,
            "number_of_replicas": 0,
            "refresh_interval": "60s"
        },
        "mappings": {
            "properties": {
                "cnpj_completo": {"type": "keyword"},
                "razao_social": {"type": "text", "analyzer": "portuguese"},
                "nome_fantasia": {"type": "text", "analyzer": "portuguese"},
                "uf": {"type": "keyword"},
                "municipio": {"type": "keyword"},
                "situacao_cadastral": {"type": "keyword"},
                "data_inicio_atividade": {"type": "keyword"},
                "capital_social": {"type": "float"}  # FORÇA TIPO FLOAT
            }
        }
    }
    es.indices.create(index=INDEX_NAME, body=mapping)
    print(f"[OK] Índice '{INDEX_NAME}' criado com mapping correto.")

def gerar_dados(conn):
    print("[*] Iniciando leitura do PostgreSQL...")
    sql = text("""
        SELECT 
            est.cnpj_basico || est.cnpj_ordem || est.cnpj_dv as cnpj_id,
            est.nome_fantasia,
            est.uf,
            est.municipio,
            est.situacao_cadastral,
            est.data_inicio_atividade,
            emp.razao_social,
            emp.capital_social -- Trazendo o campo
        FROM estabelecimentos est
        LEFT JOIN empresas emp ON est.cnpj_basico = emp.cnpj_basico
    """)
    
    result = conn.execution_options(yield_per=BATCH_SIZE).execute(sql)
    
    for row in result:
        doc = {
            "_index": INDEX_NAME,
            "_id": row[0], 
            "_source": {
                "cnpj_completo": row[0],
                "razao_social": row[6] if row[6] else "",
                "nome_fantasia": row[1] if row[1] else "",
                "uf": row[2],
                "municipio": row[3],
                "situacao_cadastral": row[4],
                "data_inicio_atividade": row[5],
                "capital_social": limpar_capital(row[7]) # Converte aqui
            }
        }
        yield doc

def sincronizar():
    engine = get_postgres_engine()
    es = Elasticsearch(ES_HOST, request_timeout=60)

    if not es.ping():
        print("[Erro] Elasticsearch não encontrado.")
        return

    # Opcional: Apagar índice antigo para garantir novo mapeamento (float)
    # es.indices.delete(index=INDEX_NAME, ignore=[400, 404])
    
    criar_indice(es)
    
    start_time = time.time()
    total = 0
    
    print("--- INICIANDO SINCRONIZAÇÃO DE CAPITAL SOCIAL ---")

    try:
        with engine.connect() as conn:
            for success, info in helpers.streaming_bulk(
                client=es,
                actions=gerar_dados(conn),
                chunk_size=BATCH_SIZE,
                max_retries=5,
                raise_on_error=False
            ):
                if success:
                    total += 1
                    if total % 5000 == 0:
                        sys.stdout.write(f"\rProcessados: {total:,}")
                        sys.stdout.flush()
                        gc.collect()
                
    except KeyboardInterrupt:
        print("\n[!] Parado pelo usuário.")
    except Exception as e:
        print(f"\n[X] Erro: {e}")

    print(f"\n\n[FIM] Total: {total:,} em {(time.time() - start_time)/60:.2f} min")

if __name__ == "__main__":
    sincronizar()