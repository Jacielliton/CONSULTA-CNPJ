import pandas as pd
import os

# Caminho de um arquivo extraído (exemplo: o primeiro arquivo de Estabelecimentos)
# O nome do arquivo extraído geralmente não tem extensão ou é .ESTABELE
CAMINHO_ARQUIVO = "./dados/K3241.K03200Y0.D50211.ESTABELE" # Verifique o nome real na sua pasta

# Nomes das colunas conforme Layout da Receita para a tabela ESTABELECIMENTO
COLUNAS_ESTABELECIMENTO = [
    "CNPJ_BASICO", "CNPJ_ORDEM", "CNPJ_DV", "ID_MATRIZ_FILIAL", "NOME_FANTASIA",
    "SITUACAO_CADASTRAL", "DATA_SITUACAO_CADASTRAL", "MOTIVO_SITUACAO_CADASTRAL",
    "NOME_CIDADE_EXTERIOR", "PAIS", "DATA_INICIO_ATIVIDADE", "CNAE_FISCAL_PRINCIPAL",
    "CNAE_FISCAL_SECUNDARIA", "TIPO_DE_LOGRADOURO", "LOGRADOURO", "NUMERO",
    "COMPLEMENTO", "BAIRRO", "CEP", "UF", "MUNICIPIO", "DDD_1", "TELEFONE_1",
    "DDD_2", "TELEFONE_2", "DDD_FAX", "FAX", "CORREIO_ELETRONICO",
    "SITUACAO_ESPECIAL", "DATA_SITUACAO_ESPECIAL"
]

def ler_amostra():
    # Procura qualquer arquivo que termine com .ESTABELE na pasta dados para testar
    arquivos = [f for f in os.listdir("./dados") if "ESTABELE" in f and not f.endswith(".zip")]
    
    if not arquivos:
        print("Nenhum arquivo de estabelecimento extraído encontrado.")
        return

    arquivo_alvo = os.path.join("./dados", arquivos[0])
    print(f"Lendo amostra de: {arquivo_alvo}")

    # Lendo apenas 5 linhas (chunksize) para não travar a máquina
    chunk = pd.read_csv(
        arquivo_alvo, 
        sep=';', 
        encoding='latin-1', 
        header=None, 
        names=COLUNAS_ESTABELECIMENTO,
        nrows=10, # Lendo apenas 10 linhas para teste
        dtype=str # Ler tudo como texto para evitar erros de conversão agora
    )
    
    print(chunk.head())
    print("\nColunas carregadas com sucesso!")

if __name__ == "__main__":
    ler_amostra()