from dotenv import load_dotenv
from sqlalchemy import create_engine, MetaData
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.orm import Session
from fastapi import Depends
import os

# .env 파일 로드
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))

DB_URL = (
    f"postgresql+psycopg://{os.getenv('DB_USER')}:{os.getenv('DB_PASS')}"
    f"@{os.getenv('DB_HOST')}:{os.getenv('DB_PORT')}/{os.getenv('DB_NAME')}"
)

# SQL 에코는 기본 끔. 디버깅이 필요하면 .env 에 DB_ECHO=1 을 넣는다.
# (AS-IS 는 echo=True 고정이라 매 쿼리마다 전문이 콘솔에 찍혔음)
DB_ECHO = os.getenv("DB_ECHO", "0") == "1"

engine = create_engine(DB_URL, echo=DB_ECHO, future=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
Base = declarative_base(metadata=MetaData(schema="life_expense"))

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

SessionDep = get_db
