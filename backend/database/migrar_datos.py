from sqlalchemy import create_engine, MetaData

sqlite_engine = create_engine("sqlite:///./sql_app.db")
pg_engine = create_engine("postgresql+psycopg2://administrador:password@localhost:5432/anidep")

origen = MetaData()
origen.reflect(bind=sqlite_engine)

destino = MetaData()
destino.reflect(bind=pg_engine)

with sqlite_engine.connect() as src, pg_engine.begin() as dst:
    for tabla in destino.sorted_tables:  
        filas = src.execute(origen.tables[tabla.name].select()).mappings().all()
        if filas:
            dst.execute(tabla.insert(), [dict(f) for f in filas])
        print(tabla.name, len(filas))