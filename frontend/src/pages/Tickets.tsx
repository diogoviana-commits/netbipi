import React, { useEffect, useState, useCallback } from 'react';
import {
  Search, Plus, X, ChevronLeft, ChevronRight, Ticket as TicketIcon,
  MessageSquare, Send, Lock,
} from 'lucide-react';
import { ticketsApi } from '../services/api';
import { Ticket, TicketComment } from '../types';
import Badge, {
  priorityVariant, priorityLabel, statusVariant, statusLabel,
} from '../components/ui/Badge';
import Button from '../components/ui/Button';
import LoadingSpinner from '../components/ui/LoadingSpinner';

const formatDate = (dateStr?: string) => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
};

interface CreateTicketForm {
  title: string;
  description: string;
  priority: string;
  category: string;
}

const Tickets: React.FC = () => {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const limit = 20;

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');

  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [isInternalComment, setIsInternalComment] = useState(false);
  const [commentLoading, setCommentLoading] = useState(false);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState<CreateTicketForm>({
    title: '', description: '', priority: 'medium', category: 'incident',
  });
  const [createLoading, setCreateLoading] = useState(false);

  const [toast, setToast] = useState<string | null>(null);

  const showMsg = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    try {
      const res = await ticketsApi.getTickets({
        page, limit,
        ...(search && { search }),
        ...(statusFilter && { status: statusFilter }),
        ...(priorityFilter && { priority: priorityFilter }),
      });
      setTickets(res.data.data || []);
      setTotal(res.data.total || 0);
    } catch {
      showMsg('Erro ao carregar chamados');
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, priorityFilter]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const openDetail = async (ticket: Ticket) => {
    setDetailLoading(true);
    setSelectedTicket(ticket);
    try {
      const res = await ticketsApi.getTicketById(ticket.id);
      setSelectedTicket(res.data);
    } catch {
      // keep initial data
    } finally {
      setDetailLoading(false);
    }
  };

  const handleAddComment = async () => {
    if (!selectedTicket || !commentText.trim()) return;
    setCommentLoading(true);
    try {
      await ticketsApi.addComment(selectedTicket.id, commentText, isInternalComment);
      showMsg('Comentário adicionado');
      setCommentText('');
      const res = await ticketsApi.getTicketById(selectedTicket.id);
      setSelectedTicket(res.data);
    } catch {
      showMsg('Erro ao adicionar comentário');
    } finally {
      setCommentLoading(false);
    }
  };

  const handleStatusChange = async (ticketId: string, status: string) => {
    try {
      await ticketsApi.updateTicket(ticketId, { status });
      showMsg('Status atualizado');
      fetchTickets();
      if (selectedTicket?.id === ticketId) {
        const res = await ticketsApi.getTicketById(ticketId);
        setSelectedTicket(res.data);
      }
    } catch {
      showMsg('Erro ao atualizar status');
    }
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateLoading(true);
    try {
      await ticketsApi.createTicket(createForm as unknown as Record<string, unknown>);
      showMsg('Chamado criado com sucesso');
      setShowCreateModal(false);
      setCreateForm({ title: '', description: '', priority: 'medium', category: 'incident' });
      fetchTickets();
    } catch {
      showMsg('Erro ao criar chamado');
    } finally {
      setCreateLoading(false);
    }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-5 relative">
      {toast && (
        <div className="fixed top-4 right-4 z-50 px-4 py-3 bg-emerald-600/20 border border-emerald-600/40 text-emerald-400 text-sm rounded-lg shadow-lg">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-white font-bold text-xl flex items-center gap-2">
            <TicketIcon size={20} className="text-emerald-400" />
            Chamados
          </h2>
          <p className="text-gray-500 text-sm">{total} chamados encontrados</p>
        </div>
        <Button variant="primary" size="sm" icon={<Plus size={14} />} onClick={() => setShowCreateModal(true)}>
          Novo Chamado
        </Button>
      </div>

      {/* Filters */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            placeholder="Buscar chamados..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full bg-gray-700 border border-gray-600 rounded-lg pl-9 pr-4 py-2 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-emerald-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500"
        >
          <option value="">Todos status</option>
          <option value="open">Aberto</option>
          <option value="in_progress">Em Andamento</option>
          <option value="resolved">Resolvido</option>
          <option value="closed">Fechado</option>
        </select>
        <select
          value={priorityFilter}
          onChange={(e) => { setPriorityFilter(e.target.value); setPage(1); }}
          className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500"
        >
          <option value="">Todas prioridades</option>
          <option value="critical">Crítica</option>
          <option value="high">Alta</option>
          <option value="medium">Média</option>
          <option value="low">Baixa</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16"><LoadingSpinner size="lg" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left text-gray-400 text-xs font-semibold px-4 py-3">ID GLPI</th>
                  <th className="text-left text-gray-400 text-xs font-semibold px-4 py-3">Título</th>
                  <th className="text-left text-gray-400 text-xs font-semibold px-4 py-3">Prioridade</th>
                  <th className="text-left text-gray-400 text-xs font-semibold px-4 py-3">Status</th>
                  <th className="text-left text-gray-400 text-xs font-semibold px-4 py-3 hidden md:table-cell">Ativo</th>
                  <th className="text-left text-gray-400 text-xs font-semibold px-4 py-3 hidden lg:table-cell">Responsável</th>
                  <th className="text-left text-gray-400 text-xs font-semibold px-4 py-3 hidden xl:table-cell">Criado em</th>
                  <th className="text-right text-gray-400 text-xs font-semibold px-4 py-3">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700/50">
                {tickets.map((ticket) => (
                  <tr
                    key={ticket.id}
                    className="hover:bg-gray-700/20 transition-colors cursor-pointer"
                    onClick={() => openDetail(ticket)}
                  >
                    <td className="px-4 py-3 text-gray-500 text-xs font-mono">
                      {ticket.glpi_ticket_id || ticket.glpiTicketId ? `#${ticket.glpi_ticket_id || ticket.glpiTicketId}` : '-'}
                    </td>
                    <td className="px-4 py-3 text-gray-200 text-xs max-w-[200px]">
                      <span className="line-clamp-2">{ticket.title}</span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={priorityVariant(ticket.priority)}>
                        {priorityLabel(ticket.priority)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={statusVariant(ticket.status)}>
                        {statusLabel(ticket.status)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs font-mono hidden md:table-cell">
                      {ticket.asset_hostname || ticket.asset?.hostname || '-'}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs hidden lg:table-cell">
                      {ticket.assigned_user_name || ticket.assignedUser?.fullName || 'N/A'}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs hidden xl:table-cell">
                      {formatDate(ticket.created_at || ticket.createdAt)}
                    </td>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <select
                          value={ticket.status}
                          onChange={(e) => handleStatusChange(ticket.id, e.target.value)}
                          className="bg-gray-700 border border-gray-600 rounded text-xs text-white px-2 py-1 focus:outline-none focus:border-emerald-500"
                          onClick={e => e.stopPropagation()}
                        >
                          <option value="open">Aberto</option>
                          <option value="in_progress">Em Andamento</option>
                          <option value="resolved">Resolvido</option>
                          <option value="closed">Fechado</option>
                        </select>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {tickets.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-gray-500">
                <TicketIcon size={40} className="mb-3 opacity-30" />
                <p className="text-sm">Nenhum chamado encontrado</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>Página {page} de {totalPages}</span>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-2 hover:bg-gray-800 rounded-lg disabled:opacity-30">
              <ChevronLeft size={16} />
            </button>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-2 hover:bg-gray-800 rounded-lg disabled:opacity-30">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Ticket Detail Slide-over */}
      {selectedTicket && (
        <div className="fixed inset-0 z-40 flex">
          <div className="flex-1 bg-black/50" onClick={() => setSelectedTicket(null)} />
          <div className="w-full max-w-xl bg-gray-900 border-l border-gray-700 flex flex-col overflow-hidden">
            {/* Detail header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700 flex-shrink-0">
              <div>
                <p className="text-gray-500 text-xs">Chamado</p>
                <h3 className="text-white font-semibold text-sm">{selectedTicket.title}</h3>
              </div>
              <button onClick={() => setSelectedTicket(null)} className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg">
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {detailLoading ? (
                <div className="flex items-center justify-center py-8"><LoadingSpinner /></div>
              ) : (
                <>
                  {/* Meta */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-gray-500 text-xs">Prioridade</p>
                      <Badge variant={priorityVariant(selectedTicket.priority)}>{priorityLabel(selectedTicket.priority)}</Badge>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">Status</p>
                      <Badge variant={statusVariant(selectedTicket.status)}>{statusLabel(selectedTicket.status)}</Badge>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">Ativo</p>
                      <p className="text-white text-sm font-mono">{selectedTicket.asset_hostname || selectedTicket.asset?.hostname || '-'}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">Responsável</p>
                      <p className="text-white text-sm">{selectedTicket.assigned_user_name || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">Categoria</p>
                      <p className="text-white text-sm capitalize">{selectedTicket.category}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">Criado em</p>
                      <p className="text-white text-sm">{formatDate(selectedTicket.created_at || selectedTicket.createdAt)}</p>
                    </div>
                  </div>

                  {/* Description */}
                  <div>
                    <p className="text-gray-500 text-xs mb-1">Descrição</p>
                    <p className="text-gray-300 text-sm bg-gray-800 border border-gray-700 rounded-lg p-3 whitespace-pre-wrap">
                      {selectedTicket.description}
                    </p>
                  </div>

                  {/* Comments */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <MessageSquare size={14} className="text-gray-400" />
                      <p className="text-gray-400 text-xs font-medium">
                        Comentários ({selectedTicket.comments?.length || 0})
                      </p>
                    </div>
                    <div className="space-y-2">
                      {(selectedTicket.comments || []).map((comment: TicketComment) => (
                        <div
                          key={comment.id}
                          className={`p-3 rounded-lg border text-xs ${
                            comment.is_internal || comment.isInternal
                              ? 'bg-yellow-600/5 border-yellow-600/20'
                              : 'bg-gray-800 border-gray-700'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-gray-300 font-medium">{comment.user_name || comment.user?.fullName}</span>
                            {(comment.is_internal || comment.isInternal) && (
                              <span className="flex items-center gap-1 text-yellow-500">
                                <Lock size={10} /> Interno
                              </span>
                            )}
                            <span className="text-gray-600 ml-auto">{formatDate(comment.created_at || comment.createdAt)}</span>
                          </div>
                          <p className="text-gray-300">{comment.content}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Add comment */}
            <div className="px-6 py-4 border-t border-gray-700 flex-shrink-0 space-y-2">
              <textarea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Adicionar comentário..."
                rows={3}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 text-sm resize-none focus:outline-none focus:border-emerald-500"
              />
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isInternalComment}
                    onChange={(e) => setIsInternalComment(e.target.checked)}
                    className="rounded border-gray-600 bg-gray-700 text-yellow-500"
                  />
                  <Lock size={12} />
                  Nota interna
                </label>
                <Button
                  variant="primary"
                  size="sm"
                  icon={<Send size={12} />}
                  loading={commentLoading}
                  onClick={handleAddComment}
                  disabled={!commentText.trim()}
                >
                  Enviar
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Ticket Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowCreateModal(false)} />
          <div className="relative bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
              <h3 className="text-white font-semibold">Novo Chamado</h3>
              <button onClick={() => setShowCreateModal(false)} className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleCreateTicket} className="p-6 space-y-4">
              <div>
                <label className="block text-gray-400 text-sm mb-1">Título *</label>
                <input
                  type="text"
                  required
                  value={createForm.title}
                  onChange={e => setCreateForm(f => ({ ...f, title: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-gray-400 text-sm mb-1">Descrição *</label>
                <textarea
                  required
                  rows={4}
                  value={createForm.description}
                  onChange={e => setCreateForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm resize-none focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-400 text-sm mb-1">Prioridade</label>
                  <select
                    value={createForm.priority}
                    onChange={e => setCreateForm(f => ({ ...f, priority: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500"
                  >
                    <option value="low">Baixa</option>
                    <option value="medium">Média</option>
                    <option value="high">Alta</option>
                    <option value="critical">Crítica</option>
                  </select>
                </div>
                <div>
                  <label className="block text-gray-400 text-sm mb-1">Categoria</label>
                  <select
                    value={createForm.category}
                    onChange={e => setCreateForm(f => ({ ...f, category: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500"
                  >
                    <option value="incident">Incidente</option>
                    <option value="change">Mudança</option>
                    <option value="maintenance">Manutenção</option>
                    <option value="request">Requisição</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button variant="ghost" size="sm" onClick={() => setShowCreateModal(false)}>Cancelar</Button>
                <Button variant="primary" size="sm" type="submit" loading={createLoading}>Criar Chamado</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Tickets;
