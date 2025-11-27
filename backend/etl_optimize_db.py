import time
from sqlalchemy import create_engine, text

# --- CONFIGURAÇÕES ---
DB_USER = "user_cnpj"
DB_PASS = "password_cnpj"
DB_HOST = "127.0.0.1"
DB_PORT = "5433"
DB_NAME = "cnpj_dados"
DATABASE_URL = f"postgresql+pg8000://{DB_USER}:{DB_PASS}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

def get_engine():
    return create_engine(DATABASE_URL, isolation_level="AUTOCOMMIT")

def otimizar_banco():
    engine = get_engine()
    print(f"[*] Conectando ao banco em {DB_HOST}:{DB_PORT}...")
    
    comandos = [
        # 1. Extensão para busca textual
        ("Instalando extensão pg_trgm", 
         "CREATE EXTENSION IF NOT EXISTS pg_trgm;"),

        # 2. Índice CNPJ (Essencial)
        ("Índice B-Tree para CNPJ", 
         "CREATE INDEX IF NOT EXISTS idx_cnpj_completo ON estabelecimentos (cnpj_basico, cnpj_ordem, cnpj_dv);"),

        # 3. Índice Join (Essencial)
        ("Índice de Join Empresas", 
         "CREATE INDEX IF NOT EXISTS idx_empresa_basico ON empresas (cnpj_basico);"),

        # --- NOVOS ÍNDICES PARA SEUS FILTROS ---
        # Isso garante que o banco filtre Data e UF antes de tentar buscar o texto
        ("Criando índice de Data de Início (Para filtro de Abertura)", 
         "CREATE INDEX IF NOT EXISTS idx_data_inicio ON estabelecimentos (data_inicio_atividade);"),
        
        ("Criando índice de UF (Para filtro de Estado)", 
         "CREATE INDEX IF NOT EXISTS idx_uf ON estabelecimentos (uf);"),
        # ---------------------------------------

        # 4. Índices Textuais (Os mais pesados)
        ("Índice GIN Razão Social", 
         "CREATE INDEX IF NOT EXISTS idx_razao_social_gin ON empresas USING gin (razao_social gin_trgm_ops);"),

        ("Índice GIN Nome Fantasia", 
         "CREATE INDEX IF NOT EXISTS idx_nome_fantasia_gin ON estabelecimentos USING gin (nome_fantasia gin_trgm_ops);")
    ]

    with engine.connect() as conn:
        start_global = time.time()
        
        for descricao, sql in comandos:
            print(f"--> {descricao}...")
            start = time.time()
            try:
                conn.execute(text(sql))
                print(f"    [OK] Concluído em {time.time() - start:.2f}s")
            except Exception as e:
                print(f"    [X] Erro/Já existe: {e}")
        
        print(f"\n[SUCESSO] Otimização finalizada em {time.time() - start_global:.2f}s!")

if __name__ == "__main__":
    otimizar_banco()