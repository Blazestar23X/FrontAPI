from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import pyodbc
import os
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()
"""
server = 'sql-test-blaze.database.windows.net'
database = 'sql-test-blaze.database.windows.net'
username = 'CloudSAf23562b4'
password = 'Procrastinate1'
driver = '{ODBC Driver 18 for SQL Server}'
"""
app.add_middleware(
  CORSMiddleware,
  allow_origins=["https://localhost:3000"],
  allow_credentials=True,
  allow_methods=["*"],
  allow_headers=["*"],
)

conn_str = (
  f"DRIVER={{ODBC Driver 18 for SQL Server}};"
  f"SERVER=sql-test-blaze.database.windows.net;"
  f"DATABASE=Blog-Post-React;"
  f"UID=CloudSAf23562b4;"
  f"PWD=Procrastinate1;"
  f"Encrypt=yes;TrustServerCertificate=no;Connection Timeout=30;"
)


@app.get("/test-connection")
def test_connection():
  try:
    conn = pyodbc.connect(conn_str)
    cursor = conn.cursor()
    cursor.execute("SELECT @@VERSION")
    row = cursor.fetchone()
    return {"message": "Connected!", "sql_version" : row[0]}
  except Exception as e:
    return {"error":str(e)}

@app.get("/get-data")
def get_data():
  try:
    connection = pyodbc.connect(conn_str)
    cursor = connection.cursor()
    insert_query = "INSERT INTO Users(UsersID,LastName,FirstName,Address,City) VALUES (?,?,?,?,?)"
    values = (2,"GPT","Chat","Internet","OpeAI")
    cursor.execute(insert_query,values)
    connection.commit()
    cursor.execute("SELECT * FROM Users")
    columns = [column[0] for column in cursor.description]
    results = [dict(zip(columns,row)) for row in cursor.fetchall()]
    return results
  except Exception as e:
    return {"error":str(e)}

@app.get("/posts")
def get_blog_posts():
  with pyodbc.connect(conn_str) as conn:
    cursor = conn.cursor()
    cursor.execute("SELECT id, title, content, date FROM BlogPosts")
    columns = [column[0] for column in cursor.description]
    results = [dict(zip(columns,row)) for row in cursor.fetchall()]
  return results
