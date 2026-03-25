import { Request, Response } from 'express';
import { query } from '../config/database';
import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';

const getDateRange = (req: Request) => {
  const { start, end } = req.query as Record<string, string>;
  const startDate = start ? new Date(start) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const endDate = end ? new Date(end) : new Date();
  return { startDate, endDate };
};

export const getIncidentReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const { startDate, endDate } = getDateRange(req);

    const [alertStats, topHosts, alertsBySeverity, alertsOverTime, ticketStats, mttr] = await Promise.all([
      query(
        `SELECT COUNT(*) AS total,
                SUM(CASE WHEN severity IN ('disaster','high') THEN 1 ELSE 0 END) AS critical_count,
                SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) AS resolved_count,
                SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) AS open_count
         FROM alerts WHERE created_at BETWEEN $1 AND $2`,
        [startDate, endDate]
      ),
      query(
        `SELECT ast.hostname, COUNT(a.id) AS incident_count
         FROM alerts a
         LEFT JOIN assets ast ON a.asset_id = ast.id
         WHERE a.created_at BETWEEN $1 AND $2
         GROUP BY ast.hostname ORDER BY incident_count DESC LIMIT 10`,
        [startDate, endDate]
      ),
      query(
        `SELECT severity, COUNT(*) AS count FROM alerts
         WHERE created_at BETWEEN $1 AND $2 GROUP BY severity ORDER BY count DESC`,
        [startDate, endDate]
      ),
      query(
        `SELECT DATE_TRUNC('day', created_at) AS day, COUNT(*) AS count
         FROM alerts WHERE created_at BETWEEN $1 AND $2
         GROUP BY day ORDER BY day`,
        [startDate, endDate]
      ),
      query(
        `SELECT status, COUNT(*) AS count FROM tickets
         WHERE created_at BETWEEN $1 AND $2 GROUP BY status`,
        [startDate, endDate]
      ),
      query(
        `SELECT AVG(EXTRACT(EPOCH FROM (resolved_at - created_at))/60) AS avg_minutes
         FROM alerts WHERE resolved_at IS NOT NULL AND created_at BETWEEN $1 AND $2`,
        [startDate, endDate]
      ),
    ]);

    res.json({
      period: { start: startDate, end: endDate },
      summary: alertStats.rows[0],
      topHosts: topHosts.rows,
      alertsBySeverity: alertsBySeverity.rows,
      alertsOverTime: alertsOverTime.rows,
      ticketsByStatus: ticketStats.rows,
      mttrMinutes: Math.round(parseFloat(mttr.rows[0]?.avg_minutes || '0')),
    });
  } catch (err) {
    console.error('[Reports] Erro ao gerar relatório:', err);
    res.status(500).json({ error: 'Erro ao gerar relatório de incidentes' });
  }
};

export const downloadPDF = async (req: Request, res: Response): Promise<void> => {
  try {
    const { startDate, endDate } = getDateRange(req);

    const [alertStats, topHosts, alertsBySeverity, ticketStats, mttr] = await Promise.all([
      query(
        `SELECT COUNT(*) AS total,
                SUM(CASE WHEN severity IN ('disaster','high') THEN 1 ELSE 0 END) AS critical_count,
                SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) AS resolved_count
         FROM alerts WHERE created_at BETWEEN $1 AND $2`,
        [startDate, endDate]
      ),
      query(
        `SELECT ast.hostname, COUNT(a.id) AS incident_count
         FROM alerts a LEFT JOIN assets ast ON a.asset_id = ast.id
         WHERE a.created_at BETWEEN $1 AND $2
         GROUP BY ast.hostname ORDER BY incident_count DESC LIMIT 10`,
        [startDate, endDate]
      ),
      query(
        `SELECT severity, COUNT(*) AS count FROM alerts
         WHERE created_at BETWEEN $1 AND $2 GROUP BY severity ORDER BY count DESC`,
        [startDate, endDate]
      ),
      query(
        `SELECT status, COUNT(*) AS count FROM tickets
         WHERE created_at BETWEEN $1 AND $2 GROUP BY status`,
        [startDate, endDate]
      ),
      query(
        `SELECT AVG(EXTRACT(EPOCH FROM (resolved_at - created_at))/60) AS avg_minutes
         FROM alerts WHERE resolved_at IS NOT NULL AND created_at BETWEEN $1 AND $2`,
        [startDate, endDate]
      ),
    ]);

    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const dateStr = new Date().toISOString().split('T')[0];

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=relatorio-netbipi-${dateStr}.pdf`);
    doc.pipe(res);

    // Header
    doc.fontSize(24).fillColor('#059669').text('NetBIPI', 50, 50);
    doc.fontSize(12).fillColor('#666666').text('Hub Operacional NOC/SOC', 50, 80);
    doc.fontSize(10).fillColor('#333333')
      .text(`Período: ${startDate.toLocaleDateString('pt-BR')} a ${endDate.toLocaleDateString('pt-BR')}`, 50, 100)
      .text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 50, 115);

    doc.moveTo(50, 135).lineTo(545, 135).stroke('#059669');

    // Summary
    doc.fontSize(14).fillColor('#333333').text('Resumo Executivo', 50, 150);
    const stats = alertStats.rows[0];
    const mttrVal = Math.round(parseFloat(mttr.rows[0]?.avg_minutes || '0'));
    const summaryData = [
      ['Total de Alertas', stats?.total || '0'],
      ['Alertas Críticos', stats?.critical_count || '0'],
      ['Alertas Resolvidos', stats?.resolved_count || '0'],
      ['MTTR Médio (min)', String(mttrVal)],
    ];

    let yPos = 175;
    summaryData.forEach(([label, value]) => {
      doc.fontSize(10).fillColor('#666666').text(label + ':', 70, yPos);
      doc.fontSize(10).fillColor('#333333').text(String(value), 250, yPos);
      yPos += 18;
    });

    // Severity breakdown
    yPos += 10;
    doc.fontSize(14).fillColor('#333333').text('Alertas por Severidade', 50, yPos);
    yPos += 25;

    const severityColors: Record<string, string> = {
      disaster: '#dc2626', high: '#ea580c', average: '#d97706', warning: '#ca8a04', info: '#2563eb',
    };

    alertsBySeverity.rows.forEach((row: { severity: string; count: string }) => {
      const color = severityColors[row.severity] || '#666666';
      doc.rect(70, yPos - 2, 10, 10).fill(color);
      doc.fontSize(10).fillColor('#666666').text(row.severity.toUpperCase() + ':', 90, yPos);
      doc.fontSize(10).fillColor('#333333').text(String(row.count), 250, yPos);
      yPos += 18;
    });

    // Top hosts
    yPos += 10;
    if (yPos > 650) { doc.addPage(); yPos = 50; }
    doc.fontSize(14).fillColor('#333333').text('Top 10 Hosts com Mais Incidentes', 50, yPos);
    yPos += 25;

    doc.fontSize(9).fillColor('#999999')
      .text('Hostname', 70, yPos)
      .text('Incidentes', 400, yPos);
    doc.moveTo(70, yPos + 12).lineTo(545, yPos + 12).stroke('#cccccc');
    yPos += 20;

    topHosts.rows.forEach((row: { hostname: string; incident_count: string }, idx: number) => {
      if (yPos > 720) { doc.addPage(); yPos = 50; }
      const bg = idx % 2 === 0 ? '#f9f9f9' : '#ffffff';
      doc.rect(70, yPos - 4, 475, 16).fill(bg);
      doc.fontSize(9).fillColor('#333333')
        .text(row.hostname || 'Desconhecido', 75, yPos)
        .text(String(row.incident_count), 405, yPos);
      yPos += 18;
    });

    // Tickets by status
    yPos += 10;
    if (yPos > 650) { doc.addPage(); yPos = 50; }
    doc.fontSize(14).fillColor('#333333').text('Chamados por Status', 50, yPos);
    yPos += 25;

    ticketStats.rows.forEach((row: { status: string; count: string }) => {
      doc.fontSize(10).fillColor('#666666').text(row.status + ':', 70, yPos);
      doc.fontSize(10).fillColor('#333333').text(String(row.count), 250, yPos);
      yPos += 18;
    });

    // Footer
    doc.fontSize(8).fillColor('#999999')
      .text('Gerado automaticamente pelo NetBIPI Hub Operacional', 50, 780, { align: 'center' });

    doc.end();
  } catch (err) {
    console.error('[Reports] Erro ao gerar PDF:', err);
    if (!res.headersSent) res.status(500).json({ error: 'Erro ao gerar PDF' });
  }
};

export const downloadExcel = async (req: Request, res: Response): Promise<void> => {
  try {
    const { startDate, endDate } = getDateRange(req);

    const [alerts, tickets, summary] = await Promise.all([
      query(
        `SELECT a.id, a.trigger_name, a.severity, a.status, a.message,
                a.created_at, a.acknowledged_at, a.resolved_at,
                ast.hostname, ast.ip_address
         FROM alerts a LEFT JOIN assets ast ON a.asset_id = ast.id
         WHERE a.created_at BETWEEN $1 AND $2 ORDER BY a.created_at DESC`,
        [startDate, endDate]
      ),
      query(
        `SELECT t.id, t.title, t.status, t.priority, t.category,
                t.created_at, t.updated_at,
                u.full_name AS assigned_to
         FROM tickets t LEFT JOIN users u ON t.assigned_to = u.id
         WHERE t.created_at BETWEEN $1 AND $2 ORDER BY t.created_at DESC`,
        [startDate, endDate]
      ),
      query(
        `SELECT
          (SELECT COUNT(*) FROM alerts WHERE created_at BETWEEN $1 AND $2) AS total_alerts,
          (SELECT COUNT(*) FROM alerts WHERE severity IN ('disaster','high') AND created_at BETWEEN $1 AND $2) AS critical_alerts,
          (SELECT COUNT(*) FROM tickets WHERE created_at BETWEEN $1 AND $2) AS total_tickets,
          (SELECT COUNT(*) FROM tickets WHERE status = 'resolved' AND created_at BETWEEN $1 AND $2) AS resolved_tickets,
          (SELECT AVG(EXTRACT(EPOCH FROM (resolved_at - created_at))/60)
           FROM alerts WHERE resolved_at IS NOT NULL AND created_at BETWEEN $1 AND $2) AS avg_mttr`,
        [startDate, endDate]
      ),
    ]);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'NetBIPI';
    workbook.created = new Date();

    // Sheet 1: Alertas
    const alertSheet = workbook.addWorksheet('Alertas');
    alertSheet.columns = [
      { header: 'ID', key: 'id', width: 38 },
      { header: 'Trigger', key: 'trigger_name', width: 40 },
      { header: 'Severidade', key: 'severity', width: 15 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Host', key: 'hostname', width: 25 },
      { header: 'IP', key: 'ip_address', width: 18 },
      { header: 'Mensagem', key: 'message', width: 50 },
      { header: 'Criado em', key: 'created_at', width: 22 },
      { header: 'Reconhecido em', key: 'acknowledged_at', width: 22 },
      { header: 'Resolvido em', key: 'resolved_at', width: 22 },
    ];
    alertSheet.getRow(1).font = { bold: true };
    alertSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF059669' } };
    alertSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    alerts.rows.forEach((row: Record<string, unknown>) => alertSheet.addRow(row));

    // Sheet 2: Chamados
    const ticketSheet = workbook.addWorksheet('Chamados');
    ticketSheet.columns = [
      { header: 'ID', key: 'id', width: 38 },
      { header: 'Título', key: 'title', width: 50 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Prioridade', key: 'priority', width: 15 },
      { header: 'Categoria', key: 'category', width: 25 },
      { header: 'Responsável', key: 'assigned_to', width: 25 },
      { header: 'Criado em', key: 'created_at', width: 22 },
      { header: 'Atualizado em', key: 'updated_at', width: 22 },
    ];
    ticketSheet.getRow(1).font = { bold: true };
    ticketSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF059669' } };
    ticketSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    tickets.rows.forEach((row: Record<string, unknown>) => ticketSheet.addRow(row));

    // Sheet 3: Resumo
    const summarySheet = workbook.addWorksheet('Resumo');
    summarySheet.columns = [
      { header: 'Métrica', key: 'metric', width: 35 },
      { header: 'Valor', key: 'value', width: 20 },
    ];
    summarySheet.getRow(1).font = { bold: true };
    summarySheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF059669' } };
    summarySheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

    const s = summary.rows[0];
    summarySheet.addRow({ metric: 'Período', value: `${startDate.toLocaleDateString('pt-BR')} a ${endDate.toLocaleDateString('pt-BR')}` });
    summarySheet.addRow({ metric: 'Total de Alertas', value: s?.total_alerts || 0 });
    summarySheet.addRow({ metric: 'Alertas Críticos', value: s?.critical_alerts || 0 });
    summarySheet.addRow({ metric: 'Total de Chamados', value: s?.total_tickets || 0 });
    summarySheet.addRow({ metric: 'Chamados Resolvidos', value: s?.resolved_tickets || 0 });
    summarySheet.addRow({ metric: 'MTTR Médio (minutos)', value: Math.round(parseFloat(s?.avg_mttr || '0')) });

    const dateStr = new Date().toISOString().split('T')[0];
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=relatorio-netbipi-${dateStr}.xlsx`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('[Reports] Erro ao gerar Excel:', err);
    if (!res.headersSent) res.status(500).json({ error: 'Erro ao gerar Excel' });
  }
};

export const getSLAReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const { startDate, endDate } = getDateRange(req);

    const result = await query(
      `SELECT
         u.full_name AS analyst,
         u.role,
         COUNT(DISTINCT t.id) AS tickets_handled,
         COUNT(DISTINCT CASE WHEN t.status IN ('resolved','closed') THEN t.id END) AS tickets_resolved,
         AVG(EXTRACT(EPOCH FROM (t.updated_at - t.created_at))/3600) AS avg_resolution_hours,
         COUNT(DISTINCT a.id) AS alerts_acknowledged
       FROM users u
       LEFT JOIN tickets t ON t.assigned_to = u.id AND t.created_at BETWEEN $1 AND $2
       LEFT JOIN alerts a ON a.acknowledged_by = u.id AND a.acknowledged_at BETWEEN $1 AND $2
       WHERE u.is_active = true
       GROUP BY u.id, u.full_name, u.role
       ORDER BY tickets_handled DESC`,
      [startDate, endDate]
    );

    res.json({
      period: { start: startDate, end: endDate },
      analysts: result.rows,
    });
  } catch (err) {
    console.error('[Reports] Erro ao gerar relatório SLA:', err);
    res.status(500).json({ error: 'Erro ao gerar relatório SLA' });
  }
};
