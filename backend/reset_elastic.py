from elasticsearch import Elasticsearch
es = Elasticsearch("http://localhost:9200")
print("Apagando índice antigo...")
es.indices.delete(index="empresas-index", ignore=[400, 404])
print("Índice apagado. Agora rode o etl_sync_es.py")