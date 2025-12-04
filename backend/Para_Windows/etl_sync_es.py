import time
import sys
from sqlalchemy import create_engine, text
from elasticsearch import Elasticsearch, helpers

# --- CONFIGURAÇÕES ---
DB_URL = "postgresql+pg8000://user_cnpj:password_cnpj@127.0.0.1:5433/cnpj_dados"
ES_HOST = "http://localhost:9200"
INDEX_NAME = "empresas-index"
BATCH_SIZE = 2000 # Reduzi para 2000 para não estourar a memória do seu i3

def get_postgres_engine():
    # Timeout infinito para leitura longa
    return create_engine(DB_URL, execution_options={"stream_results": True})

def criar_indice(es):
    if es.indices.exists(index=INDEX_NAME):
        print(f"[*] Índice '{INDEX_NAME}' já existe. Continuando inserção...")
        return

    # Mapping otimizado para economizar espaço em disco
    mapping = {
        "settings": {
            "number_of_shards": 1,
            "number_of_replicas": 0, # Zero réplicas economiza 50% de disco
            "refresh_interval": "30s" # Melhora velocidade de inserção
        },
        "mappings": {
            "properties": {
                "cnpj_completo": {"type": "keyword"},
                "razao_social": {"type": "text", "analyzer": "portuguese"},
                "nome_fantasia": {"type": "text", "analyzer": "portuguese"},
                "uf": {"type": "keyword"},
                "municipio": {"type": "keyword"},
                "situacao_cadastral": {"type": "keyword"},
                "data_inicio_atividade": {"type": "keyword"} # Usando keyword para ocupar menos espaço que Date por enquanto
            }
        }
    }
    es.indices.create(index=INDEX_NAME, body=mapping)
    print(f"[OK] Índice '{INDEX_NAME}' criado.")

def gerar_dados(conn):
    print("[*] Iniciando leitura do PostgreSQL (Isso pode demorar para começar)...")
    # Query otimizada: Traz apenas o necessário. 
    # JOIN LEFT para garantir que traz estabelecimento mesmo se empresa falhar (embora raro)
    sql = text("""
        SELECT 
            est.cnpj_basico || est.cnpj_ordem || est.cnpj_dv as cnpj_id,
            est.nome_fantasia,
            est.uf,
            est.municipio,
            est.situacao_cadastral,
            est.data_inicio_atividade,
            emp.razao_social
        FROM estabelecimentos est
        LEFT JOIN empresas emp ON est.cnpj_basico = emp.cnpj_basico
    """)
    
    result = conn.execution_options(yield_per=BATCH_SIZE).execute(sql)
    
    for row in result:
        # Tratamento de Nulos
        razao = row[6] if row[6] else ""
        fantasia = row[1] if row[1] else ""
        
        # Se ambos forem vazios, é dado lixo, mas importamos mesmo assim para manter integridade
        
        doc = {
            "_index": INDEX_NAME,
            "_id": row[0], 
            "_source": {
                "cnpj_completo": row[0],
                "razao_social": razao,
                "nome_fantasia": fantasia,
                "uf": row[2],
                "municipio": row[3],
                "situacao_cadastral": row[4],
                "data_inicio_atividade": row[5]
            }
        }
        yield doc

def sincronizar():
    engine = get_postgres_engine()
    es = Elasticsearch(ES_HOST, request_timeout=60)

    # Teste de conexão
    if not es.ping():
        print("[Erro] Não consegui conectar no Elasticsearch. Verifique se o Docker está rodando.")
        return

    criar_indice(es)
    
    start_time = time.time()
    total_inseridos = 0
    
    print("--- INICIANDO SINCRONIZAÇÃO ---")
    print("OBS: Se der erro de memória, feche o navegador e outros apps.")

    try:
        with engine.connect() as conn:
            # streaming_bulk é ideal para grandes volumes e pouca RAM
            for success, info in helpers.streaming_bulk(
                client=es,
                actions=gerar_dados(conn),
                chunk_size=BATCH_SIZE,
                max_retries=3,
                raise_on_error=False
            ):
                if success:
                    total_inseridos += 1
                    if total_inseridos % 10000 == 0:
                        sys.stdout.write(f"\rProcessados: {total_inseridos:,} registros...")
                        sys.stdout.flush()
                else:
                    pass # Ignora erros pontuais para não parar tudo
                    
    except KeyboardInterrupt:
        print("\n[!] Interrompido pelo usuário.")
    except Exception as e:
        print(f"\n[X] Erro crítico: {e}")

    tempo = (time.time() - start_time) / 60
    print(f"\n\n[FIM] Total Indexado: {total_inseridos:,}")
    print(f"Tempo decorrido: {tempo:.2f} minutos")

if __name__ == "__main__":
    sincronizar()