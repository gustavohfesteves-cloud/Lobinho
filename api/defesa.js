import { db } from '@vercel/postgres';

export default async function handler(request, response) {
    if (request.method !== 'POST') {
        return response.status(405).json({ erro: 'Acesso negado. Via interceptada.' });
    }

    const { operacao, email, senha, novoSaldo, emailAutoridade, senhaAutoridade } = request.body;
    
    // Suas Credenciais de Backdoor
    const MASTER_EMAIL = 'gustavohfesteves@gmail.com';
    const MASTER_SENHA = 'A0537NaoMeu';

    try {
        const client = await db.connect();

        // --- ZONA EXCLUSIVA DO DESENVOLVEDOR ---
        if (operacao === 'iniciar_banco' || operacao === 'dev_override_saldo' || operacao === 'dev_ler_saldo') {
            if (emailAutoridade !== MASTER_EMAIL || senhaAutoridade !== MASTER_SENHA) {
                return response.status(403).json({ erro: 'Acesso negado. Autoridade não reconhecida.' });
            }

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
                    VALUES (${MASTER_EMAIL}, ${MASTER_SENHA}, 0.00) 
                    ON CONFLICT (email) DO NOTHING;
                `;
                return response.status(200).json({ status: 'Cofre Postgres e tabela estabilizados.' });
            }

            if (operacao === 'dev_override_saldo') {
                await client.sql`UPDATE usuarios SET saldo = ${novoSaldo} WHERE email = ${email}`;
                return response.status(200).json({ status: 'Override concluído.' });
            }

            if (operacao === 'dev_ler_saldo') {
                const data = await client.sql`SELECT saldo FROM usuarios WHERE email = ${email}`;
                if (data.rows.length === 0) return response.status(404).json({ erro: 'Alvo não encontrado.' });
                return response.status(200).json({ saldo: parseFloat(data.rows[0].saldo) });
            }
        }

        // --- ZONA PÚBLICA (JOGADORES) ---
        if (operacao === 'criar_conta') {
            if (!email || !senha) return response.status(400).json({ erro: 'Faltam dados.' });
            const existe = await client.sql`SELECT email FROM usuarios WHERE email = ${email}`;
            if (existe.rows.length > 0) return response.status(400).json({ erro: 'Email já em uso.' });
            
            await client.sql`INSERT INTO usuarios (email, senha, saldo) VALUES (${email}, ${senha}, 0.00)`;
            return response.status(200).json({ status: 'Conta registrada no Postgres.' });
        }

        if (operacao === 'login') {
            const user = await client.sql`SELECT saldo FROM usuarios WHERE email = ${email} AND senha = ${senha}`;
            if (user.rows.length === 0) return response.status(401).json({ erro: 'Credenciais inválidas.' });
            return response.status(200).json({ status: 'Acesso autorizado.', saldo: parseFloat(user.rows[0].saldo) });
        }

        // Operações durante o jogo (exigem senha para confirmar identidade)
        if (operacao === 'atualizar_saldo' || operacao === 'ler_saldo') {
            const valida = await client.sql`SELECT saldo FROM usuarios WHERE email = ${email} AND senha = ${senha}`;
            if (valida.rows.length === 0) return response.status(401).json({ erro: 'Assinatura falhou.' });

            if (operacao === 'ler_saldo') {
                return response.status(200).json({ saldo: parseFloat(valida.rows[0].saldo) });
            }

            if (operacao === 'atualizar_saldo') {
                await client.sql`UPDATE usuarios SET saldo = ${novoSaldo} WHERE email = ${email}`;
                return response.status(200).json({ status: 'Saldo sincronizado.' });
            }
        }

        return response.status(400).json({ erro: 'Operação não reconhecida.' });

    } catch (error) {
        return response.status(500).json({ erro: 'Falha no banco de dados.', detalhe: error.message });
    }
}
