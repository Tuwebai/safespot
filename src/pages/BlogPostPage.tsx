import { useParams, Link, useNavigate } from 'react-router-dom';
import { getPostBySlug } from '@/data/blog-posts';
import { SEO } from '@/components/SEO';
import { ArrowLeft, Calendar, User, Clock, Share2, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function BlogPostPage() {
    const { slug } = useParams<{ slug: string }>();
    const navigate = useNavigate();
    const post = getPostBySlug(slug || '');

    if (!post) {
        return (
            <div className="min-h-screen bg-dark-bg flex flex-col items-center justify-center p-4">
                <h1 className="text-4xl font-bold text-white mb-4">404 - Artículo no encontrado</h1>
                <p className="text-gray-400 mb-8">El artículo que buscás no existe o fue movido.</p>
                <Button onClick={() => navigate('/blog')}>Volver al Blog</Button>
            </div>
        );
    }

    return (
        <>
            <SEO
                title={post.seoTitle}
                description={post.seoDescription}
                keywords={post.keywords}
                url={`https://safespot.tuweb-ai.com/blog/${post.slug}`}
                type="article"
            />

            <div className="min-h-screen bg-zinc-950 text-white font-sans selection:bg-neon-green/30 pb-20">
                {/* Progress Bar (Simulated or Real) could go here */}

                <header className="sticky top-0 z-50 bg-zinc-950/80 backdrop-blur-md border-b border-white/5">
                    <div className="container mx-auto px-4 py-4 flex items-center justify-between">
                        <Link to="/blog" className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors group">
                            <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
                            Volver al Blog
                        </Link>
                        <div className="flex items-center gap-2">
                            <Button variant="ghost" size="sm" className="hidden md:flex gap-2 text-gray-400 hover:text-white">
                                <Share2 className="h-4 w-4" /> Compartir
                            </Button>
                        </div>
                    </div>
                </header>

                <main className="container mx-auto px-4 py-12 max-w-3xl">

                    {/* Article Header */}
                    <div className="mb-12">
                        <div className="flex items-center gap-3 mb-6">
                            <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest bg-white/5 border border-white/10 text-neon-green">
                                {post.category}
                            </span>
                            <span className="text-gray-500 text-sm flex items-center gap-1">
                                <Clock className="h-3 w-3" /> {post.readTime} lectura
                            </span>
                        </div>

                        <h1 className="text-3xl md:text-5xl font-black tracking-tight text-white mb-8 leading-tight">
                            {post.title}
                        </h1>

                        <div className="flex items-center gap-4 border-y border-white/10 py-6">
                            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center border border-white/10 overflow-hidden">
                                {post.author.avatar ? (
                                    <img src={post.author.avatar} alt={post.author.name} className="h-full w-full object-cover" />
                                ) : (
                                    <User className="h-5 w-5 text-gray-400" />
                                )}
                            </div>
                            <div>
                                <div className="font-bold text-white text-sm">{post.author.name}</div>
                                <div className="text-xs text-gray-400">{post.author.role}</div>
                            </div>
                            <div className="ml-auto flex items-center gap-2 text-xs text-gray-500 font-mono">
                                <Calendar className="h-3 w-3" />
                                {new Date(post.date).toLocaleDateString()}
                            </div>
                        </div>
                    </div>

                    {/* Article Content - Uses SafeSpot Enterprise Typography System defined in index.css */}
                    <article className="prose-safespot">
                        {/* 
                            Dangerous HTML Used responsibly from our own Static CMS.
                        */}
                        <div dangerouslySetInnerHTML={{ __html: post.content }} />
                    </article>

                    {/* Related Links & Tags */}
                    <div className="mt-16 pt-8 border-t border-white/10">
                        <h4 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-4">Lectura Relacionada</h4>
                        <div className="flex flex-wrap gap-4">
                            {post.relatedLinks?.map((link, i) => (
                                <Link key={i} to={link.url} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 transition-colors text-sm text-neon-green font-medium">
                                    {link.label} <ArrowRight className="h-3 w-3" />
                                </Link>
                            ))}
                        </div>
                    </div>

                    <div className="mt-8 flex flex-wrap gap-2">
                        {post.keywords.map((kw, i) => (
                            <span key={i} className="px-2 py-1 rounded bg-zinc-900 text-xs text-gray-500">#{kw}</span>
                        ))}
                    </div>

                </main>
            </div>
        </>
    );
}
