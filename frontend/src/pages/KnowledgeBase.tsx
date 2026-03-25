import React, { useState, useEffect, useCallback } from 'react';
import { BookOpen, Search, Plus, Eye, Tag, X, ChevronRight, Loader2, FileText } from 'lucide-react';
import { knowledgeApi } from '../services/api';
import { useAuthStore } from '../store/authStore';

interface Article {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  trigger_pattern?: string;
  view_count: number;
  author_name?: string;
  created_at: string;
  updated_at: string;
}

const categoryColors: Record<string, string> = {
  Nginx: 'bg-green-500/20 text-green-400 border-green-500/30',
  Linux: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  VPN: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  'Active Directory': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  Redes: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  Segurança: 'bg-red-500/20 text-red-400 border-red-500/30',
  Geral: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
};

const getCategoryStyle = (cat: string) =>
  categoryColors[cat] || 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';

const ArticleModal: React.FC<{ article: Article; onClose: () => void }> = ({ article, onClose }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
    <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl">
      <div className="flex items-center justify-between p-5 border-b border-gray-800">
        <div className="flex-1 min-w-0">
          <h2 className="text-white font-bold text-lg leading-snug">{article.title}</h2>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className={`text-xs px-2 py-0.5 rounded border ${getCategoryStyle(article.category)}`}>
              {article.category}
            </span>
            {article.trigger_pattern && (
              <span className="text-xs text-gray-500">Trigger: {article.trigger_pattern}</span>
            )}
            <span className="text-gray-600 text-xs flex items-center gap-1">
              <Eye size={11} /> {article.view_count} visualizações
            </span>
          </div>
        </div>
        <button onClick={onClose} className="text-gray-500 hover:text-white ml-4 flex-shrink-0">
          <X size={20} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-5">
        <pre className="text-gray-300 text-sm whitespace-pre-wrap font-mono leading-relaxed bg-gray-950 rounded-lg p-4 border border-gray-800">
          {article.content}
        </pre>
        {article.tags.length > 0 && (
          <div className="flex items-center gap-2 mt-4 flex-wrap">
            <Tag size={12} className="text-gray-600" />
            {article.tags.map((t) => (
              <span key={t} className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded">
                {t}
              </span>
            ))}
          </div>
        )}
        <p className="text-gray-600 text-xs mt-4">
          Última atualização: {new Date(article.updated_at).toLocaleString('pt-BR')}
          {article.author_name && ` · Por: ${article.author_name}`}
        </p>
      </div>
    </div>
  </div>
);

const CreateArticleModal: React.FC<{ onClose: () => void; onCreated: () => void }> = ({ onClose, onCreated }) => {
  const [form, setForm] = useState({ title: '', content: '', category: 'Geral', tags: '', trigger_pattern: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await knowledgeApi.createArticle({
        ...form,
        tags: form.tags ? form.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
        trigger_pattern: form.trigger_pattern || undefined,
      });
      onCreated();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao criar artigo';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-2xl shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-gray-800">
          <h2 className="text-white font-bold text-lg">Novo Artigo</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && <div className="bg-red-900/30 border border-red-700 text-red-400 text-sm p-3 rounded-lg">{error}</div>}
          <div>
            <label className="block text-gray-400 text-sm mb-1">Título *</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
              placeholder="Título do artigo..."
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-400 text-sm mb-1">Categoria</label>
              <select
                value={form.category}
                onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
              >
                {['Geral', 'Nginx', 'Linux', 'VPN', 'Active Directory', 'Redes', 'Segurança', 'Windows', 'Database'].map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-gray-400 text-sm mb-1">Padrão de trigger</label>
              <input
                type="text"
                value={form.trigger_pattern}
                onChange={(e) => setForm((p) => ({ ...p, trigger_pattern: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
                placeholder="ex: nginx, disk, cpu"
              />
            </div>
          </div>
          <div>
            <label className="block text-gray-400 text-sm mb-1">Tags (separadas por vírgula)</label>
            <input
              type="text"
              value={form.tags}
              onChange={(e) => setForm((p) => ({ ...p, tags: e.target.value }))}
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
              placeholder="nginx, web, http"
            />
          </div>
          <div>
            <label className="block text-gray-400 text-sm mb-1">Conteúdo *</label>
            <textarea
              value={form.content}
              onChange={(e) => setForm((p) => ({ ...p, content: e.target.value }))}
              rows={10}
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-emerald-500 resize-none"
              placeholder="Conteúdo do artigo em Markdown..."
              required
            />
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-gray-400 hover:text-white text-sm transition-colors">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              Criar Artigo
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const KnowledgeBase: React.FC = () => {
  const { user } = useAuthStore();
  const [articles, setArticles] = useState<Article[]>([]);
  const [categories, setCategories] = useState<string[]>(['Todos']);
  const [selectedCategory, setSelectedCategory] = useState('Todos');
  const [search, setSearch] = useState('');
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  const canCreate = user?.role === 'n2' || user?.role === 'admin';

  const fetchArticles = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (selectedCategory !== 'Todos') params.category = selectedCategory;
      const res = await knowledgeApi.getArticles(params);
      setArticles(res.data.articles || []);
      setTotal(res.data.pagination?.total || 0);
    } catch {
      setArticles([]);
    } finally {
      setLoading(false);
    }
  }, [search, selectedCategory]);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await knowledgeApi.getCategories();
      setCategories(res.data.categories || ['Todos']);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  useEffect(() => {
    const timer = setTimeout(fetchArticles, 300);
    return () => clearTimeout(timer);
  }, [fetchArticles]);

  const handleArticleClick = async (article: Article) => {
    try {
      const res = await knowledgeApi.getArticleById(article.id);
      setSelectedArticle(res.data);
    } catch {
      setSelectedArticle(article);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <BookOpen size={24} className="text-emerald-400" />
            Base de Conhecimento
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            {total} artigo{total !== 1 ? 's' : ''} disponível{total !== 1 ? 'is' : ''}
          </p>
        </div>
        {canCreate && (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus size={16} />
            Novo Artigo
          </button>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por título, conteúdo ou tags..."
          className="w-full bg-gray-800 border border-gray-700 text-white placeholder-gray-500 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
            <X size={14} />
          </button>
        )}
      </div>

      {/* Category filter */}
      <div className="flex items-center gap-2 flex-wrap">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              selectedCategory === cat
                ? 'bg-emerald-600/30 text-emerald-400 border-emerald-500/50'
                : 'bg-gray-800 text-gray-400 border-gray-700 hover:border-gray-600 hover:text-gray-300'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Articles grid */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={32} className="animate-spin text-emerald-400" />
        </div>
      ) : articles.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <FileText size={48} className="text-gray-700 mb-4" />
          <p className="text-gray-400 text-lg font-medium">Nenhum artigo encontrado</p>
          <p className="text-gray-600 text-sm mt-1">
            {search ? 'Tente uma busca diferente' : 'Nenhum artigo publicado ainda'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {articles.map((article) => (
            <div
              key={article.id}
              onClick={() => handleArticleClick(article)}
              className="bg-gray-800/60 border border-gray-700 rounded-xl p-4 cursor-pointer hover:border-emerald-500/50 hover:bg-gray-800 transition-all group"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <span className={`text-xs px-2 py-0.5 rounded border flex-shrink-0 ${getCategoryStyle(article.category)}`}>
                  {article.category}
                </span>
                <ChevronRight size={14} className="text-gray-600 group-hover:text-emerald-400 transition-colors flex-shrink-0 mt-0.5" />
              </div>

              <h3 className="text-white font-semibold text-sm leading-snug mb-2 line-clamp-2">
                {article.title}
              </h3>

              <p className="text-gray-500 text-xs leading-relaxed line-clamp-3 mb-3">
                {article.content.replace(/[#`*]/g, '').substring(0, 120)}
                {article.content.length > 120 ? '...' : ''}
              </p>

              {article.tags.length > 0 && (
                <div className="flex items-center gap-1.5 mb-3 flex-wrap">
                  {article.tags.slice(0, 3).map((tag) => (
                    <span key={tag} className="text-xs bg-gray-700 text-gray-400 px-1.5 py-0.5 rounded">
                      {tag}
                    </span>
                  ))}
                  {article.tags.length > 3 && (
                    <span className="text-xs text-gray-600">+{article.tags.length - 3}</span>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between text-gray-600 text-xs">
                <span className="flex items-center gap-1">
                  <Eye size={11} /> {article.view_count}
                </span>
                <span>{new Date(article.updated_at).toLocaleDateString('pt-BR')}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedArticle && (
        <ArticleModal article={selectedArticle} onClose={() => setSelectedArticle(null)} />
      )}
      {showCreate && (
        <CreateArticleModal onClose={() => setShowCreate(false)} onCreated={fetchArticles} />
      )}
    </div>
  );
};

export default KnowledgeBase;
