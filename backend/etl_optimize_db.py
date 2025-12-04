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
    # Aumentamos o timeout para garantir que operações longas não caiam
    return create_engine(DATABASE_URL, isolation_level="AUTOCOMMIT", connect_args={"timeout": 300})

def otimizar_banco():
    engine = get_engine()
    print(f"[*] Otimizando banco para máquina: i3-10105F / 16GB RAM / SSD")
    print(f"[*] Foco: Índices estruturais (Elasticsearch cuidará da busca textual)")
    
    # Comandos SQL otimizados
    comandos = [
        # 1. Ajuste de Memória para a sessão atual (Acelera a criação de índices)
        # Usamos 1GB de RAM para manutenção (tente não usar o PC para outras coisas pesadas durante isso)
        ("Ajustando work_mem temporário", 
         "SET maintenance_work_mem = '1GB';"),

        # 2. Índices Essenciais para Relacionamento (JOINs)
        # Fundamental para ligar Empresa com Estabelecimento sem travar
        ("Índice B-Tree: Empresas (CNPJ Básico)", 
         "CREATE INDEX IF NOT EXISTS idx_empresa_basico ON empresas (cnpj_basico);"),

        ("Índice B-Tree: Estabelecimentos (CNPJ Completo)", 
         "CREATE INDEX IF NOT EXISTS idx_cnpj_completo ON estabelecimentos (cnpj_basico, cnpj_ordem, cnpj_dv);"),

        # 3. Índices para Filtros Rápidos (Estado e Data)
        # Estes são leves e não ocupam muito espaço
        ("Índice B-Tree: UF", 
         "CREATE INDEX IF NOT EXISTS idx_uf ON estabelecimentos (uf);"),
         
        ("Índice B-Tree: Data Início (Para ordenação)", 
         "CREATE INDEX IF NOT EXISTS idx_data_inicio ON estabelecimentos (data_inicio_atividade);"),

        # 4. Índices Auxiliares para Detalhes (Sócios e CNAEs)
        ("Índice B-Tree: Sócios", 
         "CREATE INDEX IF NOT EXISTS idx_socios_basico ON socios (cnpj_basico);"),
         
        ("Índice B-Tree: CNAE Principal", 
         "CREATE INDEX IF NOT EXISTS idx_cnae_principal ON estabelecimentos (cnae_fiscal_principal);")
    ]

    # NOTA: Removemos os índices GIN (pg_trgm) de Razão Social e Nome Fantasia.
    # Motivo: Você tem pouco espaço em disco (~117GB livre) e usará o ElasticSearch.
    # Manter esses índices no Postgres duplicaria os dados e lotaria seu SSD.

    with engine.connect() as conn:
        start_global = time.time()
        
        for descricao, sql in comandos:
            print(f"--> {descricao}...")
            start = time.time()
            try:
                conn.execute(text(sql))
                print(f"    [OK] Concluído em {time.time() - start:.2f}s")
            except Exception as e:
                # Ignora erros se o índice já existir ou se tabela estiver travada
                print(f"    [!] Aviso (pode ser ignorado se já existir): {e}")
        
        # Opcional: Vacuum Analyze para atualizar as estatísticas do banco
        print("--> Executando VACUUM ANALYZE (Limpeza e estatísticas)...")
        try:
            conn.execute(text("VACUUM ANALYZE;"))
            print("    [OK] Banco otimizado.")
        except Exception as e:
            print(f"    [!] Pulei o Vacuum (tabelas em uso): {e}")

        print(f"\n[SUCESSO] Otimização LEVE finalizada em {time.time() - start_global:.2f}s!")

if __name__ == "__main__":
    otimizar_banco()