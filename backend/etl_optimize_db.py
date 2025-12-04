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
    # Timeout de 10 min para criação de indices pesados
    return create_engine(DATABASE_URL, isolation_level="AUTOCOMMIT", connect_args={"timeout": 600})

def otimizar_banco():
    engine = get_engine()
    print(f"[*] Otimizando banco (Perfil: VPS 8GB RAM)")
    
    comandos = [
        # Reduzido para 256MB para não matar o Elastic/System
        ("Ajustando work_mem temporário (256MB)", 
         "SET maintenance_work_mem = '256MB';"),

        # Índices Essenciais (B-Tree apenas)
        ("Índice: Empresas (CNPJ Básico)", 
         "CREATE INDEX IF NOT EXISTS idx_empresa_basico ON empresas (cnpj_basico);"),

        ("Índice: Estabelecimentos (CNPJ Completo)", 
         "CREATE INDEX IF NOT EXISTS idx_cnpj_completo ON estabelecimentos (cnpj_basico, cnpj_ordem, cnpj_dv);"),

        ("Índice: UF", 
         "CREATE INDEX IF NOT EXISTS idx_uf ON estabelecimentos (uf);"),
         
        ("Índice: Data Início", 
         "CREATE INDEX IF NOT EXISTS idx_data_inicio ON estabelecimentos (data_inicio_atividade);"),

        ("Índice: Sócios", 
         "CREATE INDEX IF NOT EXISTS idx_socios_basico ON socios (cnpj_basico);")
    ]

    with engine.connect() as conn:
        start_global = time.time()
        
        for descricao, sql in comandos:
            print(f"--> {descricao}...")
            start = time.time()
            try:
                conn.execute(text(sql))
                print(f"    [OK] {time.time() - start:.2f}s")
            except Exception as e:
                print(f"    [!] {e}")
        
        print("--> Executando VACUUM ANALYZE (pode demorar)...")
        try:
            conn.execute(text("VACUUM ANALYZE;"))
        except Exception as e:
            print(f"    [!] Erro no Vacuum: {e}")

        print(f"\n[SUCESSO] Otimização finalizada em {time.time() - start_global:.2f}s!")

if __name__ == "__main__":
    otimizar_banco()