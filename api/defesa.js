import { db } from '@vercel/postgres';

export default async function handler(request, response) {
    if (request.method !== 'POST') {
        return response.status(405).json({ erro: 'Acesso negado.' });
    }

    const { operacao, email, senha, novoSaldo } = request.body;

    if (email !== 'gustavohfesteves@gmail.com' || senha !== 'A0537NaoMeu') {
        return response.status(403).json({ erro: 'Credenciais inválidas.' });
    }

    try {
        const client = await db.connect();

        if (operacao === 'iniciar_banco') {
            await client.sql`
                CREATE TABLE IF NOT EXISTS usuarios (
                    email VARCHAR(255) PRIMARY KEY,
                    senha VARCHAR(255),
                    saldo NUMERIC(10, 2) DEFAULT 0.00
                );
            `;
            await client.sql`
                INSERT INTO usuarios (email, senha, saldo) 
                VALUES (${email}, ${senha}, 0.00) 
                ON CONFLICT (email) DO NOTHING;
            `;
            return response.status(200).json({ status: 'Cofre estabilizado.' });
        }

        if (operacao === 'atualizar_saldo') {
            await client.sql`
                UPDATE usuarios SET saldo = ${novoSaldo} WHERE email = ${email};
            `;
            return response.status(200).json({ status: 'Saldo sobrescrito.' });
        }

        if (operacao === 'ler_saldo') {
            const data = await client.sql`SELECT saldo FROM usuarios WHERE email = ${email};`;
            const saldoAtual = data.rows.length > 0 ? data.rows[0].saldo : 0;
            return response.status(200).json({ saldo: parseFloat(saldoAtual) });
        }

        return response.status(400).json({ erro: 'Comando não reconhecido.' });

    } catch (error) {
        return response.status(500).json({ erro: 'Falha no servidor.', detalhe: error.message });
    }
}
