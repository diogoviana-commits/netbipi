import { Request, Response } from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as net from 'net';
import * as dns from 'dns';
import { query } from '../config/database';

const execAsync = promisify(exec);
const dnsResolve = promisify(dns.resolve);

const savesDiagnostic = async (
  userId: string,
  type: string,
  target: string,
  result: string,
  status: string,
  assetId?: string
) => {
  try {
    await query(
      `INSERT INTO network_diagnostics (executed_by, asset_id, type, target, result, status)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, assetId || null, type, target, result, status]
    );
  } catch (err) {
    console.error('[Network] Failed to save diagnostic:', err);
  }
};

const TCP_FALLBACK_PORTS = [443, 80, 22, 53];

const probeTcpReachability = async (target: string): Promise<{ port: number; latency: number } | null> => {
  for (const port of TCP_FALLBACK_PORTS) {
    try {
      const start = Date.now();
      await new Promise<void>((resolve, reject) => {
        const socket = new net.Socket();
        socket.setTimeout(2500);
        socket.connect(port, target, () => {
          socket.destroy();
          resolve();
        });
        socket.on('timeout', () => {
          socket.destroy();
          reject(new Error('timeout'));
        });
        socket.on('error', (err) => {
          socket.destroy();
          reject(err);
        });
      });
      return { port, latency: Date.now() - start };
    } catch {
      // Tenta a proxima porta comum.
    }
  }

  return null;
};

const isPingReply = (output: string): boolean => {
  const text = output.toLowerCase();
  return (
    text.includes('bytes from') ||
    text.includes('reply from') ||
    text.includes('resposta de') ||
    text.includes('0% packet loss') ||
    text.includes('0% de perda') ||
    /received\s*=\s*[1-9]/i.test(output)
  );
};

const findAssetByTarget = async (target: string): Promise<string | undefined> => {
  const result = await query(
    'SELECT id FROM assets WHERE ip_address = $1 OR hostname = $1',
    [target]
  );
  return result.rows[0]?.id;
};

export const runPing = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Não autenticado' });
      return;
    }

    const { target, count = 4 } = req.body;
    if (!target) {
      res.status(400).json({ error: 'Target é obrigatório' });
      return;
    }

    const sanitizedTarget = target.replace(/[^a-zA-Z0-9.\-_:]/g, '');
    const assetId = await findAssetByTarget(sanitizedTarget);

    let result = '';
    let status = 'success';

    try {
      const isWindows = process.platform === 'win32';
      const cmd = isWindows
        ? `ping -n ${count} ${sanitizedTarget}`
        : `ping -c ${count} -W 2 ${sanitizedTarget}`;

      const { stdout, stderr } = await execAsync(cmd, { timeout: 15000 });
      result = `${stdout || ''}${stderr || ''}`.trim();

      if (!isPingReply(result)) {
        status = 'failed';
      }
    } catch (execErr: unknown) {
      const msg = (execErr as { message?: string }).message || '';
      // ping não instalado — tenta TCP connect na porta 80 como fallback
      if (msg.includes('not found') || msg.includes('ENOENT') || msg.includes('command')) {
        try {
          const start = Date.now();
          await new Promise<void>((resolve, reject) => {
            const s = new net.Socket();
            s.setTimeout(3000);
            s.connect(80, sanitizedTarget, () => { s.destroy(); resolve(); });
            s.on('error', reject);
            s.on('timeout', () => { s.destroy(); reject(new Error('timeout')); });
          });
          const latency = Date.now() - start;
          result = `TCP connect para ${sanitizedTarget}:80 — SUCESSO (${latency}ms)\n[ICMP ping indisponível no container — usando TCP como alternativa]`;
          status = 'success';
        } catch {
          result = `${sanitizedTarget} — sem resposta na porta 80\n[ICMP ping indisponível no container — usando TCP como alternativa]`;
          status = 'failed';
        }
      } else {
        result = `Ping para ${sanitizedTarget} falhou: host inacessível ou timeout`;
        status = 'failed';
      }
    }

    if (status === 'failed') {
      const tcpProbe = await probeTcpReachability(sanitizedTarget);
      if (tcpProbe) {
        result =
          `ICMP indisponível ou bloqueado para ${sanitizedTarget}.\n` +
          `TCP respondeu na porta ${tcpProbe.port} (${tcpProbe.latency}ms).\n` +
          '[Fallback automático do NetBIPI: algumas redes bloqueiam ICMP, mas continuam acessíveis via TCP.]';
        status = 'success';
      }
    }

    await savesDiagnostic(req.user.userId, 'ping', sanitizedTarget, result, status, assetId);

    res.json({ target: sanitizedTarget, result, status, type: 'ping' });
  } catch (err) {
    console.error('[Network] runPing error:', err);
    res.status(500).json({ error: 'Erro ao executar ping' });
  }
};

export const runDnsLookup = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Não autenticado' });
      return;
    }

    const { target } = req.body;
    if (!target) {
      res.status(400).json({ error: 'Target é obrigatório' });
      return;
    }

    let result = '';
    let status = 'success';

    try {
      const addresses = await dnsResolve(target);
      result = `Resolução DNS para ${target}:\n`;
      result += addresses.map(addr => `  -> ${addr}`).join('\n');
      result += `\n\nTotal: ${addresses.length} registro(s) encontrado(s)`;
    } catch (dnsErr) {
      result = `Falha na resolução DNS para ${target}: ${(dnsErr as Error).message}`;
      status = 'failed';
    }

    await savesDiagnostic(req.user.userId, 'dns', target, result, status);

    res.json({ target, result, status, type: 'dns' });
  } catch (err) {
    console.error('[Network] runDnsLookup error:', err);
    res.status(500).json({ error: 'Erro ao executar DNS lookup' });
  }
};

export const runPortCheck = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Não autenticado' });
      return;
    }

    const { target, port } = req.body;
    if (!target || !port) {
      res.status(400).json({ error: 'Target e port são obrigatórios' });
      return;
    }

    const portNum = parseInt(port);
    if (portNum < 1 || portNum > 65535) {
      res.status(400).json({ error: 'Porta inválida (1-65535)' });
      return;
    }

    const assetId = await findAssetByTarget(target);

    let result = '';
    let status = 'success';

    await new Promise<void>((resolve) => {
      const socket = new net.Socket();
      const startTime = Date.now();

      socket.setTimeout(5000);
      socket.connect(portNum, target, () => {
        const latency = Date.now() - startTime;
        result = `Porta ${portNum} em ${target}: ABERTA (latência: ${latency}ms)`;
        status = 'success';
        socket.destroy();
        resolve();
      });

      socket.on('timeout', () => {
        result = `Porta ${portNum} em ${target}: TIMEOUT (sem resposta em 5s)`;
        status = 'timeout';
        socket.destroy();
        resolve();
      });

      socket.on('error', (err) => {
        result = `Porta ${portNum} em ${target}: FECHADA/FILTRADA (${err.message})`;
        status = 'failed';
        socket.destroy();
        resolve();
      });
    });

    await savesDiagnostic(req.user.userId, 'port', `${target}:${port}`, result, status, assetId);

    res.json({ target, port: portNum, result, status, type: 'port' });
  } catch (err) {
    console.error('[Network] runPortCheck error:', err);
    res.status(500).json({ error: 'Erro ao verificar porta' });
  }
};

export const runTraceroute = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Não autenticado' });
      return;
    }

    const { target } = req.body;
    if (!target) {
      res.status(400).json({ error: 'Target é obrigatório' });
      return;
    }

    const sanitizedTarget = target.replace(/[^a-zA-Z0-9.\-_:]/g, '');
    let result = '';
    let status = 'success';

    try {
      const isWindows = process.platform === 'win32';
      const cmd = isWindows
        ? `tracert -h 15 -w 1000 ${sanitizedTarget}`
        : `traceroute -m 15 -w 2 ${sanitizedTarget}`;

      const { stdout, stderr } = await execAsync(cmd, { timeout: 30000 });
      result = stdout || stderr || 'Sem saída';
    } catch (execErr) {
      const error = execErr as { message?: string; stdout?: string; stderr?: string };
      const details = [error.stdout, error.stderr, error.message]
        .filter(Boolean)
        .join('\n')
        .trim();

      if (/ENOENT|not found|is not recognized/i.test(error.message || '')) {
        result = `Traceroute indisponível neste ambiente para ${sanitizedTarget}. Instale traceroute/tracert no host para ver os saltos detalhados.`;
      } else {
        result = details || `Traceroute para ${sanitizedTarget} falhou.`;
      }
      status = 'failed';
    }

    await savesDiagnostic(req.user.userId, 'traceroute', sanitizedTarget, result, status);

    res.json({ target: sanitizedTarget, result, status, type: 'traceroute' });
  } catch (err) {
    console.error('[Network] runTraceroute error:', err);
    res.status(500).json({ error: 'Erro ao executar traceroute' });
  }
};

export const getDiagnosticHistory = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Não autenticado' });
      return;
    }

    const { limit = '20' } = req.query;

    const result = await query(
      `SELECT nd.*, u.full_name as executed_by_name, ast.hostname as asset_hostname
       FROM network_diagnostics nd
       LEFT JOIN users u ON nd.executed_by = u.id
       LEFT JOIN assets ast ON nd.asset_id = ast.id
       WHERE nd.executed_by = $1
       ORDER BY nd.executed_at DESC
       LIMIT $2`,
      [req.user.userId, parseInt(limit as string)]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('[Network] getDiagnosticHistory error:', err);
    res.status(500).json({ error: 'Erro ao buscar histórico de diagnósticos' });
  }
};
