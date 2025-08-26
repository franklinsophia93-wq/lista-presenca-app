from flask import Flask, render_template, request, redirect, url_for
import sqlite3
import os

app = Flask(__name__)

# Configuração do banco de dados SQLite
DATABASE = 'database.db'

def init_db():
    with sqlite3.connect(DATABASE) as conn:
        cursor = conn.cursor()
        cursor.execute('''CREATE TABLE IF NOT EXISTS confirmacoes
                         (id INTEGER PRIMARY KEY AUTOINCREMENT,
                          nome TEXT NOT NULL,
                          presenca TEXT NOT NULL,
                          acompanhante TEXT NOT NULL)''')
        conn.commit()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/submit', methods=['POST'])
def submit():
    nome = request.form['nome']
    presenca = request.form['presenca']
    acompanhante = request.form['acompanhante']
    
    with sqlite3.connect(DATABASE) as conn:
        cursor = conn.cursor()
        cursor.execute("INSERT INTO confirmacoes (nome, presenca, acompanhante) VALUES (?, ?, ?)",
                      (nome, presenca, acompanhante))
        conn.commit()
    
    return redirect(url_for('confirmados'))

@app.route('/confirmados')
def confirmados():
    with sqlite3.connect(DATABASE) as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT nome, presenca, acompanhante FROM confirmacoes")
        confirmacoes = cursor.fetchall()
    return render_template('confirmados.html', confirmacoes=confirmaciones)

if __name__ == '__main__':
    init_db()  # Inicializa o banco de dados
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 8080)))
