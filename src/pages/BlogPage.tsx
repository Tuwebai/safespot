import { Link } from 'react-router-dom';
import { ArrowLeft, Newspaper, ArrowRight, Calendar } from 'lucide-react';
import { SEO } from '@/components/SEO';
import { BLOG_POSTS, BlogPost } from '@/data/blog-posts';
import { useState } from 'react';
import { cn } from '@/lib/utils'; // Assuming this utility exists, otherwise standard className string interpolation

export default function BlogPage() {
    const [selectedCategory, setSelectedCategory] = useState<string>('Todos');

    // Get unique categories
    const categories = ['Todos', ...Array.from(new Set(BLOG_POSTS.map(post => post.category)))];

    // Filter posts
    const filteredPosts = selectedCategory === 'Todos'
        ? BLOG_POSTS
        : BLOG_POSTS.filter(post => post.category === selectedCategory);

    // Sort by date desc (just in case)
    const sortedPosts = [...filteredPosts].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return (
        <>
            <SEO
                title="Blog SafeSpot: Noticias de Seguridad Urbana"
                description="Novedades de la plataforma SafeSpot, análisis de delincuencia en GBA y tecnología cívica para la prevención del delito."
                keywords={['blog seguridad', 'noticias safespot', 'gba norte', 'prevencion delito', 'actualizaciones']}
                url="https://safespot.tuweb-ai.com/blog"
            />
            <div className="min-h-screen bg-zinc-950 text-white font-sans selection:bg-neon-green/30">
                <header className="sticky top-0 z-50 bg-zinc-950/80 backdrop-blur-md border-b border-white/5">
                    <div className="container mx-auto px-4 py-4 flex items-center gap-4">
                        <Link to="/" className="p-2 hover:bg-white/5 rounded-full transition-colors group">
                            <ArrowLeft className="h-5 w-5 text-gray-400 group-hover:text-white transition-colors" />
                        </Link>
                        <h1 className="text-xl font-bold tracking-tight">Blog & Novedades</h1>
                    </div>
                </header>

                <main className="container mx-auto px-4 py-16 max-w-6xl">

                    <div className="text-center mb-20">
                        <div className="inline-flex items-center justify-center p-3 bg-white/5 rounded-2xl mb-6 ring-1 ring-white/10">
                            <Newspaper className="h-8 w-8 text-neon-green" />
                        </div>
                        <h1 className="text-4xl md:text-6xl font-black tracking-tighter text-white mb-6">
                            Bitácora <span className="text-transparent bg-clip-text bg-gradient-to-r from-neon-green to-emerald-600">SafeSpot</span>
                        </h1>
                        <p className="text-xl text-zinc-400 max-w-2xl mx-auto leading-relaxed">
                            Transparencia radical, datos de seguridad urbana y actualizaciones de producto. Todo lo que pasa en tu barrio, explicado.
                        </p>
                    </div>

                    {/* Filter Bar */}
                    <div className="flex flex-wrap justify-center gap-2 mb-12">
                        {categories.map((cat) => (
                            <button
                                key={cat}
                                onClick={() => setSelectedCategory(cat)}
                                className={cn(
                                    "px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 border",
                                    selectedCategory === cat
                                        ? "bg-neon-green text-black border-neon-green shadow-[0_0_15px_rgba(0,255,157,0.3)]"
                                        : "bg-white/5 text-gray-400 border-white/10 hover:bg-white/10 hover:text-white"
                                )}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>

                    {/* Grid */}
                    {sortedPosts.length > 0 ? (
                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                            {sortedPosts.map((post) => (
                                <ArticleCard key={post.id} post={post} />
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-20 border border-dashed border-white/10 rounded-2xl">
                            <p className="text-gray-500">No hay artículos en esta categoría aún.</p>
                        </div>
                    )}

                    {/* Newsletter Box */}
                    <div className="mt-24 p-8 md:p-12 bg-gradient-to-br from-zinc-900 to-black border border-white/10 rounded-3xl text-center relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-32 bg-neon-green/5 blur-3xl -z-10 transition-opacity group-hover:opacity-100 opacity-50"></div>
                        <h3 className="text-2xl font-bold text-white mb-4">Mantenete Alerta</h3>
                        <p className="text-zinc-400 max-w-md mx-auto mb-8">
                            Recibí un resumen mensual con las estadísticas de seguridad de tu zona y nuevas features de la App.
                        </p>
                        <div className="flex justify-center gap-4">
                            <button className="bg-white text-zinc-900 font-bold py-3 px-8 rounded-full hover:bg-zinc-200 transition-colors shadow-lg">
                                Suscribirse (Próximamente)
                            </button>
                        </div>
                    </div>

                    <div className="mt-20 pt-8 border-t border-white/5 flex justify-between items-center text-sm text-zinc-500">
                        <Link to="/confianza/sistema-de-confianza" className="hover:text-white transition-colors flex items-center gap-2">
                            <ArrowLeft className="h-4 w-4" /> Anterior: Sistema de Confianza
                        </Link>
                    </div>

                </main>
            </div>
        </>
    );
}

function ArticleCard({ post }: { post: BlogPost }) {
    return (
        <article className="group bg-zinc-900/50 border border-white/10 rounded-2xl overflow-hidden hover:border-neon-green/30 transition-all hover:-translate-y-1 flex flex-col h-full">
            <div className="p-6 flex-1 flex flex-col">
                <div className="flex items-center justify-between mb-4 text-xs text-zinc-500 font-mono">
                    <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {new Date(post.date).toLocaleDateString()}</span>
                    <span className="flex items-center gap-1 text-neon-green bg-neon-green/10 px-2 py-0.5 rounded border border-neon-green/20">
                        {post.category}
                    </span>
                </div>

                <h2 className="text-xl font-bold text-white mb-3 group-hover:text-neon-green transition-colors leading-tight">
                    <Link to={`/blog/${post.slug}`}>
                        {post.title}
                    </Link>
                </h2>

                <p className="text-zinc-400 text-sm mb-6 line-clamp-3 leading-relaxed flex-1">
                    {post.excerpt}
                </p>

                <div className="pt-4 border-t border-white/5 mt-auto flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-full bg-white/10 flex items-center justify-center text-[10px] text-white font-bold overflow-hidden border border-white/10">
                            {post.author.avatar ? (
                                <img src={post.author.avatar} alt={post.author.name} className="h-full w-full object-cover" />
                            ) : (
                                post.author.name.charAt(0)
                            )}
                        </div>
                        <span className="text-xs text-gray-500">{post.author.name}</span>
                    </div>
                    <Link to={`/blog/${post.slug}`} className="inline-flex items-center gap-1 text-sm font-bold text-white hover:text-neon-green transition-colors">
                        Leer <ArrowRight className="h-3 w-3" />
                    </Link>
                </div>
            </div>
        </article>
    );
}
